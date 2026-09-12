import {fullCrop,type ScanPage,type Filter,type Quad} from "./types";
import {processPixels,type PixelJob} from "./image-math";

export function blobFromCanvas(canvas:HTMLCanvasElement,quality=.91):Promise<Blob> {
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Không thể mã hóa ảnh.")),"image/jpeg",quality));
}
export async function decodeImage(blob:Blob):Promise<HTMLImageElement> {
  const url=URL.createObjectURL(blob),image=new Image();
  try { image.src=url; await image.decode(); return image; }
  catch { throw new Error("Không đọc được ảnh. Hãy dùng JPEG, PNG hoặc WebP; với HEIC, hãy xuất thành JPEG trước."); }
  finally { URL.revokeObjectURL(url); }
}
function canvas(width:number,height:number) {
  const c=document.createElement("canvas");c.width=width;c.height=height;
  const ctx=c.getContext("2d",{willReadFrequently:true});
  if(!ctx)throw new Error("Trình duyệt không hỗ trợ Canvas 2D.");
  return {c,ctx};
}
export async function normalizeImage(blob:Blob,max=2400):Promise<Blob> {
  const image=await decodeImage(blob);
  if(image.naturalWidth*image.naturalHeight>60_000_000)throw new Error("Ảnh vượt 60 megapixel. Hãy giảm kích thước trước khi nhập.");
  const scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight));
  const {c,ctx}=canvas(Math.max(2,Math.round(image.naturalWidth*scale)),Math.max(2,Math.round(image.naturalHeight*scale)));
  ctx.fillStyle="white";ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(image,0,0,c.width,c.height);
  return blobFromCanvas(c);
}
export async function newPage(blob:Blob):Promise<ScanPage> {
  const original=await normalizeImage(blob),image=await decodeImage(original);
  const thumbnail=await normalizeImage(original,220);
  return {id:crypto.randomUUID(),original,rendered:original,thumbnail,originalThumbnail:thumbnail,width:image.naturalWidth,height:image.naturalHeight,crop:fullCrop(),rotation:0,filter:"original",text:""};
}
async function pixels(job:PixelJob):Promise<ReturnType<typeof processPixels>> {
  if(typeof Worker==="undefined") return processPixels(job);
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL("/workers/processing.js",window.location.origin),{type:"module"});
    const timeout=window.setTimeout(()=>{worker.terminate();reject(new Error("Xử lý ảnh quá lâu. Hãy thử ảnh nhỏ hơn."));},90_000);
    const end=()=>{clearTimeout(timeout);worker.terminate();};
    worker.onmessage=event=>{end();event.data.error?reject(new Error(event.data.error)):resolve(event.data);};
    worker.onerror=()=>{end();reject(new Error("Không thể chạy bộ xử lý ảnh. Hãy tải lại ứng dụng khi có mạng."));};
    worker.postMessage(job,[job.pixels.buffer]);
  });
}
export async function editPage(page:ScanPage,changes:Partial<Pick<ScanPage,"crop"|"rotation"|"filter">>):Promise<ScanPage> {
  const next={...page,...changes};
  const image=await decodeImage(page.original);
  const source=canvas(image.naturalWidth,image.naturalHeight);
  source.ctx.drawImage(image,0,0);
  const result=await pixels({pixels:source.ctx.getImageData(0,0,source.c.width,source.c.height).data,width:source.c.width,height:source.c.height,crop:next.crop,filter:next.filter});
  const corrected=canvas(result.width,result.height);
  corrected.ctx.putImageData(new ImageData(new Uint8ClampedArray(result.pixels),result.width,result.height),0,0);
  const turns=((next.rotation%4)+4)%4;
  const dest=canvas(turns%2?result.height:result.width,turns%2?result.width:result.height);
  dest.ctx.translate(dest.c.width/2,dest.c.height/2);dest.ctx.rotate(turns*Math.PI/2);
  dest.ctx.drawImage(corrected.c,-result.width/2,-result.height/2);
  const rendered=await blobFromCanvas(dest.c);
  return {...next,rendered,thumbnail:await normalizeImage(rendered,220),width:dest.c.width,height:dest.c.height,text:"",ocrAt:undefined};
}
