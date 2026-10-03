"""Reusable local voice interfaces for Javis Core.

No recording, transcript, synthetic voice, or wake-word event is authority to approve
a consequential action. Voice modules only capture and present conversational turns.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class SpeechInput:
    text: str
    confidence: float | None = None
    locale: str = "en-AU"


class SpeechToText(Protocol):
    def listen_once(self) -> SpeechInput:
        """Capture one local utterance and return text."""


class TextToSpeech(Protocol):
    def speak(self, text: str) -> None:
        """Speak non-sensitive response text locally."""


class TurnTaking(Protocol):
    def wait_for_turn(self) -> None:
        """Wait without stealing focus or treating ambient audio as approval."""

    def stop_output(self) -> None:
        """Stop speech promptly when the user interrupts."""


@dataclass
class VoiceSession:
    stt: SpeechToText
    tts: TextToSpeech
    turns: TurnTaking

    def capture_text(self) -> str:
        self.turns.wait_for_turn()
        return self.stt.listen_once().text.strip()

    def say(self, text: str) -> None:
        if text.strip():
            self.tts.speak(text.strip())
