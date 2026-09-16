/* sw.js — caches the app shell so it opens instantly and works offline (recording + transcripts need no network) */
const VERSION='br-v20260915181013';
const SHELL=['./','index.html','core.js','llm.js','media.js','ui.js','study.js','cal.js','boot.js','terms.html','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(url.origin!==location.origin||e.request.method!=='GET')return;           // APIs, CDNs: straight to network
  // network-first for the shell so updates land; fall back to cache when offline
  e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{const copy=r.clone();caches.open(VERSION).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));
});
