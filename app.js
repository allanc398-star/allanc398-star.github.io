const API="https://puurdihdaplegdndxbho.supabase.co/functions/v1/javis-api";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let session=null,lastData=null,listening=false,recognition=null,installPrompt=null;

function saveSession(s){session=s||null;if(s)localStorage.setItem("javis_session",JSON.stringify(s));else localStorage.removeItem("javis_session")}
function loadSession(){try{session=JSON.parse(localStorage.getItem("javis_session")||"null")}catch{session=null}}
async function call(action,payload={},auth=true,retry=true){
  if(auth&&session?.expires_at&&Date.now()/1000>session.expires_at-90&&session.refresh_token)await refreshSession();
  const headers={"Content-Type":"application/json"};if(auth&&session?.access_token)headers.Authorization="Bearer "+session.access_token;
  const r=await fetch(API,{method:"POST",headers,body:JSON.stringify({action,...payload})});
  const data=await r.json().catch(()=>({ok:false,error:"Invalid server response."}));
  if(r.status===401&&auth&&retry&&session?.refresh_token){await refreshSession();return call(action,payload,auth,false)}
  if(!r.ok||!data.ok)throw new Error(data.error||"Request failed.");
  return data;
}
async function refreshSession(){if(!session?.refresh_token)throw new Error("Sign in again.");const d=await call("refresh",{refresh_token:session.refresh_token},false,false);saveSession(d.session)}
function showAuth(on){$("login").classList.toggle("hide",on);$("app").classList.toggle("hide",!on)}
function notice(text,bad=false){$("cmdmsg").textContent=text;$("cmdmsg").classList.toggle("error",bad)}
function setNetwork(){const online=navigator.onLine;$("netBadge").textContent=online?"ONLINE":"OFFLINE";$("netBadge").classList.toggle("offline",!online)}
const projectCommand=key=>({
  "townsville-trip":"Check and update my Townsville road trip status and tell me what changed.",
  "starlink-mini":"Review my Starlink Mini decision and update the current recommendation.",
  "qcs-career":"Check current QCS career readiness and recruitment changes relevant to me.",
  "money-ops":"Catch me up on MONEY OPS and continue the highest-value next step.",
  "project-catchup":"Catch up my active projects, including ThinkLink, Learning Lab, RPL, Cert IV, vehicle and Javis."
}[key]||"Check this project and update its status.");
function speak(text){if(!("speechSynthesis"in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="en-AU";speechSynthesis.speak(u)}
function statusSummary(){if(!lastData)return"Javis is online.";const open=(lastData.tasks||[]).filter(x=>!x.done).length,pending=(lastData.commands||[]).filter(x=>["pending","running"].includes(x.status)).length,verified=(lastData.learnings||[]).filter(x=>x.verification_status==="verified").length;return`Javis online. ${lastData.streams?.length||0} project streams, ${pending} commands in progress, ${open} open tasks, and ${verified} verified learnings.`}

async function signIn(){try{$("authmsg").textContent="Signing in…";const d=await call("signin",{email:$("email").value.trim(),password:$("password").value},false);saveSession(d.session);showAuth(true);$("password").value="";await loadDashboard()}catch(e){$("authmsg").textContent=e.message}}
async function signUp(){try{$("authmsg").textContent="Creating login…";const d=await call("signup",{email:$("email").value.trim(),password:$("password").value},false);if(d.session){saveSession(d.session);showAuth(true);await loadDashboard()}$("authmsg").textContent=d.message||"Login created."}catch(e){$("authmsg").textContent=e.message}}
async function signOut(){saveSession(null);lastData=null;showAuth(false)}

async function loadDashboard(){try{const d=await call("dashboard");lastData=d;render(d);notice("Ready.");return d}catch(e){notice(e.message,true);if(/auth|sign in|expired/i.test(e.message)){saveSession(null);showAuth(false)}}}
function render(d){
  $("mStreams").textContent=d.streams.length;
  $("mCommands").textContent=d.commands.filter(x=>["pending","running"].includes(x.status)).length;
  $("mTasks").textContent=d.tasks.filter(x=>!x.done).length;
  $("mLearn").textContent=d.learnings.filter(x=>x.verification_status==="verified").length;
  $("streams").innerHTML=d.streams.length?d.streams.map(x=>`<div class="item"><div class="row"><strong>${esc(x.title)}</strong><span class="status">${esc(x.status)}</span></div><p>${esc(x.summary)}</p>${x.next_action?`<small>Next: ${esc(x.next_action)}</small>`:""}${x.blocker?`<em>Blocker: ${esc(x.blocker)}</em>`:""}<div class="miniActions"><button class="miniBtn" data-check="${esc(x.key)}">Check now</button></div></div>`).join(""):'<div class="empty">No project streams yet.</div>';
  $("commands").innerHTML=d.commands.length?d.commands.map(x=>`<div class="item"><div class="row"><strong>${esc((x.domain||"javis").replaceAll("-"," "))}</strong><span class="status ${esc(x.status)}">${esc(x.status)}</span></div><p>${esc(x.command_text)}</p>${x.result_summary?`<em>${esc(x.result_summary)}</em>`:""}${x.result_detail?`<details><summary>Full result</summary><div class="resultDetail">${esc(x.result_detail)}</div></details>`:""}${x.completed_at?`<small>Completed: ${new Date(x.completed_at).toLocaleString("en-AU")}</small>`:""}${x.error_text?`<small class="error">${esc(x.error_text)}</small>`:""}</div>`).join(""):'<div class="empty">No cloud commands yet.</div>';
  $("tasks").innerHTML=d.tasks.length?d.tasks.map(x=>`<div class="item row"><label class="taskLabel ${x.done?"taskDone":""}"><input data-task="${x.id}" type="checkbox" ${x.done?"checked":""}><span>${esc(x.text)}</span></label><button data-del="${x.id}" class="btn ghost">Delete</button></div>`).join(""):'<div class="empty">No tasks yet.</div>';
  $("learnings").innerHTML=d.learnings.length?d.learnings.slice(0,16).map(x=>`<div class="item"><div class="row"><strong>${esc(x.domain)}</strong><span class="status">${esc(x.verification_status)}</span></div><p>${esc(x.statement)}</p><small>${esc(x.source)} · ${esc(x.confidence)}%</small></div>`).join(""):'<div class="empty">No learning records yet.</div>';
  $("feedback").innerHTML=d.feedback.length?d.feedback.map(x=>`<div class="item"><div class="row"><strong>${esc(x.tester)}</strong><span class="status ${esc(x.status)}">${esc(x.status)}</span></div><p>${esc(x.feedback_text)}</p><small>${esc(x.build_version||"")} ${esc(x.subject_area||"")} ${esc(x.game_area||"")}</small></div>`).join(""):'<div class="empty">No tester feedback yet.</div>';
  document.querySelectorAll("[data-task]").forEach(el=>el.onchange=async e=>{try{await call("toggle_task",{id:e.target.dataset.task,done:e.target.checked});await loadDashboard()}catch(err){notice(err.message,true)}});
  document.querySelectorAll("[data-del]").forEach(el=>el.onclick=async e=>{try{await call("delete_task",{id:e.target.dataset.del});await loadDashboard()}catch(err){notice(err.message,true)}});
  document.querySelectorAll("[data-check]").forEach(el=>el.onclick=async e=>{const key=e.target.dataset.check;try{e.target.disabled=true;notice("Queuing project check…");const d=await call("queue_command",{command:projectCommand(key)});notice(d.message||"Project check queued.");await loadDashboard()}catch(err){notice(err.message,true)}finally{e.target.disabled=false}});
  $("refreshed").textContent=new Date().toLocaleTimeString("en-AU",{hour:"2-digit",minute:"2-digit"});
}

async function runCommand(){
  const text=$("cmd").value.trim();if(!text)return;
  $("run").disabled=true;notice("Working…");
  try{
    const low=text.toLowerCase().trim();
    if(["status","javis status","system status","catch me up"].includes(low)){const s=statusSummary();notice(s);speak(s)}
    else if(low.startsWith("task:")){await call("add_task",{text:text.slice(5).trim()});notice("Task saved.");}
    else if(low.startsWith("remember:")||low.startsWith("note:")){await call("add_note",{text:text.slice(text.indexOf(":")+1).trim()});notice("Note saved.");}
    else if(low.startsWith("learn:")||low.startsWith("correction:")){await call("add_learning",{statement:text.slice(text.indexOf(":")+1).trim(),kind:low.startsWith("correction:")?"correction":"observation"});notice("Learning saved for verification.");}
    else{const d=await call("queue_command",{command:text});notice(d.message||"Queued for Javis.");}
    $("cmd").value="";await loadDashboard();
  }catch(e){notice(e.message,true)}finally{$("run").disabled=false}
}

function startMic(){
  const R=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!R){notice("Browser voice dictation is unavailable here. Type instead.",true);return}
  if(!recognition){recognition=new R();recognition.lang="en-AU";recognition.interimResults=false;recognition.continuous=false;recognition.onstart=()=>{listening=true;$("mic").textContent="Stop mic";notice("Listening…")};recognition.onresult=e=>{$("cmd").value=e.results[0][0].transcript;notice("Voice captured. Review it, then run command.")};recognition.onerror=e=>notice("Microphone: "+e.error,true);recognition.onend=()=>{listening=false;$("mic").textContent="Mic"}}
  if(listening)recognition.stop();else try{recognition.start()}catch(e){notice(e.message,true)}
}

$("signin").onclick=signIn;$("signup").onclick=signUp;$("logout").onclick=signOut;$("run").onclick=runCommand;$("mic").onclick=startMic;$("speak").onclick=()=>speak($("cmd").value.trim()||statusSummary());
$("refresh").onclick=async()=>{notice("Refreshing…");await loadDashboard()};
$("install").onclick=async()=>{if(!installPrompt){notice("Use your browser's Add to Home Screen option to install Javis.");return}installPrompt.prompt();const choice=await installPrompt.userChoice;notice(choice.outcome==="accepted"?"Javis install accepted.":"Install cancelled.");installPrompt=null;$("install").classList.add("hide")};
$("addTask").onclick=async()=>{const text=$("task").value.trim();if(!text)return;try{await call("add_task",{text});$("task").value="";await loadDashboard()}catch(e){notice(e.message,true)}};
$("cmd").onkeydown=e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey))runCommand()};$("password").onkeydown=e=>{if(e.key==="Enter")signIn()};
loadSession();if(session){showAuth(true);loadDashboard()}else showAuth(false);
setInterval(()=>{if(session)loadDashboard()},30000);