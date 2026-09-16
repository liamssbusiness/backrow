/* boot.js — startup, keyboard shortcuts, PWA */

(async function boot(){
  try{
    loadSettings();await DB.open();await loadAll();
    ui.render();ui.storage();
    await SYNC.init();ui.syncBadge();cal.autoRefresh();
    const hasAI=(S.settings.provider==='backrow'&&SYNC.user)||(S.settings.provider==='gemini'&&S.settings.geminiKey)||(S.settings.provider==='anthropic'&&S.settings.anthropicKey)||(S.settings.provider==='openai'&&(S.settings.oaiKey||/localhost/.test(S.settings.oaiUrl)))||S.settings.provider==='ollama'||S.settings.provider==='claudecode';
    if(!hasAI&&!localStorage.getItem('lt.seen')){localStorage.setItem('lt.seen','1');if(S.settings.provider==='backrow')ui.openSync(true);else ui.openSettings(true)}
    if(ui.route?.q?.get('checkout')==='success'){toast('Subscribed — thank you. Your plan is active.');history.replaceState(null,'',location.pathname+'#/')}
    window.addEventListener('online',()=>SYNC.run());
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){SYNC.run();cal.autoRefresh();if(REC.active)REC.holdWake()}});
    if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('sw.js').catch(()=>{});
  }catch(e){document.getElementById('main').innerHTML=`<div class="card">Failed to start: ${esc(e.message)}</div>`;console.error(e)}
})();

window.addEventListener('beforeunload',e=>{if(REC.active){e.preventDefault();e.returnValue=''}});

document.addEventListener('keydown',e=>{
  const tag=(e.target.tagName||'').toLowerCase();const typing=tag==='input'||tag==='textarea'||tag==='select'||e.target.isContentEditable;
  if(e.key==='Escape'){ui.closeModal();ui.toggleSide(false);return}
  if(typing||e.metaKey||e.ctrlKey||e.altKey)return;
  const p=ui.route.parts[0]||'';
  if(e.key==='/'){e.preventDefault();if(p==='search')document.getElementById('searchBox')?.focus();else go('/search');return}
  if(e.key==='r'||e.key==='R'){go('/record');return}
  if(e.key==='h'||e.key==='H'){go('/');return}
  if(e.key===' '){
    if(p==='cards'){e.preventDefault();if(!study._flipped)study.flip();return}
    if(p==='record'&&REC.active){e.preventDefault();ui.togglePause();return}
    const a=document.getElementById('audio');if(a){e.preventDefault();a.paused?a.play():a.pause()}return}
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){const a=document.getElementById('audio');if(a){e.preventDefault();a.currentTime=Math.max(0,a.currentTime+(e.key==='ArrowRight'?10:-10))}return}
  if(/^[1-4]$/.test(e.key)){
    const n=+e.key-1;
    if(p==='cards'){if(study._flipped)study.gradeCard(n);return}
    if(p==='quiz'&&study._quiz&&!study._quiz.at.result){
      const open=[...document.querySelectorAll('.q')].find(b=>{const r=b.getBoundingClientRect();return r.bottom>80&&r.top<window.innerHeight*0.6})||document.querySelector('.q');
      const opts=open?.querySelectorAll('.opt');if(opts&&opts[n])opts[n].click();return}
  }
  if(e.key==='Enter'&&p==='lecture'){document.getElementById('qbox')?.focus()}
});
