(() => {
  const byId = id => document.getElementById(id);
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis || null;
  const nativeSpeak = synth?.speak?.bind(synth) || null;

  let handsFree = false;
  let selectedVoiceName = "";
  try{
    handsFree = localStorage.getItem("javis_handsfree") === "1";
    selectedVoiceName = localStorage.getItem("javis_voice_name") || "";
  }catch{}

  let recognizer = null;
  let speaking = false;
  let waitingForCommand = false;
  let restartTimer = null;
  let submitTimer = null;
  let pendingCommand = "";
  let pendingConfidence = 0;
  let commandDeadline = 0;

  const SILENCE_COMMIT_MS = 700;
  const COMMAND_WINDOW_MS = 12000;
  const MIN_CONFIDENCE = 0.45;

  function saveHandsFree(){
    try{ localStorage.setItem("javis_handsfree", handsFree ? "1" : "0"); }catch{}
  }
  function saveVoice(name){
    selectedVoiceName = name || "";
    try{ localStorage.setItem("javis_voice_name", selectedVoiceName); }catch{}
  }

  function availableVoices(){
    return (synth?.getVoices?.() || []).slice();
  }

  function voiceScore(v){
    const name = String(v.name || "");
    const lang = String(v.lang || "");
    let score = 0;
    if (/^en-GB$/i.test(lang)) score += 80;
    else if (/^en-AU$/i.test(lang)) score += 45;
    else if (/^en/i.test(lang)) score += 15;
    if (/male|daniel|james|arthur|oliver|ryan|william|thomas|alex|lee|george|guy/i.test(name)) score += 55;
    if (/female|karen|samantha|victoria|olivia|moira|fiona|tessa|catherine|zira|susan/i.test(name)) score -= 80;
    if (/google|samsung|microsoft/i.test(name)) score += 5;
    return score;
  }

  function preferredVoice(){
    const voices = availableVoices();
    if(selectedVoiceName){
      const chosen = voices.find(v => v.name === selectedVoiceName);
      if(chosen) return chosen;
    }
    return voices.sort((a,b)=>voiceScore(b)-voiceScore(a))[0] || null;
  }

  function setMsg(text,bad=false){
    const msg = byId("cmdmsg");
    if(!msg) return;
    msg.textContent = text;
    msg.classList.toggle("error",bad);
  }

  function setHandsFreeUi(){
    const btn = byId("handsfree");
    if(btn){
      btn.textContent = handsFree ? "Hands-free ON" : "Hands-free";
      btn.classList.toggle("active", handsFree);
    }
    const mic = byId("mic");
    if(mic) mic.disabled = handsFree;
  }

  function createVoiceControls(){
    const command = document.querySelector("section.command");
    const textarea = byId("cmd");
    if(!command || !textarea || byId("voiceControls")) return;

    const wrap = document.createElement("div");
    wrap.id = "voiceControls";
    wrap.className = "voiceControls";
    wrap.innerHTML = `
      <label for="voiceSelect">Javis voice</label>
      <select id="voiceSelect" aria-label="Javis voice"></select>
      <button id="testVoice" class="btn ghost" type="button">Test voice</button>
      <small id="voiceHint">Choose the male voice you prefer. Javis will remember it on this phone.</small>`;
    command.insertBefore(wrap, textarea);

    byId("voiceSelect")?.addEventListener("change", e => {
      saveVoice(e.target.value);
      setMsg("Voice saved. Press Test voice to check it.");
    });
    byId("testVoice")?.addEventListener("click", () => {
      movieSpeak("Good evening. Javis online and ready.");
    });
    populateVoiceSelect();
  }

  function populateVoiceSelect(){
    const select = byId("voiceSelect");
    if(!select) return;
    const voices = availableVoices().filter(v=>/^en/i.test(v.lang || ""));
    select.innerHTML = "";
    if(!voices.length){
      const opt = document.createElement("option");
      opt.textContent = "Phone default voice";
      opt.value = "";
      select.appendChild(opt);
      return;
    }
    const sorted = voices.sort((a,b)=>voiceScore(b)-voiceScore(a));
    for(const v of sorted){
      const opt = document.createElement("option");
      opt.value = v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      select.appendChild(opt);
    }
    const chosen = preferredVoice();
    if(chosen){
      select.value = chosen.name;
      if(!selectedVoiceName) saveVoice(chosen.name);
    }
  }

  function scheduleRestart(delay=500){
    clearTimeout(restartTimer);
    if(!handsFree || speaking || document.hidden) return;
    restartTimer = setTimeout(()=>{
      try{ ensureRecognizer()?.start(); }catch{}
    }, delay);
  }

  function applyMovieVoice(u){
    const v = preferredVoice();
    if(v) u.voice = v;
    u.lang = v?.lang || "en-GB";
    u.rate = 0.90;
    u.pitch = 0.76;
    u.volume = 1;
  }

  function prepareForSpeech(u){
    speaking = true;
    clearTimeout(restartTimer);
    clearTimeout(submitTimer);
    try{ recognizer?.abort(); }catch{}
    applyMovieVoice(u);
    const oldEnd = u.onend;
    const oldError = u.onerror;
    const done = (e,old,delay) => {
      try{ old?.call(u,e); }catch{}
      speaking = false;
      scheduleRestart(delay);
    };
    u.onend = e => done(e,oldEnd,550);
    u.onerror = e => done(e,oldError,800);
  }

  if(synth && nativeSpeak){
    synth.speak = utterance => {
      prepareForSpeech(utterance);
      nativeSpeak(utterance);
    };
  }

  function movieSpeak(text){
    if(!nativeSpeak || !text) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    prepareForSpeech(u);
    nativeSpeak(u);
  }
  window.speak = movieSpeak;

  function heardWakePhrase(text){
    return /\b(?:hey\s+)?(?:javis|jarvis)\b/i.test(String(text || ""));
  }
  function cleanWakePhrase(text){
    return String(text || "")
      .replace(/^.*?\b(?:hey\s+)?(?:javis|jarvis)\b[,:\s-]*/i, "")
      .trim();
  }
  function usefulSpeech(text){
    const clean = String(text || "").trim();
    return clean.length >= 2 && /[a-z0-9]/i.test(clean);
  }
  function confidenceOk(conf){
    // Some Android speech engines report 0 when confidence is unavailable.
    return conf === 0 || conf >= MIN_CONFIDENCE;
  }

  function queueSubmit(command,confidence){
    if(!usefulSpeech(command) || !confidenceOk(confidence)){
      setMsg("I did not hear that clearly. Please say it again.");
      pendingCommand = "";
      return;
    }
    pendingCommand = command.trim();
    pendingConfidence = confidence;
    clearTimeout(submitTimer);
    setMsg("Got it. Waiting for you to finish…");
    submitTimer = setTimeout(()=>submitVoiceCommand(pendingCommand,pendingConfidence),SILENCE_COMMIT_MS);
  }

  function submitVoiceCommand(command){
    const input = byId("cmd");
    const run = byId("run");
    if(!input || !run || !command) return;
    waitingForCommand = false;
    pendingCommand = "";
    commandDeadline = 0;
    input.value = command;
    setMsg("Processing your command…");
    setTimeout(()=>run.click(), 80);
  }

  function ensureRecognizer(){
    if(recognizer || !Recognition) return recognizer;
    recognizer = new Recognition();
    recognizer.lang = "en-AU";
    recognizer.continuous = false;
    recognizer.interimResults = true;
    recognizer.maxAlternatives = 3;

    recognizer.onstart = () => {
      if(speaking) return;
      if(waitingForCommand){
        if(commandDeadline && Date.now() > commandDeadline){
          waitingForCommand = false;
          commandDeadline = 0;
        }
      }
      setMsg(waitingForCommand ? "Listening. Speak naturally…" : "Waiting for ‘Hey Javis’…");
    };

    recognizer.onresult = event => {
      if(speaking) return;
      const input = byId("cmd");
      let interim = "";
      let finalText = "";
      let bestConfidence = 0;

      for(let i=event.resultIndex;i<event.results.length;i++){
        const result = event.results[i];
        const text = String(result[0]?.transcript || "").trim();
        const confidence = Number(result[0]?.confidence || 0);
        if(result.isFinal){
          finalText = [finalText,text].filter(Boolean).join(" ").trim();
          bestConfidence = Math.max(bestConfidence,confidence);
        }else{
          interim = [interim,text].filter(Boolean).join(" ").trim();
        }
      }

      const heard = finalText || interim;
      if(waitingForCommand){
        const preview = cleanWakePhrase(heard) || heard;
        if(input && preview) input.value = preview;
        if(interim){
          setMsg("Listening: “" + preview + "”");
          return;
        }
        if(finalText){
          const command = cleanWakePhrase(finalText) || finalText;
          queueSubmit(command,bestConfidence);
        }
        return;
      }

      if(!heardWakePhrase(heard)) return;
      const afterWake = cleanWakePhrase(heard);
      if(input && afterWake) input.value = afterWake;
      if(interim){
        setMsg(afterWake ? "Wake phrase heard. Keep speaking…" : "Wake phrase heard…");
        return;
      }
      if(finalText){
        const command = cleanWakePhrase(finalText);
        if(command){
          queueSubmit(command,bestConfidence);
        }else{
          waitingForCommand = true;
          commandDeadline = Date.now() + COMMAND_WINDOW_MS;
          movieSpeak("Yes?");
        }
      }
    };

    recognizer.onerror = event => {
      if(event.error === "not-allowed" || event.error === "service-not-allowed"){
        handsFree = false;
        saveHandsFree();
        setHandsFreeUi();
        setMsg("Microphone permission is required for Hands-free mode.",true);
        return;
      }
      if(event.error === "no-speech"){
        if(handsFree && !speaking) scheduleRestart(500);
        return;
      }
      if(event.error === "audio-capture"){
        setMsg("I cannot access the microphone right now.",true);
        return;
      }
      if(handsFree && !speaking) scheduleRestart(900);
    };

    recognizer.onend = () => {
      if(handsFree && !speaking && !pendingCommand) scheduleRestart(450);
    };
    return recognizer;
  }

  function toggleHandsFree(){
    if(!Recognition){
      setMsg("Hands-free speech recognition is not available in this browser.",true);
      return;
    }
    handsFree = !handsFree;
    saveHandsFree();
    waitingForCommand = false;
    pendingCommand = "";
    clearTimeout(submitTimer);
    setHandsFreeUi();
    ensureRecognizer();
    if(handsFree){
      movieSpeak("Hands-free mode active.");
    }else{
      clearTimeout(restartTimer);
      try{ recognizer?.abort(); }catch{}
      setMsg("Hands-free mode off.");
    }
  }

  window.JavisVoice = {
    speak: movieSpeak,
    voices: availableVoices,
    getSelectedVoice: ()=>preferredVoice()?.name || "",
    isHandsFree: ()=>handsFree
  };

  window.addEventListener("load",()=>{
    createVoiceControls();
    const btn = byId("handsfree");
    if(btn) btn.addEventListener("click",toggleHandsFree);
    setHandsFreeUi();
    if(synth){
      synth.getVoices();
      synth.addEventListener?.("voiceschanged",()=>{
        populateVoiceSelect();
      });
    }
    if(handsFree && Recognition){
      ensureRecognizer();
      scheduleRestart(800);
    }
  });

  document.addEventListener("visibilitychange",()=>{
    if(document.hidden){
      clearTimeout(restartTimer);
      clearTimeout(submitTimer);
      try{ recognizer?.abort(); }catch{}
    }else if(handsFree){
      ensureRecognizer();
      scheduleRestart(400);
    }
  });
})();
