import {readFile,writeFile,readdir,stat} from "node:fs/promises";
import {resolve,relative,join} from "node:path";
import {createHash} from "node:crypto";
const root=resolve(import.meta.dirname,"..");
const output=resolve(root,process.argv[2]||"dist/client");
async function walk(directory) {
  const result=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(entry.name.startsWith("."))continue;
    const path=join(directory,entry.name);
    if(entry.isDirectory())result.push(...await walk(path));else result.push(path);
  }
  return result;
}
const files=(await walk(output)).filter(path=>!/(\.map|\.zip|\.txt|\.md)$/.test(path)&&!/[\\/]sw\.js$/.test(path)&&!/[\\/]_headers$/.test(path));
const paths=files.map(file=>"/"+relative(output,file).replaceAll("\\","/")).sort();
const hash=createHash("sha256");let bytes=0;
for(const file of files.sort()){const data=await readFile(file);hash.update(relative(output,file));hash.update(data);bytes+=data.length;}
// Include the server build because a new HTML shell may change with identical public assets.
try{hash.update(await readFile(join(root,"dist/server/index.js")));}catch{}
const version=hash.digest("hex").slice(0,16);
const worker=`/* Generated from the complete build. Do not edit by hand. */
const CACHE = "paperscan-v1-${version}";
const URLS = ${JSON.stringify(["/",...paths])};
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Four downloads at a time: bounded memory and friendly to mobile connections.
    for (let i = 0; i < URLS.length; i += 4) {
      await Promise.all(URLS.slice(i,i+4).map(async path => {
        const request = new Request(path, {cache:"reload", credentials:"same-origin"});
        const response = await fetch(request);
        if (!response.ok || response.redirected) throw new Error("Offline asset unavailable: " + path);
        await cache.put(path,response);
      }));
    }
    // Updates wait for existing windows to close, avoiding mixed-version assets.
    if (!self.registration.active) await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith("paperscan-v1-") && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event => {
  const request=event.request,url=new URL(request.url);
  if(request.method!=="GET" || url.origin!==self.location.origin || url.pathname==="/sw.js")return;
  if(request.mode==="navigate" && url.pathname==="/") {
    // Shell and chunks are an immutable snapshot of this version. An update installs
    // a whole new snapshot rather than mixing fresh HTML with old cached chunks.
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match("/")) || fetch(request)));
    return;
  }
  if(URLS.includes(url.pathname))event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.pathname)) || fetch(request)));
});
`;
await writeFile(join(output,"sw.js"),worker);
console.log(`Generated service worker: ${paths.length+1} URLs, ${(bytes/1024/1024).toFixed(1)} MiB, version ${version}`);
