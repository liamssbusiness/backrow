/* cal.js — calendar: Canvas feed (assignments & due dates) + class meeting times → calendar page, home strip, auto-filing, assignment import */

const cal={
  DAY:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
  data(){try{return JSON.parse(localStorage.getItem('lt.cal')||'null')}catch{return null}},
  save(d){localStorage.setItem('lt.cal',JSON.stringify(d))},
  events(){return cal.data()?.events||[]},
  stale(ms){const d=cal.data();return !d||Date.now()-(d.fetchedAt||0)>ms},

  /* ---- Canvas feed, fetched through the canvas-feed Edge Function (Canvas has no CORS) ---- */
  async refresh(opts={}){
    const url=(S.settings.canvasFeed||'').trim();if(!url)throw new Error('Paste your Canvas calendar feed link first.');
    if(!SYNC.client||!SYNC.user)throw new Error('Sign in to sync first (Settings → Sync between devices). The calendar is fetched through your account.');
    const {data,error}=await SYNC.client.functions.invoke('canvas-feed',{body:{url,force:!!opts.force}});
    if(error){let msg=error.message||'Could not fetch the calendar.';try{const j=await error.context?.json();if(j?.error)msg=j.error}catch{}throw new Error(msg)}
    if(data?.error)throw new Error(data.error);
    cal.save({fetchedAt:Date.now(),tz:data.tz||null,events:data.events||[]});return data;
  },
  async autoRefresh(){if(!S.settings.canvasFeed||!SYNC.user||!navigator.onLine||!cal.stale(6*3600000))return;try{await cal.refresh();const p=ui.route.parts[0]||'';if(p===''||p==='calendar')ui.render()}catch(e){console.warn('calendar',e)}},
  async saveFeed(){const v=document.getElementById('cal_url').value.trim();S.settings.canvasFeed=v;saveSettings();if(!v){localStorage.removeItem('lt.cal');toast('Feed link removed.');return ui.render()}await cal.doRefresh('calSave')},
  async doRefresh(btnId){const b=document.getElementById(btnId||'calRefresh');if(b){b.disabled=true;b.classList.add('busy')}
    try{const r=await cal.refresh({force:true});toast(`Fetched ${r.count} Canvas item${r.count===1?'':'s'}.`);ui.render()}catch(e){toast(e.message,'err');if(b){b.disabled=false;b.classList.remove('busy')}}},

  /* ---- matching Canvas courses ("2026FallC-T-PSY101-67106") to Backrow classes ---- */
  code(label){const m=String(label||'').toUpperCase().match(/([A-Z]{2,4})\s?-?(\d{3}[A-Z]?)/);return m?m[1]+' '+m[2]:null},
  norm(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'')},
  canvasCourses(){return [...new Set(cal.events().map(e=>e.course).filter(Boolean))]},
  courseFor(label){if(!label)return null;const map=S.settings.calMap||{};if(map[label]&&course(map[label]))return course(map[label]);const code=cal.code(label);if(!code)return null;return S.courses.find(c=>cal.norm(c.name).includes(cal.norm(code)))||null},
  async map(label,val){const map={...(S.settings.calMap||{})};
    if(val==='__new'){const code=cal.code(label)||label;const id=uid();await DB.put('courses',{id,name:code,vocab:'',syllabus:'',syllabusSummary:'',syllabusFile:null,created:Date.now()});await loadAll();map[label]=id;toast(`Created ${code}. Add its syllabus and meeting time from the class page.`)}
    else if(val)map[label]=val;else delete map[label];
    S.settings.calMap=map;saveSettings();ui.render()},

  /* ---- class meeting times: c.meets = {days:[1,3], start:'09:00', end:'10:15'} ---- */
  meetsOn(c,date){const m=c.meets;if(!m?.days?.length||!m.start)return null;if(!m.days.includes(date.getDay()))return null;
    const [sh,sm]=m.start.split(':').map(Number);const [eh,em]=(m.end||m.start).split(':').map(Number);
    const s=new Date(date);s.setHours(sh,sm,0,0);const e=new Date(date);e.setHours(eh,em,0,0);if(e<=s)e.setTime(s.getTime()+75*60000);return {start:s.getTime(),end:e.getTime()}},
  nowCourse(){const now=Date.now(),d=new Date();for(const c of S.courses){const m=cal.meetsOn(c,d);if(m&&now>=m.start-15*60000&&now<=m.end+15*60000)return c}return null},
  nextMeeting(){const now=Date.now();let best=null;for(let i=0;i<8;i++){const d=new Date();d.setDate(d.getDate()+i);for(const c of S.courses){const m=cal.meetsOn(c,d);if(m&&m.end>now&&(!best||m.start<best.start))best={c,...m}}}return best},
  meetsS(c){const m=c.meets;if(!m?.days?.length||!m.start)return '';return m.days.slice().sort((a,b)=>(a||7)-(b||7)).map(d=>cal.DAY[d]).join('/')+' '+cal.clockS(m.start)+(m.end?'–'+cal.clockS(m.end):'')},
  clockS(t){const [h,mi]=String(t).split(':').map(Number);const d=new Date();d.setHours(h,mi,0,0);return d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})},
  meetsForm(c){const m=c?.meets||{};return `<label class="f">Meets</label><div class="row-btns" id="c_days">${[1,2,3,4,5,6,0].map(d=>`<label style="display:flex;gap:4px;align-items:center;font-size:13px"><input type="checkbox" value="${d}" style="width:auto" ${m.days?.includes(d)?'checked':''}>${cal.DAY[d]}</label>`).join('')}</div>
    <div class="row-btns" style="margin-top:6px"><input type="time" id="c_start" value="${esc(m.start||'')}" style="width:auto"><span class="tiny">to</span><input type="time" id="c_end" value="${esc(m.end||'')}" style="width:auto"></div><div class="tiny">Set this and a recording started during class files itself here.</div>`},
  readMeets(){const days=[...document.querySelectorAll('#c_days input:checked')].map(i=>+i.value);const start=document.getElementById('c_start')?.value||'';const end=document.getElementById('c_end')?.value||'';return days.length&&start?{days,start,end}:null},

  /* ---- time helpers ---- */
  dueMs(e){if(typeof e.start==='number')return e.start;const [y,m,d]=String(e.start).split('-').map(Number);return new Date(y,m-1,d,23,59,0).getTime()},
  sameDay(a,b){return new Date(a).toDateString()===new Date(b).toDateString()},
  dayS(t,long){const now=Date.now();const d=new Date(t);const full=d.toLocaleDateString(undefined,{weekday:long?'long':'short',month:'short',day:'numeric'});if(cal.sameDay(t,now))return long?'Today · '+full:'Today';if(cal.sameDay(t,now+86400000))return long?'Tomorrow · '+full:'Tomorrow';return full},
  timeS(t){return new Date(t).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})},
  whenS(t,allDay){return allDay?cal.dayS(t):cal.dayS(t)+' '+cal.timeS(t)},

  /* ---- assignments from Canvas ---- */
  upcoming(days){const from=new Date();from.setHours(0,0,0,0);const to=Date.now()+days*86400000;return cal.events().filter(e=>{const t=cal.dueMs(e);return t>=from.getTime()&&t<=to}).sort((a,b)=>cal.dueMs(a)-cal.dueMs(b))},
  imported(e){return S.assignments.find(a=>a.canvasUid&&a.canvasUid===e.uid)},
  doneOf(e){return !!cal.imported(e)?.done},
  async toggleDone(id){const e=cal.events().find(x=>x.uid===id);if(!e)return;let a=cal.imported(e);if(a)a.done=a.done?null:Date.now();else{a=cal.toAssignment(e,cal.courseFor(e.course));a.done=Date.now()}await DB.put('assignments',a);await loadAll();ui.render()},
  async importEvent(id){const e=cal.events().find(x=>x.uid===id);if(!e)return;const have=cal.imported(e);if(have)return go('/assignment/'+have.id);
    const c=cal.courseFor(e.course);if(!c)return toast(`First say which class "${cal.code(e.course)||e.course}" is, in the Canvas classes box.`,'err');
    await DB.put('assignments',cal.toAssignment(e,c));await loadAll();toast('Added to Assignments.');ui.render()},
  toAssignment(e,c){return {id:uid(),courseId:c?.id||null,done:null,title:e.title,lectureId:null,sectionId:null,text:(e.description||'').trim(),fileName:null,image:null,imageType:null,brief:null,due:cal.dueMs(e),allDay:!!e.allDay,canvasUid:e.uid,canvasUrl:e.url||null,created:Date.now()}},
  async importAll(days){let n=0,skipped=0;for(const e of cal.upcoming(days)){if(cal.imported(e))continue;const c=cal.courseFor(e.course);if(!c){skipped++;continue}await DB.put('assignments',cal.toAssignment(e,c));n++}
    await loadAll();toast(n?`Added ${n} assignment${n===1?'':'s'}.${skipped?` ${skipped} skipped — match their Canvas course to a class first.`:''}`:skipped?'Match your Canvas courses to classes first.':'Nothing new to add.',skipped&&!n?'err':'');ui.render()},

  /* ---- home strip ---- */
  homeStrip(){const now=cal.nowCourse(),next=cal.nextMeeting();const parts=[];
    const due=cal.upcoming(2).filter(e=>!cal.doneOf(e));if(now)parts.push(`<b>${esc(now.name)}</b> is on now — <a href="#/record?course=${now.id}" onclick="event.stopPropagation()">record it</a>`);
    else if(next)parts.push(`Next class: <b>${esc(next.c.name)}</b>, ${esc(cal.whenS(next.start))}`);
    if(due.length)parts.push(`${due.length} Canvas item${due.length===1?'':'s'} due by tomorrow: ${due.slice(0,3).map(e=>esc(e.title)).join(', ')}${due.length>3?'…':''}`);
    if(parts.length)return `<div class="card click" onclick="go('/calendar')">${parts.map(p=>`<div>${p}</div>`).join('')}</div>`;
    return S.settings.canvasFeed||S.courses.some(c=>c.meets)?'':`<div class="card click" onclick="go('/calendar')"><b>Set up your calendar</b> <span class="muted">— Canvas due dates and class times, so lectures file themselves.</span></div>`},

  /* ---- calendar page ---- */
  agenda(days){const out=[],now=Date.now();
    for(let i=0;i<days;i++){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+i);const items=[];
      for(const c of S.courses){const m=cal.meetsOn(c,d);if(m&&m.end>now-3600000)items.push({kind:'class',c,start:m.start,end:m.end})}
      for(const e of cal.events()){const t=cal.dueMs(e);if(cal.sameDay(t,d.getTime()))items.push({kind:'due',e,start:t})}
      items.sort((a,b)=>a.start-b.start);if(items.length)out.push({d,items})}
    return out},
  row(e,inDay){const a=cal.imported(e),t=cal.dueMs(e),done=!!a?.done;const when=inDay?(e.allDay?'due end of day':'due '+cal.timeS(t)):'due '+cal.whenS(t,e.allDay);const c=cal.courseFor(e.course);
    return `<div class="card ${done?'done':''}" style="cursor:default"><div><b>${esc(e.title)}</b><div class="tiny">${esc(when)}${e.url?` · <a href="${esc(e.url)}" target="_blank" rel="noopener">open in Canvas</a>`:''}</div></div><div class="row-btns">${c?`<span class="pill ok">${esc(c.name.split(/\s[—–]\s/)[0].slice(0,16))}</span>`:`<span class="pill warn" title="${esc(e.course||'')}">${esc(cal.code(e.course)||'Canvas')}</span>`}${done?`<span class="pill ok">Done</span><button class="ghost" title="Mark not done" data-u="${esc(e.uid)}" onclick="cal.toggleDone(this.dataset.u)">↺</button>`:`<button class="small" data-u="${esc(e.uid)}" onclick="cal.toggleDone(this.dataset.u)">✓ Done</button>${a?`<button class="small" onclick="go('/assignment/${a.id}')">Open</button>`:`<button class="small primary" data-u="${esc(e.uid)}" onclick="cal.importEvent(this.dataset.u)">Add</button>`}`}</div></div>`},
  classesCard(){const cc=cal.canvasCourses();if(!cc.length&&!S.courses.length)return '';
    const rows=cc.map(label=>{const c=cal.courseFor(label);const code=cal.code(label)||label;return `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0;border-top:1px solid var(--line)"><div><b>${esc(code)}</b><div class="tiny">${esc(label)}</div></div><select style="width:auto;max-width:180px" data-l="${esc(label)}" onchange="cal.map(this.dataset.l,this.value)"><option value="">— pick a class —</option>${S.courses.map(x=>`<option value="${x.id}" ${c?.id===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}<option value="__new">+ Create "${esc(code)}"</option></select></div>`}).join('');
    const meets=S.courses.map(c=>`<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid var(--line)"><b>${esc(c.name)}</b><span class="tiny" style="text-align:right">${c.meets?esc(cal.meetsS(c)):'no meeting time'} · <a href="#" onclick="event.preventDefault();ui.editCourse('${c.id}')">edit</a></span></div>`).join('');
    return `<div class="grid2"><div class="card"><div class="eyebrow">Canvas classes</div><div class="tiny" style="margin:4px 0 8px">Which Backrow class each Canvas course is. Guessed from the course code; fix any that are wrong.</div>${rows||'<div class="tiny">Fetch the feed to see your Canvas courses.</div>'}</div>
      <div class="card"><div class="eyebrow">Meeting times</div><div class="tiny" style="margin:4px 0 8px">Set these and a lecture files itself under the class that is on right now.</div>${meets||'<div class="tiny">No classes yet.</div>'}</div></div>`},
  view(m){const d=cal.data(),feed=(S.settings.canvasFeed||'').trim();
    const setup=`<div class="eyebrow">Canvas</div><p class="muted" style="margin:6px 0 10px">Paste your Canvas calendar feed and every due date lands here. In Canvas: <b>Calendar → Calendar Feed</b> (bottom right) → copy the link. Works on a device that is signed in to sync.</p><input id="cal_url" value="${esc(feed)}" placeholder="https://yourschool.instructure.com/feeds/calendars/user_….ics"><div class="row-btns" style="margin-top:10px"><button class="primary small" id="calSave" onclick="cal.saveFeed()">Save and fetch</button></div>`;
    const ag=cal.agenda(14);
    m.innerHTML=`<div class="top"><div><div class="eyebrow">Calendar</div><h1>The next two weeks</h1><div class="muted">${d?`${d.events.length} Canvas items · updated ${new Date(d.fetchedAt).toLocaleString()}`:'Class times and Canvas due dates, in one list.'}</div></div>
      <div class="row-btns">${feed?`<button class="small" id="calRefresh" onclick="cal.doRefresh()">Refresh</button>`:''}${d?`<button class="small" onclick="cal.importAll(14)">Add everything due in 2 weeks</button>`:''}</div></div>
      ${!feed||!d?`<div class="card">${setup}</div>`:''}
      ${cal.classesCard()}
      ${ag.length?ag.map(({d,items})=>`<div class="eyebrow" style="margin:16px 0 8px">${esc(cal.dayS(d.getTime(),true))}</div><div class="list">${items.map(it=>it.kind==='class'?`<div class="card click" onclick="go('/course/${it.c.id}')"><div><b>${esc(it.c.name)}</b><div class="tiny">${esc(cal.timeS(it.start))}–${esc(cal.timeS(it.end))} · class</div></div>${Date.now()>=it.start-15*60000&&Date.now()<=it.end?`<button class="small primary" onclick="event.stopPropagation();go('/record?course=${it.c.id}')">● Record</button>`:'<span class="pill">Class</span>'}</div>`:cal.row(it.e,true)).join('')}</div>`).join(''):`<div class="card muted">Nothing on the calendar for the next two weeks${feed?'':' yet'}.</div>`}
      ${feed&&d?`<details class="card" style="margin-top:16px"><summary class="tiny">Canvas feed link</summary><div style="margin-top:8px">${setup}</div></details>`:''}`;
  },
};
