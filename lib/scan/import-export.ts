import type {ScanDocument,ScanPage,ProgressInfo} from "./types";
import {MAX_PAGES,MAX_FILE_SIZE} from "./types";
import {newPage,blobFromCanvas} from "./images";

export async function importFiles(files:File[],remaining:number,progress:(p:ProgressInfo)=>void):Promise<ScanPage[]> {
  if(!files.length)return [];
  const pages:ScanPage[]=[];
  for(const file of files) {
    if(file.size>MAX_FILE_SIZE)throw new Error(`${file.name} vượt giới hạn 40 MB mỗi tệp.`);
    if(file.type==="application/pdf"||/\.pdf$/i.test(file.name)) {
      const pdfjs=await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc="/vendor/pdf/pdf.worker.min.mjs";
      const task=pdfjs.getDocument({data:await file.arrayBuffer(),cMapUrl:"/vendor/pdf/cmaps/",cMapPacked:true,standardFontDataUrl:"/vendor/pdf/standard_fonts/",wasmUrl:"/vendor/pdf/wasm/"});
      try {
        const pdf=await task.promise;
        if(pages.length+pdf.numPages>remaining)throw new Error(`Tài liệu hỗ trợ tối đa ${MAX_PAGES} trang. Hãy nhập PDF ít trang hơn.`);
        for(let i=1;i<=pdf.numPages;i++) {
          progress({message:`Đang nhập ${file.name} · trang ${i}/${pdf.numPages}`,percent:i/pdf.numPages*100});
          const page=await pdf.getPage(i),base=page.getViewport({scale:1});
          const viewport=page.getViewport({scale:Math.min(2,2200/Math.max(base.width,base.height))});
          const canvas=document.createElement("canvas");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
          const context=canvas.getContext("2d");if(!context)throw new Error("Không thể mở Canvas.");
          await page.render({canvas,canvasContext:context,viewport}).promise;
          pages.push(await newPage(await blobFromCanvas(canvas)));page.cleanup();
          canvas.width=1;canvas.height=1;
        }
      } catch(error) {
        if(error instanceof Error&&error.name==="PasswordException")throw new Error("PDF được khóa bằng mật khẩu. Hãy mở khóa tệp trước khi nhập.");
        throw error;
      } finally {await task.destroy();}
    } else if(file.type.startsWith("image/")||/\.(jpe?g|png|webp)$/i.test(file.name)) {
      if(pages.length>=remaining)throw new Error(`Tài liệu hỗ trợ tối đa ${MAX_PAGES} trang.`);
      progress({message:`Đang nhập ${file.name}…`});
      pages.push(await newPage(file));
    } else throw new Error(`${file.name}: chỉ hỗ trợ ảnh và PDF.`);
  }
  return pages;
}
export async function makePDF(doc:ScanDocument,progress:(p:ProgressInfo)=>void):Promise<File> {
  const {PDFDocument}=await import("pdf-lib");
  const pdf=await PDFDocument.create();pdf.setTitle(doc.title);pdf.setCreator("PaperScan Studio");pdf.setCreationDate(new Date(doc.createdAt));
  for(let i=0;i<doc.pages.length;i++) {
    progress({message:`Đang tạo PDF · trang ${i+1}/${doc.pages.length}`,percent:(i+1)/doc.pages.length*100});
    const page=doc.pages[i],jpg=await pdf.embedJpg(await page.rendered.arrayBuffer());
    const scale=Math.min(1,842/Math.max(jpg.width,jpg.height));
    const sheet=pdf.addPage([jpg.width*scale,jpg.height*scale]);
    sheet.drawImage(jpg,{x:0,y:0,width:sheet.getWidth(),height:sheet.getHeight()});
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  const data=await pdf.save();
  return new File([new Uint8Array(data)],`${safeName(doc.title)}.pdf`,{type:"application/pdf"});
}
export const safeName=(name:string)=>name.replace(/[\\/:*?"<>|\x00-\x1f]/g,"-").trim().slice(0,100)||"Tai-lieu";
export function download(file:File) {
  const url=URL.createObjectURL(file),link=document.createElement("a");
  link.href=url;link.download=file.name;document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),60_000);
}
