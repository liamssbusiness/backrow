/* media.js — recorder + live captions, in-browser Whisper, PDF text */

const REC={
  MIN:300, // seconds before End stops asking "keep it anyway?"
  CHECK_EVERY:3600, CHECK_WAIT:300, nextCheck:3600, checking:false, checkTimer:null, // "still in class?" every hour; auto-end after 5 unanswered minutes
  active:false,paused:false,media:null,chunks:[],rec:null,sr:null,tick:null,lecture:null,segments:[],interim:'',mimeType:'',srSupported:null,wake:null,
  t0:0,accum:0,elapsed(){return REC.accum+(REC.paused?0:(Date.now()-REC.t0)/1000)},
  async begin(lec){
    REC.lecture=lec;REC.segments=[];REC.interim='';REC.chunks=[];REC.accum=0;REC.paused=false;REC.chat=null;REC.nextCheck=REC.CHECK_EVERY;REC.checking=false;
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:true}}).catch(()=>{throw new Error('Microphone access denied. Allow the mic for this site and try again.')});
    REC.media=stream;
    const pick=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'].find(t=>window.MediaRecorder&&MediaRecorder.isTypeSupported(t));
    REC.mimeType=pick||'';
    REC.rec=new MediaRecorder(stream,pick?{mimeType:pick,audioBitsPerSecond:32000}:undefined);
    REC.rec.ondataavailable=e=>{if(e.data.size)REC.chunks.push(e.data)};
    REC.rec.start(5000);REC.t0=Date.now();REC.active=true;
    REC.startSR();
    await REC.holdWake();
    REC.tick=setInterval(()=>{const el=document.getElementById('timer');if(el)el.textContent=fmt(REC.elapsed());ui.stopLock?.();if(REC.active&&!REC.checking&&REC.elapsed()>=REC.nextCheck)ui.stillRecording?.()},500);
  },
  // Keep the screen (and with it the mic and captions) awake for the whole class. Browsers drop the lock when the tab is hidden, so we ask again every time it comes back.
  async holdWake(){try{if(REC.wake&&!REC.wake.released)return;if(!navigator.wakeLock)throw new Error('no wakeLock');REC.wake=await navigator.wakeLock.request('screen');REC.wake.addEventListener('release',()=>{REC.wake=null;ui.wakeBadge?.()})}catch{REC.wake=null}ui.wakeBadge?.()},
  startSR(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){REC.srSupported=false;return}
    REC.srSupported=true;
    const sr=new SR();sr.continuous=true;sr.interimResults=true;sr.lang=S.settings.lang||'en-US';
    let utterStart=null;
    sr.onresult=e=>{let interim='';
      for(let i=e.resultIndex;i<e.results.length;i++){const r=e.results[i];const txt=(r[0]?.transcript||'').trim();
        if(utterStart===null)utterStart=REC.elapsed();
        if(r.isFinal){if(txt)REC.segments.push({t:Math.max(0,utterStart-0.8),text:txt});utterStart=null}else interim+=txt+' '}
      REC.interim=interim;ui.renderLive()};
    sr.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed'){REC.srSupported=false;ui.renderLive();}};
    sr.onend=()=>{if(REC.active&&!REC.paused&&REC.srSupported){try{sr.start()}catch{}}};
    try{sr.start();REC.sr=sr}catch(e){REC.srSupported=false}
  },
  pause(){if(!REC.active||REC.paused)return;REC.paused=true;REC.accum+=(Date.now()-REC.t0)/1000;REC.rec.pause();try{REC.sr?.stop()}catch{}},
  resume(){if(!REC.active||!REC.paused)return;REC.paused=false;REC.t0=Date.now();REC.rec.resume();try{REC.sr?.start()}catch{}},
  async finish(save){
    REC.active=false;clearInterval(REC.tick);clearInterval(REC.checkTimer);REC.checkTimer=null;REC.checking=false;if(!REC.paused)REC.accum+=(Date.now()-REC.t0)/1000;REC.paused=false;
    REC.srSupported=false;try{REC.sr?.stop()}catch{}try{REC.wake?.release()}catch{}REC.wake=null;
    const blob=await new Promise(res=>{REC.rec.onstop=()=>res(new Blob(REC.chunks,{type:REC.mimeType||'audio/webm'}));try{REC.rec.stop()}catch{res(new Blob(REC.chunks,{type:REC.mimeType||'audio/webm'}))}});
    REC.media.getTracks().forEach(t=>t.stop());
    if(!save)return null;
    const l=REC.lecture;l.duration=REC.accum;l.segments=REC.segments;l.source='live';l.transcriptSource=REC.segments.length?'captions':'none';
    await DB.putRaw('audio',{id:l.id,blob,type:blob.type});SYNC.markDirty('audio',l.id);await DB.put('lectures',l);return l;
  }
};

/* Whisper in the browser (transformers.js). Free; one-time model download. */
const WHISPER={
  pipe:null,model:null,
  async load(onProgress){
    if(WHISPER.pipe&&WHISPER.model===S.settings.whisper)return WHISPER.pipe;
    const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/dist/transformers.min.js');
    env.allowLocalModels=false;
    const webgpu=!!navigator.gpu;let pipe;
    try{pipe=await pipeline('automatic-speech-recognition',S.settings.whisper,{device:webgpu?'webgpu':'wasm',dtype:webgpu?{encoder_model:'fp32',decoder_model_merged:'q4'}:'q8',progress_callback:onProgress})}
    catch(e){if(!webgpu)throw e;pipe=await pipeline('automatic-speech-recognition',S.settings.whisper,{device:'wasm',dtype:'q8',progress_callback:onProgress})}
    WHISPER.pipe=pipe;WHISPER.model=S.settings.whisper;return pipe;
  },
  async decode(blob){
    const buf=await blob.arrayBuffer();const ac=new (window.AudioContext||window.webkitAudioContext)({sampleRate:16000});
    const audio=await ac.decodeAudioData(buf).finally(()=>ac.close());
    let data=audio.getChannelData(0);
    if(audio.numberOfChannels>1){const b=audio.getChannelData(1);data=data.map((v,i)=>(v+b[i])/2)}
    if(audio.sampleRate!==16000){const off=new OfflineAudioContext(1,Math.ceil(audio.duration*16000),16000);const src=off.createBufferSource();src.buffer=audio;src.connect(off.destination);src.start();data=(await off.startRendering()).getChannelData(0)}
    return {data,duration:audio.duration};
  },
  async transcribe(blob,onStatus){
    onStatus('Loading the speech model (one-time download)…',0);
    const pipe=await WHISPER.load(p=>{if(p.status==='progress'&&p.progress)onStatus(`Downloading ${p.file.split('/').pop()} — ${Math.round(p.progress)}%`,p.progress/100)});
    onStatus('Decoding audio…',0);const {data,duration}=await WHISPER.decode(blob);
    onStatus(`Transcribing ${fmt(duration)} of audio on this device. Roughly ${Math.ceil(duration/60/(navigator.gpu?8:2))} min — keep this tab open…`,0);
    const lang=(S.settings.lang||'en').split('-')[0];
    const out=await pipe(data,{chunk_length_s:30,stride_length_s:5,return_timestamps:true,language:lang,task:'transcribe'});
    const segs=(out.chunks||[]).map(c=>({t:c.timestamp?.[0]??0,text:(c.text||'').trim()})).filter(s=>s.text);
    if(!segs.length&&out.text)segs.push({t:0,text:out.text.trim()});
    return {segments:segs,duration};
  }
};

async function pdfText(buf){
  const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
  const doc=await pdfjs.getDocument({data:buf}).promise;let out=[];
  for(let p=1;p<=doc.numPages;p++){const tc=await (await doc.getPage(p)).getTextContent();out.push(tc.items.map(i=>i.str).join(' '))}
  return out.join('\n\n');
}
