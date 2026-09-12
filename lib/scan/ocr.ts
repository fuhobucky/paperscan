import {createWorker,OEM} from "tesseract.js";
import type {ScanPage,ProgressInfo} from "./types";
function abortable<T>(promise:Promise<T>,signal:AbortSignal):Promise<T> {
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(new DOMException("Đã hủy nhận diện.","AbortError"));
    if(signal.aborted){abort();return;}
    signal.addEventListener("abort",abort,{once:true});
    promise.then(resolve,reject).finally(()=>signal.removeEventListener("abort",abort));
  });
}
export async function recognizePages(pages:ScanPage[],progress:(p:ProgressInfo)=>void,signal:AbortSignal):Promise<ScanPage[]> {
  let pageIndex=0;
  progress({message:"Đang mở bộ nhận diện tiếng Việt + Anh…",percent:0});
  const origin=window.location.origin;
  const creation=createWorker(["vie","eng"],OEM.LSTM_ONLY,{
    workerPath:`${origin}/vendor/ocr/worker.min.js`,
    corePath:`${origin}/vendor/ocr/core`,langPath:`${origin}/vendor/ocr/lang`,
    workerBlobURL:false,
    logger:message=>{
      if(signal.aborted)return;
      const percentage=(pageIndex+Math.max(0,Math.min(1,message.progress||0)))/pages.length*100;
      progress({message:message.status==="recognizing text"?`Đang đọc trang ${pageIndex+1}/${pages.length}…`:"Đang chuẩn bị bộ nhận diện…",percent:percentage});
    },
  });
  // If canceled during startup, terminate as soon as the worker becomes available.
  void creation.then(worker=>{if(signal.aborted)void worker.terminate();},()=>{});
  const worker=await abortable(creation,signal);
  const abort=()=>{void worker.terminate();};
  signal.addEventListener("abort",abort,{once:true});
  try {
    const result:ScanPage[]=[];
    for(pageIndex=0;pageIndex<pages.length;pageIndex++) {
      if(signal.aborted)throw new DOMException("Đã hủy nhận diện.","AbortError");
      const page=pages[pageIndex],{data}=await abortable(worker.recognize(page.rendered),signal);
      result.push({...page,text:data.text.trim(),ocrAt:Date.now()});
    }
    return result;
  } finally {signal.removeEventListener("abort",abort);await worker.terminate();}
}
