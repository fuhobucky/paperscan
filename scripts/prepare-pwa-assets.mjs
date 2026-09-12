import {createRequire} from "node:module";
import {dirname,join,resolve} from "node:path";
import {mkdir,copyFile,cp,readFile,writeFile,readdir} from "node:fs/promises";
import ts from "typescript";
const require=createRequire(import.meta.url);
const root=resolve(import.meta.dirname,"..");
const packageRoot=(name,paths)=>dirname(require.resolve(`${name}/package.json`,paths?{paths}:undefined));
const tesseract=packageRoot("tesseract.js"),core=packageRoot("tesseract.js-core",[tesseract]);
const output=join(root,"public/vendor");
// Compile standalone ES modules explicitly; this works with Next/Turbopack and Vite.
// Some bundlers treat Worker(new URL('*.ts')) as an uncompiled static media asset.
await mkdir(join(root,"public/workers"),{recursive:true});
for(const [source,destination] of [["image-math.ts","image-math.js"],["processing.worker.ts","processing.js"]]) {
  const input=await readFile(join(root,"lib/scan",source),"utf8");
  const javascript=ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText
    .replace('from "./image-math"','from "./image-math.js"');
  await writeFile(join(root,"public/workers",destination),javascript);
}
await mkdir(join(output,"ocr/core"),{recursive:true});await mkdir(join(output,"ocr/lang"),{recursive:true});
await copyFile(join(tesseract,"dist/worker.min.js"),join(output,"ocr/worker.min.js"));
for(const name of await readdir(core)) if(name.endsWith(".wasm.js")) await copyFile(join(core,name),join(output,"ocr/core",name));
for(const language of ["eng","vie"]) {
  const pkg=packageRoot(`@tesseract.js-data/${language}`);
  await copyFile(join(pkg,`4.0.0_best_int/${language}.traineddata.gz`),join(output,`ocr/lang/${language}.traineddata.gz`));
}
const pdf=packageRoot("pdfjs-dist");
await mkdir(join(output,"pdf"),{recursive:true});
await copyFile(join(pdf,"build/pdf.worker.min.mjs"),join(output,"pdf/pdf.worker.min.mjs"));
for(const directory of ["cmaps","standard_fonts","wasm"]) await cp(join(pdf,directory),join(output,"pdf",directory),{recursive:true});
await mkdir(join(root,"public/licenses"),{recursive:true});
for(const [name,directory] of [["tesseract",tesseract],["tesseract-core",core],["pdfjs",pdf]]) {
  const license=(await readdir(directory)).find(n=>/^license/i.test(n));
  if(license)await copyFile(join(directory,license),join(root,`public/licenses/${name}.txt`));
}
await writeFile(join(root,"public/manifest.webmanifest"),JSON.stringify({
  id:"/",name:"PaperScan Studio",short_name:"PaperScan",description:"Quét tài liệu, OCR tiếng Việt và xuất PDF ngay trên thiết bị.",lang:"vi",start_url:"/",scope:"/",display:"standalone",background_color:"#f2f5f4",theme_color:"#087f63",categories:["productivity","utilities"],
  icons:[{src:"/icons/icon-192.png",sizes:"192x192",type:"image/png",purpose:"any"},{src:"/icons/icon-512.png",sizes:"512x512",type:"image/png",purpose:"any"},{src:"/icons/maskable-512.png",sizes:"512x512",type:"image/png",purpose:"maskable"}],
},null,2));
console.log("Offline OCR worker, 4 core variants, Việt/Anh data, PDF worker and fonts prepared.");
