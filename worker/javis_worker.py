from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import requests


@dataclass(frozen=True)
class Config:
    bridge_url: str
    worker_key: str
    ollama_url: str
    ollama_model: str
    poll_seconds: int

    @staticmethod
    def from_env() -> "Config":
        bridge_url = os.environ.get("JAVIS_BRIDGE_URL", "").strip().rstrip("/")
        worker_key = os.environ.get("JAVIS_WORKER_KEY", "").strip()
        if not bridge_url or not worker_key:
            raise RuntimeError("JAVIS_BRIDGE_URL and JAVIS_WORKER_KEY are required")
        return Config(
            bridge_url=bridge_url,
            worker_key=worker_key,
            ollama_url=os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434").strip().rstrip("/"),
            ollama_model=os.environ.get("OLLAMA_MODEL", "qwen2.5:7b").strip(),
            poll_seconds=max(2, int(os.environ.get("JAVIS_POLL_SECONDS", "8"))),
        )


CONSEQUENTIAL = re.compile(
    r"\b(send|email|message|call|phone|purchase|buy|pay|book|submit|apply|publish|post|delete|cancel|sign|agree|accept|transfer|refund|register)\b",
    re.IGNORECASE,
)


def bridge_get(cfg: Config, op: str, **params: str) -> dict[str, Any]:
    query = {"op": op, "key": cfg.worker_key, **params}
    response = requests.get(f"{cfg.bridge_url}?{urlencode(query)}", timeout=30)
    response.raise_for_status()
    payload = response.json()
    if not payload.get("ok"):
        raise RuntimeError(f"Bridge returned an error for {op}: {payload}")
    return payload


def ask_ollama(cfg: Config, command: str, domain: str, intent: str) -> tuple[str, str]:
    prompt = f"""You are the local reasoning worker for Javis Core.

Rules:
- This stage is read-only reasoning only. Never claim an external action was performed.
- Be concise, factual, and explicit about uncertainty.
- Do not invent customer records, emails, web results, files, or completed actions.
- If the request requires a connected app, web research, file access, or a real-world action, say exactly what capability is still required.

Domain: {domain}
Intent: {intent}
Request: {command}

Return JSON only with keys summary and detail.
"""
    response = requests.post(
        f"{cfg.ollama_url}/api/generate",
        json={"model": cfg.ollama_model, "prompt": prompt, "stream": False, "format": "json"},
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    raw = str(data.get("response", "{}")).strip()
    parsed = json.loads(raw)
    summary = str(parsed.get("summary", "Local reasoning completed.")).strip()[:1500]
    detail = str(parsed.get("detail", "")).strip()[:6500]
    return summary, detail


def complete(cfg: Config, job: dict[str, Any], status: str, summary: str, detail: str, approval_title: str = "") -> None:
    params = {
        "id": str(job["id"]),
        "cb": str(job["callback"]),
        "status": status,
        "summary": summary,
        "detail": detail,
    }
    if approval_title:
        params["approval_title"] = approval_title
    bridge_get(cfg, "complete", **params)


def process_job(cfg: Config, job: dict[str, Any]) -> None:
    command = str(job.get("command_text", "")).strip()
    domain = str(job.get("domain", "javis"))
    intent = str(job.get("intent", "general"))

    if CONSEQUENTIAL.search(command):
        complete(
            cfg,
            job,
            "needs_approval",
            "Approval required before an external or consequential action.",
            "Javis has paused this request. The local worker has not contacted anyone, spent money, submitted anything, published anything, or deleted anything.",
            "Approve consequential Javis action",
        )
        return

    try:
        summary, detail = ask_ollama(cfg, command, domain, intent)
        complete(cfg, job, "completed", summary, detail)
    except Exception as exc:
        complete(cfg, job, "failed", "Local Core worker could not complete this request.", str(exc)[:6500])


def main() -> None:
    cfg = Config.from_env()
    bridge_get(cfg, "ping")
    print("Javis Windows Core worker connected.")

    while True:
        try:
            payload = bridge_get(cfg, "pull")
            jobs = payload.get("jobs") or []
            for job in jobs:
                process_job(cfg, job)
            if not jobs:
                time.sleep(cfg.poll_seconds)
        except KeyboardInterrupt:
            break
        except Exception as exc:
            print(f"Worker error: {exc}")
            try:
                bridge_get(cfg, "heartbeat", phase="idle", summary="Windows worker recovering from a polling error.")
            except Exception:
                pass
            time.sleep(max(cfg.poll_seconds, 10))


if __name__ == "__main__":
    main()
