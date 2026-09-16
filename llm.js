/* llm.js — providers (Backrow AI via the ai-proxy Edge Function, Gemini free tier, Anthropic, OpenAI-compatible e.g. Groq/OpenRouter, Ollama, Claude Code bridge) with streaming */

const LLM={
  // messages: [{role:'user'|'assistant', content: string | [{type:'text',text}|{type:'image',data,mediaType}]}]
  // opts: {json, maxTokens, onToken(partialText), kind} — kind names the job (notes, tutor, quiz…) so the server picks the model and meters it
  async chat(system,messages,opts={}){
    const st=S.settings;const p=st.provider;
    const fn={backrow:LLM.backrow,gemini:LLM.gemini,anthropic:LLM.anthropic,openai:LLM.openai,ollama:LLM.ollama,claudecode:LLM.claudecode}[p]||LLM.backrow;
    return fn(system,messages,opts);
  },
  parts(content){return typeof content==='string'?[{type:'text',text:content}]:content},
  text(content){return LLM.parts(content).filter(b=>b.type==='text').map(b=>b.text).join('\n')},
  parseJSON(text){let t=(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a>0||b<t.length-1)t=t.slice(a,b+1);return JSON.parse(t)},
  need(v,msg){if(!v)throw new Error(msg)},

  // read an SSE / ndjson body, calling onLine for every non-empty line
  async readLines(resp,onLine){
    const reader=resp.body.getReader();const dec=new TextDecoder();let buf='';
    while(true){const {done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});let i;
      while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i).trim();buf=buf.slice(i+1);if(line)onLine(line)}}
    if(buf.trim())onLine(buf.trim());
  },
  async errorText(r){let m='';try{const j=await r.json();m=j.error?.message||j.error||JSON.stringify(j)}catch{}return (m||'').toString().slice(0,300)},

  /* ---- Backrow AI (included in the plan) — the ai-proxy Edge Function holds the key, checks the plan and meters usage ---- */
  async backrow(system,messages,{json=false,maxTokens=8000,onToken,kind='other'}={}){
    const st=S.settings;
    if(!SYNC.client||!SYNC.user)throw new Error('Sign in to use Backrow AI: Settings → Sync between devices → type your email. Takes a minute.');
    const {data}=await SYNC.client.auth.getSession();const token=data?.session?.access_token;   // getSession refreshes an expired token
    LLM.need(token,'Your sign-in expired. Open Settings → Sync between devices and sign in again.');
    const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),70000);
    const r=await fetch(st.supabaseUrl.replace(/\/$/,'')+'/functions/v1/ai-proxy',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,apikey:st.supabaseKey},
      body:JSON.stringify({system,messages,json,maxTokens,stream:!!onToken,kind}),signal:ctl.signal}).catch(e=>{clearTimeout(timer);throw new Error(e.name==='AbortError'?'Backrow AI took too long. Try again.':'Network error reaching Backrow AI. Are you online?')});
    if(!r.ok){clearTimeout(timer);let j={};try{j=await r.json()}catch{}const e=new Error(j.error||(r.status===401?'Sign in to Backrow first (Settings → Sync between devices).':'Backrow AI error '+r.status));e.code=j.code;e.status=r.status;throw e}
    try{
      if(onToken){let out='',err='';await LLM.readLines(r,line=>{if(!line.startsWith('data:'))return;try{const j=JSON.parse(line.slice(5));if(j.t){out+=j.t;onToken(out)}if(j.error)err=j.error}catch{}});
        if(err&&!out)throw new Error(err);LLM.need(out,'Backrow AI returned an empty answer. Try again.');return out}
      const j=await r.json();LLM.need(j.text,'Backrow AI returned an empty answer. Try again.');return j.text;
    }finally{clearTimeout(timer)}
  },

  /* ---- Google Gemini (free tier) ---- */
  async gemini(system,messages,opts={}){
    // retired model name → switch to the alias; overloaded (503) or rate-limited (429) → back off, then try Flash-Lite
    for(let attempt=0;;attempt++){
      try{return await LLM.geminiOnce(system,messages,opts)}
      catch(e){const m=e.message||'';
        if(/404|no longer available|not found/i.test(m)&&S.settings.geminiModel!=='gemini-flash-latest'){S.settings.geminiModel='gemini-flash-latest';saveSettings();toast('That Gemini model was retired — switched to the current Flash model.');continue}
        if(/503|high demand|overloaded|429|quota|rate|timed out/i.test(m)&&attempt<2){if(!opts.model){toast('Gemini Flash is busy — using Flash-Lite for this request…');opts={...opts,model:'gemini-flash-lite-latest'}}else{toast('Gemini is busy — retrying…');await sleep(1500)}continue}
        throw e}}
  },
  async geminiOnce(system,messages,{json=false,maxTokens=8000,onToken,model}={}){
    const st=S.settings;LLM.need(st.geminiKey,'No Gemini API key set. Open Settings — a free key takes one click at aistudio.google.com.');
    const contents=messages.map(m=>({role:m.role==='assistant'?'model':'user',parts:LLM.parts(m.content).map(b=>b.type==='image'?{inline_data:{mime_type:b.mediaType,data:b.data}}:{text:b.text})}));
    // Gemini 3.x thinks before answering and the thinking counts against maxOutputTokens, so never send a tiny budget
    const body={system_instruction:{parts:[{text:system}]},contents,generationConfig:{maxOutputTokens:Math.max(maxTokens,4096),temperature:0.4,...(json?{responseMimeType:'application/json'}:{})}};
    const base=`https://generativelanguage.googleapis.com/v1beta/models/${model||st.geminiModel}`;
    const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),25000);const netErr=e=>{throw new Error(e.name==='AbortError'?'Gemini timed out (busy).':'Network error reaching Gemini.')};
    if(onToken){
      const r=await fetch(`${base}:streamGenerateContent?alt=sse&key=${encodeURIComponent(st.geminiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctl.signal}).catch(netErr);clearTimeout(timer);
      if(!r.ok)throw new Error('Gemini error '+r.status+': '+await LLM.errorText(r));
      let out='';await LLM.readLines(r,line=>{if(!line.startsWith('data:'))return;try{const j=JSON.parse(line.slice(5));const t=(j.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('');if(t){out+=t;onToken(out)}if(j.promptFeedback?.blockReason)throw new Error('Gemini blocked the request: '+j.promptFeedback.blockReason)}catch(e){if(e.message.startsWith('Gemini'))throw e}});
      LLM.need(out,'Gemini returned an empty answer.');return out;
    }
    const r=await fetch(`${base}:generateContent?key=${encodeURIComponent(st.geminiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctl.signal}).catch(netErr);clearTimeout(timer);
    if(!r.ok)throw new Error('Gemini error '+r.status+': '+await LLM.errorText(r));
    const j=await r.json();const t=(j.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('');
    LLM.need(t,'Gemini returned an empty answer'+(j.promptFeedback?.blockReason?' ('+j.promptFeedback.blockReason+')':j.candidates?.[0]?.finishReason==='MAX_TOKENS'?' (ran out of output room while thinking — try again)':'')+'.');return t;
  },

  async geminiModels(key){const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key='+encodeURIComponent(key));if(!r.ok)throw new Error('Could not list models ('+r.status+')');const j=await r.json();
    return (j.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>m.name.replace('models/','')).filter(n=>/^gemini-/.test(n)&&!/image|tts|audio|robotics|computer-use|transcribe|omni|customtools|preview-\d/.test(n)).sort()},

  /* ---- Anthropic (your own key) ---- */
  async anthropic(system,messages,{maxTokens=8000,onToken}={}){
    const st=S.settings;LLM.need(st.anthropicKey,'No Anthropic API key set. Open Settings.');
    const msgs=messages.map(m=>typeof m.content==='string'?m:{role:m.role,content:m.content.map(b=>b.type==='image'?{type:'image',source:{type:'base64',media_type:b.mediaType,data:b.data}}:b)});
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':st.anthropicKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:st.anthropicModel,max_tokens:maxTokens,system,messages:msgs,stream:!!onToken})}).catch(()=>{throw new Error('Network error reaching api.anthropic.com')});
    if(!r.ok)throw new Error('Anthropic error '+r.status+': '+await LLM.errorText(r));
    if(onToken){let out='',stop='';await LLM.readLines(r,line=>{if(!line.startsWith('data:'))return;try{const j=JSON.parse(line.slice(5));if(j.type==='content_block_delta'&&j.delta?.text){out+=j.delta.text;onToken(out)}if(j.type==='message_delta')stop=j.delta?.stop_reason||stop}catch{}});
      if(stop==='refusal')throw new Error('The model declined this request.');return out}
    const d=await r.json();if(d.stop_reason==='refusal')throw new Error('The model declined this request.');
    return d.content.filter(b=>b.type==='text').map(b=>b.text).join('');
  },

  /* ---- OpenAI-compatible (Groq free tier, OpenRouter, LM Studio, …) ---- */
  async openai(system,messages,{json=false,maxTokens=8000,onToken}={}){
    const st=S.settings;LLM.need(st.oaiKey||/localhost|127\.0\.0\.1/.test(st.oaiUrl),'No API key set for the OpenAI-compatible provider. Open Settings.');
    const msgs=[{role:'system',content:system},...messages.map(m=>typeof m.content==='string'?m:{role:m.role,content:m.content.map(b=>b.type==='image'?{type:'image_url',image_url:{url:`data:${b.mediaType};base64,${b.data}`}}:{type:'text',text:b.text})})];
    const r=await fetch(st.oaiUrl.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',...(st.oaiKey?{Authorization:'Bearer '+st.oaiKey}:{})},
      body:JSON.stringify({model:st.oaiModel,messages:msgs,max_tokens:maxTokens,temperature:0.4,stream:!!onToken,...(json?{response_format:{type:'json_object'}}:{})})}).catch(()=>{throw new Error('Network error reaching '+st.oaiUrl)});
    if(!r.ok)throw new Error('Provider error '+r.status+': '+await LLM.errorText(r));
    if(onToken){let out='';await LLM.readLines(r,line=>{if(!line.startsWith('data:')||line.includes('[DONE]'))return;try{const j=JSON.parse(line.slice(5));const t=j.choices?.[0]?.delta?.content;if(t){out+=t;onToken(out)}}catch{}});return out}
    const d=await r.json();return d.choices?.[0]?.message?.content||'';
  },

  /* ---- Claude Code bridge (your subscription, this Mac only) ---- */
  async claudecode(system,messages,opts={}){
    const st=S.settings;const url=(st.bridgeUrl||'http://localhost:8790/v1').replace(/\/$/,'');
    const saved={oaiUrl:st.oaiUrl,oaiKey:st.oaiKey,oaiModel:st.oaiModel};
    try{Object.assign(st,{oaiUrl:url,oaiKey:'',oaiModel:st.claudeModel||'sonnet'});return await LLM.openai(system,messages,opts)}
    catch(e){if(/Network error/.test(e.message))throw new Error('The Claude bridge is not running on this Mac. Double-click start-bridge.command in the Backrow folder, then try again.');throw e}
    finally{Object.assign(st,saved)}
  },

  /* ---- Ollama (local) ---- */
  async ollama(system,messages,{json=false,onToken}={}){
    const st=S.settings;
    const msgs=messages.map(m=>{if(typeof m.content==='string')return m;const text=LLM.text(m.content);const images=m.content.filter(b=>b.type==='image').map(b=>b.data);return {role:m.role,content:text,...(images.length?{images}:{})}});
    const r=await fetch(st.ollamaUrl.replace(/\/$/,'')+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:st.ollamaModel,stream:!!onToken,format:json?'json':undefined,options:{num_ctx:32768},messages:[{role:'system',content:system},...msgs]})}).catch(()=>{throw new Error('Cannot reach Ollama at '+st.ollamaUrl+'. Is it running, and is OLLAMA_ORIGINS set to allow this site?')});
    if(!r.ok)throw new Error('Ollama error '+r.status+': '+(await r.text()).slice(0,200));
    if(onToken){let out='';await LLM.readLines(r,line=>{try{const j=JSON.parse(line);const t=j.message?.content;if(t){out+=t;onToken(out)}}catch{}});return out}
    return (await r.json()).message.content;
  },
};

/* ------------------------------ AI features ------------------------------ */
const AI={
  async syllabus(text,image,imageType){
    const system=`You are reading a university course syllabus for a student's lecture-notes app. Return ONLY JSON:
{"summary":"3-5 sentences: what the course covers, how it is assessed, what the professor emphasises — written so an AI note-taker knows what matters in this class","profile":{"grading":"how the final grade is weighted, one line, with percentages if given","exams":"how many exams and quizzes, their format and dates if given, one line","textbook":"required books, software or platforms, one line","rules":"attendance, late work, participation and device rules the professor enforces, one line"},"sections":["the course units/weeks/topics in order, one short name each, e.g. 'Unit 2 — Kant'"],"vocab":["names and technical terms that captions will mishear: professor, TAs, key theorists, jargon — 10 to 30 items"],"dates":["exam and deadline lines exactly as written, with dates"]}
If the material is not a syllabus, still fill what you can and say so in the summary.`;
    const content=[];if(image)content.push({type:'image',data:image,mediaType:imageType});content.push({type:'text',text:text?text.slice(0,60000):'(see attached image)'});
    const j=LLM.parseJSON(await LLM.chat(system,[{role:'user',content}],{json:true,maxTokens:4000,kind:'syllabus'}));
    const pr=j.profile&&typeof j.profile==='object'?Object.fromEntries(['grading','exams','textbook','rules'].map(k=>[k,String(j.profile[k]||'').trim()])):null;
    return {summary:(j.summary||'').trim(),profile:pr&&Object.values(pr).some(Boolean)?pr:null,sections:(j.sections||[]).map(x=>String(x).trim()).filter(Boolean).slice(0,40),vocab:(j.vocab||[]).map(x=>String(x).trim()).filter(Boolean),dates:(j.dates||[]).map(x=>String(x).trim()).filter(Boolean)};
  },
  async memory(c,l){
    const system=`You keep a running summary of one university course for a student's notes app. Given the summary so far and the notes from one lecture, return the updated summary: 3–5 plain sentences, at most 90 words, no preamble, no bullets. In order: what the course has covered, the thread the professor is building, and anything announced as coming next (exams, readings). The lecture you are given may be older than ones already in the summary — merge by date, do not assume it is the latest. Keep the professor's own terms.`;
    const out=await LLM.chat(system,[{role:'user',content:`Course: ${c.name}\n\nSUMMARY SO FAR:\n${c.memory||'(nothing yet)'}\n\nLECTURE: ${l.title} (${dateS(l.created)})\nNOTES:\n${(l.notes||'').slice(0,14000)}`}],{maxTokens:400,kind:'memory'});
    return out.trim().replace(/^summary:?\s*/i,'');
  },
  async topics(l){
    const system=`You are sorting a lecture transcript. Each line is "#index [mm:ss] text". Group consecutive lines into blocks and label each block with exactly one kind:
- "content": the actual course material — concepts, arguments, examples, worked problems, definitions, discussion that a test could draw on.
- "logistics": announcements the student must not lose — exam dates, deadlines, office hours, what to read, format of an assignment.
- "tangent": off-topic — jokes, small talk, tech trouble, weather, sports, personal stories with no bearing on the course, waiting for people to settle, background chatter.
Be careful: a professor's story that illustrates a concept is content, not a tangent. When unsure, choose content. Blocks must cover every line in order with no gaps and no overlaps.${courseContext(l.courseId)}${vocabFor(l.courseId)}
Return ONLY JSON: {"blocks":[{"start":0,"end":12,"kind":"content","label":"3-6 word description"}]}`;
    const j=LLM.parseJSON(await LLM.chat(system,[{role:'user',content:transcriptText(l,null,{full:true,index:true})}],{json:true,maxTokens:8000,kind:'topics'}));
    const n=l.segments.length;let blocks=(j.blocks||[]).map(b=>({start:Math.max(0,b.start|0),end:Math.min(n-1,b.end|0),kind:['content','logistics','tangent'].includes(b.kind)?b.kind:'content',label:(b.label||'').slice(0,60)})).filter(b=>b.end>=b.start).sort((a,b)=>a.start-b.start);
    // fill gaps so every line has a kind
    const fixed=[];let cur=0;for(const b of blocks){if(b.start>cur)fixed.push({start:cur,end:b.start-1,kind:'content',label:''});if(b.start<cur)b.start=cur;if(b.end>=b.start)fixed.push(b);cur=b.end+1}if(cur<n)fixed.push({start:cur,end:n-1,kind:'content',label:''});
    return fixed;
  },
  async notes(l,onToken){
    const system=`You are a meticulous note-taker for a university student. You will be given a verbatim lecture transcript with [mm:ss] timestamps (auto-captions, so expect misheard words — correct obvious ones). Write structured study notes in the professor's own framing and terminology — never generic textbook summaries. Include only what was actually said.
Honesty rules: never fill a gap from general knowledge. If the captions are thin, garbled, or clearly missed a stretch, say so in the Gist in one plain sentence (e.g. "the captions dropped out around 20:00–35:00") rather than smoothing it over. If a term was clearly misheard, give the professor's likely word and mark it (?). Nothing in these notes may come from outside the transcript.${courseContext(l.courseId)}${vocabFor(l.courseId)}
Output Markdown with exactly these sections:

## Quick recap
Exactly five bullets, one line each, plain words, in the order the lecture went — what a student could read in thirty seconds. Then one line: **The one thing:** the single idea to remember, with its timestamp.

## Gist
2–4 sentences on what this lecture was about.

## Arguments in order
Numbered list following the lecture's actual sequence. Each point cites the timestamp it came from, like [12:34].

## Key terms
Bullets, one per line: **term** — the definition as the professor gave it, with a timestamp.

## Likely exam topics
Bullets. Anything the professor flagged, repeated, or spent unusual time on. Cite timestamps.

## Open questions
Questions the professor raised but did not answer, or deferred to later. Write "None raised." if there were none.

## Housekeeping
Dates, deadlines, readings and instructions from lines marked {logistics}, each with its timestamp. Write "Nothing announced." if there were none.${(l.myNotes||'').trim()?`

## What you flagged
The student typed side notes during class, each stamped with the lecture time they wrote it. Go through them in order: quote the note briefly in bold, then answer or expand it from what the professor was saying around that time — what was said, why it matters, what to remember, with timestamps. If the transcript never covers it, say so in one line. Also weigh these moments more heavily in Likely exam topics.`:''}

Lines marked "(off-topic tangent skipped)" were not course material — do not mention them.`;
    const side=(l.myNotes||'').trim()?`STUDENT'S SIDE NOTES (typed during class, [mm:ss] = when):\n${l.myNotes.trim()}\n\n`:'';
    return LLM.chat(system,[{role:'user',content:`Lecture: ${lecLabel(l)}\n\n${side}${transcriptText(l)}`}],{onToken,kind:'notes'});
  },
  async ask(scope,id,history,question,onToken,opts={}){
    const list=scopeLectures(scope,id);const live=opts.live&&opts.live.segments?.length?opts.live:null;
    if(!list.length&&!live)throw new Error('Nothing transcribed in this scope yet.');
    const multi=list.length+(live?1:0)>1;const cid=live?.courseId||list[0]?.courseId||(scope==='course'?id:scope==='section'?section(id)?.courseId:lecture(id)?.courseId);
    const cname=course(cid)?.name||'this class';
    const extras=S.assignments.filter(a=>scope==='course'?a.courseId===id:scope==='section'?a.sectionId===id:a.lectureId===id).filter(a=>a.text);
    const system=`You are the tutor for ${cname}, and only ${cname}. You know nothing about the student's other classes; if asked about one, say to ask from that class instead. You were in the room. You answer ONLY from the lecture transcript(s)${extras.length?' and attached assignment files':''} below.${live?` The student is sitting in ${cname} right now: the last block of material is being captioned live and is still growing. When they ask what was "just" said, use the most recent minutes. Keep answers short — they are listening at the same time.`:''} Rules:
- Ground every claim in the material. ${CITE_RULE(multi)}
- If the professor defined something their own way, use their definition.
- If the material does not cover the question, say so plainly in one sentence ("Not covered in this lecture" / "Not in any lecture on file") and do not invent an answer. You may add at most one sentence of general context clearly labelled as outside the tape.
- Style: start with the answer — no preamble like "Here's a recap", no sign-off. If asked for a number of items, give exactly that many. Bullets are one idea each, one line, plain words, no bold labels with colons, no headings. One timestamp per point, at the end, a single moment like [31:44] rather than a range. Short paragraphs otherwise. Use the professor's own terms.
- Never bluff. If you are not sure it was said, say "I'm not sure this was covered" and point to the closest moment. When asked to quiz the student, ask one question at a time and wait.
- The syllabus below is also fair game for questions about dates, readings, grading and policies.${courseContext(cid,{full:true})}${vocabFor(cid)}

MATERIAL:
${corpusText(list)}${extras.map(a=>`\n\n=== ASSIGNMENT: ${a.title} ===\n${a.text.slice(0,30000)}`).join('')}${live?`\n\n=== RIGHT NOW: ${live.title} (live captions, still being recorded) ===\n${transcriptText(live,null,{full:true})}`:''}`;
    return LLM.chat(system,[...history.map(m=>({role:m.role,content:m.content})),{role:'user',content:question}],{maxTokens:3000,onToken,kind:'tutor'});
  },
  async quiz(scope,id,kind,difficulty,focus){
    const list=scopeLectures(scope,id);if(!list.length)throw new Error('Nothing transcribed in this scope yet.');
    const spec=kind==='test'?'a full 100-point test with exactly 18 questions: 10 multiple-choice (4 pts each), 4 true/false (5 pts each), 4 short-answer (10 pts each)':'a quick quiz with exactly 8 questions: 5 multiple-choice (5 pts each), 1 true/false (5 pts), 2 short-answer (5 pts each)';
    const diff={easy:'Easy — recall of the main points, generous wording.',standard:'Standard — the level a professor would test: understanding, not just recall.',hard:'Hard — application, subtle distinctions, and the asides the professor flagged.'}[difficulty]||'Standard.';
    const system=`You write exam questions strictly from lecture transcripts. Generate ${spec}. Difficulty: ${diff} Every question must be answerable from the material alone and should favour what the professor emphasised. Never write a question whose answer is not on the tape — if the material is too thin for the full count, write fewer good questions rather than invent one.${focus?`\nFOCUS: the student got these wrong before — build the paper around these gaps, rephrased, not copied:\n${focus}`:''}${courseContext(list[0].courseId)}${vocabFor(list[0].courseId)}
Return ONLY JSON, no prose, exactly this shape:
{"title":"short paper title","questions":[
 {"type":"mcq","q":"...","options":["...","...","...","..."],"answer":0,"points":5,"explanation":"why, citing ${list.length>1?'[Lecture title @ mm:ss]':'[mm:ss]'}"},
 {"type":"tf","q":"statement","answer":true,"points":5,"explanation":"..."},
 {"type":"short","q":"...","answer":"model answer, 1-3 sentences","points":5,"explanation":"what full credit needs, with citation"}]}
For mcq, "answer" is the 0-based index of the correct option; spread correct answers across positions. Order the questions mixed, not grouped by type.`;
    const q=LLM.parseJSON(await LLM.chat(system,[{role:'user',content:corpusText(list)}],{json:true,maxTokens:16000,kind:'quiz'}));
    if(!q.questions?.length)throw new Error('The paper came back empty. Try again.');
    q.questions=q.questions.filter(x=>x.q&&['mcq','tf','short'].includes(x.type)).map(x=>({...x,points:+x.points||5,answer:x.type==='tf'?(x.answer===true||x.answer==='true'):x.answer}));
    return q;
  },
  async grade(quiz,answers){
    const shorts=quiz.questions.map((q,i)=>({i,q})).filter(x=>x.q.type==='short'&&(answers[x.i]||'').trim());if(!shorts.length)return {};
    const system=`You are marking short-answer exam questions. For each item compare the student's answer with the model answer and marking notes. Award integer points from 0 to the maximum, and one sentence of feedback naming what was missing or wrong. Return ONLY JSON: {"grades":[{"i":<index>,"points":<int>,"feedback":"..."}]}`;
    const payload=shorts.map(({i,q})=>({i,question:q.q,max:q.points,model_answer:q.answer,marking_notes:q.explanation,student_answer:answers[i]}));
    const g=LLM.parseJSON(await LLM.chat(system,[{role:'user',content:JSON.stringify(payload,null,1)}],{json:true,maxTokens:4000,kind:'grade'}));const map={};
    (g.grades||[]).forEach(x=>{const q=quiz.questions[x.i];if(q)map[x.i]={points:Math.max(0,Math.min(x.points|0,q.points)),feedback:x.feedback||''}});
    return map;
  },
  async cards(l){
    const system=`Make flashcards from this lecture transcript for spaced-repetition review. 8–20 cards. Each card: a front (a term, question, or prompt in the professor's words) and a back (a tight answer, 1–2 sentences, with the [mm:ss] it came from). Cover key terms, definitions, arguments and anything flagged for the exam. Return ONLY JSON: {"cards":[{"front":"...","back":"..."}]}${courseContext(l.courseId)}${vocabFor(l.courseId)}`;
    const j=LLM.parseJSON(await LLM.chat(system,[{role:'user',content:transcriptText(l)}],{json:true,maxTokens:6000,kind:'cards'}));
    return (j.cards||[]).filter(c=>c.front&&c.back);
  },
  async brief(a){
    const list=(a.lectureId?[lecture(a.lectureId)]:a.sectionId?scopeLectures('section',a.sectionId):scopeLectures('course',a.courseId)).filter(l=>l&&l.segments?.length);
    const system=`You are helping a student understand an assignment handout. Read it and their lecture material, then return ONLY JSON:
{"summary":"2-3 sentences: what this assignment actually asks for","tasks":["each concrete task hidden in the prose, in order"],"handIn":"exactly what must be submitted, format, length, deadline if stated","lectureLinks":[{"lecture":"exact lecture title from a === header ===","why":"which part of the assignment this lecture covers","at":"mm:ss of the most relevant moment"}]}
Only link lectures whose transcript genuinely covers a task. If no lecture on file covers it, return an empty lectureLinks array — never invent coverage.${courseContext(a.courseId,{full:true})}`;
    const content=[];if(a.image)content.push({type:'image',data:a.image,mediaType:a.imageType});
    content.push({type:'text',text:`ASSIGNMENT: ${a.title}\n${a.text?a.text.slice(0,60000):'(see attached image)'}\n\nLECTURE MATERIAL:\n${list.length?corpusText(list,400000):'(no transcribed lectures on file yet)'}`});
    const b=LLM.parseJSON(await LLM.chat(system,[{role:'user',content}],{json:true,maxTokens:6000,kind:'brief'}));
    b.lectureLinks=(b.lectureLinks||[]).map(x=>{const l=list.find(l=>l.title===x.lecture)||list.find(l=>lecLabel(l)===x.lecture)||list.find(l=>x.lecture&&(lecLabel(l).includes(x.lecture)||x.lecture.includes(l.title)));return {...x,lectureId:l?.id}});
    return b;
  }
};
