// Update this version whenever shell resources change. Old caches survive until
// the next worker activates, allowing an interrupted update to keep working.
const CACHE='bodytrack-shell-e3a6d53833a8';
const ASSETS=['./','./index.html','./styles.css','./app.mjs','./core.mjs','./store.mjs','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    for(const path of ASSETS){
      const response=await fetch(new Request(new URL(path,self.registration.scope),{cache:'reload'}));
      if(!response.ok || response.redirected || response.type==='opaque')throw new Error('离线文件下载失败');
      const type=response.headers.get('content-type')??'';
      if((path.endsWith('.mjs')||path.endsWith('.js'))&&type.includes('text/html'))throw new Error('资源返回了登录页面');
      await cache.put(path,response);
    }
  })());
});
self.addEventListener('message',event=>{
  if(event.data==='ACTIVATE_UPDATE')self.skipWaiting();
  if(event.data==='CHECK_SHELL')event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);const found=await Promise.all(ASSETS.map(p=>cache.match(p)));
    event.ports[0]?.postMessage({complete:found.every(Boolean),version:CACHE});
  })());
});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('bodytrack-shell-')&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  // Only the known application shell is cached; never cache uploaded files or
  // authentication responses. Records live in IndexedDB, outside this cache.
  const base=new URL(self.registration.scope);
  const relative=url.pathname.slice(base.pathname.length);
  if(event.request.mode==='navigate'){
    event.respondWith((async()=>await caches.match(new URL('index.html',base))??fetch(event.request))());return;
  }
  if(ASSETS.some(p=>p.replace('./','')===relative))event.respondWith((async()=>await caches.match(new Request(url.origin+url.pathname))??fetch(event.request))());
});
