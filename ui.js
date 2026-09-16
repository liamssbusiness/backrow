/* ui.js — shell: routing, sidebar, home, classes, recording, imports, lecture page shell, settings, backup, sync UI */

const ui={
  route:{parts:[],q:new URLSearchParams()},
  render(){
    const r=parseRoute();const [p0,p1]=r.parts;const m=document.getElementById('main');ui.route=r;ui.side();
    window.scrollTo(0,0);
    if(!p0)return ui.home(m);
    if(p0==='record')return ui.recordView(m);
    if(p0==='calendar')return cal.view(m);
    if(p0==='course'&&course(p1))return ui.courseView(m,course(p1));
    if(p0==='lecture'&&lecture(p1))return ui.lectureView(m,lecture(p1),r.q);
    if(p0==='quiz'&&S.quizzes.find(q=>q.id===p1))return study.quizView(m,S.quizzes.find(q=>q.id===p1));
    if(p0==='quizzes')return study.quizzesView(m,r.q);
    if(p0==='weak')return study.weakView(m,r.q);
    if(p0==='cards')return study.cardsView(m,r.q);
    if(p0==='assignments')return study.assignmentsView(m,r.q);
    if(p0==='assignment'&&S.assignments.find(a=>a.id===p1))return study.assignmentView(m,S.assignments.find(a=>a.id===p1));
    if(p0==='search')return study.searchView(m,r.q.get('q')||'');
    ui.home(m);
  },
  toggleSide(open){const s=document.getElementById('side'),b=document.getElementById('sideBg');const o=open===undefined?!s.classList.contains('open'):open;s.classList.toggle('open',o);b.classList.toggle('open',o)},
  side(){
    const r=ui.route;const p=r.parts[0]||'';const on=x=>p===x?'on':'';
    document.getElementById('nav').innerHTML=`<a href="#/" class="${on('')}">Home</a><a href="#/calendar" class="${on('calendar')}">Calendar</a><a href="#/quizzes" class="${on('quizzes')||on('quiz')}">Quizzes &amp; tests</a><a href="#/cards" class="${on('cards')}">Flashcards</a><a href="#/weak" class="${on('weak')}">Weak spots</a><a href="#/assignments" class="${on('assignments')||on('assignment')}">Assignments</a><a href="#/search" class="${on('search')}">Search transcripts</a>`;
    document.getElementById('bottomnav').innerHTML=`<a href="#/" class="${on('')}"><span>⌂</span>Home</a><a href="#/record" class="${on('record')}"><span>●</span>Record</a><a href="#/calendar" class="${on('calendar')}"><span>▦</span>Calendar</a><a href="#/quizzes" class="${on('quizzes')||on('quiz')}"><span>✓</span>Quizzes</a><a href="#/cards" class="${on('cards')}"><span>▤</span>Cards</a><a href="#/search" class="${on('search')}"><span>⌕</span>Search</a>`;
    const cur=p==='lecture'?r.parts[1]:null;const curCourse=p==='course'?r.parts[1]:cur?lecture(cur)?.courseId:(r.q.get('course')||null);const tab=r.q.get('tab')||'';
    const open=ui.openClasses(),openL=ui.openSet('lt.openLectures');const now=Date.now();const ltab=r.q.get('tab')||'transcript';
    const recNow=REC.active&&REC.lecture?`<div class="c on recnow"><a href="#/record"><span class="pill rec" style="margin-right:6px">● Rec</span>${esc(course(REC.lecture.courseId)?.name||'Class')}<div class="tiny" style="font-weight:400">${esc(dateS(REC.lecture.created))} · <span id="railTimer">${fmt(REC.elapsed())}</span></div></a></div>`:'';
    document.getElementById('rail').innerHTML=recNow+(S.courses.length?S.courses.map(c=>{const isCur=c.id===curCourse,exp=open.has('!'+c.id)?false:(isCur||open.has(c.id));
      const ls=S.lectures.filter(l=>l.courseId===c.id),as=S.assignments.filter(a=>a.courseId===c.id&&!a.done),qs=S.quizzes.filter(q=>q.courseId===c.id),due=S.cards.filter(x=>x.courseId===c.id&&(x.due||0)<=now).length;
      const next=as.filter(a=>a.due).sort((a,b)=>a.due-b.due)[0];const sub=k=>isCur&&((k==='info'&&p==='course'&&tab==='info')||(k==='lectures'&&p==='course'&&!tab)||(k==='assignments'&&p==='assignments')||(k==='quizzes'&&p==='quizzes')||(k==='cards'&&p==='cards'))?'on':'';
      return `<div class="c ${isCur?'on':''}"><a href="#/course/${c.id}">${esc(c.name)}</a><button class="chev ${exp?'open':''}" title="${exp?'Collapse':'Expand'}" onclick="ui.toggleClass('${c.id}')">›</button></div>
      ${exp?`<a class="s ${sub('info')}" href="#/course/${c.id}?tab=info"><span>Info</span><span class="tiny">${c.meets?esc(cal.meetsS(c)):''}</span></a>
      <a class="s ${sub('lectures')}" href="#/course/${c.id}"><span>Lectures</span><span class="tiny">${ls.length}</span></a>
      ${ls.slice(0,isCur?50:3).map(l=>{const lo=openL.has('!'+l.id)?false:(l.id===cur||openL.has(l.id));return `<div class="l ${l.id===cur?'on':''}"><a href="#/lecture/${l.id}"><span>${esc(l.title)}</span><span class="tiny">${l.duration?fmt(l.duration):''}</span></a><button class="chev ${lo?'open':''}" title="${lo?'Collapse':'Expand'}" onclick="ui.toggleLecture('${l.id}')">›</button></div>${lo?ui.lectureSubs(l,l.id===cur?ltab:''):''}`}).join('')}
      <a class="s add" href="#" onclick="event.preventDefault();ui.addLecture('${c.id}')"><span>+ Add lecture</span></a>
      <a class="s ${sub('assignments')}" href="#/assignments?course=${c.id}"><span>Assignments</span><span class="tiny">${as.length?`${as.length}${next?' · '+esc(cal.dayS(next.due)):''}`:''}</span></a>
      <a class="s ${sub('quizzes')}" href="#/quizzes?course=${c.id}"><span>Quizzes</span><span class="tiny">${qs.length||''}</span></a>
      <a class="s ${sub('cards')}" href="#/cards?course=${c.id}"><span>Flashcards</span><span class="tiny">${due?due+' due':''}</span></a>`:''}`}).join(''):'<div class="tiny" style="padding:8px 10px">No classes yet. Create one before you press record.</div>');
    ui.syncBadge();ui.liveButtons();
  },
  openSet(key){try{return new Set(JSON.parse(localStorage.getItem(key)||'[]'))}catch{return new Set()}},
  openClasses(){return ui.openSet('lt.openClasses')},
  toggleLecture(id){const o=ui.openSet('lt.openLectures');const cur=ui.route.parts[0]==='lecture'?ui.route.parts[1]:null;const shown=o.has('!'+id)?false:(o.has(id)||id===cur);
    if(shown){o.delete(id);o.add('!'+id)}else{o.add(id);o.delete('!'+id)}localStorage.setItem('lt.openLectures',JSON.stringify([...o]));ui.side()},
  lectureSubs(l,tab){const qs=S.quizzes.filter(q=>q.lectureId===l.id).length,cs=S.cards.filter(c=>c.lectureId===l.id).length,as=S.assignments.filter(a=>a.lectureId===l.id).length;
    const tabs=[['transcript','Transcript',l.segments?.length?'':'none'],['notes','Notes',l.notes?'✓':''],['tutor','Ask',''],['quizzes','Quizzes',qs||''],['cards','Cards',cs||''],['assignments','Assignments',as||''],['mine','My notes',l.myNotes?'✓':'']];
    return tabs.map(([k,n,x])=>`<a class="ll ${tab===k?'on':''}" href="#/lecture/${l.id}?tab=${k}"><span>${n}</span><span class="tiny">${x}</span></a>`).join('')},
  addLecture(courseId){const c=course(courseId);ui.modal(`<h2>Add a lecture to ${esc(c?.name||'this class')}</h2><p class="muted">Missed recording one, or have it on another device? Bring it in any of these ways. You can set the date it happened.</p>
    <div class="list"><div class="card click" onclick="ui.closeModal();go('/record?course=${courseId}')"><div><b>● Record now</b><div class="tiny">Live captions, filed under this class.</div></div></div>
    <div class="card click" onclick="ui.importTranscriptNew('${courseId}')"><div><b>Paste a transcript</b><div class="tiny">From Whisper, Otter, a friend, anything. Speaker labels are cleaned up.</div></div></div>
    <div class="card click" onclick="ui.importAudioNew('${courseId}')"><div><b>Upload audio</b><div class="tiny">A voice memo or any recording. Transcribe it on this device afterwards, free.</div></div></div></div>
    <div class="row-btns" style="margin-top:8px"><button onclick="ui.closeModal()">Cancel</button></div>`)},
  toggleClass(id){const o=ui.openClasses();const r=ui.route;const p=r.parts[0]||'';const curCourse=p==='course'?r.parts[1]:p==='lecture'?lecture(r.parts[1])?.courseId:(r.q.get('course')||null);
    const shown=o.has('!'+id)?false:(o.has(id)||id===curCourse);if(shown){o.delete(id);o.add('!'+id)}else{o.add(id);o.delete('!'+id)}
    localStorage.setItem('lt.openClasses',JSON.stringify([...o]));ui.side()},
  syncBadge(){
    const st=SYNC.state;const txt=st==='off'?'Not syncing — this device only':st==='signedout'?'Sync: sign in':st==='busy'?'Syncing…':st==='err'?'Sync error: '+SYNC.msg:SYNC.msg||'Synced';
    const cls=st==='ok'?'ok':st==='busy'?'busy':st==='err'?'err':'';
    const html=`<span class="sync-dot ${cls}"></span>${esc(txt)}`;
    const a=document.getElementById('syncInfo');if(a){a.innerHTML=html;a.style.cursor='pointer';a.onclick=()=>ui.openSync()}
    const b=document.getElementById('syncTop');if(b){b.innerHTML=`<span class="sync-dot ${cls}" title="${esc(txt)}" onclick="ui.openSync()"></span>`}
  },

  /* ---- home ---- */
  home(m){
    const n=S.lectures.length,secs=S.lectures.reduce((a,l)=>a+(l.duration||0),0),noted=S.lectures.filter(l=>l.notes).length;
    const due=study.dueCards().length;
    m.innerHTML=`${REC.active?ui.recordPanel(true):''}<div class="empty"><div class="eyebrow">From the back row</div>
      <h1 style="margin-top:10px">Every lecture you sat through,<br>still <span class="hero-em">answering</span> questions.</h1>
      <p>Record a class, get structured notes, ask the lecture itself, and drill quizzes built from what your professor actually said.</p>
      <div class="row-btns" style="justify-content:center;margin:22px 0 28px"><button class="primary" onclick="go('/record')">● Record a lecture</button><button onclick="ui.importTranscriptNew()">Paste a transcript</button><button onclick="ui.importAudioNew()">Upload audio</button></div></div>
      ${cal.homeStrip()}
      ${due?`<div class="card click" onclick="go('/cards')" style="border-color:var(--gold)"><b>${due} flashcard${due===1?'':'s'} due today</b> <span class="muted">— five minutes, then it sticks.</span></div>`:''}
      <div class="card"><div class="stat"><div><b>${n}</b><span class="tiny">RECORDINGS</span></div><div><b>${noted}</b><span class="tiny">WITH NOTES</span></div><div><b>${S.quizzes.length}</b><span class="tiny">QUIZZES &amp; TESTS</span></div><div><b>${fmt(secs)}</b><span class="tiny">OF LECTURE ON FILE</span></div></div></div>
      <form class="card" style="display:flex;gap:8px" onsubmit="event.preventDefault();go('/search?q='+encodeURIComponent(this.q.value))"><input name="q" placeholder="Search across the words your professors actually said…"><button>Search</button></form>
      ${S.courses.length?`<div class="eyebrow" style="margin:8px 0 10px">Classes</div><div class="grid3">${S.courses.map(c=>{const ls=S.lectures.filter(l=>l.courseId===c.id);return `<div class="card click" onclick="go('/course/${c.id}')"><b>${esc(c.name)}</b><div class="tiny" style="margin-top:4px">${ls.length} lecture${ls.length===1?'':'s'} · ${fmt(ls.reduce((a,l)=>a+(l.duration||0),0))} on file · ${S.sections.filter(s=>s.courseId===c.id).length} sections</div></div>`}).join('')}</div>`:''}
      ${n?`<div class="eyebrow" style="margin:18px 0 10px">Recent</div><div class="list">${S.lectures.slice(0,8).map(l=>`<div class="card click" onclick="go('/lecture/${l.id}')"><div><b>${esc(l.title)}</b><div class="tiny">${esc(lecLabel(l).replace(' · '+l.title,''))} · ${dateS(l.created)} · ${l.duration?fmt(l.duration):'—'}</div></div>${ui.status(l)}</div>`).join('')}</div>`:''}
      ${S.quizzes.some(q=>q.attempts?.some(a=>a.result))?`<div class="eyebrow" style="margin:18px 0 10px">Recent marks</div><div class="list">${S.quizzes.flatMap(q=>(q.attempts||[]).filter(a=>a.result).map(a=>({q,a}))).sort((x,y)=>y.a.result.at-x.a.result.at).slice(0,5).map(({q,a})=>`<div class="card click" onclick="go('/quiz/${q.id}')"><div><b>${esc(q.title)}</b><div class="tiny">${esc(course(q.courseId)?.name||'')} · ${dateS(a.result.at)}</div></div><b>${a.result.score}/${a.result.max}</b></div>`).join('')}</div>`:''}
      <div class="tiny" style="margin-top:24px">Shortcuts: <kbd>R</kbd> record · <kbd>/</kbd> search · <kbd>Space</kbd> play/pause · <kbd>←</kbd> <kbd>→</kbd> skip 10s · <kbd>1</kbd>–<kbd>4</kbd> answer a question</div>`;
    if(REC.active)ui.recordBind();
  },
  status(l){if(!l.segments?.length)return '<span class="pill warn">Still needs a transcript</span>';return l.notes?'<span class="pill ok">Transcribed and noted</span>':'<span class="pill">Transcribed, no notes yet</span>'},

  /* ---- classes & sections ---- */
  courseForm(c){return `<label class="f">Class name</label><input id="c_name" value="${esc(c?.name||'')}" placeholder="PHIL 210 — Ethics">
    <label class="f">Syllabus</label><div class="row-btns"><button class="small" onclick="document.getElementById('assignFile').click()">Attach PDF or photo</button><span class="tiny" id="c_file">${c?.syllabusFile?esc(c.syllabusFile):'none'}</span><button class="small primary" id="readSyl" onclick="ui.readSyllabus()">Read it with AI</button></div>
    <textarea id="c_syl" style="min-height:110px;margin-top:6px" placeholder="…or paste the syllabus text here. The AI reads it to fill in the units and terms below, and every note, quiz and tutor answer knows what this class is about.">${esc(c?.syllabus||'')}</textarea>
    <div class="tiny" id="c_sum" style="margin-top:4px">${c?.syllabusSummary?esc(c.syllabusSummary):''}</div>
    ${cal.meetsForm(c)}
    ${c?'':'<label class="f">Sections, one per line</label><textarea id="c_secs" placeholder="Unit 1 — Aristotle&#10;Unit 2 — Kant&#10;Unit 3 — Mill"></textarea><div class="tiny">Use the units from your syllabus — quizzes and the tutor can be scoped to one of these.</div>'}
    <label class="f">Names &amp; terms to spell right</label><textarea id="c_vocab" style="min-height:60px" placeholder="Prof. Okonkwo, categorical imperative, Sittlichkeit">${esc(c?.vocab||'')}</textarea><div class="tiny">Captions mishear jargon. Anything here is spelled correctly in notes and quizzes.</div>`},
  bindSyllabusFile(){ui._sylImg=null;document.getElementById('assignFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const lbl=document.getElementById('c_file');lbl.textContent='Reading '+f.name+'…';
    try{if(f.type==='application/pdf'||/\.pdf$/i.test(f.name)){const t=(await pdfText(await f.arrayBuffer())).trim();if(!t)throw new Error('That PDF has no text layer — take a photo of it instead.');document.getElementById('c_syl').value=t}
      else if(f.type.startsWith('image/')){ui._sylImg=await study.shrinkImage(f)}else document.getElementById('c_syl').value=(await f.text()).trim();
      ui._sylFile=f.name;lbl.textContent=f.name}catch(err){lbl.textContent='none';toast(err.message,'err')}}},
  async readSyllabus(){const text=document.getElementById('c_syl').value.trim();if(!text&&!ui._sylImg)return toast('Paste the syllabus or attach it first.','err');const b=document.getElementById('readSyl');b.disabled=true;b.classList.add('busy');
    try{const r=await AI.syllabus(text,ui._sylImg,'image/jpeg');ui._sylSummary=r.summary+(r.dates.length?' Key dates: '+r.dates.join('; '):'');ui._sylProfile=r.profile||null;document.getElementById('c_sum').textContent=ui._sylSummary;
      const secs=document.getElementById('c_secs');if(secs&&!secs.value.trim())secs.value=r.sections.join('\n');
      const v=document.getElementById('c_vocab');const have=v.value.split(',').map(x=>x.trim()).filter(Boolean);v.value=[...new Set([...have,...r.vocab])].join(', ');
      if(!document.getElementById('c_name').value.trim()&&r.summary)document.getElementById('c_name').value='';
      toast(secs?`Read it — ${r.sections.length} units and ${r.vocab.length} terms filled in. Edit anything, then save.`:'Read it — terms updated. Add any new units from the class page.')}
    catch(e){toast(e.message,'err')}b.disabled=false;b.classList.remove('busy')},
  newCourse(){ui._sylSummary='';ui._sylFile=null;ui._sylProfile=null;ui.modal(`<h2>New class</h2>${ui.courseForm()}<div class="row-btns" style="margin-top:16px"><button class="primary" onclick="ui.saveCourse()">Create class</button><button onclick="ui.closeModal()">Cancel</button></div>`);ui.bindSyllabusFile();document.getElementById('c_name').focus()},
  async saveCourse(){const name=document.getElementById('c_name').value.trim();if(!name)return toast('Give the class a name.','err');const id=uid();
    await DB.put('courses',{id,name,vocab:document.getElementById('c_vocab').value.trim(),syllabus:document.getElementById('c_syl').value.trim(),syllabusSummary:ui._sylSummary||'',syllabusFile:ui._sylFile||null,profile:ui._sylProfile||null,meets:cal.readMeets(),created:Date.now()});
    const secs=document.getElementById('c_secs').value.split('\n').map(s=>s.trim()).filter(Boolean);for(let i=0;i<secs.length;i++)await DB.put('sections',{id:uid(),courseId:id,name:secs[i],order:i});
    ui.closeModal();await loadAll();go('/course/'+id)},
  editCourse(id){const c=course(id);ui._sylSummary=c.syllabusSummary||'';ui._sylFile=c.syllabusFile||null;ui._sylProfile=null;ui.modal(`<h2>Edit class</h2>${ui.courseForm(c)}<div class="row-btns" style="margin-top:16px"><button class="primary" onclick="ui.saveEditCourse('${id}')">Save</button><button onclick="ui.closeModal()">Cancel</button></div>`);ui.bindSyllabusFile()},
  async saveEditCourse(id){const c=course(id);const n=document.getElementById('c_name').value.trim();if(!n)return toast('Give the class a name.','err');c.name=n;c.vocab=document.getElementById('c_vocab').value.trim();c.syllabus=document.getElementById('c_syl').value.trim();c.syllabusSummary=ui._sylSummary||c.syllabusSummary||'';c.syllabusFile=ui._sylFile||null;c.profile=ui._sylProfile||c.profile||null;c.meets=cal.readMeets();await DB.put('courses',c);ui.closeModal();await loadAll();ui.render()},
  async delCourse(id){const ls=S.lectures.filter(l=>l.courseId===id);if(!confirm(`Delete this class${ls.length?` and its ${ls.length} lecture(s), quizzes and assignments`:''}? This cannot be undone.`))return;
    for(const l of ls)await ui.deleteLectureData(l.id);for(const s of S.sections.filter(s=>s.courseId===id))await DB.del('sections',s.id);
    for(const q of S.quizzes.filter(q=>q.courseId===id))await DB.del('quizzes',q.id);for(const a of S.assignments.filter(a=>a.courseId===id))await DB.del('assignments',a.id);
    for(const c of S.cards.filter(c=>c.courseId===id))await DB.del('cards',c.id);
    await DB.del('chats','course:'+id);await DB.del('courses',id);await loadAll();go('/')},
  async addSection(courseId){const n=prompt('Section name (e.g. Unit 3 — Mill)');if(!n?.trim())return;await DB.put('sections',{id:uid(),courseId,name:n.trim(),order:S.sections.filter(s=>s.courseId===courseId).length});await loadAll();ui.render()},
  async renameSection(id){const s=section(id);const n=prompt('Rename section',s.name);if(!n?.trim())return;s.name=n.trim();await DB.put('sections',s);await loadAll();ui.render()},
  async delSection(id){if(!confirm('Delete this section? Its lectures stay in the archive but become unfiled.'))return;for(const l of S.lectures.filter(l=>l.sectionId===id)){l.sectionId=null;await DB.put('lectures',l)}await DB.del('sections',id);await DB.del('chats','section:'+id);await loadAll();ui.render()},
  async deleteLectureData(id){await DB.del('lectures',id);await DB.delRaw('audio',id);await DB.del('chats','recording:'+id);for(const q of S.quizzes.filter(q=>q.lectureId===id))await DB.del('quizzes',q.id);for(const c of S.cards.filter(c=>c.lectureId===id))await DB.del('cards',c.id);for(const a of S.assignments.filter(a=>a.lectureId===id)){a.lectureId=null;await DB.put('assignments',a)}},
  async delLecture(id){const l=lecture(id);if(!confirm(`Delete "${l.title}", its recording, notes, chats and quizzes?`))return;const c=l.courseId;await ui.deleteLectureData(id);await loadAll();go('/course/'+c)},

  courseView(m,c){
    const secs=S.sections.filter(s=>s.courseId===c.id),ls=S.lectures.filter(l=>l.courseId===c.id),loose=ls.filter(l=>!secs.some(s=>s.id===l.sectionId));
    const row=l=>`<div class="card click" onclick="go('/lecture/${l.id}')"><div><b>${esc(l.title)}</b><div class="tiny">${dateS(l.created)} · ${l.duration?fmt(l.duration):'—'}</div></div>${ui.status(l)}</div>`;
    const qs=S.quizzes.filter(q=>q.courseId===c.id),as=S.assignments.filter(a=>a.courseId===c.id);
    m.innerHTML=`<div class="top"><div><div class="eyebrow">Class</div><h1>${esc(c.name)}</h1><div class="muted">${ls.length} lecture${ls.length===1?'':'s'} · ${fmt(ls.reduce((a,l)=>a+(l.duration||0),0))} on file across ${secs.length} section${secs.length===1?'':'s'}</div></div>
      <div class="row-btns"><button class="primary small" onclick="go('/record?course=${c.id}')">● Record in this class</button><button class="small" onclick="ui.editCourse('${c.id}')">${c.syllabus?'Edit · syllabus on file':'Add syllabus'}</button><button class="small danger" onclick="ui.delCourse('${c.id}')">Delete</button></div></div>
      ${REC.active&&REC.lecture?.courseId===c.id?ui.recordPanel(true):''}
      <div class="tabs"><a class="${!ui.route.q.get('tab')?'on':''}" href="#/course/${c.id}">Lectures &amp; sections</a><a class="${ui.route.q.get('tab')==='info'?'on':''}" href="#/course/${c.id}?tab=info">Info</a><a class="${ui.route.q.get('tab')==='tutor'?'on':''}" href="#/course/${c.id}?tab=tutor">Class tutor</a><a href="#/quizzes?course=${c.id}">Quizzes (${qs.length})</a><a href="#/cards?course=${c.id}">Flashcards</a><a href="#/assignments?course=${c.id}">Assignments (${as.length})</a></div>
      <div id="body"></div>`;
    const body=document.getElementById('body');if(REC.active&&REC.lecture?.courseId===c.id)ui.recordBind();
    if(ui.route.q.get('tab')==='tutor')return study.tutor(body,'course',c.id,ls);
    if(ui.route.q.get('tab')==='info')return ui.courseInfo(body,c);
    body.innerHTML=`${secs.map(s=>{const sl=ls.filter(l=>l.sectionId===s.id);return `<div style="display:flex;justify-content:space-between;align-items:center;margin:14px 0 8px"><h3>${esc(s.name)}</h3><span class="row-btns"><a class="tiny" href="#/course/${c.id}?tab=tutor&scope=section&id=${s.id}">ask this section</a><button class="ghost" title="Rename" onclick="ui.renameSection('${s.id}')">✎</button><button class="ghost" title="Delete section" onclick="ui.delSection('${s.id}')">×</button></span></div><div class="list">${sl.length?sl.map(row).join(''):'<div class="tiny" style="padding:4px 0 10px">Nothing filed under this section yet.</div>'}</div>`}).join('')}
      ${loose.length?`<h3 style="margin:14px 0 8px">Unfiled</h3><div class="list">${loose.map(row).join('')}</div>`:''}
      <div class="row-btns" style="margin-top:10px"><button class="small" onclick="ui.addSection('${c.id}')">+ Add section</button><button class="small" onclick="ui.importTranscriptNew('${c.id}')">Paste a transcript</button><button class="small" onclick="ui.importAudioNew('${c.id}')">Upload audio</button></div>
      ${!ls.length?'<p class="muted" style="margin-top:20px">Once you record or upload a lecture it stays here for the rest of the semester.</p>':''}`;
  },

  courseInfo(el,c){const as=S.assignments.filter(a=>a.courseId===c.id&&!a.done&&a.due).sort((a,b)=>a.due-b.due);const canvas=cal.canvasCourses().filter(l=>cal.courseFor(l)?.id===c.id);const nm=cal.nextMeeting();
    el.innerHTML=`<div class="grid2"><div class="card"><div class="eyebrow">Meets</div><div style="margin-top:6px">${c.meets?esc(cal.meetsS(c)):'<span class="muted">No meeting time yet</span>'}${nm&&nm.c.id===c.id?`<div class="tiny">Next: ${esc(cal.whenS(nm.start))}</div>`:''}</div><div class="tiny" style="margin-top:8px"><a href="#" onclick="event.preventDefault();ui.editCourse('${c.id}')">Edit class</a></div></div>
      <div class="card"><div class="eyebrow">Canvas</div><div style="margin-top:6px">${canvas.length?canvas.map(l=>`<div>${esc(l)}</div>`).join(''):'<span class="muted">Not matched to a Canvas course yet</span>'}</div><div class="tiny" style="margin-top:8px"><a href="#/calendar">Open the calendar</a></div></div></div>
      <div class="card"><div class="eyebrow">Syllabus</div>${c.syllabusSummary?`<p style="margin:6px 0 0">${esc(c.syllabusSummary)}</p>`:'<p class="muted" style="margin:6px 0 0">No syllabus yet. Edit the class to paste or attach it, then "Read it with AI".</p>'}${c.vocab?`<div class="tiny" style="margin-top:8px">Names &amp; terms: ${esc(c.vocab)}</div>`:''}</div>
      ${c.profile?`<div class="card"><div class="eyebrow">Class profile</div><div class="tiny" style="margin:4px 0 8px">Pulled from the syllabus. The AI sees this on every call for this class.</div>${[['Grading',c.profile.grading],['Exams',c.profile.exams],['Textbook',c.profile.textbook],['Rules',c.profile.rules]].filter(x=>x[1]).map(x=>`<div style="display:flex;gap:10px;padding:5px 0;border-top:1px solid var(--line)"><span class="tiny" style="min-width:76px;padding-top:2px">${x[0].toUpperCase()}</span><span>${esc(x[1])}</span></div>`).join('')}</div>`:''}
      <div class="card"><div class="eyebrow">Where the course is so far</div>${c.memory?`<p style="margin:6px 0 0">${esc(c.memory)}</p><div class="tiny" style="margin-top:8px">Updated ${c.memoryUpdated?esc(dateS(c.memoryUpdated)):''} · rewritten after each lecture's notes · the tutor reads this first</div>`:'<p class="muted" style="margin:6px 0 0">Fills in by itself once a lecture has notes.</p>'}</div>
      <div class="eyebrow" style="margin:6px 0 8px">Coming up</div>${as.length?`<div class="list">${as.slice(0,10).map(study.assignRow).join('')}</div>`:'<div class="card muted">Nothing due. Add Canvas items from the Calendar page.</div>'}
      ${c.syllabus?`<details class="card" style="margin-top:8px"><summary class="tiny">Full syllabus text</summary><pre style="white-space:pre-wrap;font:inherit;margin-top:10px">${esc(c.syllabus)}</pre></details>`:''}`},

  /* ---- recording ---- */
  isoDate(t){const d=new Date(t||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`},
  filingForm(lec,courseId,withDate){
    const now=!lec&&!courseId?cal.nowCourse():null;const cid=lec?.courseId||courseId||now?.id||localStorage.getItem('lt.lastCourse')||S.courses[0]?.id||'';
    return `<div class="grid2"><div><label class="f">Lecture title</label><input id="f_title" value="${esc(lec?.title||'')}" placeholder="Lecture 6 — Universalisability"></div>
      ${withDate?`<div><label class="f">Date of the lecture</label><input id="f_date" type="date" value="${ui.isoDate(lec?.created)}"><div class="tiny" style="margin-top:4px">Past lectures file in order and count toward the right week.</div></div>`:''}
      <div><label class="f">Class</label><select id="f_course" onchange="ui.syncSections()">${S.courses.map(c=>`<option value="${c.id}" ${cid===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}<option value="__new">+ New class…</option></select><input id="f_course_new" placeholder="New class name" style="margin-top:6px;display:none">${now?`<div class="tiny" style="margin-top:4px">${esc(now.name)} is on right now — filed there.</div>`:''}</div>
      <div><label class="f">Section</label><select id="f_section"></select><input id="f_section_new" placeholder="New section name" style="margin-top:6px;display:none"></div></div>`;
  },
  syncSections(sel){
    const c=document.getElementById('f_course'),cn=document.getElementById('f_course_new'),u=document.getElementById('f_section'),un=document.getElementById('f_section_new');
    cn.style.display=c.value==='__new'?'block':'none';sel=sel||localStorage.getItem('lt.lastSection');
    u.innerHTML=`<option value="">— unfiled —</option>${S.sections.filter(x=>x.courseId===c.value).map(x=>`<option value="${x.id}" ${sel===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}<option value="__new">+ New section…</option>`;
    u.onchange=()=>{un.style.display=u.value==='__new'?'block':'none'};un.style.display='none';
  },
  async readFiling(existing){
    let courseId=document.getElementById('f_course').value,sectionId=document.getElementById('f_section').value;
    let created;const dEl=document.getElementById('f_date');
    if(dEl?.value){const [y,m,d]=dEl.value.split('-').map(Number);if(existing&&ui.isoDate(existing.created)===dEl.value)created=existing.created;
      else{const c=course(courseId);const [hh,mm]=(c?.meets?.days?.includes(new Date(y,m-1,d).getDay())&&c.meets.start?c.meets.start:'12:00').split(':').map(Number);created=new Date(y,m-1,d,hh,mm,0,0).getTime()}}
    if(courseId==='__new'||!courseId){const name=document.getElementById('f_course_new')?.value.trim();if(!name)throw new Error('Create a class before you press record — pick one or type a new name.');courseId=uid();await DB.put('courses',{id:courseId,name,created:Date.now()})}
    if(sectionId==='__new'){const name=document.getElementById('f_section_new').value.trim();if(!name)throw new Error('Give the new section a name.');sectionId=uid();await DB.put('sections',{id:sectionId,courseId,name,order:99})}
    const n=S.lectures.filter(l=>l.courseId===courseId).length+1;
    const title=document.getElementById('f_title').value.trim()||`Lecture ${n} — ${dateS(created||Date.now())}`;
    localStorage.setItem('lt.lastCourse',courseId);localStorage.setItem('lt.lastSection',sectionId||'');
    const out={title,courseId,sectionId:sectionId||null};if(created)out.created=created;return out;
  },
  recordView(m){
    if(!REC.active){
      const cid=ui.route.q.get('course');
      m.innerHTML=`<div class="top"><div><div class="eyebrow">New recording</div><h1>Put this one on tape</h1></div></div>
      <div class="card">${S.courses.length?ui.filingForm(null,cid):'<p class="muted">Create a class before you press record.</p><button class="primary" onclick="ui.newCourse()">+ New class</button>'}
        ${S.courses.length?`<div class="row-btns" style="margin-top:20px"><button class="primary" style="padding:12px 22px;font-size:16px" onclick="ui.startRec()">● Start recording</button><button onclick="history.back()">Cancel</button></div>`:''}
        <p class="tiny" style="margin-top:14px">Live captions use your browser's speech engine (Chrome on laptop is best; on iPhone use Safari and keep the screen on). Audio is saved as a small Opus file — about 15 MB for a ninety-minute class.</p></div>`;
      if(S.courses.length)ui.syncSections(ui.route.q.get('section'));
      return;
    }
    m.innerHTML=ui.recordPanel();ui.recordBind();
  },
  recordPanel(compact){
    return `<div class="top"><div><div class="eyebrow">Recording</div><h1>${esc(REC.lecture.title)}</h1><div class="muted">${esc(lecLabel(REC.lecture))}</div></div><span class="pill ${REC.paused?'warn':'rec'}" id="recPill">${REC.paused?'Paused':'● Live'}</span></div>
      <div class="card" style="display:flex;align-items:center;gap:26px;flex-wrap:wrap"><button class="rec-btn" id="stopBtn" onclick="ui.stopRec()">END<br><small>&amp; save</small></button><div><div class="timer" id="timer">${fmt(REC.elapsed())}</div><div class="tiny" id="stopHint">Put it away. Hit stop when class ends.</div><div class="tiny" id="wakeHint" style="margin-top:4px"></div></div>
        <div class="row-btns" style="margin-left:auto"><button id="pauseBtn" onclick="ui.togglePause()">${REC.paused?'▶ Resume':'❚❚ Pause'}</button><button class="danger" onclick="ui.discardRec()">Discard</button></div></div>
      <div class="card"><div class="eyebrow">Ask the ${esc(course(REC.lecture.courseId)?.name||'class')} tutor</div><div class="tiny" style="margin:4px 0 8px">Knows this class's earlier lectures, its syllabus, and what's being said right now. Nothing from your other classes. The thread continues in this lecture's Ask tab afterwards.</div>
        <div class="chat" id="liveChat" style="max-height:240px"></div>
        <div class="starters" id="liveFollow" style="margin-top:8px"></div>
        <form style="display:flex;gap:8px;margin-top:8px" onsubmit="event.preventDefault();ui.liveSend()"><input id="liveQ" placeholder="What did he just mean by that?" autocomplete="off"><button class="primary" id="liveAskBtn">Ask</button></form>${study.modelPicker()}</div>
      <div class="card"><div class="eyebrow">Side notes</div><div class="tiny" style="margin:4px 0 8px">Anything you want to really know or come back to. Each note is stamped with the lecture time, kept in My notes, and worked into the AI notes.</div>
        <div id="sideList" class="transcript" style="max-height:200px"></div>
        <div style="display:flex;gap:8px;margin-top:8px;align-items:flex-start"><textarea id="sideBox" style="min-height:44px" placeholder="e.g. this is on the midterm · ask about the grace period · re-listen to this part" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();ui.addSideNote()}"></textarea><button class="primary" onclick="ui.addSideNote()">Add</button></div></div>
      <div class="card"><div class="eyebrow">Live captions</div><div class="transcript" id="live" style="margin-top:8px${compact?';max-height:220px':''}"></div></div>${compact?'<hr style="border:0;border-top:1px solid var(--line);margin:18px 0">':''}`;
  },
  recordBind(){ui.renderLive();ui.stopLock();ui.wakeBadge();ui.renderSideNotes();ui.renderLiveChat()},
  async liveChatLoad(){if(!REC.lecture)return null;if(!REC.chat){const key='recording:'+REC.lecture.id;REC.chat=(await DB.get('chats',key))||{id:key,messages:[]}}return REC.chat},
  async renderLiveChat(streaming){const el=document.getElementById('liveChat');if(!el||!REC.active)return;const chat=await ui.liveChatLoad();if(!document.getElementById('liveChat'))return;
    el.innerHTML=(chat.messages.length?chat.messages.map((m,i)=>study.msgHTML(m,undefined,i,'live')).join(''):'<div class="tiny">Ask while the professor talks. Answers come from this class only, and cite the moment.</div>')+(streaming?'<div class="msg a" id="lstream"><span class="busy">Listening back</span></div>':'');el.scrollTop=el.scrollHeight;
    const fu=document.getElementById('liveFollow');if(fu)fu.innerHTML=chat.messages.at(-1)?.role==='assistant'&&!streaming?study.FOLLOWUPS.map(s=>`<button onclick="document.getElementById('liveQ').value=${JSON.stringify(s).replace(/"/g,'&quot;')};ui.liveSend()">${esc(s)}</button>`).join(''):''},
  async liveSend(){const box=document.getElementById('liveQ');const q=(box?.value||'').trim();if(!q||!REC.active)return;const chat=await ui.liveChatLoad();const hist=chat.messages.slice(-8);
    chat.messages.push({role:'user',content:q});box.value='';await ui.renderLiveChat(true);const btn=document.getElementById('liveAskBtn');if(btn)btn.disabled=true;
    try{const a=await AI.ask('course',REC.lecture.courseId,hist,q,p=>{const s=document.getElementById('lstream');if(s){s.innerHTML=md(p);s.parentElement.scrollTop=s.parentElement.scrollHeight}},{live:{...REC.lecture,segments:REC.segments}});
      chat.messages.push({role:'assistant',content:a});await DB.put('chats',chat)}catch(e){chat.messages.pop();toast(e.message,'err')}
    const b=document.getElementById('liveAskBtn');if(b)b.disabled=false;ui.renderLiveChat();box?.focus()},
  addSideNote(){const box=document.getElementById('sideBox');const text=(box?.value||'').trim();if(!text||!REC.active)return;
    const line=`[${fmt(REC.elapsed())}] ${text}`;REC.lecture.myNotes=(REC.lecture.myNotes?REC.lecture.myNotes.replace(/\s+$/,'')+'\n':'')+line;
    try{localStorage.setItem('lt.liveNotes',JSON.stringify({id:REC.lecture.id,notes:REC.lecture.myNotes}))}catch{}
    box.value='';ui.renderSideNotes();box.focus()},
  renderSideNotes(){const el=document.getElementById('sideList');if(!el||!REC.lecture)return;const lines=(REC.lecture.myNotes||'').split('\n').filter(Boolean);
    el.innerHTML=lines.length?lines.map(l=>{const m=l.match(/^\[(\d{1,2}:\d{2})\]\s*(.*)$/);return `<div class="seg"><span class="t">${esc(m?m[1]:'')}</span><span>${esc(m?m[2]:l)}</span></div>`}).join(''):'<div class="tiny">Nothing yet. Type a thought and press Enter.</div>';el.scrollTop=el.scrollHeight},
  wakeBadge(){const el=document.getElementById('wakeHint');if(!el||!REC.active)return;const held=!!(REC.wake&&!REC.wake.released);
    el.textContent=held?'Screen stays awake while this tab is in front. Keep the lid open; closing it puts the Mac to sleep and stops the mic.':'This browser will not keep the screen awake. Turn off auto-sleep for this class and keep the lid open.';el.style.color=held?'':'var(--red)'},
  renderLive(){const el=document.getElementById('live');if(!el)return;const atBottom=el.scrollHeight-el.scrollTop-el.clientHeight<60;
    el.innerHTML=REC.segments.map(s=>`<div class="seg"><span class="t">${fmt(s.t)}</span><span>${esc(s.text)}</span></div>`).join('')+(REC.interim?`<div class="seg"><span class="t">…</span><span class="interim">${esc(REC.interim)}</span></div>`:'')
      +(!REC.segments.length&&!REC.interim?(REC.srSupported===false?'<div class="tiny">Live captions are not available in this browser — the audio is still being recorded. Afterwards, use "Transcribe with AI" (free, on-device).</div>':'<div class="tiny">Captions appear here as your professor speaks.</div>'):'');
    if(atBottom)el.scrollTop=el.scrollHeight},
  async startRec(){try{if(!localStorage.getItem('lt.consent')){if(!confirm('Quick reminder before your first recording:\n\nRecordings stay private to your account and are never shared. Check your school\'s policy on recording lectures, and if a professor asks you not to record, don\'t.\n\nOK to continue.'))return;localStorage.setItem('lt.consent','1')}const f=await ui.readFiling();await loadAll();const lec={id:uid(),...f,created:Date.now(),duration:0,segments:[],notes:null,myNotes:''};await REC.begin(lec);ui.render()}catch(e){toast(e.message,'err')}},
  stillRecording(){if(!REC.active||REC.checking)return;REC.checking=true;const deadline=Date.now()+REC.CHECK_WAIT*1000;
    ui.modal(`<h2>Still in class?</h2><p class="muted">Backrow has been recording ${esc(course(REC.lecture.courseId)?.name||'')} for ${fmt(REC.elapsed())}. If nobody answers, it ends and saves on its own in <b id="chkLeft">${fmt(REC.CHECK_WAIT)}</b>.</p>
      <div class="row-btns" style="margin-top:16px"><button class="primary" style="padding:12px 22px" onclick="ui.checkAnswer(true)">Yes, keep recording</button><button onclick="ui.checkAnswer(false)">No, end &amp; save</button></div>`);
    REC.checkTimer=setInterval(()=>{if(!REC.active)return ui.checkAnswer(true);if(!document.getElementById('chkLeft'))return ui.checkAnswer(true);const left=Math.max(0,Math.ceil((deadline-Date.now())/1000));document.getElementById('chkLeft').textContent=fmt(left);if(left<=0)ui.checkAnswer(false)},1000)},
  checkAnswer(keep){clearInterval(REC.checkTimer);REC.checkTimer=null;REC.checking=false;ui.closeModal();if(!REC.active)return;if(keep){REC.nextCheck=REC.elapsed()+REC.CHECK_EVERY;toast('Still recording. I will check again in an hour.')}else{REC.MIN=0;ui.stopRec()}},
  liveButtons(){const on=REC.active;for(const id of ['topRec','sideRec']){const b=document.getElementById(id);if(!b)continue;b.innerHTML=on?`● Live ${fmt(REC.elapsed())}`:'● Record';b.classList.toggle('live',on)}},
  stopLock(){ui.liveButtons();const b=document.getElementById('stopBtn'),h=document.getElementById('stopHint');const rt=document.getElementById('railTimer');if(rt)rt.textContent=fmt(REC.elapsed());if(!b)return;const left=REC.MIN-REC.elapsed();const locked=left>0;
    b.innerHTML=locked?`END<br><small>${fmt(left)}</small>`:'END<br><small>&amp; save</small>';b.classList.toggle('soft',locked);
    if(h)h.textContent=locked?'End saves the recording. Under five minutes it asks first, since a lecture is never that short. Wrong room? Use Discard.':'Put it away. Press End when class finishes — it saves and writes the notes.'},
  togglePause(){REC.paused?REC.resume():REC.pause();ui.render();ui.stopLock()},
  async stopRec(){if(REC.elapsed()<REC.MIN&&!confirm(`Only ${fmt(REC.elapsed())} recorded — a lecture is never this short.\n\nEnd now and keep it anyway?`))return;
    try{const l=await REC.finish(true);await loadAll();
      if(l.segments.length&&S.settings.autoNotes){go('/lecture/'+l.id+'?tab=notes');toast('Saved. Sorting the tape and writing the notes — they appear here as they are written.');study.genNotes(l.id).catch(()=>{})}
      else{go('/lecture/'+l.id);toast(l.segments.length?'Saved. Write the notes when you are ready.':'Saved without captions. Use "Transcribe with AI" or paste a transcript.')}}
    catch(e){toast('Could not save: '+e.message,'err')}},
  async discardRec(){if(!confirm('Discard this recording? Nothing will be saved.'))return;const c=REC.lecture.courseId;await REC.finish(false);go('/course/'+c)},

  /* ---- import paths ---- */
  importTranscriptNew(courseId){if(!S.courses.length)return ui.newCourse();ui.modal(`<h2>Paste a transcript</h2><p class="muted">Lines starting with [mm:ss] keep their timestamps. Plain text is spread evenly across the length you give.</p>${ui.filingForm(null,courseId,true)}<label class="f">Transcript</label><textarea id="f_tx" style="min-height:200px"></textarea><label class="f">Approximate length (minutes, optional)</label><input id="f_mins" type="number" placeholder="50">
    <div class="row-btns" style="margin-top:16px"><button class="primary" onclick="ui.saveTranscriptNew()">Save lecture</button><button onclick="ui.closeModal()">Cancel</button></div>`);ui.syncSections()},
  parseTranscript(text,mins){
    text=text.replace(/(^|[.!?]\s+)(?:Speaker\s*\d+|You|Me)\s*:\s*/gim,'$1');   // Whisper / Otter style speaker labels
    const lines=text.split(/\n+/).map(l=>l.trim()).filter(Boolean);
    const stamped=lines.filter(l=>/^\[?\d{1,2}:\d{2}(:\d{2})?\]?/.test(l));
    if(stamped.length&&stamped.length>=lines.length/2)return lines.map(l=>{const m=l.match(/^\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s*(.*)$/);if(!m)return null;const t=m[3]?(+m[1]*3600+ +m[2]*60+ +m[3]):(+m[1]*60+ +m[2]);return {t,text:m[4]}}).filter(x=>x&&x.text);
    const sents=text.replace(/\s+/g,' ').match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)||[text];
    const total=(mins||Math.max(5,sents.length/6))*60,per=total/sents.length,segs=[];let buf=[],i=0;
    sents.forEach((s,k)=>{buf.push(s.trim());if(buf.length>=3||k===sents.length-1){segs.push({t:i*per,text:buf.join(' ')});i=k+1;buf=[]}});
    return segs;
  },
  async saveTranscriptNew(){try{const f=await ui.readFiling();const tx=document.getElementById('f_tx').value;if(!tx.trim())throw new Error('Paste some text first.');const mins=+document.getElementById('f_mins').value||0;const segs=ui.parseTranscript(tx,mins);
    const lec={id:uid(),created:Date.now(),...f,duration:mins?mins*60:(segs.at(-1)?.t||0)+30,segments:segs,notes:null,myNotes:'',source:'paste',transcriptSource:'paste'};await DB.put('lectures',lec);ui.closeModal();await loadAll();go('/lecture/'+lec.id);if(S.settings.autoNotes)study.genNotes(lec.id).catch(()=>{})}catch(e){toast(e.message,'err')}},
  importAudioNew(courseId){if(!S.courses.length)return ui.newCourse();ui.modal(`<h2>Upload audio you already have</h2><p class="muted">A voice memo from your phone works. Then run "Transcribe with AI" (free, on this device) or paste a transcript.</p>${ui.filingForm(null,courseId,true)}<div class="row-btns" style="margin-top:16px"><button class="primary" onclick="document.getElementById('audioFile').click()">Choose audio file</button><button onclick="ui.closeModal()">Cancel</button></div>`);ui.syncSections();
    document.getElementById('audioFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const f=await ui.readFiling();const lec={id:uid(),created:Date.now(),...f,duration:0,segments:[],notes:null,myNotes:'',source:'upload',transcriptSource:'none'};
      try{const ac=new AudioContext();const ab=await ac.decodeAudioData(await file.arrayBuffer());lec.duration=ab.duration;ac.close()}catch{}
      await DB.putRaw('audio',{id:lec.id,blob:file,type:file.type});SYNC.markDirty('audio',lec.id);await DB.put('lectures',lec);ui.closeModal();await loadAll();go('/lecture/'+lec.id);toast('Audio saved. Transcribe it from the Transcript tab.')}catch(err){toast(err.message,'err')}e.target.value=''}},

  /* ---- lecture page shell ---- */
  async lectureView(m,l,q){
    const tab=q.get('tab')||'transcript';const tabs=[['transcript','Transcript'],['notes','Notes'],['tutor','Ask'],['quizzes','Quizzes'],['cards','Cards'],['assignments','Assignments'],['mine','My notes']];
    m.innerHTML=`<div class="top"><div><div class="eyebrow"><a href="#/course/${l.courseId}">${esc(course(l.courseId)?.name||'Unfiled')}</a>${section(l.sectionId)?` · ${esc(section(l.sectionId).name)}`:''}</div>
        <h1 contenteditable="true" spellcheck="false" onblur="ui.rename('${l.id}',this.textContent)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}" title="Click to rename">${esc(l.title)}</h1>
        <div class="muted">${dateS(l.created)} · ${l.duration?fmt(l.duration):'—'} · ${l.segments?.length||0} caption lines</div></div>
      <div class="row-btns">${ui.status(l)}<button class="small" onclick="ui.refile('${l.id}')">File…</button><button class="small danger" onclick="ui.delLecture('${l.id}')">Delete</button></div></div>
      <div id="player"></div>
      <div class="tabs">${tabs.map(([k,n])=>`<a class="${tab===k?'on':''}" href="#/lecture/${l.id}?tab=${k}">${n}</a>`).join('')}</div><div id="body"></div>`;
    const body=document.getElementById('body');
    ({transcript:study.transcriptTab,notes:study.notesTab,tutor:(b,l)=>study.tutor(b,'lecture',l.id,[l]),quizzes:study.lectureQuizzes,cards:study.lectureCards,assignments:study.lectureAssignments,mine:study.mineTab})[tab](body,l);
    await ui.player(l,+q.get('t')||0);
  },
  async player(l,seekTo){
    const p=document.getElementById('player');if(!p)return;
    let a=await DB.get('audio',l.id);
    if(!a&&l.audioPath&&SYNC.user){p.innerHTML='<div class="tiny busy" style="margin-bottom:10px">Fetching the recording from sync</div>';try{await SYNC.fetchAudio(l);a=await DB.get('audio',l.id)}catch(e){p.innerHTML=`<div class="tiny" style="margin-bottom:10px">Could not fetch the recording: ${esc(e.message)}</div>`;return}}
    if(!a){p.innerHTML='<div class="tiny" style="margin-bottom:10px">No audio was stored with this lecture.</div>';return}
    const url=URL.createObjectURL(a.blob);const speed=+localStorage.getItem('lt.speed')||1;
    p.innerHTML=`<div class="card player" style="padding:10px 16px"><audio id="audio" controls preload="metadata" src="${url}"></audio><div class="speed">${[1,1.25,1.5,2].map(s=>`<button class="${s===speed?'on':''}" onclick="ui.speed(${s})">${s}×</button>`).join('')}</div></div>`;
    const el=document.getElementById('audio');el.playbackRate=speed;
    if(seekTo)el.addEventListener('loadedmetadata',()=>{el.currentTime=seekTo},{once:true});
    el.addEventListener('timeupdate',()=>study.follow(l,el.currentTime));
  },
  speed(s){localStorage.setItem('lt.speed',s);const el=document.getElementById('audio');if(el)el.playbackRate=s;document.querySelectorAll('.speed button').forEach(b=>b.classList.toggle('on',+b.textContent===s))},
  seek(t){const a=document.getElementById('audio');if(!a)return toast('No audio stored for this lecture.');a.currentTime=t;a.play()},
  async rename(id,t){const l=lecture(id);t=t.trim();if(!t||t===l.title)return;l.title=t;await DB.put('lectures',l);ui.side()},
  refile(id){const l=lecture(id);ui.modal(`<h2>File this lecture</h2>${ui.filingForm(l,null,true)}<div class="row-btns" style="margin-top:16px"><button class="primary" onclick="ui.saveRefile('${id}')">Save</button><button onclick="ui.closeModal()">Cancel</button></div>`);ui.syncSections(l.sectionId||'')},
  async saveRefile(id){try{const l=lecture(id);const f=await ui.readFiling(l);Object.assign(l,f);await DB.put('lectures',l);ui.closeModal();await loadAll();ui.render()}catch(e){toast(e.message,'err')}},
  cite(html,list){
    html=html.replace(/\[([^\[\]@]{1,80}?) @ (\d{1,2}):(\d{2})\]/g,(m,title,mm,ss)=>{const t=+mm*60+ +ss;const L=list||S.lectures;const tt=title.trim();const l=L.find(l=>l.title===tt)||L.find(l=>lecLabel(l).endsWith(tt))||L.find(l=>l.title.includes(tt)||tt.includes(l.title));return l?`<a class="cite" href="#/lecture/${l.id}?t=${t}">${esc(m)}</a>`:m});
    return html.replace(/\[(\d{1,2}):(\d{2})\]/g,(m,mm,ss)=>`<span class="cite" onclick="ui.seek(${+mm*60+ +ss})">${m}</span>`);
  },

  /* ---- settings ---- */
  openSettings(first){const s=S.settings;const sel=(v,x)=>v===x?'selected':'';
    ui.modal(`<h2>Settings</h2>${first?'<p class="muted">Welcome. One thing to set up: which AI writes your notes. Backrow AI needs only a sign-in; the free options take a minute.</p>':''}
    <label class="f">AI provider</label><select id="s_prov" onchange="['backrow','gemini','anthropic','openai','ollama','claudecode'].forEach(p=>document.getElementById('p_'+p).hidden=this.value!==p)">
      <option value="backrow" ${sel(s.provider,'backrow')}>Backrow AI — included in your plan, nothing to set up</option><option value="claudecode" ${sel(s.provider,'claudecode')}>Claude Code on this Mac — uses your Claude subscription (laptop only)</option><option value="gemini" ${sel(s.provider,'gemini')}>Google Gemini — free tier</option><option value="openai" ${sel(s.provider,'openai')}>Groq / OpenRouter / any OpenAI-compatible — free tiers</option><option value="anthropic" ${sel(s.provider,'anthropic')}>Anthropic Claude — your own key, pay per use</option><option value="ollama" ${sel(s.provider,'ollama')}>Ollama — local, laptop only</option></select>
    <div id="p_backrow" ${s.provider==='backrow'?'':'hidden'}><div class="tiny" style="margin-top:4px">${SYNC.user?`Signed in as <b>${esc(SYNC.user.email)}</b>. Notes, tutor, quizzes and briefs run on Backrow's own AI; nothing to paste, works on the phone and the laptop.`:'Sign in once (Settings → Sync between devices → your email) and the AI is on. No key, no card during the trial.'}</div><div id="planBox" style="margin-top:10px"></div></div>
    <div id="p_claudecode" ${s.provider==='claudecode'?'':'hidden'}><label class="f">Model</label><select id="s_cmodel">${[['sonnet','Sonnet — smart and quick (default)'],['opus','Opus — strongest, slower'],['haiku','Haiku — fastest']].map(([v,l])=>`<option value="${v}" ${sel(s.claudeModel,v)}>${l}</option>`).join('')}</select>
      <div class="tiny" style="margin-top:4px">Runs through Claude Code, which is part of your Claude plan — no API key, no extra bill. The bridge has to be running on the Mac: double-click <b>start-bridge.command</b> in the Backrow folder and leave the window open. Works in Chrome on the laptop; the phone can't reach it, so pick Gemini there.</div>
      <label class="f">Bridge address</label><input id="s_burl" value="${esc(s.bridgeUrl||'http://localhost:8790/v1')}"></div>
    <div id="p_gemini" ${s.provider==='gemini'?'':'hidden'}><label class="f">Gemini API key</label><input id="s_gkey" type="password" value="${esc(s.geminiKey)}" placeholder="AIza…"><div class="tiny" style="margin-top:4px">Free: go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>, sign in with Google, click "Create API key", paste it here. No card needed.</div>
      <label class="f">Model</label><select id="s_gmodel" onfocus="ui.fillGeminiModels()">${[['gemini-flash-latest','Latest Flash — free, fast, 1M context (default)'],['gemini-flash-lite-latest','Latest Flash-Lite — free, higher limits'],['gemini-pro-latest','Latest Pro — smarter, tighter free limits']].concat(['gemini-flash-latest','gemini-flash-lite-latest','gemini-pro-latest'].includes(s.geminiModel)?[]:[[s.geminiModel,s.geminiModel]]).map(([v,l])=>`<option value="${v}" ${sel(s.geminiModel,v)}>${l}</option>`).join('')}</select><div class="tiny" style="margin-top:4px">"Latest" names follow whatever Google currently serves, so they never expire. Click the list to see every model your key can use.</div></div>
    <div id="p_openai" ${s.provider==='openai'?'':'hidden'}><label class="f">Base URL</label><input id="s_ourl" value="${esc(s.oaiUrl)}" placeholder="https://api.groq.com/openai/v1"><label class="f">API key</label><input id="s_okey" type="password" value="${esc(s.oaiKey)}"><label class="f">Model</label><input id="s_omodel" value="${esc(s.oaiModel)}" placeholder="llama-3.3-70b-versatile"><div class="tiny" style="margin-top:4px">Groq: free key at console.groq.com. OpenRouter: base URL https://openrouter.ai/api/v1 and a model ending in :free.</div></div>
    <div id="p_anthropic" ${s.provider==='anthropic'?'':'hidden'}><label class="f">Anthropic API key</label><input id="s_akey" type="password" value="${esc(s.anthropicKey)}" placeholder="sk-ant-…"><label class="f">Model</label><select id="s_amodel">${[['claude-sonnet-5','Claude Sonnet 5 — best value'],['claude-haiku-4-5','Claude Haiku 4.5 — cheapest'],['claude-opus-5','Claude Opus 5 — strongest']].map(([v,l])=>`<option value="${v}" ${sel(s.anthropicModel,v)}>${l}</option>`).join('')}</select></div>
    <div id="p_ollama" ${s.provider==='ollama'?'':'hidden'}><label class="f">Ollama URL</label><input id="s_llurl" value="${esc(s.ollamaUrl)}"><label class="f">Model</label><input id="s_llmodel" value="${esc(s.ollamaModel)}"><div class="tiny" style="margin-top:4px">Only works on the laptop running Ollama, and OLLAMA_ORIGINS must include this site's address.</div></div>
    <label class="f">After recording</label><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="s_auto" style="width:auto" ${s.autoNotes?'checked':''}> Write the notes automatically when I stop</label>
    <label class="f">Captions language</label><input id="s_lang" value="${esc(s.lang)}" placeholder="en-US">
    <label class="f">On-device transcription model (uploaded audio)</label><select id="s_wh">${[['onnx-community/whisper-tiny.en','Whisper tiny (English) — fastest, ~40 MB'],['onnx-community/whisper-base','Whisper base — good balance, ~75 MB (default)'],['onnx-community/whisper-small','Whisper small — best accuracy, ~250 MB, slow']].map(([v,l])=>`<option value="${v}" ${sel(s.whisper,v)}>${l}</option>`).join('')}</select>
    <div class="row-btns" style="margin-top:18px"><button class="primary" onclick="ui.saveSettings()">Save</button><button onclick="ui.testLLM()" id="testBtn">Test connection</button><button onclick="ui.closeModal();ui.openSync()">Sync between devices…</button><button onclick="ui.closeModal()">Close</button></div>`);ui.loadPlan()},
  /* ---- plan: the Backrow AI account (accounts + usage rows are read-only for the user; Stripe and deletion go through Edge Functions) ---- */
  PLAN_CAP:{notes:60,tutor:300,quiz:60,brief:40,syllabus:20,cards:60,topics:60,memory:60,grade:200,other:100},   // mirrors CAP in ai-proxy
  async loadPlan(){const box=document.getElementById('planBox');if(!box)return;
    if(!SYNC.client||!SYNC.user){box.innerHTML='';return}
    box.innerHTML='<div class="tiny">Loading your plan…</div>';
    try{const month=new Date().toISOString().slice(0,7);
      const [{data:a,error:e1},{data:u,error:e2}]=await Promise.all([SYNC.client.from('accounts').select('*').eq('user_id',SYNC.user.id).maybeSingle(),SYNC.client.from('usage').select('kind,calls').eq('user_id',SYNC.user.id).eq('month',month)]);
      if(e1)throw e1;if(e2)throw e2;if(!document.getElementById('planBox'))return;
      const tier=a?.tier||'trial';const d=t=>t?dateS(new Date(t).getTime()):'';const live=a?.trial_ends&&new Date(a.trial_ends)>new Date();
      const head=tier==='friend'?'<b>Friends plan</b> — free, no limits.':tier==='paid'?`<b>Backrow plan</b> — ${a.plan==='semester'?'$25 per semester':'$7 per month'}${a.current_period_end?', renews '+d(a.current_period_end):''}.`
        :tier==='trial'?(a?.trial_ends?(live?`<b>Free trial</b> — ends ${d(a.trial_ends)}. Subscribe any time; you are not charged until the trial ends.`:`<b>Free trial ended</b> ${d(a.trial_ends)}. Subscribe to keep the AI going.`):'<b>Free trial</b> — 14 days, starting with your first AI call.'):'<b>Plan not active.</b> Subscribe to keep the AI going.';
      const names={notes:'notes',tutor:'tutor questions',quiz:'quizzes',brief:'briefs',syllabus:'syllabus reads',cards:'card decks',topics:'sortings',memory:'memory updates',grade:'markings',other:'other'};
      const used=(u||[]).filter(x=>x.calls>0).sort((x,y)=>y.calls-x.calls).map(x=>`${x.calls}${tier==='friend'?'':'/'+(ui.PLAN_CAP[x.kind]||100)} ${names[x.kind]||x.kind}`).join(' · ');
      const canSub=tier!=='paid'&&tier!=='friend';
      box.innerHTML=`<div class="card"><div>${head}</div><div class="tiny" style="margin-top:6px">This month: ${used||'nothing yet'}.${tier==='friend'?'':' Limits reset on the 1st.'}</div>
        <div class="row-btns" style="margin-top:10px">${canSub?`<button class="small primary" onclick="ui.subscribe('monthly')">Subscribe · $7/month</button><button class="small" onclick="ui.subscribe('semester')">$25/semester</button>`:''}${a?.stripe_customer_id?`<button class="small" onclick="ui.billingPortal()">Manage subscription</button>`:''}<button class="small danger" onclick="ui.deleteAccount()">Delete my account</button></div>
        <div class="tiny" style="margin-top:8px"><a href="terms.html" target="_blank" rel="noopener">Terms &amp; privacy</a></div></div>`;
    }catch(e){box.innerHTML=`<div class="tiny">Could not load your plan: ${esc(e.message)}</div>`}},
  async fn(name,body){const {data,error}=await SYNC.client.functions.invoke(name,{body});if(error){let msg=error.message||'Something went wrong.';try{const j=await error.context?.json();if(j?.error)msg=j.error}catch{}throw new Error(msg)}if(data?.error)throw new Error(data.error);return data},
  async subscribe(plan){try{toast('Opening checkout…');const d=await ui.fn('create-checkout',{plan,returnUrl:location.origin+location.pathname});if(!d.url)throw new Error('No checkout link came back.');location.href=d.url}catch(e){toast(e.message,'err')}},
  async billingPortal(){try{toast('Opening your billing page…');const d=await ui.fn('billing-portal',{returnUrl:location.origin+location.pathname});if(!d.url)throw new Error('No link came back.');location.href=d.url}catch(e){toast(e.message,'err')}},
  async deleteAccount(){if(!confirm('Delete your Backrow account? This cancels any subscription and permanently removes your synced lectures, notes and audio from the server. Copies already on this device stay until you clear the site data. This cannot be undone.'))return;
    try{await ui.fn('delete-account',{});await SYNC.client.auth.signOut().catch(()=>{});SYNC.user=null;SYNC.state='signedout';localStorage.removeItem('lt.dirty');localStorage.removeItem('lt.lastPull');ui.closeModal();ui.side();toast('Your account was deleted.')}catch(e){toast(e.message,'err')}},
  async fillGeminiModels(){const sel=document.getElementById('s_gmodel');const key=document.getElementById('s_gkey')?.value.trim();if(!sel||!key||sel.dataset.filled)return;sel.dataset.filled='1';
    try{const names=await LLM.geminiModels(key);const have=new Set([...sel.options].map(o=>o.value));for(const n of names){if(have.has(n))continue;const o=document.createElement('option');o.value=n;o.textContent=n;sel.appendChild(o)}}catch(e){sel.dataset.filled=''}},
  readSettings(){const g=id=>document.getElementById(id).value;return {...S.settings,provider:g('s_prov'),geminiKey:g('s_gkey').trim(),geminiModel:g('s_gmodel'),oaiUrl:g('s_ourl').trim(),oaiKey:g('s_okey').trim(),oaiModel:g('s_omodel').trim(),anthropicKey:g('s_akey').trim(),anthropicModel:g('s_amodel'),claudeModel:g('s_cmodel'),bridgeUrl:g('s_burl').trim()||'http://localhost:8790/v1',ollamaUrl:g('s_llurl').trim(),ollamaModel:g('s_llmodel').trim(),lang:g('s_lang').trim()||'en-US',whisper:g('s_wh'),autoNotes:document.getElementById('s_auto').checked}},
  saveSettings(){S.settings=ui.readSettings();saveSettings();ui.closeModal();toast('Settings saved.')},
  async testLLM(){const b=document.getElementById('testBtn');const prev=S.settings;S.settings=ui.readSettings();b.disabled=true;b.classList.add('busy');try{const r=await LLM.chat('Reply with the single word OK.',[{role:'user',content:'ping'}],{maxTokens:20});toast('Connected — model replied: '+r.trim().slice(0,40))}catch(e){toast(e.message,'err')}S.settings=prev;b.disabled=false;b.classList.remove('busy')},

  /* ---- sync ---- */
  openSync(first){const s=S.settings;const signed=!!SYNC.user;
    ui.modal(`<h2>${first?'Welcome to Backrow':'Sync between phone and laptop'}</h2><p class="muted">${first?'One step: type your email and tap the link we send (or enter the code). That turns on the AI and keeps your phone and laptop in sync.':'Type your email, tap the link we send (or enter the code), done. Recordings made on the phone show up on the laptop and vice versa. Do it once on each device.'}</p>
    ${signed?`<div class="card"><b>Signed in as ${esc(SYNC.user.email)}</b><div class="tiny">${esc(SYNC.msg||'')}</div><div class="row-btns" style="margin-top:10px"><button class="small" onclick="SYNC.run();ui.closeModal()">Sync now</button><button class="small" onclick="SYNC.signOut();ui.closeModal()">Sign out</button></div></div>`:''}
    ${!signed?`<label class="f">Your email</label><input id="sb_email" type="email" value="${esc(localStorage.getItem('lt.email')||'')}" placeholder="you@school.edu" autocomplete="email"><div class="row-btns" style="margin-top:10px"><button class="primary" id="sbSend" onclick="ui.sendLink()">Email me a sign-in code</button></div>
    <label class="f">Code from the email (or just tap the link in it)</label><div style="display:flex;gap:8px"><input id="sb_code" inputmode="numeric" placeholder="123456"><button onclick="ui.verifyCode()">Sign in</button></div>`:''}
    <details style="margin-top:18px"><summary class="tiny">Advanced: use your own Supabase project</summary><label class="f">Supabase project URL</label><input id="sb_url" value="${esc(s.supabaseUrl)}" placeholder="https://xxxx.supabase.co"><label class="f">Supabase publishable key</label><input id="sb_key" type="password" value="${esc(s.supabaseKey)}" placeholder="sb_publishable_…"><div class="row-btns" style="margin-top:12px"><button class="small" onclick="ui.saveSync()">Save connection</button></div></details>
    <div class="row-btns" style="margin-top:18px"><button onclick="ui.closeModal()">Close</button></div>`)},
  async saveSync(){S.settings.supabaseUrl=document.getElementById('sb_url').value.trim();S.settings.supabaseKey=document.getElementById('sb_key').value.trim();saveSettings();await SYNC.init();ui.syncBadge();toast(SYNC.state==='err'?'Could not connect: '+SYNC.msg:'Connection saved. Now sign in.',SYNC.state==='err'?'err':'')},
  async sendLink(){const email=document.getElementById('sb_email').value.trim();if(!email)return toast('Type your email.','err');localStorage.setItem('lt.email',email);const b=document.getElementById('sbSend');b.disabled=true;b.classList.add('busy');
    try{if(!SYNC.client)await ui.saveSync();await SYNC.signIn(email);toast('Sent. Check your inbox — tap the link, or type the code here.')}catch(e){toast(e.message,'err')}b.disabled=false;b.classList.remove('busy')},
  async verifyCode(){try{await SYNC.verify(document.getElementById('sb_email').value.trim(),document.getElementById('sb_code').value.trim());ui.closeModal();toast('Signed in. Syncing…')}catch(e){toast(e.message,'err')}},

  /* ---- modal / backup ---- */
  modal(html){ui.closeModal();const d=document.createElement('div');d.className='modal-bg';d.id='modal';d.innerHTML=`<div class="modal">${html}</div>`;d.onclick=e=>{if(e.target===d)ui.closeModal()};document.body.appendChild(d)},
  closeModal(){document.getElementById('modal')?.remove()},
  async exportAll(){
    const data={v:3,exported:Date.now()};for(const s of STORES)data[s]=await DB.all(s);
    const audio=await DB.all('audio');data.audio={};for(const a of audio)data.audio[a.id]={type:a.type,data:await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result.split(',')[1]);fr.readAsDataURL(a.blob)})};
    const blob=new Blob([JSON.stringify(data)],{type:'application/json'});const file=new File([blob],`backrow-backup-${new Date().toISOString().slice(0,10)}.json`,{type:'application/json'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:'Backrow backup'});return}catch{}}
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;a.click();toast('Backup downloaded.');
  },
  importAll(){const f=document.getElementById('importFile');f.onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const d=JSON.parse(await file.text());
      for(const s of STORES)for(const o of d[s]||[])await DB.put(s,o);for(const o of d.units||[])await DB.put('sections',o);
      for(const [id,a] of Object.entries(d.audio||{})){const bin=atob(a.data);const arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);await DB.putRaw('audio',{id,type:a.type,blob:new Blob([arr],{type:a.type})});SYNC.markDirty('audio',id)}
      await loadAll();ui.render();ui.storage();toast('Imported.')}catch(err){toast('Import failed: '+err.message,'err')}f.value=''};f.click()},
  async storage(){try{const e=await navigator.storage.estimate();document.getElementById('storageInfo').textContent=`On this device: ${(e.usage/1048576).toFixed(1)} MB`;navigator.storage.persist?.()}catch{}},
};
