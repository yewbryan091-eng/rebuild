// Offline cache for the app itself. Bump V on every deploy; the new copy loads on the next launch.
const V='rebuild-20261113140909';
const SHELL=[
  './','index.html','manifest.webmanifest','vendor/supabase.js',
  'fonts/Barlow-400.woff2',
  'fonts/Barlow-500.woff2',
  'fonts/Barlow-600.woff2',
  'fonts/Barlow-700.woff2',
  'fonts/BigShouldersDisplay-700.woff2',
  'fonts/BigShouldersDisplay-800.woff2',
  'fonts/BigShouldersDisplay-900.woff2',
  'icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png',
];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request, url=new URL(req.url);
  // cloud sync and Claude calls go straight to the network; only the app's own files are cached
  if(req.method!=='GET'||url.origin!==location.origin) return;
  const fresh=fetch(req).then(r=>{if(r.ok){const copy=r.clone();caches.open(V).then(c=>c.put(req,copy))}return r}).catch(()=>null);
  e.waitUntil(fresh.then(()=>{}));
  // answer from the phone straight away, refresh the copy in the background
  e.respondWith(caches.match(req,{ignoreSearch:true}).then(hit=>hit||fresh.then(r=>r||(req.mode==='navigate'?caches.match('index.html'):Response.error()))));
});
