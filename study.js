/* study.js — transcript, notes, tutor, quizzes, weak spots, flashcards, assignments, search */

const study={
  /* ---- transcript (click a line to fix it; follows the player) ---- */
  async transcriptTab(el,l){
    const hasAudio=!!(await DB.get('audio',l.id))||!!(l.audioPath&&SYNC.user);
    const sorted=!!l.topics;const nT=sorted?l.segments.filter((_,i)=>lineKind(l,i)==='tangent').length:0;const hide=localStorage.getItem('lt.hideTangents')==='1';
    const tag=(i)=>{if(!sorted)return '';const k=lineKind(l,i);const b=l.topics.find(b=>i>=b.start&&i<=b.end);if(!b||i!==b.start||k==='content'&&!b.label)return '';return `<span class="tag ${k}" title="Tap to change" onclick="study.flipBlock('${l.id}',${b.start})">${k==='tangent'?'off-topic':k==='logistics'?'housekeeping':'content'}${b.label?' · '+esc(b.label):''}</span>`};
    el.innerHTML=`<div class="row-btns" style="margin-bottom:12px">${hasAudio?`<button class="small primary" id="whBtn" onclick="study.transcribeAI('${l.id}')">${l.segments?.length?'Re-transcribe with AI':'Transcribe with AI (free, on-device)'}</button>`:''}${l.segments?.length?`<button class="small" id="sortBtn" onclick="study.sortTopics('${l.id}')">${sorted?'Re-sort content vs tangents':'Sort content vs tangents'}</button>`:''}<button class="small" onclick="study.pasteTranscript('${l.id}')">${l.segments?.length?'Replace transcript':'Paste a transcript'}</button>${l.segments?.length?`<button class="small" onclick="navigator.clipboard.writeText(transcriptText(lecture('${l.id}'),null,{full:true}));toast('Copied.')">Copy</button>`:''}<span class="tiny" id="whStatus"></span></div><div class="bar" id="whBar" hidden><i></i></div>
      ${sorted?`<div class="tiny" style="margin-bottom:8px">${nT?`${nT} off-topic line${nT===1?'':'s'} dimmed — notes, quizzes and the tutor skip them. `:'No tangents found. '}<a href="#" onclick="event.preventDefault();localStorage.setItem('lt.hideTangents',${hide?"'0'":"'1'"});ui.render()">${hide?'Show tangents':'Hide tangents'}</a></div>`:''}
      <div class="card transcript" id="tx">${l.segments?.length?l.segments.map((s,i)=>{const k=sorted?lineKind(l,i):'content';if(hide&&k==='tangent')return '';return `<div class="seg ${k}" data-i="${i}">${tag(i)}<span class="t" onclick="ui.seek(${s.t})">${fmt(s.t)}</span><span class="x" title="Click to correct this line" onclick="study.editLine('${l.id}',${i},this)">${esc(s.text)}</span></div>`}).join(''):`<div class="muted">${hasAudio?'Run the free on-device transcription, or paste your own transcript. Notes, quizzes and the tutor all read from this text.':'No transcript. Record live for automatic captions, or paste one.'}</div>`}</div>
      ${l.segments?.length?'<div class="tiny" style="margin-top:6px">Click any line to fix a misheard word. Tap a tag to change what a block counts as. Captions follow the player as it plays.</div>':''}`;
  },
  async sortTopics(id){const l=lecture(id);const b=document.getElementById('sortBtn');if(b){b.disabled=true;b.classList.add('busy')}
    try{l.topics=await AI.topics(l);await DB.put('lectures',l);const n=l.segments.filter((_,i)=>lineKind(l,i)==='tangent').length;toast(n?`Sorted — ${n} off-topic line${n===1?'':'s'} set aside.`:'Sorted — it was all course material.');ui.render()}catch(e){toast('Could not sort: '+e.message,'err');ui.render()}},
  async flipBlock(id,start){const l=lecture(id);const b=(l.topics||[]).find(b=>b.start===start);if(!b)return;b.kind={content:'tangent',tangent:'logistics',logistics:'content'}[b.kind];await DB.put('lectures',l);ui.render()},
  editLine(id,i,span){const l=lecture(id);if(span.querySelector('textarea'))return;const ta=document.createElement('textarea');ta.value=l.segments[i].text;span.replaceWith(ta);ta.focus();
    const done=async()=>{const v=ta.value.trim();if(v&&v!==l.segments[i].text){l.segments[i].text=v;await DB.put('lectures',l)}ui.render()};
    ta.onblur=done;ta.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ta.blur()}if(e.key==='Escape'){ta.value=l.segments[i].text;ta.blur()}}},
  follow(l,t){const segs=l.segments||[];if(!segs.length)return;let i=segs.findIndex((s,k)=>t>=s.t&&(k===segs.length-1||t<segs[k+1].t));if(i<0)return;
    const box=document.getElementById('tx');if(!box)return;const cur=box.querySelector('.seg.now');const nxt=box.querySelector(`.seg[data-i="${i}"]`);if(cur===nxt)return;cur?.classList.remove('now');
    if(nxt){nxt.classList.add('now');const r=nxt.getBoundingClientRect(),b=box.getBoundingClientRect();if(r.top<b.top||r.bottom>b.bottom)nxt.scrollIntoView({block:'center',behavior:'smooth'})}},
  async transcribeAI(id){const l=lecture(id);let a=await DB.get('audio',id);if(!a&&l.audioPath){try{await SYNC.fetchAudio(l);a=await DB.get('audio',id)}catch(e){return toast(e.message,'err')}}if(!a)return toast('No audio stored.','err');
    const b=document.getElementById('whBtn'),st=document.getElementById('whStatus'),bar=document.getElementById('whBar');b.disabled=true;b.classList.add('busy');bar.hidden=false;
    try{const r=await WHISPER.transcribe(a.blob,(msg,p)=>{st.textContent=msg;bar.firstElementChild.style.width=(p*100)+'%'});
      if(!r.segments.length)throw new Error('No speech was detected in the audio.');l.segments=r.segments;l.topics=null;l.duration=l.duration||r.duration;l.transcriptSource='whisper';await DB.put('lectures',l);toast(`Transcribed ${r.segments.length} lines.`);ui.render();if(S.settings.autoNotes)study.genNotes(id).catch(()=>{})}
    catch(e){toast('Transcription failed: '+e.message,'err');b.disabled=false;b.classList.remove('busy');bar.hidden=true;st.textContent=''}},
  pasteTranscript(id){ui.modal(`<h2>Paste transcript</h2><p class="muted">Replaces the current transcript for this lecture.</p><textarea id="f_tx" style="min-height:240px"></textarea><div class="row-btns" style="margin-top:14px"><button class="primary" onclick="study.savePaste('${id}')">Save transcript</button><button onclick="ui.closeModal()">Cancel</button></div>`)},
  async savePaste(id){const l=lecture(id);const tx=document.getElementById('f_tx').value;if(!tx.trim())return;l.segments=ui.parseTranscript(tx,l.duration?l.duration/60:0);l.topics=null;if(!l.duration)l.duration=(l.segments.at(-1)?.t||0)+30;l.transcriptSource='paste';await DB.put('lectures',l);ui.closeModal();ui.render()},

  /* ---- notes (streamed) ---- */
  notesTab(el,l){
    if(!l.segments?.length){el.innerHTML='<div class="card muted">Transcribe this lecture first — notes are built from the transcript, not the raw audio.</div>';return}
    const busy=study._notesBusy===l.id;
    el.innerHTML=`<div class="row-btns" style="margin-bottom:12px"><button class="primary small ${busy?'busy':''}" id="genNotes" ${busy?'disabled':''} onclick="study.genNotes('${l.id}')">${busy?'Writing notes':l.notes?'Regenerate notes':'Write the notes'}</button>${l.notes?`<button class="small" onclick="navigator.clipboard.writeText(lecture('${l.id}').notes);toast('Copied as Markdown.')">Copy Markdown</button>`:''}<span class="tiny">~${Math.round(transcriptText(l).length/4/1000)}k tokens</span></div>
      <div class="card notes" id="notesBody">${l.notes?ui.cite(md(l.notes)):busy?'<span class="muted">Sorting content from tangents, then writing…</span>':'<span class="muted">Transcribed and filed. Write the notes to get the gist, the arguments in order, key terms, likely exam topics and the questions your professor left open — in their words, not a textbook\'s.</span>'}</div>`;
  },
  async genNotes(id){const l=lecture(id);if(study._notesBusy)return;study._notesBusy=id;if(ui.route.parts[1]===id&&ui.route.q.get('tab')==='notes')study.notesTab(document.getElementById('body'),l);
    try{if(!l.topics&&l.segments.length>=8){try{l.topics=await AI.topics(l);await DB.put('lectures',l)}catch(e){console.warn('topics',e)}}
      let last=0;const text=await AI.notes(l,partial=>{const now=Date.now();if(now-last<150)return;last=now;const nb=document.getElementById('notesBody');if(nb&&ui.route.parts[1]===id)nb.innerHTML=md(partial)});
      l.notes=text;await DB.put('lectures',l);study._notesBusy=null;toast('Notes ready.');if(!REC.active)ui.render();study.updateMemory(l).catch(e=>console.warn('memory',e))}
    catch(e){study._notesBusy=null;toast(e.message,'err');if(!REC.active)ui.render()}},
  async updateMemory(l){const c=course(l.courseId);if(!c||!l.notes)return;const m=await AI.memory(c,l);if(!m)return;c.memory=m;c.memoryUpdated=Date.now();c.memoryLecture=l.id;await DB.put('courses',c);if(ui.route.parts[0]==='course'&&ui.route.parts[1]===c.id)ui.render()},
  mineTab(el,l){
    el.innerHTML=`<div class="card"><div class="eyebrow">Your own notes to keep with the tape</div><textarea id="myNotes" style="min-height:260px;margin-top:10px" placeholder="Things to remember, questions for office hours, page references…">${esc(l.myNotes||'')}</textarea><div class="tiny" id="mySaved" style="margin-top:6px">Saves as you type.</div></div>`;
    let t;document.getElementById('myNotes').oninput=e=>{clearTimeout(t);t=setTimeout(async()=>{l.myNotes=e.target.value;await DB.put('lectures',l);document.getElementById('mySaved').textContent='Saved '+new Date().toLocaleTimeString()},600)};
  },

  /* ---- tutor (streamed) ---- */
  async tutor(el,scope,id,lectures){
    const q=ui.route.q;if(scope==='course'&&q.get('scope')==='section'&&section(q.get('id'))){scope='section';id=q.get('id')}
    const key=(scope==='lecture'?'recording:':scope+':')+id;
    const chat=(await DB.get('chats',key))||{id:key,messages:[]};study._chat=chat;
    const ready=scopeLectures(scope,id).length>0;
    const starters=scope==='lecture'?['What will the professor probably put on the exam from this?','Explain the hardest part again, simply.','Quiz me out loud on this material','What did the professor leave open or push to next week?']:['What will the professor probably put on the exam?','Where did I miss something between lectures?','What are the big themes across the whole course so far?','Build me a revision plan for the midterm','Quiz me out loud on this material'];
    const c=scope==='lecture'?lecture(id).courseId:scope==='section'?section(id).courseId:id;
    el.innerHTML=`<div class="row-btns" style="margin-bottom:10px"><span class="tiny">${esc(course(c)?.name||'')} TUTOR · ASKING</span>${scope==='lecture'?`<b>${esc(lecture(id).title)}</b>`:`<select style="width:auto" onchange="go('/course/${c}?tab=tutor'+(this.value==='course'?'':'&scope=section&id='+this.value))"><option value="course" ${scope==='course'?'selected':''}>the whole class</option>${S.sections.filter(s=>s.courseId===c).map(s=>`<option value="${s.id}" ${scope==='section'&&id===s.id?'selected':''}>section: ${esc(s.name)}</option>`).join('')}</select>`}<button class="small" onclick="study.clearChat('${key}')">Clear thread</button></div>
      <div class="card">${ready?'':'<div class="muted" style="margin-bottom:10px">The tutor only answers from your own transcripts and notes, so it needs at least one lecture written down in this scope.</div>'}
      <div class="chat" id="chat">${chat.messages.length?chat.messages.map((m,i)=>study.msgHTML(m,lectures,i,'tutor')).join(''):'<div class="tiny">Ask anything about this material. Answers are grounded in your own recordings — nothing else. They cite the moment it was said, and say when class never covered it.</div>'}</div>
      <div class="starters" style="margin-top:12px">${(chat.messages.at(-1)?.role==='assistant'?study.FOLLOWUPS:starters).map(s=>`<button onclick="document.getElementById('qbox').value=${JSON.stringify(s).replace(/"/g,'&quot;')};study.send('${scope}','${id}')">${esc(s)}</button>`).join('')}</div>
      <form style="display:flex;gap:8px" onsubmit="event.preventDefault();study.send('${scope}','${id}')"><input id="qbox" placeholder="I lost the thread at the universalisability test — what was the actual argument?" autocomplete="off" ${ready?'':'disabled'}><button class="primary" id="sendBtn" ${ready?'':'disabled'}>Ask</button></form>
      ${study.modelPicker()}</div>`;
    const ch=document.getElementById('chat');if(ch)ch.scrollTop=ch.scrollHeight;
  },
  FOLLOWUPS:['Explain it simpler','Give me an example','Quiz me on this','Where did he say it?'],
  modelPicker(){return `<div class="row-btns" style="margin-top:8px"><span class="tiny">MODEL</span><select style="width:auto;font-size:12px;padding:3px 8px" title="More models come with the paid plan"><option>Standard · included</option><option disabled>Deeper thinking · coming soon</option><option disabled>Exam coach · coming soon</option></select></div>`},
  msgHTML(m,list,i,owner){const a=m.role==='assistant';const n=(m.content.match(/\[(?:[^\[\]@]+ @ )?\d{1,2}:\d{2}\]/g)||[]).length;
    const rate=a&&owner!==undefined?`<span class="rate"><button class="ghost ${m.rating===1?'on':''}" title="Good answer" onclick="study.rate(${i},1,'${owner}')">👍</button><button class="ghost ${m.rating===-1?'on':''}" title="Off or wrong" onclick="study.rate(${i},-1,'${owner}')">👎</button></span>`:'';
    return `<div class="msg ${a?'a':'u'}">${a?ui.cite(md(m.content),list):esc(m.content)}${a?`<span class="foot">${n?`From your transcript · ${n} citation${n>1?'s':''}`:'From your transcript'}${rate}</span>`:''}</div>`},
  async rate(i,v,owner){const chat=owner==='live'?REC.chat:study._chat;const m=chat?.messages[i];if(!m)return;m.rating=m.rating===v?null:v;await DB.put('chats',chat);if(owner==='live')ui.renderLiveChat();else{const ch=document.getElementById('chat');if(ch)ch.innerHTML=chat.messages.map((x,k)=>study.msgHTML(x,undefined,k,'tutor')).join('')}},
  async send(scope,id){const box=document.getElementById('qbox');const q=box.value.trim();if(!q)return;const chat=study._chat;const hist=chat.messages.slice(-12);
    chat.messages.push({role:'user',content:q});box.value='';const ch=document.getElementById('chat');if(!ch)return;ch.innerHTML=chat.messages.map((m,i)=>study.msgHTML(m,undefined,i,'tutor')).join('')+'<div class="msg a" id="streaming"><span class="busy">Reading the tape</span></div>';ch.scrollTop=ch.scrollHeight;document.getElementById('sendBtn').disabled=true;
    try{const a=await AI.ask(scope,id,hist,q,partial=>{const s=document.getElementById('streaming');if(s){s.innerHTML=md(partial);ch.scrollTop=ch.scrollHeight}});chat.messages.push({role:'assistant',content:a});await DB.put('chats',chat)}catch(e){chat.messages.pop();toast(e.message,'err')}
    ui.render()},
  async clearChat(key){await DB.del('chats',key);ui.render()},

  /* ---- quizzes ---- */
  lectureQuizzes(el,l){const qs=S.quizzes.filter(q=>q.lectureId===l.id);el.innerHTML=`<div class="row-btns" style="margin-bottom:12px"><button class="primary small" onclick="study.newQuiz('${l.courseId}','lecture','${l.id}')">New quiz or test</button></div>${qs.length?`<div class="list">${qs.map(study.quizRow).join('')}</div>`:'<div class="card muted">Assessments from this lecture will show here. Questions are written from the transcript, with an answer key and explanations.</div>'}`},
  quizRow(q){const last=(q.attempts||[]).filter(a=>a.result).at(-1);return `<div class="card click" onclick="go('/quiz/${q.id}')"><div><b>${esc(q.title)}</b><div class="tiny">${q.kind==='test'?'Test':'Quiz'} · ${q.questions.length} q · ${q.difficulty} · ${q.scope==='lecture'?esc(lecture(q.lectureId)?.title||'lecture'):q.scope==='section'?'section: '+esc(section(q.sectionId)?.name||''):'whole class'} · ${dateS(q.created)}</div></div><div>${last?`<b>${last.result.score}/${last.result.max}</b>`:'<span class="pill">Not sat</span>'}<button class="ghost" onclick="event.stopPropagation();study.delQuiz('${q.id}')">×</button></div></div>`},
  quizzesView(m,q){const cid=q.get('course');const qs=S.quizzes.filter(x=>!cid||x.courseId===cid);
    m.innerHTML=`<div class="top"><div><div class="eyebrow">Examination room</div><h1>Quizzes &amp; tests</h1><div class="muted">Pick one lecture, a whole section, or the entire class, and it writes the paper from your own transcripts.</div></div><div class="row-btns">${S.courses.length?`<select id="qc" style="width:auto">${S.courses.map(c=>`<option value="${c.id}" ${c.id===cid?'selected':''}>${esc(c.name)}</option>`).join('')}</select><button class="primary small" onclick="study.newQuiz(document.getElementById('qc').value)">Build a quiz or test</button>`:''}</div></div>
      ${qs.length?`<div class="list">${qs.map(study.quizRow).join('')}</div>`:'<div class="card muted">Everything you have been quizzed on will show here.</div>'}`},
  newQuiz(courseId,scope,id,focus){
    const secs=S.sections.filter(s=>s.courseId===courseId),ls=S.lectures.filter(l=>l.courseId===courseId&&l.segments?.length);
    if(!ls.length)return toast('This class has no transcribed lecture yet.','err');study._focus=focus||'';
    ui.modal(`<h2>${focus?'Drill the gaps':'New quiz or test'}</h2><p class="muted">${focus?'A fresh paper built around the questions you got wrong.':'Questions are written from the lecture material you choose, with an answer key and explanations. Answers stay hidden until you submit.'}</p>
      <label class="f">Over</label><select id="nq_scope">${ls.map(l=>`<option value="lecture:${l.id}" ${scope==='lecture'&&id===l.id?'selected':''}>${esc(l.title)}</option>`).join('')}${secs.map(s=>`<option value="section:${s.id}" ${scope==='section'&&id===s.id?'selected':''}>A whole section — ${esc(s.name)}</option>`).join('')}<option value="course:${courseId}" ${!scope||scope==='course'?'selected':''}>All lectures in this class</option></select>
      <label class="f">Paper</label><select id="nq_kind"><option value="quiz">Quiz — 8 questions (multiple choice, true/false, short answer)</option><option value="test">Test — 18 questions, 100 points</option></select>
      <label class="f">Difficulty</label><select id="nq_diff"><option value="easy">Easy — recall</option><option value="standard" selected>Standard — the level a professor would test</option><option value="hard">Hard — application and the asides</option></select>
      <div class="row-btns" style="margin-top:18px"><button class="primary" id="nqBtn" onclick="study.genQuiz('${courseId}')">Write the paper</button><button onclick="ui.closeModal()">Cancel</button></div>`);
  },
  async genQuiz(courseId){const [scope,id]=document.getElementById('nq_scope').value.split(':');const kind=document.getElementById('nq_kind').value,difficulty=document.getElementById('nq_diff').value;const b=document.getElementById('nqBtn');b.disabled=true;b.classList.add('busy');b.textContent='Writing — about 20 seconds';
    try{const q=await AI.quiz(scope,id,kind,difficulty,study._focus);const quiz={id:uid(),courseId,scope,lectureId:scope==='lecture'?id:null,sectionId:scope==='section'?id:null,kind,difficulty,title:q.title||(kind==='test'?'Practice test':'Quick quiz'),questions:q.questions,created:Date.now(),attempts:[]};
      await DB.put('quizzes',quiz);await loadAll();ui.closeModal();go('/quiz/'+quiz.id)}catch(e){toast(e.message,'err');b.disabled=false;b.classList.remove('busy');b.textContent='Write the paper'}},
  async delQuiz(id){if(!confirm('Delete this paper and its marks?'))return;await DB.del('quizzes',id);await loadAll();if(ui.route.parts[0]==='quiz')go('/quizzes');else ui.render()},
  quizView(m,quiz){
    quiz.attempts=quiz.attempts||[];const review=ui.route.q.get('review');let at=review?quiz.attempts.find(a=>a.id===review):quiz.attempts.find(a=>!a.result);
    if(!at){at={id:uid(),answers:{},started:Date.now()};quiz.attempts.push(at)}
    const done=!!at.result,max=quiz.questions.reduce((a,q)=>a+q.points,0),list=scopeLectures(quiz.scope,quiz.lectureId||quiz.sectionId||quiz.courseId);
    const past=quiz.attempts.filter(a=>a.result);study._quiz={quiz,at};
    m.innerHTML=`<div class="top"><div><div class="eyebrow"><a href="#/quizzes?course=${quiz.courseId}">${esc(course(quiz.courseId)?.name||'')}</a> · ${quiz.kind==='test'?'Test':'Quiz'} · ${quiz.difficulty}</div><h1>${esc(quiz.title)}</h1><div class="muted">${quiz.questions.length} questions · ${max} points · ${quiz.scope==='lecture'?esc(lecture(quiz.lectureId)?.title||''):quiz.scope==='section'?'section: '+esc(section(quiz.sectionId)?.name||''):'whole class'}</div></div>
      <div class="row-btns">${done?`<button class="primary small" onclick="study.retake('${quiz.id}')">Retake</button>`:''}<button class="small danger" onclick="study.delQuiz('${quiz.id}')">Delete</button></div></div>
      ${done?`<div class="card" style="display:flex;gap:26px;align-items:center"><div class="score">${at.result.score}<span class="muted" style="font-size:20px">/${max}</span></div><div><b>${Math.round(at.result.score/max*100)}%</b><div class="tiny">${at.result.score/max>=0.8?'Solid. Retake next week to keep it.':'Worth another pass through the lecture before you retake this.'}</div></div></div>`:''}
      ${quiz.questions.map((q,i)=>{const ans=at.answers[i];const g=at.result?.grades?.[i];const col=g?.points===q.points?'var(--green)':g?.points?'var(--gold)':'var(--red)';
        return `<div class="q" data-q="${i}"><div class="n">Q${i+1} · ${{mcq:'Multiple choice',tf:'True or false',short:'Short answer'}[q.type]} · ${q.points} pts${done?` · <b style="color:${col}">${g?.points??0}/${q.points}</b>`:''}</div><div style="margin-bottom:8px">${esc(q.q)}</div>
          ${q.type==='mcq'?q.options.map((o,k)=>`<span class="opt ${ans===k?'sel':''} ${done?(k===q.answer?'right':ans===k?'wrong':''):''}" ${done?'':`onclick="study.answer(${i},${k})"`}>${String.fromCharCode(65+k)}. ${esc(o)}</span>`).join('')
          :q.type==='tf'?[true,false].map(v=>`<span class="opt ${ans===v?'sel':''} ${done?(v===q.answer?'right':ans===v?'wrong':''):''}" ${done?'':`onclick="study.answer(${i},${v})"`}>${v?'True':'False'}</span>`).join('')
          :`<textarea ${done?'disabled':''} oninput="study.answer(${i},this.value,true)" placeholder="Answer in 1–3 sentences">${esc(ans||'')}</textarea>`}
          ${done?`<div class="explain">${q.type==='short'?`<b>Model answer:</b> ${esc(q.answer)}<br>`:''}${g?.feedback?`<b>Feedback:</b> ${esc(g.feedback)}<br>`:''}${ui.cite(esc(q.explanation||''),list)}</div>`:''}</div>`}).join('')}
      ${done?'':`<div class="row-btns"><button class="primary" id="submitQ" onclick="study.submitQuiz()">Submit for marking</button><span class="tiny">Answers are hidden until you submit. Keys <kbd>1</kbd>–<kbd>4</kbd> pick an option.</span></div>`}
      ${past.length>1||(past.length&&!done)?`<div class="eyebrow" style="margin:24px 0 8px">Attempts</div><div class="list">${past.slice().reverse().map(a=>`<div class="card click" onclick="go('/quiz/${quiz.id}?review=${a.id}')"><span>${new Date(a.result.at).toLocaleString()}</span><b>${a.result.score}/${a.result.max}</b></div>`).join('')}</div>`:''}`;
  },
  async answer(i,v,silent){const {quiz,at}=study._quiz;at.answers[i]=v;await DB.put('quizzes',quiz);if(!silent){const box=document.querySelector(`.q[data-q="${i}"]`);if(box){box.querySelectorAll('.opt').forEach((o,k)=>{const q=quiz.questions[i];const val=q.type==='tf'?[true,false][k]:k;o.classList.toggle('sel',val===v)})}}},
  async submitQuiz(){const {quiz,at}=study._quiz;const b=document.getElementById('submitQ');b.disabled=true;b.classList.add('busy');b.textContent='Marking';
    try{const grades={};quiz.questions.forEach((q,i)=>{if(q.type!=='short')grades[i]={points:at.answers[i]===q.answer?q.points:0,feedback:''}});
      Object.assign(grades,await AI.grade(quiz,at.answers));quiz.questions.forEach((q,i)=>{if(!grades[i])grades[i]={points:0,feedback:(at.answers[i]||'').trim()?'':'Left blank.'}});
      const score=Object.values(grades).reduce((a,g)=>a+g.points,0),max=quiz.questions.reduce((a,q)=>a+q.points,0);at.result={score,max,grades,at:Date.now()};await DB.put('quizzes',quiz);go('/quiz/'+quiz.id+'?review='+at.id);ui.render()}
    catch(e){toast(e.message,'err');b.disabled=false;b.classList.remove('busy');b.textContent='Submit for marking'}},
  async retake(qid){const quiz=S.quizzes.find(q=>q.id===qid);quiz.attempts.push({id:uid(),answers:{},started:Date.now()});await DB.put('quizzes',quiz);go('/quiz/'+qid);ui.render()},

  /* ---- weak spots ---- */
  weakView(m,q){
    const cid=q.get('course');const misses=[];
    for(const quiz of S.quizzes){if(cid&&quiz.courseId!==cid)continue;const last=(quiz.attempts||[]).filter(a=>a.result).at(-1);if(!last)continue;
      quiz.questions.forEach((qq,i)=>{const g=last.result.grades[i];if(g&&g.points<qq.points)misses.push({quiz,q:qq,i,g,key:quiz.lectureId?'lecture:'+quiz.lectureId:quiz.sectionId?'section:'+quiz.sectionId:'course:'+quiz.courseId})})}
    const groups={};for(const x of misses)(groups[x.key]=groups[x.key]||[]).push(x);
    const label=k=>{const [s,id]=k.split(':');return s==='lecture'?esc(lecture(id)?.title||'lecture'):s==='section'?'Section: '+esc(section(id)?.name||''):'Whole class: '+esc(course(id)?.name||'')};
    m.innerHTML=`<div class="top"><div><div class="eyebrow">Weak spots</div><h1>What you keep getting wrong</h1><div class="muted">Every question you dropped points on in your most recent attempt, grouped by where it came from.</div></div></div>
      ${misses.length?Object.entries(groups).map(([k,xs])=>{const [s,id]=k.split(':');const c=xs[0].quiz.courseId;return `<div style="display:flex;justify-content:space-between;align-items:center;margin:16px 0 8px;gap:10px;flex-wrap:wrap"><h3>${label(k)}</h3><button class="primary small" onclick="study.drill('${c}','${s}','${id}',${JSON.stringify(xs.map(x=>x.q.q)).replace(/"/g,'&quot;')})">Drill these (${xs.length})</button></div>
        ${xs.map(x=>`<div class="q"><div class="n">${esc(x.quiz.title)} · ${x.g.points}/${x.q.points}</div><div>${esc(x.q.q)}</div><div class="explain">${x.q.type==='mcq'?`<b>Answer:</b> ${esc(x.q.options[x.q.answer])}<br>`:x.q.type==='tf'?`<b>Answer:</b> ${x.q.answer?'True':'False'}<br>`:`<b>Model answer:</b> ${esc(x.q.answer)}<br>`}${x.g.feedback?`<b>Feedback:</b> ${esc(x.g.feedback)}<br>`:''}${ui.cite(esc(x.q.explanation||''),S.lectures)}</div></div>`).join('')}`}).join(''):'<div class="card muted">Nothing here yet. Sit a quiz — anything you miss lands on this page with a one-click drill.</div>'}`;
  },
  drill(courseId,scope,id,questions){study.newQuiz(courseId,scope,id,questions.map(q=>'- '+q).join('\n'))},

  /* ---- flashcards (spaced repetition) ---- */
  dueCards(cid){const now=Date.now();return S.cards.filter(c=>(!cid||c.courseId===cid)&&(c.due||0)<=now)},
  lectureCards(el,l){const cs=S.cards.filter(c=>c.lectureId===l.id);const due=cs.filter(c=>(c.due||0)<=Date.now()).length;
    el.innerHTML=`<div class="row-btns" style="margin-bottom:12px"><button class="primary small" id="mkCards" onclick="study.makeCards('${l.id}')">${cs.length?'Regenerate cards':'Make flashcards'}</button>${cs.length?`<a href="#/cards?lecture=${l.id}"><button class="small">Review (${due} due)</button></a>`:''}</div>
      ${cs.length?`<div class="list">${cs.map(c=>`<div class="card"><div><b>${esc(c.front)}</b><div class="tiny" style="margin-top:4px">${esc(c.back)}</div></div><div class="tiny" style="white-space:nowrap">${(c.due||0)<=Date.now()?'due':'in '+Math.ceil((c.due-Date.now())/86400000)+'d'}<button class="ghost" onclick="study.delCard('${c.id}')">×</button></div></div>`).join('')}</div>`:'<div class="card muted">Flashcards are built from the key terms and arguments in this lecture, then scheduled with spaced repetition. Five minutes a day and they stick.</div>'}`;
    if(!l.segments?.length)el.innerHTML='<div class="card muted">Transcribe this lecture first.</div>'},
  async makeCards(id){const l=lecture(id);const b=document.getElementById('mkCards');b.disabled=true;b.classList.add('busy');
    try{const cards=await AI.cards(l);if(!cards.length)throw new Error('No cards came back.');for(const c of S.cards.filter(c=>c.lectureId===id))await DB.del('cards',c.id);
      for(const c of cards)await DB.put('cards',{id:uid(),lectureId:id,courseId:l.courseId,front:c.front,back:c.back,due:Date.now(),interval:0,reps:0,created:Date.now()});
      await loadAll();ui.render();toast(`${cards.length} cards ready.`)}catch(e){toast(e.message,'err');b.disabled=false;b.classList.remove('busy')}},
  async delCard(id){await DB.del('cards',id);await loadAll();ui.render()},
  cardsView(m,q){
    const cid=q.get('course'),lid=q.get('lecture');let pool=S.cards.filter(c=>(!cid||c.courseId===cid)&&(!lid||c.lectureId===lid));
    const due=pool.filter(c=>(c.due||0)<=Date.now()).sort((a,b)=>(a.due||0)-(b.due||0));
    const scopeName=lid?lecture(lid)?.title:cid?course(cid)?.name:'all classes';
    if(!pool.length){m.innerHTML=`<div class="top"><div><div class="eyebrow">Flashcards</div><h1>Nothing to review yet</h1></div></div><div class="card muted">Open a lecture → Cards → "Make flashcards". They come back here on a spaced-repetition schedule.</div>`;return}
    if(!due.length){const next=Math.min(...pool.map(c=>c.due||0));m.innerHTML=`<div class="top"><div><div class="eyebrow">Flashcards · ${esc(scopeName)}</div><h1>All caught up</h1><div class="muted">${pool.length} cards on file. Next one due ${new Date(next).toLocaleString()}.</div></div></div><div class="row-btns"><button onclick="study.cramAll('${cid||''}','${lid||''}')">Review everything anyway</button></div>`;return}
    const c=due[0];study._card=c;study._flipped=false;
    m.innerHTML=`<div class="top"><div><div class="eyebrow">Flashcards · ${esc(scopeName)}</div><h1>${due.length} due</h1><div class="muted">${esc(lecture(c.lectureId)?.title||'')}</div></div></div>
      <div class="card flash" id="flash" onclick="study.flip()">${esc(c.front)}<small>Tap or press Space to flip</small></div>
      <div class="row-btns" id="grades" hidden style="justify-content:center"><button class="danger" onclick="study.gradeCard(0)">Again <kbd>1</kbd></button><button onclick="study.gradeCard(1)">Hard <kbd>2</kbd></button><button class="primary" onclick="study.gradeCard(2)">Good <kbd>3</kbd></button><button onclick="study.gradeCard(3)">Easy <kbd>4</kbd></button></div>`;
  },
  flip(){const c=study._card;if(!c)return;study._flipped=true;document.getElementById('flash').innerHTML=`<div style="font-size:15px;color:var(--ink3);font-family:var(--sans);margin-bottom:12px">${esc(c.front)}</div>${ui.cite(esc(c.back),S.lectures)}`;document.getElementById('grades').hidden=false},
  async gradeCard(g){const c=study._card;if(!c||!study._flipped)return;const day=86400000;
    if(g===0){c.interval=0;c.due=Date.now()+10*60000}else{const base=c.interval||0;c.interval=g===1?Math.max(1,base*1.2):g===2?(base?base*2.5:1):(base?base*3.5:3);c.due=Date.now()+c.interval*day}
    c.reps=(c.reps||0)+1;c.last=Date.now();await DB.put('cards',c);await loadAll();ui.render()},
  async cramAll(cid,lid){for(const c of S.cards.filter(c=>(!cid||c.courseId===cid)&&(!lid||c.lectureId===lid))){c.due=Date.now();await DB.putRaw('cards',c)}await loadAll();ui.render()},

  /* ---- assignments ---- */
  lectureAssignments(el,l){const as=S.assignments.filter(a=>a.lectureId===l.id);el.innerHTML=`<div class="row-btns" style="margin-bottom:12px"><button class="primary small" onclick="study.newAssignment('${l.courseId}','${l.id}')">Attach an assignment</button></div>${as.length?`<div class="list">${as.map(study.assignRow).join('')}</div>`:'<div class="card muted">Attach a PDF, a photo of the sheet, or a text file — then let the AI break it down. Linking it to this lecture makes the brief point back at the tape.</div>'}`},
  async toggleDone(id){const a=S.assignments.find(x=>x.id===id);if(!a)return;a.done=a.done?null:Date.now();await DB.put('assignments',a);await loadAll();ui.render()},
  assignRow(a){return `<div class="card click ${a.done?'done':''}" onclick="go('/assignment/${a.id}')"><div><b>${esc(a.title)}</b><div class="tiny">${esc(course(a.courseId)?.name||'')}${a.lectureId?' · '+esc(lecture(a.lectureId)?.title||''):a.sectionId?' · '+esc(section(a.sectionId)?.name||''):''} · ${a.fileName?esc(a.fileName)+' · ':''}${a.due?'due '+esc(cal.whenS(a.due,a.allDay)):dateS(a.created)}</div></div><div class="row-btns">${a.done?`<span class="pill ok">Done</span><button class="ghost" title="Mark not done" onclick="event.stopPropagation();study.toggleDone('${a.id}')">↺</button>`:`${a.brief?'<span class="pill ok">Brief ready</span>':'<span class="pill">No brief</span>'}<button class="small" onclick="event.stopPropagation();study.toggleDone('${a.id}')">✓ Done</button>`}<button class="ghost" onclick="event.stopPropagation();study.delAssignment('${a.id}')">×</button></div></div>`},
  assignmentsView(m,q){const cid=q.get('course');const as=S.assignments.filter(a=>!cid||a.courseId===cid).sort((x,y)=>(!!x.done-!!y.done)||((x.due||x.created)-(y.due||y.created)));
    m.innerHTML=`<div class="top"><div><div class="eyebrow">Assignments</div><h1>Handouts, read against your lectures</h1><div class="muted">Upload the handout and it gets read against your lectures — the tasks hidden in the prose, what to hand in, and where it was covered in class.</div></div><div class="row-btns">${S.courses.length?`<select id="ac" style="width:auto">${S.courses.map(c=>`<option value="${c.id}" ${c.id===cid?'selected':''}>${esc(c.name)}</option>`).join('')}</select><button class="primary small" onclick="study.newAssignment(document.getElementById('ac').value)">New assignment</button>`:''}</div></div>
      ${as.length?`<div class="list">${as.map(study.assignRow).join('')}</div>`:'<div class="card muted">Nothing attached yet.</div>'}`},
  newAssignment(courseId,lectureId){const ls=S.lectures.filter(l=>l.courseId===courseId),secs=S.sections.filter(s=>s.courseId===courseId);
    ui.modal(`<h2>Attach an assignment</h2><label class="f">Title</label><input id="a_title" placeholder="Essay 1 — the categorical imperative"><label class="f">Lecture or section it goes with</label><select id="a_link"><option value="">The whole class</option>${secs.map(s=>`<option value="section:${s.id}">Section — ${esc(s.name)}</option>`).join('')}${ls.map(l=>`<option value="lecture:${l.id}" ${l.id===lectureId?'selected':''}>${esc(l.title)}</option>`).join('')}</select>
      <label class="f">File (PDF, photo, or text) — optional</label><div class="row-btns"><button onclick="document.getElementById('assignFile').click()">Choose file or take a photo</button><span class="tiny" id="a_file">none</span></div>
      <label class="f">Or paste the assignment text</label><textarea id="a_text" placeholder="Paste the handout text here if you have no file."></textarea>
      <div class="row-btns" style="margin-top:16px"><button class="primary" id="aBtn" onclick="study.saveAssignment('${courseId}')">Save assignment</button><button onclick="ui.closeModal()">Cancel</button></div>`);
    study._afile=null;document.getElementById('assignFile').onchange=e=>{study._afile=e.target.files[0]||null;document.getElementById('a_file').textContent=study._afile?study._afile.name:'none';if(study._afile&&!document.getElementById('a_title').value)document.getElementById('a_title').value=study._afile.name.replace(/\.[^.]+$/,'');e.target.value=''}},
  async shrinkImage(file){const img=await createImageBitmap(file);const max=1600;const s=Math.min(1,max/Math.max(img.width,img.height));const cv=document.createElement('canvas');cv.width=Math.round(img.width*s);cv.height=Math.round(img.height*s);cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);return cv.toDataURL('image/jpeg',0.85).split(',')[1]},
  async saveAssignment(courseId){const title=document.getElementById('a_title').value.trim();if(!title)return toast('Give the assignment a title.','err');const link=document.getElementById('a_link').value;const b=document.getElementById('aBtn');b.disabled=true;b.classList.add('busy');
    try{const a={id:uid(),courseId,title,lectureId:link.startsWith('lecture:')?link.slice(8):null,sectionId:link.startsWith('section:')?link.slice(8):null,text:document.getElementById('a_text').value.trim(),fileName:study._afile?.name||null,image:null,imageType:null,brief:null,created:Date.now()};
      const f=study._afile;
      if(f){if(f.type==='application/pdf'||/\.pdf$/i.test(f.name)){a.text=(await pdfText(await f.arrayBuffer())).trim()+(a.text?'\n\n'+a.text:'');if(!a.text.trim())toast('That PDF has no text layer (scanned). Add a photo instead so the AI can read it.','err')}
        else if(f.type.startsWith('image/')){a.image=await study.shrinkImage(f);a.imageType='image/jpeg'}
        else a.text=(await f.text()).trim()+(a.text?'\n\n'+a.text:'')}
      if(!a.text&&!a.image)throw new Error('Attach a file or paste the assignment text.');
      await DB.put('assignments',a);await loadAll();ui.closeModal();go('/assignment/'+a.id);study.buildBrief(a.id)}catch(e){toast('The assignment did not save: '+e.message,'err');b.disabled=false;b.classList.remove('busy')}},
  async delAssignment(id){if(!confirm('Delete this assignment?'))return;await DB.del('assignments',id);await loadAll();if(ui.route.parts[0]==='assignment')go('/assignments');else ui.render()},
  assignmentView(m,a){const w=a.brief;
    m.innerHTML=`<div class="top"><div><div class="eyebrow">${a.courseId?`<a href="#/assignments?course=${a.courseId}">${esc(course(a.courseId)?.name||'')}</a>`:'Canvas'}${a.lectureId?` · <a href="#/lecture/${a.lectureId}">${esc(lecture(a.lectureId)?.title||'')}</a>`:a.sectionId?' · '+esc(section(a.sectionId)?.name||''):''}</div><h1>${esc(a.title)}</h1><div class="muted">${a.due?'Due '+esc(cal.whenS(a.due,a.allDay))+' · ':''}${a.fileName?esc(a.fileName)+' · ':''}${dateS(a.created)}${a.canvasUrl?` · <a href="${esc(a.canvasUrl)}" target="_blank" rel="noopener">open in Canvas</a>`:''}</div></div>
      <div class="row-btns">${a.done?`<span class="pill ok">Done</span><button class="small" onclick="study.toggleDone('${a.id}')">Not done</button>`:`<button class="small" onclick="study.toggleDone('${a.id}')">✓ Done</button>`}<button class="primary small" id="briefBtn" onclick="study.buildBrief('${a.id}')">${w?'Rebuild brief':'Build the brief'}</button><button class="small danger" onclick="study.delAssignment('${a.id}')">Delete</button></div></div>
      ${a.image?`<div class="card"><img src="data:${a.imageType};base64,${a.image}" style="max-height:360px;border-radius:8px"></div>`:''}
      <div id="brief">${w?`<div class="card notes"><h2>What it asks</h2><p>${esc(w.summary)}</p>${w.tasks?.length?`<h2>Tasks hidden in the prose</h2><ol>${w.tasks.map(t=>`<li>${esc(t)}</li>`).join('')}</ol>`:''}${w.handIn?`<h2>What to hand in</h2><p>${esc(w.handIn)}</p>`:''}<h2>Where it was covered in class</h2>${w.lectureLinks?.length?`<ul>${w.lectureLinks.map(x=>`<li>${x.lectureId?`<a href="#/lecture/${x.lectureId}${x.at?'?t='+study.secs(x.at):''}">${esc(x.lecture)}${x.at?' @ '+esc(x.at):''}</a>`:esc(x.lecture)} — ${esc(x.why)}</li>`).join('')}</ul>`:'<p class="muted">No lecture on file covers this yet.</p>'}</div>`:a.briefStatus==='working'?'<div class="card muted busy">Pulling out the tasks and matching them to your lectures</div>':'<div class="card muted">No brief yet.</div>'}</div>
      ${a.text?`<details class="card"><summary>Assignment text</summary><pre style="white-space:pre-wrap;font:inherit;margin-top:10px">${esc(a.text)}</pre></details>`:''}`},
  secs(s){const m=String(s).match(/(\d{1,2}):(\d{2})/);return m?+m[1]*60+ +m[2]:0},
  async buildBrief(id){const a=S.assignments.find(x=>x.id===id);a.briefStatus='working';ui.render();try{a.brief=await AI.brief(a);a.briefStatus='ready';await DB.put('assignments',a);toast('Brief ready.')}catch(e){a.briefStatus='failed';toast('Brief failed: '+e.message,'err')}ui.render()},

  /* ---- search ---- */
  searchView(m,q){
    const hits=[];const needle=q.trim().toLowerCase();
    if(needle.length>=2)for(const l of S.lectures)for(const s of (l.segments||[])){const i=s.text.toLowerCase().indexOf(needle);if(i>=0){hits.push({l,s,i});if(hits.length>200)break}}
    const hl=t=>esc(t).replace(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),x=>`<mark>${x}</mark>`);
    m.innerHTML=`<div class="top"><div><div class="eyebrow">Search transcripts</div><h1>The words your professors actually said</h1></div></div>
      <form class="card" style="display:flex;gap:8px" onsubmit="event.preventDefault();go('/search?q='+encodeURIComponent(this.q.value))"><input name="q" id="searchBox" value="${esc(q)}" placeholder="categorical imperative" autofocus><button class="primary">Search</button></form>
      ${needle.length>=2?`<div class="tiny" style="margin-bottom:10px">${hits.length} hit${hits.length===1?'':'s'}${hits.length>200?' (showing first 200)':''}</div>`:''}
      <div class="list">${hits.map(({l,s,i})=>`<div class="card click" onclick="go('/lecture/${l.id}?t=${Math.floor(s.t)}')"><div><div class="tiny">${esc(lecLabel(l))} · <span class="cite">${fmt(s.t)}</span></div><div>${hl(s.text.slice(Math.max(0,i-120),i+200))}</div></div></div>`).join('')}</div>`;
  },
};
