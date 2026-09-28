const CACHE='alefatemion-pwa-step1fix-v3';
const V='test2-3';
const STEP1='step1fix-3';
const SHELL=[
  '/',
  '/index.html',
  `/app.css?v=${V}`,
  `/app-test2.css?v=${V}`,
  `/app-step1-home-header.css?v=${STEP1}`,
  `/app-core.js?v=${V}`,
  `/app-content.js?v=${V}`,
  `/app-account.js?v=${V}`,
  `/app-radio.js?v=${V}`,
  `/app-platform-parity.js?v=${V}`,
  `/app-step1-fix.js?v=${STEP1}`,
  `/app-auth.js?v=${V}`,
  `/brand-logo.webp?v=${V}`,
  `/icon.svg?v=${V}`,
  `/manifest.webmanifest?v=${V}`
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.pathname.startsWith('/api/')) return;
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put('/index.html',c));return r}).catch(()=>caches.match('/index.html')));return;
  }
  if(u.origin===location.origin){
    e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request,{cache:'no-store'}).then(r=>{const copy=r.clone();caches.open(CACHE).then(x=>x.put(e.request,copy));return r})));
  }
});
