const CACHE="ctool-v1.2";
const ASSETS=["./","index.html","styles-v1.2.css","app-v1.2.js","manifest.json","icon.svg","version.json"];

self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all(
        ASSETS.map(asset =>
          fetch(asset,{cache:"reload"}).then(response=>{
            if(!response.ok) throw new Error(`Failed: ${asset}`);
            return cache.put(asset,response);
          })
        )
      )
    )
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;

  // version.json は絶対にキャッシュしない
  if(url.pathname.endsWith("/version.json")){
    event.respondWith(fetch(event.request,{cache:"no-store"}));
    return;
  }

  // ナビゲーションはネットワーク優先
  if(event.request.mode==="navigate"){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(event.request,{cache:"no-store"});
        if(fresh.ok){
          const cache=await caches.open(CACHE);
          await cache.put("index.html",fresh.clone());
        }
        return fresh;
      }catch{
        return (await caches.match("index.html")) || (await caches.match("./"));
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    try{
      const fresh=await fetch(event.request,{cache:"no-store"});
      if(fresh.ok){
        const cache=await caches.open(CACHE);
        await cache.put(event.request,fresh.clone());
      }
      return fresh;
    }catch{
      return (await caches.match(event.request)) || Response.error();
    }
  })());
});
