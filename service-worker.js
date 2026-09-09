const CACHE="ctool-v1.1-r3";
const ASSETS=["./","index.html","styles.css","app.js","manifest.json","icon.svg"];

async function freshPrecache(){
  const cache=await caches.open(CACHE);
  await Promise.all(ASSETS.map(async asset=>{
    const response=await fetch(asset,{cache:"reload"});
    if(!response.ok) throw new Error(`Precache failed: ${asset}`);
    await cache.put(asset,response);
  }));
}

self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil(freshPrecache());
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("message",event=>{
  if(event.data && event.data.type==="SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;

  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;

  event.respondWith((async()=>{
    try{
      if(url.searchParams.has("version_check")){
        return await fetch(event.request,{cache:"no-store"});
      }

      const response=await fetch(event.request,{cache:"no-store"});
      if(response && response.ok){
        const cache=await caches.open(CACHE);
        await cache.put(event.request,response.clone());
      }
      return response;
    }catch(err){
      return (await caches.match(event.request)) ||
             (await caches.match(url.pathname.endsWith("/") ? "./" : url.pathname.split("/").pop())) ||
             (await caches.match("index.html"));
    }
  })());
});
