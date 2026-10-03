(() => {
  const byId = id => document.getElementById(id);
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis || null;
  const nativeSpeak = synth?.speak?.bind(synth) || null;

  let handsFree = false;
  let selectedVoiceName = "";
  try {
    handsFree = localStorage.getItem("javis_handsfree") === "1";
    selectedVoiceName = localStorage.getItem("javis_voice_name") || "";
  } catch {}

  let recognizer = null;
  let speaking = false;
  let mode = "wake";
  let draft = "";
  let restartTimer = null;
  let listening = false;

  const MIN_CONFIDENCE = 0.52;
  const SEND_RE = /(?:^|\s)(?:send it|send that|go ahead|process that|submit that|i(?:'m| am) done|that(?:'s| is) all)\s*[.!?]*$/i;
  const CANCEL_RE = /(?:^|\s)(?:cancel that|clear that|start again)\s*[.!?]*$/i;

  function telemetry(type, severity="info", message="", detail={}) {
    try { window.JavisTelemetry?.event?.(type,severity,message,detail); } catch {}
  }

  function setMsg(text,bad=false) {
    const el = byId("cmdmsg");
    if(!el) return;
    el.textContent = text;
    el.classList.toggle("error",bad);
  }

  function saveHandsFree() {
    try { localStorage.setItem("javis_handsfree", handsFree ? "1" : "0"); } catch {}
  }
  function saveVoice(name) {
    selectedVoiceName = name || "";
    try { localStorage.setItem("javis_voice_name",selectedVoiceName); } catch {}
  }

  function voices() { return (synth?.getVoices?.() || []).slice(); }
  function voiceScore(v) {
    const name=String(v.name||""), lang=String(v.lang||"").replace("_","-");
    let score=0;
    if(/^en-GB$/i.test(lang)) score+=80;
    else if(/^en-AU$/i.test(lang)) score+=55;
    else if(/^en/i.test(lang)) score+=20;
    if(/male|daniel|james|arthur|oliver|ryan|william|thomas|alex|george|guy/i.test(name)) score+=80;
    if(/female|karen|samantha|victoria|olivia|moira|fiona|tessa|catherine|zira|susan/i.test(name)) score-=100;
    return score;
  }
  function preferredVoice() {
    const list=voices();
    const chosen=list.find(v=>v.name===selectedVoiceName);
    if(chosen) return chosen;
    return list.sort((a,b)=>voiceScore(b)-voiceScore(a))[0] || null;
  }

  function populateVoiceSelect() {
    const select=byId("voiceSelect");
    if(!select) return;
    const list=voices().filter(v=>/^en/i.test(String(v.lang||""))).sort((a,b)=>voiceScore(b)-voiceScore(a));
    select.innerHTML="";
    if(!list.length) {
      const opt=document.createElement("option"); opt.value=""; opt.textContent="Phone default voice"; select.appendChild(opt); return;
    }
    for(const v of list) {
      const opt=document.createElement("option");
      opt.value=v.name; opt.textContent=`${v.name} (${String(v.lang||"").replace("_","-")})`; select.appendChild(opt);
    }
    const chosen=preferredVoice();
    if(chosen) { select.value=chosen.name; if(!selectedVoiceName) saveVoice(chosen.name); }
    const hint=byId("voiceHint");
    if(hint) hint.textContent=/male/i.test(list.map(v=>v.name).join(" ")) ? "Choose the voice you prefer. Javis remembers it on this phone." : "Your phone exposes generic voice names only. Javis can lower the pitch, but Android controls whether the installed voice is male or female.";
  }

  function applyVoice(u) {
    const v=preferredVoice();
    if(v) u.voice=v;
    u.lang=String(v?.lang||"en-GB").replace("_","-");
    u.rate=0.88;
    u.pitch=0.66;
    u.volume=1;
  }

  function scheduleRestart(delay=450) {
    clearTimeout(restartTimer);
    if(!handsFree || speaking || document.hidden) return;
    restartTimer=setTimeout(()=>{
      if(listening) return;
      try { ensureRecognizer()?.start(); } catch {}
    },delay);
  }

  function prepareSpeech(u) {
    speaking=true;
    clearTimeout(restartTimer);
    try { recognizer?.abort(); } catch {}
    applyVoice(u);
    const oldEnd=u.onend, oldError=u.onerror;
    const done=(e,old)=>{
      try { old?.call(u,e); } catch {}
      speaking=false;
      scheduleRestart(550);
    };
    u.onend=e=>done(e,oldEnd);
    u.onerror=e=>done(e,oldError);
  }

  if(synth && nativeSpeak) {
    synth.speak=utterance=>{ prepareSpeech(utterance); nativeSpeak(utterance); };
  }
  function movieSpeak(text) {
    if(!nativeSpeak || !text) return;
    synth.cancel();
    const u=new SpeechSynthesisUtterance(String(text));
    prepareSpeech(u); nativeSpeak(u);
  }
  window.speak=movieSpeak;

  function wakePhrase(text) { return /\b(?:hey\s+)?(?:javis|jarvis)\b/i.test(String(text||"")); }
  function stripWake(text) { return String(text||"").replace(/^.*?\b(?:hey\s+)?(?:javis|jarvis)\b[,:\s-]*/i,"").trim(); }
  function goodFinal(text,conf) {
    const s=String(text||"").trim();
    if(!/[a-z0-9]/i.test(s) || s.length<2) return false;
    if(conf===0) return s.split(/\s+/).length>=2 || s.length>=8;
    return conf>=MIN_CONFIDENCE;
  }
  function normaliseSpaces(s){ return String(s||"").replace(/\s+/g," ").trim(); }

  function updateDraft(preview="") {
    const input=byId("cmd");
    if(!input) return;
    const shown=normaliseSpaces([draft,preview].filter(Boolean).join(" "));
    input.value=shown;
  }

  function clearDraft(message="Draft cleared. Waiting for ‘Hey Javis’." ) {
    draft=""; mode="wake"; updateDraft(); setMsg(message);
    telemetry("voice_draft_cleared","info",message);
  }

  function submitDraft() {
    const command=normaliseSpaces(draft.replace(SEND_RE,"").trim());
    if(!command) { clearDraft(); return; }
    const run=byId("run"), input=byId("cmd");
    if(!run || !input) return;
    draft=""; mode="wake"; input.value=command;
    setMsg("Sending command…");
    telemetry("voice_submit","info","Voice command submitted.",{length:command.length});
    setTimeout(()=>run.click(),80);
  }

  function acceptFinal(text,conf) {
    let clean=normaliseSpaces(text);
    if(!clean) return;

    if(mode==="wake") {
      if(!wakePhrase(clean)) return;
      const after=stripWake(clean);
      mode="dictating";
      draft="";
      if(after && goodFinal(after,conf)) draft=after;
      updateDraft();
      setMsg(draft ? "Draft held. Keep talking, or say ‘send it’ when finished." : "Listening. Speak your command, then say ‘send it’." );
      telemetry("wake_phrase_accepted","info","Javis wake phrase accepted.",{has_command:!!draft,confidence:conf});
      if(draft && SEND_RE.test(draft)) submitDraft();
      return;
    }

    if(CANCEL_RE.test(clean)) { clearDraft(); return; }
    if(!goodFinal(clean,conf)) {
      telemetry("voice_segment_ignored","info","Low-confidence/background segment ignored.",{confidence:conf,length:clean.length});
      setMsg("I ignored an unclear sound. Your draft is still held. Keep talking or say ‘send it’." );
      return;
    }
    draft=normaliseSpaces([draft,clean].filter(Boolean).join(" "));
    updateDraft();
    if(SEND_RE.test(draft)) submitDraft();
    else setMsg("Draft held. Keep talking, or say ‘send it’ when finished." );
  }

  function ensureRecognizer() {
    if(recognizer || !Recognition) return recognizer;
    recognizer=new Recognition();
    recognizer.lang="en-AU";
    recognizer.continuous=false;
    recognizer.interimResults=true;
    recognizer.maxAlternatives=3;

    recognizer.onstart=()=>{
      listening=true;
      if(speaking) return;
      setMsg(mode==="dictating" ? "Listening. Your draft is held. Say ‘send it’ when finished." : "Waiting for ‘Hey Javis’…");
    };
    recognizer.onresult=event=>{
      if(speaking) return;
      let interim="";
      for(let i=event.resultIndex;i<event.results.length;i++) {
        const result=event.results[i];
        const text=String(result[0]?.transcript||"").trim();
        const conf=Number(result[0]?.confidence||0);
        if(result.isFinal) acceptFinal(text,conf);
        else interim=normaliseSpaces([interim,text].filter(Boolean).join(" "));
      }
      if(mode==="dictating" && interim) {
        updateDraft(interim);
        setMsg("Listening… your words are not sent until you say ‘send it’." );
      }
    };
    recognizer.onerror=event=>{
      listening=false;
      const code=String(event.error||"");
      if(code==="not-allowed" || code==="service-not-allowed") {
        handsFree=false; saveHandsFree(); setHandsFreeUi(); setMsg("Microphone permission is required for Hands-free mode.",true); return;
      }
      if(code==="audio-capture") { setMsg("Javis cannot access the microphone right now.",true); return; }
      if(!["no-speech","aborted"].includes(code)) setMsg("Voice recognition paused. Your draft is still held.");
      scheduleRestart(700);
    };
    recognizer.onend=()=>{ listening=false; scheduleRestart(500); };
    return recognizer;
  }

  function setHandsFreeUi() {
    const btn=byId("handsfree"), mic=byId("mic");
    if(btn) { btn.textContent=handsFree ? "Hands-free ON" : "Hands-free"; btn.classList.toggle("active",handsFree); }
    if(mic) mic.disabled=handsFree;
  }

  function toggleHandsFree() {
    if(!Recognition) { setMsg("Hands-free speech recognition is not available in this browser.",true); return; }
    handsFree=!handsFree; saveHandsFree(); setHandsFreeUi();
    ensureRecognizer();
    if(handsFree) {
      mode="wake"; draft=""; updateDraft();
      setMsg("Hands-free ready. Say ‘Hey Javis’. Javis stays silent until you speak." );
      scheduleRestart(150);
    } else {
      clearTimeout(restartTimer); try { recognizer?.abort(); } catch {}
      mode="wake"; draft=""; setMsg("Hands-free mode off.");
    }
  }

  function createVoiceControls() {
    const command=document.querySelector("section.command"), textarea=byId("cmd");
    if(!command || !textarea || byId("voiceControls")) return;
    const wrap=document.createElement("div");
    wrap.id="voiceControls"; wrap.className="voiceControls";
    wrap.innerHTML=`<label for="voiceSelect">Javis voice</label><select id="voiceSelect" aria-label="Javis voice"></select><button id="testVoice" class="btn ghost" type="button">Test voice</button><small id="voiceHint"></small>`;
    command.insertBefore(wrap,textarea);
    byId("voiceSelect")?.addEventListener("change",e=>{ saveVoice(e.target.value); setMsg("Voice saved. Press Test voice to check it."); });
    byId("testVoice")?.addEventListener("click",()=>movieSpeak("Javis online and ready."));
    populateVoiceSelect();
  }

  window.JavisVoice={
    speak:movieSpeak,
    voices,
    getSelectedVoice:()=>preferredVoice()?.name||"",
    isHandsFree:()=>handsFree,
    clearDraft,
    submitDraft
  };

  window.addEventListener("load",()=>{
    createVoiceControls();
    byId("handsfree")?.addEventListener("click",toggleHandsFree);
    setHandsFreeUi();
    synth?.getVoices?.();
    synth?.addEventListener?.("voiceschanged",populateVoiceSelect);
    if(handsFree && Recognition) { ensureRecognizer(); scheduleRestart(500); }
  });

  document.addEventListener("visibilitychange",()=>{
    if(document.hidden) { clearTimeout(restartTimer); try { recognizer?.abort(); } catch {} }
    else if(handsFree) { ensureRecognizer(); scheduleRestart(350); }
  });
})();
