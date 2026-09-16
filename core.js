/* core.js — helpers, storage, state, settings, sync, markdown, router */

const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36);
const fmt=s=>{s=Math.max(0,Math.floor(s||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=s%60;return (h?h+':':'')+`${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dateS=t=>new Date(t).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const go=path=>{location.hash='#'+path};
let toastT;function toast(msg,kind){document.getElementById('toast')?.remove();const d=document.createElement('div');d.id='toast';d.className='toast '+(kind||'');d.textContent=msg;document.body.appendChild(d);clearTimeout(toastT);toastT=setTimeout(()=>d.remove(),kind==='err'?8000:3500)}

/* ------------------------------ storage ---------------------------------- */
const STORES=['courses','sections','lectures','chats','quizzes','assignments','cards'];   // synced
const LOCAL_STORES=['audio','tombstones','meta'];                                          // local only
const DB={
  db:null,
  open(){return new Promise((res,rej)=>{const r=indexedDB.open('lecthread',3);
    r.onupgradeneeded=e=>{const d=e.target.result;for(const s of [...STORES,...LOCAL_STORES]) if(!d.objectStoreNames.contains(s)) d.createObjectStore(s,{keyPath:'id'})};
    r.onsuccess=e=>{DB.db=e.target.result;res()};r.onerror=e=>rej(e.target.error)})},
  tx(store,mode,fn){return new Promise((res,rej)=>{const t=DB.db.transaction(store,mode);const req=fn(t.objectStore(store));t.oncomplete=()=>res(req&&req.result);t.onerror=e=>rej(e.target.error)})},
  all(s){return DB.tx(s,'readonly',o=>o.getAll())},
  get(s,id){return DB.tx(s,'readonly',o=>o.get(id))},
  putRaw(s,obj){return DB.tx(s,'readwrite',o=>o.put(obj))},
  delRaw(s,id){return DB.tx(s,'readwrite',o=>o.delete(id))},
  // synced writes: stamp `updated`, remember as dirty, kick the sync
  async put(s,obj){obj.updated=Date.now();await DB.putRaw(s,obj);if(STORES.includes(s))SYNC.markDirty(s,obj.id);return obj},
  async del(s,id){await DB.delRaw(s,id);if(STORES.includes(s)){await DB.putRaw('tombstones',{id,store:s,updated:Date.now()});SYNC.markDirty('tombstones',id)}},
};

/* -------------------------------- state ---------------------------------- */
const S={courses:[],sections:[],lectures:[],quizzes:[],assignments:[],cards:[],settings:null};
async function loadAll(){
  [S.courses,S.sections,S.lectures,S.quizzes,S.assignments,S.cards]=await Promise.all(['courses','sections','lectures','quizzes','assignments','cards'].map(DB.all));
  S.courses.sort((a,b)=>a.name.localeCompare(b.name));
  S.sections.sort((a,b)=>(a.order??0)-(b.order??0)||a.name.localeCompare(b.name,undefined,{numeric:true}));
  S.lectures.sort((a,b)=>b.created-a.created);
  S.quizzes.sort((a,b)=>b.created-a.created);
  S.assignments.sort((a,b)=>b.created-a.created);
}
const course=id=>S.courses.find(c=>c.id===id),section=id=>S.sections.find(s=>s.id===id),lecture=id=>S.lectures.find(l=>l.id===id);
const lecLabel=l=>[course(l.courseId)?.name,section(l.sectionId)?.name,l.title].filter(Boolean).join(' · ');

/* ------------------------------- settings -------------------------------- */
const settingsDefault={provider:'backrow',geminiKey:'',geminiModel:'gemini-flash-latest',anthropicKey:'',anthropicModel:'claude-sonnet-5',
  oaiUrl:'https://api.groq.com/openai/v1',oaiKey:'',oaiModel:'llama-3.3-70b-versatile',ollamaUrl:'http://localhost:11434',ollamaModel:'llama3.1',
  lang:'en-US',whisper:'onnx-community/whisper-base',autoNotes:true,supabaseUrl:'https://vjxevxlxjjwkpqnoytds.supabase.co',supabaseKey:'sb_publishable_1WOx_Mh4SjfsP9MPaVVFmQ_SQ5CmlLz',bridgeUrl:'http://localhost:8790/v1',claudeModel:'sonnet'};
function loadSettings(){try{S.settings={...settingsDefault,...JSON.parse(localStorage.getItem('lt.settings')||'{}')}}catch{S.settings={...settingsDefault}}
  const mig={'gemini-2.5-flash':'gemini-flash-latest','gemini-2.5-flash-lite':'gemini-flash-lite-latest','gemini-2.5-pro':'gemini-pro-latest'};if(mig[S.settings.geminiModel]){S.settings.geminiModel=mig[S.settings.geminiModel];saveSettings()}
  if(!S.settings.supabaseUrl||!S.settings.supabaseKey){S.settings.supabaseUrl=settingsDefault.supabaseUrl;S.settings.supabaseKey=settingsDefault.supabaseKey;saveSettings()}}
function saveSettings(){localStorage.setItem('lt.settings',JSON.stringify(S.settings))}

/* --------------------------- corpus builders ----------------------------- */
function lineKind(l,i){for(const b of (l.topics||[])){if(i>=b.start&&i<=b.end)return b.kind}return 'content'}
function transcriptText(l,label,opts={}){
  const head=label?`=== ${label} ===\n`:'';if(!l.segments?.length)return head+'(no transcript)';
  const skip=!opts.full&&(l.topics||[]).length>0;let out=[],dropped=0;
  l.segments.forEach((s,i)=>{const k=skip?lineKind(l,i):'content';
    if(k==='tangent'){dropped++;const b=(l.topics||[]).find(b=>i>=b.start&&i<=b.end);if(i===b.start)out.push(`[${fmt(s.t)}] (off-topic tangent skipped: ${b.label||'not course material'})`);return}
    out.push(`${opts.index?'#'+i+' ':''}[${fmt(s.t)}] ${k==='logistics'?'{logistics} ':''}${s.text}`)});
  return head+out.join('\n');
}
function scopeLectures(scope,id){
  let list;if(scope==='lecture')list=[lecture(id)];else if(scope==='section')list=S.lectures.filter(l=>l.sectionId===id);else list=S.lectures.filter(l=>l.courseId===id);
  return list.filter(l=>l&&l.segments?.length).sort((a,b)=>a.created-b.created);
}
function corpusText(list,budget=600000){
  let total=list.reduce((a,l)=>a+transcriptText(l).length,0),out=[];
  for(const l of list){const label=list.length>1?lecLabel(l):null;const tx=transcriptText(l,label);
    if(total<=budget||!l.notes)out.push(tx);else out.push((label?`=== ${label} (structured notes — transcript too long to include) ===\n`:'')+l.notes)}
  return out.join('\n\n');
}
function courseContext(courseId,{full=false}={}){const c=course(courseId);if(!c)return '';const parts=[];
  if(c.syllabusSummary)parts.push(`COURSE: ${c.name}. ${c.syllabusSummary}`);
  if(c.profile){const p=c.profile;const bits=[['Grading',p.grading],['Exams',p.exams],['Textbook',p.textbook],['Rules',p.rules]].filter(x=>x[1]).map(x=>`${x[0]}: ${x[1]}`);if(bits.length)parts.push(`CLASS PROFILE — ${bits.join(' · ')}`)}
  if(c.memory)parts.push(`WHERE THE COURSE IS SO FAR (kept up to date after each lecture): ${c.memory}`);
  if(full&&c.syllabus)parts.push(`SYLLABUS (verbatim, for dates, policies and reading lists):\n${c.syllabus.slice(0,12000)}`);
  const secs=S.sections.filter(s=>s.courseId===courseId).map(s=>s.name);if(secs.length)parts.push(`Units in this course, in order: ${secs.join(' → ')}`);
  return parts.length?'\n'+parts.join('\n')+'\n':''}
function vocabFor(courseId){const v=(course(courseId)?.vocab||'').trim();return v?`\nSpelling guide — the professor and these terms are spelled exactly like this (captions may have misheard them): ${v}\n`:''}
const CITE_RULE=multi=>multi?'Cite the exact moment with the lecture title and time like [Lecture 6 — Kant @ 18:24] (title exactly as given in the === header ===, then " @ ", then mm:ss).':'Cite the moment it was said with [mm:ss] markers, e.g. [18:24].';

/* -------------------------------- sync ----------------------------------- */
const SYNC={
  client:null,user:null,timer:null,state:'off',msg:'',lastPull:0,
  dirty(){try{return JSON.parse(localStorage.getItem('lt.dirty')||'[]')}catch{return[]}},
  setDirty(a){localStorage.setItem('lt.dirty',JSON.stringify(a))},
  markDirty(store,id){const d=SYNC.dirty();if(!d.some(x=>x.store===store&&x.id===id)){d.push({store,id});SYNC.setDirty(d)}SYNC.schedule()},
  configured(){return !!(S.settings.supabaseUrl&&S.settings.supabaseKey&&window.supabase)},
  async init(){
    if(!SYNC.configured()){SYNC.state='off';return}
    try{SYNC.client=window.supabase.createClient(S.settings.supabaseUrl,S.settings.supabaseKey);
      const {data}=await SYNC.client.auth.getSession();SYNC.user=data.session?.user||null;
      SYNC.client.auth.onAuthStateChange((_e,sess)=>{SYNC.user=sess?.user||null;ui.side();if(SYNC.user)SYNC.run()});
      SYNC.lastPull=+localStorage.getItem('lt.lastPull')||0;
      SYNC.state=SYNC.user?'idle':'signedout';
      if(SYNC.user)SYNC.run();
      clearInterval(SYNC.timer);SYNC.timer=setInterval(()=>SYNC.user&&SYNC.run(),60000);
    }catch(e){SYNC.state='err';SYNC.msg=e.message}
  },
  async signIn(email){if(!SYNC.client)throw new Error('Set the Supabase URL and key first.');const {error}=await SYNC.client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error},
  async verify(email,token){const {error}=await SYNC.client.auth.verifyOtp({email,token,type:'email'});if(error)throw error},
  async signOut(){await SYNC.client?.auth.signOut();SYNC.user=null;SYNC.state='signedout';ui.side()},
  schedule(){clearTimeout(SYNC._t);SYNC._t=setTimeout(()=>SYNC.run(),2500)},
  async run(){
    if(!SYNC.client||!SYNC.user||SYNC.running||!navigator.onLine)return;SYNC.running=true;SYNC.state='busy';ui.syncBadge();
    try{await SYNC.push();await SYNC.pull();SYNC.state='ok';SYNC.msg='Synced '+new Date().toLocaleTimeString();localStorage.setItem('lt.lastSync',Date.now())}
    catch(e){SYNC.state='err';SYNC.msg=e.message||String(e);console.warn('sync',e)}
    SYNC.running=false;ui.syncBadge();
  },
  async push(){
    const d=SYNC.dirty();if(!d.length)return;
    // audio first, so the lecture row we push already carries its audioPath
    for(const {store,id} of d.filter(x=>x.store==='audio')){const a=await DB.get('audio',id);const l=lecture(id);if(!a||!l)continue;const ext=(a.type||'').includes('mp4')?'m4a':(a.type||'').includes('ogg')?'ogg':'webm';const path=`${SYNC.user.id}/${id}.${ext}`;
      const {error}=await SYNC.client.storage.from('audio').upload(path,a.blob,{upsert:true,contentType:a.type||'audio/webm'});if(error)throw error;
      if(l.audioPath!==path){l.audioPath=path;l.updated=Date.now();await DB.putRaw('lectures',l);if(!d.some(x=>x.store==='lectures'&&x.id===id))d.push({store:'lectures',id})}}
    const rows=[];
    for(const {store,id} of d){
      if(store==='audio')continue;
      if(store==='tombstones'){const t=await DB.get('tombstones',id);if(t)rows.push({id,store:t.store,data:null,updated:t.updated,deleted:true});continue}
      const obj=await DB.get(store,id);if(obj)rows.push({id,store,data:obj,updated:obj.updated||Date.now(),deleted:false});
    }
    for(let i=0;i<rows.length;i+=50){const {error}=await SYNC.client.from('docs').upsert(rows.slice(i,i+50).map(r=>({...r,user_id:SYNC.user.id})));if(error)throw error}
    SYNC.setDirty(SYNC.dirty().filter(x=>!d.some(y=>y.store===x.store&&y.id===x.id)));
  },
  async pull(){
    const since=SYNC.lastPull;let from=0,maxUpd=since,changed=false;
    while(true){const {data,error}=await SYNC.client.from('docs').select('id,store,data,updated,deleted').gt('updated',since).order('updated').range(from,from+499);if(error)throw error;
      for(const r of data){maxUpd=Math.max(maxUpd,r.updated);if(!STORES.includes(r.store))continue;const local=await DB.get(r.store,r.id);
        if(r.deleted){if(local&&(local.updated||0)<=r.updated){await DB.delRaw(r.store,r.id);changed=true}}
        else if(!local||(local.updated||0)<r.updated){await DB.putRaw(r.store,r.data);changed=true}}
      if(data.length<500)break;from+=500}
    SYNC.lastPull=maxUpd;localStorage.setItem('lt.lastPull',String(maxUpd));
    if(changed){await loadAll();if(!REC.active)ui.render()}
  },
  async fetchAudio(l){ // pull a recording made on another device
    if(!SYNC.client||!SYNC.user||!l.audioPath)return null;
    const {data,error}=await SYNC.client.storage.from('audio').download(l.audioPath);if(error)throw error;
    await DB.putRaw('audio',{id:l.id,blob:data,type:data.type||'audio/webm'});return data;
  },
  async wipeRemote(){const {error}=await SYNC.client.from('docs').delete().eq('user_id',SYNC.user.id);if(error)throw error;const {data}=await SYNC.client.storage.from('audio').list(SYNC.user.id,{limit:1000});if(data?.length)await SYNC.client.storage.from('audio').remove(data.map(f=>`${SYNC.user.id}/${f.name}`))},
};

/* ------------------------------- markdown -------------------------------- */
function md(src){
  const lines=(src||'').split('\n');let out='',list=null;
  const inline=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/`(.+?)`/g,'<code>$1</code>').replace(/(^|\s)\*(?!\s)(.+?)\*(?=\s|$|[.,;:])/g,'$1<i>$2</i>');
  const close=()=>{if(list){out+=`</${list}>`;list=null}};
  for(const l of lines){
    const h=l.match(/^(#{1,3})\s+(.*)/),ul=l.match(/^\s*[-*•]\s+(.*)/),ol=l.match(/^\s*\d+[.)]\s+(.*)/);
    if(ul||ol){const kind=ul?'ul':'ol';if(list!==kind){close();out+=`<${kind}>`;list=kind}out+=`<li>${inline((ul||ol)[1])}</li>`;continue}
    close();if(h){const lv=h[1].length<3?2:3;out+=`<h${lv}>${inline(h[2])}</h${lv}>`;continue}
    if(l.trim())out+=`<p>${inline(l)}</p>`;
  }
  close();return out;
}

/* -------------------------------- router --------------------------------- */
function parseRoute(){const h=location.hash.slice(1)||'/';if(h.startsWith('access_token')||h.includes('type=magiclink')||h.includes('type=recovery'))return {parts:[],q:new URLSearchParams()};const [path,qs]=h.split('?');return {parts:path.split('/').filter(Boolean),q:new URLSearchParams(qs||'')}}
window.addEventListener('hashchange',()=>{ui.toggleSide(false);ui.render()});
