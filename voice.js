(() => {
  const byId = id => document.getElementById(id);
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis || null;
  const nativeSpeak = synth?.speak?.bind(synth) || null;
  let handsFree = false;
  let recognizer = null;
  let speaking = false;
  let waitingForCommand = false;
  let restartTimer = null;

  function availableVoices(){
    return (synth?.getVoices?.() || []);
  }

  function voiceScore(v){
    const name = String(v.name || "");
    const lang = String(v.lang || "");
    let score = 0;
    if (/^en-GB$/i.test(lang)) score += 60;
    else if (/^en-AU$/i.test(lang)) score += 35;
    else if (/^en/i.test(lang)) score += 10;
    if (/male|daniel|james|arthur|oliver|ryan|william|thomas|alex|lee/i.test(name)) score += 40;
    if (/female|karen|samantha|victoria|olivia|moira|fiona|tessa|catherine/i.test(name)) score -= 50;
    if (/google|samsung|microsoft/i.test(name)) score += 5;
    return score;
  }

  function preferredVoice(){
    const voices = availableVoices();
    return voices.sort((a,b)=>voiceScore(b)-voiceScore(a))[0] || null;
  }

  function setHandsFreeUi(){
    const btn = byId("handsfree");
    if(!btn) return;
    btn.textContent = handsFree ? "Hands-free ON" : "Hands-free";
    btn.classList.toggle("active", handsFree);
  }

  function scheduleRestart(delay=450){
    clearTimeout(restartTimer);
    if(!handsFree || speaking || document.hidden) return;
    restartTimer = setTimeout(()=>{
      try{ recognizer?.start(); }catch{}
    }, delay);
  }

  function applyMovieVoice(u){
    const v = preferredVoice();
    if(v) u.voice = v;
    u.lang = v?.lang || "en-GB";
    u.rate = 0.90;
    u.pitch = 0.78;
    u.volume = 1;
  }

  function prepareForSpeech(u){
    speaking = true;
    try{ recognizer?.abort(); }catch{}
    applyMovieVoice(u);
    const oldEnd = u.onend;
    const oldError = u.onerror;
    u.onend = e => {
      try{ oldEnd?.call(u,e); }catch{}
      speaking = false;
      scheduleRestart(500);
    };
    u.onerror = e => {
      try{ oldError?.call(u,e); }catch{}
      speaking = false;
      scheduleRestart(700);
    };
  }

  // Ensure every existing Javis spoken reply gets the same movie-style voice profile.
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

  function cleanWakePhrase(text){
    return String(text || "")
      .replace(/^.*?\b(?:hey\s+)?(?:javis|jarvis)\b[,:\s-]*/i, "")
      .trim();
  }

  function heardWakePhrase(text){
    return /\b(?:hey\s+)?(?:javis|jarvis)\b/i.test(String(text || ""));
  }

  function submitVoiceCommand(command){
    const input = byId("cmd");
    const run = byId("run");
    if(!input || !run || !command) return;
    waitingForCommand = false;
    input.value = command;
    movieSpeak("Understood.");
    setTimeout(()=>run.click(), 300);
  }

  function ensureRecognizer(){
    if(recognizer || !Recognition) return recognizer;
    recognizer = new Recognition();
    recognizer.lang = "en-AU";
    recognizer.continuous = false;
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 3;

    recognizer.onstart = () => {
      const msg = byId("cmdmsg");
      if(handsFree && msg && !speaking) msg.textContent = waitingForCommand ? "Listening for your command…" : "Waiting for ‘Hey Javis’…";
    };

    recognizer.onresult = event => {
      if(speaking) return;
      const alternatives = [];
      const result = event.results?.[event.results.length-1];
      if(result){
        for(let i=0;i<result.length;i++) alternatives.push(result[i].transcript || "");
      }
      const phrase = alternatives.find(heardWakePhrase) || alternatives[0] || "";
      if(waitingForCommand){
        const command = cleanWakePhrase(phrase) || phrase.trim();
        if(command) submitVoiceCommand(command);
        return;
      }
      if(heardWakePhrase(phrase)){
        const command = cleanWakePhrase(phrase);
        if(command){
          submitVoiceCommand(command);
        }else{
          waitingForCommand = true;
          movieSpeak("Yes?");
        }
      }
    };

    recognizer.onerror = event => {
      if(event.error === "not-allowed" || event.error === "service-not-allowed"){
        handsFree = false;
        setHandsFreeUi();
        const msg = byId("cmdmsg");
        if(msg) msg.textContent = "Microphone permission is required for Hands-free mode.";
        return;
      }
      if(handsFree && !speaking) scheduleRestart(800);
    };

    recognizer.onend = () => {
      if(handsFree && !speaking) scheduleRestart();
    };
    return recognizer;
  }

  function toggleHandsFree(){
    if(!Recognition){
      const msg = byId("cmdmsg");
      if(msg) msg.textContent = "Hands-free speech recognition is not available in this browser.";
      return;
    }
    handsFree = !handsFree;
    waitingForCommand = false;
    setHandsFreeUi();
    ensureRecognizer();
    if(handsFree){
      movieSpeak("Hands-free mode active.");
    }else{
      clearTimeout(restartTimer);
      try{ recognizer?.abort(); }catch{}
      const msg = byId("cmdmsg");
      if(msg) msg.textContent = "Hands-free mode off.";
    }
  }

  window.addEventListener("load",()=>{
    const btn = byId("handsfree");
    if(btn) btn.addEventListener("click", toggleHandsFree);
    if(synth){
      synth.getVoices();
      synth.addEventListener?.("voiceschanged",()=>synth.getVoices(),{once:true});
    }
  });

  document.addEventListener("visibilitychange",()=>{
    if(document.hidden){
      try{ recognizer?.abort(); }catch{}
    }else if(handsFree){
      scheduleRestart(300);
    }
  });
})();
