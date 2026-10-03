(() => {
  const TELEMETRY_API = "https://puurdihdaplegdndxbho.supabase.co/functions/v1/javis-telemetry";
  const QUEUE_KEY = "javis_telemetry_queue_v1";
  const SESSION_KEY = "javis_client_session_v1";
  const nativeFetch = window.fetch.bind(window);
  let flushing = false;
  let sessionId = "";

  try {
    sessionId = sessionStorage.getItem(SESSION_KEY) || crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  } catch {
    sessionId = String(Date.now()) + "-" + Math.random().toString(16).slice(2);
  }

  function readQueue() {
    try {
      const value = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }
  function writeQueue(items) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-80))); } catch {}
  }
  function queue(event_type, severity="info", message="", detail={}) {
    const items = readQueue();
    items.push({
      session_id: sessionId,
      event_type: String(event_type || "unknown").slice(0,120),
      severity: ["info","warning","error"].includes(severity) ? severity : "info",
      message: String(message || "").slice(0,1000),
      detail: detail && typeof detail === "object" ? detail : {},
      client_time: new Date().toISOString()
    });
    writeQueue(items);
    scheduleFlush(250);
  }

  async function flush() {
    if (flushing || !navigator.onLine) return;
    const items = readQueue();
    if (!items.length) return;
    let accessToken = "";
    try {
      const saved = JSON.parse(localStorage.getItem("javis_session") || "null");
      accessToken = saved?.access_token || "";
    } catch {}
    if (!accessToken) return;
    flushing = true;
    const batch = items.slice(0,40);
    try {
      const response = await nativeFetch(TELEMETRY_API, {
        method: "POST",
        headers: {"Content-Type":"application/json","Authorization":"Bearer "+accessToken},
        body: JSON.stringify({events:batch})
      });
      if (response.ok) writeQueue(items.slice(batch.length));
    } catch {}
    finally { flushing = false; }
  }
  let flushTimer = null;
  function scheduleFlush(delay=1000) {
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, delay);
  }

  window.JavisTelemetry = { event: queue, flush, sessionId };

  window.addEventListener("error", e => {
    queue("javascript_error","error",String(e.message || "JavaScript error"),{
      filename:String(e.filename || "").split("/").pop(),
      line:Number(e.lineno || 0),
      column:Number(e.colno || 0)
    });
  });
  window.addEventListener("unhandledrejection", e => {
    const reason = e.reason instanceof Error ? e.reason.message : String(e.reason || "Unhandled promise rejection");
    queue("unhandled_rejection","error",reason.slice(0,1000));
  });
  window.addEventListener("online",()=>queue("network_online","info","Phone returned online."));
  window.addEventListener("offline",()=>queue("network_offline","warning","Phone went offline."));
  document.addEventListener("visibilitychange",()=>queue("visibility_change","info",document.hidden?"App moved to background.":"App returned to foreground.",{hidden:document.hidden}));

  window.fetch = async (...args) => {
    const start = performance.now();
    let action = "";
    let url = "";
    try {
      url = typeof args[0] === "string" ? args[0] : String(args[0]?.url || "");
      const init = args[1] || {};
      if (url.includes("/functions/v1/javis-api") && typeof init.body === "string") {
        action = String(JSON.parse(init.body)?.action || "");
      }
    } catch {}
    try {
      const response = await nativeFetch(...args);
      if (url.includes("/functions/v1/javis-api")) {
        const duration_ms = Math.round(performance.now()-start);
        queue(response.ok?"api_request":"api_error",response.ok?"info":"error",response.ok?"Javis API request completed.":"Javis API request failed.",{
          action,status:response.status,duration_ms
        });
      }
      return response;
    } catch (error) {
      if (url.includes("/functions/v1/javis-api")) {
        queue("api_network_error","error",error instanceof Error?error.message:"Network request failed.",{action,duration_ms:Math.round(performance.now()-start)});
      }
      throw error;
    }
  };

  const NativeRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (NativeRecognition) {
    function MonitoredRecognition(...args) {
      const recognizer = new NativeRecognition(...args);
      recognizer.addEventListener?.("start",()=>queue("voice_listen_start","info","Speech recognition started.",{lang:recognizer.lang || ""}));
      recognizer.addEventListener?.("end",()=>queue("voice_listen_end","info","Speech recognition ended."));
      recognizer.addEventListener?.("error",e=>{
        const code=String(e.error || "unknown");
        queue("voice_error",/[a-z]/.test(code)&&!["no-speech","aborted"].includes(code)?"warning":"info","Speech recognition event: "+code,{code});
      });
      recognizer.addEventListener?.("result",e=>{
        let finals=0,interims=0,maxConfidence=0,totalLength=0,wake=false;
        for(let i=e.resultIndex||0;i<e.results.length;i++){
          const result=e.results[i];
          const text=String(result?.[0]?.transcript || "");
          totalLength += text.length;
          maxConfidence=Math.max(maxConfidence,Number(result?.[0]?.confidence || 0));
          if(/\b(?:hey\s+)?(?:javis|jarvis)\b/i.test(text)) wake=true;
          if(result.isFinal) finals++; else interims++;
        }
        queue("voice_result","info","Speech recognition produced a result.",{finals,interims,max_confidence:maxConfidence,transcript_length:totalLength,wake_phrase:wake});
      });
      return recognizer;
    }
    try { Object.setPrototypeOf(MonitoredRecognition, NativeRecognition); MonitoredRecognition.prototype = NativeRecognition.prototype; } catch {}
    if (window.SpeechRecognition) window.SpeechRecognition = MonitoredRecognition;
    if (window.webkitSpeechRecognition) window.webkitSpeechRecognition = MonitoredRecognition;
  }

  const synth = window.speechSynthesis;
  if (synth?.speak) {
    const originalSpeak = synth.speak.bind(synth);
    synth.speak = utterance => {
      const text=String(utterance?.text || "");
      const voice=utterance?.voice;
      const suppress=/^(?:Yes\?|Hands-free mode active\.)$/i.test(text.trim());
      queue(suppress?"tts_prompt_suppressed":"tts_speak","info",suppress?"Unwanted hands-free prompt suppressed.":"Javis spoke a response.",{
        voice_name:String(voice?.name || ""),voice_lang:String(voice?.lang || utterance?.lang || ""),rate:Number(utterance?.rate || 1),pitch:Number(utterance?.pitch || 1),text_length:text.length
      });
      if(suppress){
        setTimeout(()=>{ try{ utterance?.onend?.(new Event("end")); }catch{} },0);
        return;
      }
      return originalSpeak(utterance);
    };
  }

  function reportVoices(){
    try{
      const voices=(speechSynthesis?.getVoices?.() || []).filter(v=>/^en/i.test(v.lang || ""));
      queue("voice_inventory","info","English phone voices detected.",{
        count:voices.length,
        voices:voices.slice(0,30).map(v=>({name:String(v.name || "").slice(0,120),lang:String(v.lang || "").slice(0,30),default:!!v.default})),
        saved_voice:(()=>{try{return localStorage.getItem("javis_voice_name") || ""}catch{return ""}})()
      });
    }catch{}
  }

  window.addEventListener("load", async()=>{
    let cachesFound=[];
    try{ cachesFound=await caches.keys(); }catch{}
    queue("page_load","info","Javis app loaded on phone/browser.",{
      user_agent:navigator.userAgent.slice(0,300),
      platform:String(navigator.platform || "").slice(0,80),
      online:navigator.onLine,
      standalone:!!window.matchMedia?.("(display-mode: standalone)")?.matches,
      service_worker:!!navigator.serviceWorker?.controller,
      caches:cachesFound.slice(0,10)
    });
    reportVoices();
    setTimeout(flush,500);
  });
  synth?.addEventListener?.("voiceschanged",reportVoices);

  setInterval(()=>{
    if(!document.hidden) queue("heartbeat","info","Javis phone app active.",{online:navigator.onLine});
    flush();
  },60000);
  setInterval(flush,15000);
})();
