import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import ts from "typescript";
import vm from "node:vm";
const source=await readFile(new URL("../lib/scan/image-math.ts",import.meta.url),"utf8");
const javascript=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {validQuad,homography,project,processPixels}=await import("data:text/javascript;base64,"+Buffer.from(javascript).toString("base64"));
const quad=[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
assert.equal(validQuad(quad),true);
assert.equal(validQuad([quad[0],quad[2],quad[1],quad[3]]),false);
const target=[{x:23,y:15},{x:170,y:31},{x:193,y:245},{x:13,y:212}];
const matrix=homography(quad,target);
for(let i=0;i<4;i++){const point=project(matrix,quad[i]);assert.ok(Math.abs(point.x-target[i].x)<1e-8);assert.ok(Math.abs(point.y-target[i].y)<1e-8);}
console.log("PASS: convex corner validation and four-corner perspective projection");
const width=24,height=32,pixels=new Uint8ClampedArray(width*height*4);
for(let i=0;i<pixels.length;i+=4){pixels[i]=i%256;pixels[i+1]=(i*3)%256;pixels[i+2]=(i*7)%256;pixels[i+3]=255;}
const original=pixels.slice();
const full=processPixels({pixels,width,height,crop:quad,filter:"original"});
assert.equal(full.width,width);assert.equal(full.height,height);assert.deepEqual(full.pixels,pixels);
const gray=processPixels({pixels,width,height,crop:quad,filter:"gray"});
for(let i=0;i<gray.pixels.length;i+=4){assert.equal(gray.pixels[i],gray.pixels[i+1]);assert.equal(gray.pixels[i],gray.pixels[i+2]);}
const bw=processPixels({pixels,width,height,crop:quad,filter:"bw"});
for(let i=0;i<bw.pixels.length;i+=4){assert.ok(bw.pixels[i]===0||bw.pixels[i]===255);assert.equal(bw.pixels[i],bw.pixels[i+1]);}
assert.deepEqual(pixels,original);
assert.throws(()=>processPixels({pixels,width,height,crop:[quad[0],quad[2],quad[1],quad[3]],filter:"original"}));
console.log("PASS: lossless full-frame mapping, grayscale, binary B&W and immutable input");

// Service-worker logic is tested in a VM, not in a browser or with camera permissions.
const workerCode=await readFile(new URL("../out/sw.js",import.meta.url),"utf8");
const handlers={},storage=new Map(),origin="https://paperscan.test";
let offline=false,claimed=false;
const key=input=>new URL(typeof input==="string"?input:input.url,origin).pathname;
const caches={
  async open(name){if(!storage.has(name))storage.set(name,new Map());const entries=storage.get(name);return {async put(path,response){entries.set(key(path),response.clone());},async match(path){return entries.get(key(path))?.clone();}};},
  async keys(){return [...storage.keys()];},async delete(name){return storage.delete(name);},
};
class LocalRequest extends Request{constructor(input,init){super(new URL(input,origin),init);}}
const context={URL,Request:LocalRequest,Promise,console,caches,fetch:async request=>{if(offline)throw new Error("offline");return new Response("cached:"+key(request));},self:{location:{origin},registration:{active:null},skipWaiting:async()=>{},clients:{claim:async()=>{claimed=true;}},addEventListener(type,handler){handlers[type]=handler;}}};
vm.runInNewContext(workerCode,context);
let work;handlers.install({waitUntil(p){work=p;}});await work;
assert.ok((await caches.keys()).some(name=>name.startsWith("paperscan-v1-")));
handlers.activate({waitUntil(p){work=p;}});await work;assert.equal(claimed,true);
offline=true;
let response;
handlers.fetch({request:{url:origin+"/",method:"GET",mode:"navigate"},respondWith(p){response=p;}});
assert.equal(await (await response).text(),"cached:/");
handlers.fetch({request:{url:origin+"/vendor/ocr/lang/vie.traineddata.gz",method:"GET",mode:"cors"},respondWith(p){response=p;}});
assert.equal(await (await response).text(),"cached:/vendor/ocr/lang/vie.traineddata.gz");
let intercepted=false;
handlers.fetch({request:{url:"https://other.test/private",method:"GET",mode:"cors"},respondWith(){intercepted=true;}});
assert.equal(intercepted,false);
console.log("PASS: precache installation, activation, offline shell + OCR assets, external-request isolation");
