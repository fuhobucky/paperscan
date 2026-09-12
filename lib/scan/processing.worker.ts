import { processPixels, type PixelJob } from "./image-math";
const scope = globalThis as unknown as {
  onmessage:(event:MessageEvent<PixelJob>)=>void;
  postMessage:(message:unknown,transfer?:Transferable[])=>void;
};
scope.onmessage=event=>{
  try {
    const result=processPixels(event.data);
    scope.postMessage(result,[result.pixels.buffer]);
  } catch(error) { scope.postMessage({error:error instanceof Error?error.message:"Không thể xử lý ảnh."}); }
};
