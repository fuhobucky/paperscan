"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {X,SwitchCamera,Check,Camera,ImagePlus,AlertCircle} from "lucide-react";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {blobFromCanvas} from "@/lib/scan/images";
import {BlobImage} from "./blob-image";

export function CameraOverlay({onClose,onSave,onImport,remaining}:{onClose:()=>void;onSave:(images:Blob[])=>void;onImport:()=>void;remaining:number}) {
  const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null);
  const [facing,setFacing]=useState<"environment"|"user">("environment"),[attempt,setAttempt]=useState(0);
  const [ready,setReady]=useState(false),[error,setError]=useState(""),[shots,setShots]=useState<Blob[]>([]),[taking,setTaking]=useState(false);
  const stop=useCallback(()=>{stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;setReady(false);},[]);
  useEffect(()=>{
    let disposed=false;setError("");setReady(false);
    async function start() {
      if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){setError("Camera cần HTTPS và trình duyệt hỗ trợ. Bạn vẫn có thể nhập ảnh từ thiết bị.");return;}
      try {
        const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:2560},height:{ideal:1920}},audio:false});
        if(disposed){media.getTracks().forEach(track=>track.stop());return;}
        stream.current=media;
        if(video.current){video.current.srcObject=media;await video.current.play();if(!disposed)setReady(true);}
      } catch(err){if(!disposed)setError(err instanceof DOMException&&err.name==="NotAllowedError"?"Camera chưa được cho phép. Hãy bật quyền camera cho trang web trong cài đặt trình duyệt.":"Không mở được camera. Hãy đóng ứng dụng đang dùng camera hoặc nhập ảnh có sẵn.");}
    }
    void start();
    const visibility=()=>{if(document.hidden){stop();setError("Camera đã tạm dừng khi rời ứng dụng. Bấm Mở lại để tiếp tục.");}};
    document.addEventListener("visibilitychange",visibility);
    return()=>{disposed=true;stop();document.removeEventListener("visibilitychange",visibility);};
  },[facing,attempt,stop]);
  async function capture() {
    if(!video.current||!ready||taking||shots.length>=remaining)return;
    setTaking(true);
    try {
      const v=video.current,c=document.createElement("canvas"),scale=Math.min(1,2400/Math.max(v.videoWidth,v.videoHeight));
      c.width=Math.round(v.videoWidth*scale);c.height=Math.round(v.videoHeight*scale);
      const context=c.getContext("2d");if(!context)throw new Error("Không thể chụp ảnh.");
      context.drawImage(v,0,0,c.width,c.height);const blob=await blobFromCanvas(c);
      setShots(current=>[...current,blob]);
    } catch(err){setError(err instanceof Error?err.message:"Không thể chụp ảnh.");}
    finally {setTaking(false);}
  }
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}>
    <DialogContent className="camera-overlay" showCloseButton={false}>
      <DialogTitle className="sr-only">Camera quét tài liệu</DialogTitle><DialogDescription className="sr-only">Chụp nhiều trang rồi bấm Lưu. Có thể chỉnh bốn góc sau khi chụp.</DialogDescription>
      <video ref={video} autoPlay playsInline muted className="camera-video"/>
      <header className="camera-header"><Button variant="ghost" size="icon" onClick={onClose} aria-label="Đóng camera"><X/></Button><span><Camera size={18}/>Quét tài liệu</span><Button variant="ghost" size="icon" onClick={()=>{stop();setFacing(value=>value==="environment"?"user":"environment");}} aria-label="Đổi camera"><SwitchCamera/></Button></header>
      {error?<div className="camera-error"><AlertCircle size={32}/><p>{error}</p><div className="flex flex-wrap justify-center gap-3"><Button onClick={()=>setAttempt(value=>value+1)}>Mở lại camera</Button><Button variant="secondary" onClick={onImport}>Nhập ảnh</Button></div></div>:<div className="camera-guidance"><div className="camera-frame"><i/><i/><i/><i/></div><p>{ready?"Đặt trang giấy trong khung. Giữ máy thẳng và đủ sáng.":"Đang mở camera…"}</p><span>Chụp trước, căn chỉnh 4 góc sau</span></div>}
      <footer className="camera-footer"><div className="shot-strip">{shots.map((shot,index)=><div key={index}><BlobImage blob={shot} alt={`Ảnh vừa chụp ${index+1}`}/><button aria-label={`Bỏ ảnh ${index+1}`} onClick={()=>setShots(current=>current.filter((_,i)=>i!==index))}><X size={12}/></button></div>)}</div>
        <div className="camera-actions"><Button variant="ghost" onClick={onImport}><ImagePlus/>Nhập ảnh</Button><button className="shutter" aria-label="Chụp trang" onClick={()=>void capture()} disabled={!ready||taking||shots.length>=remaining}><span/></button><Button variant="ghost" disabled={!shots.length||taking} onClick={()=>{stop();onSave(shots);}}><Check/>Lưu ({shots.length})</Button></div>
        <p>{shots.length}/{remaining} trang · Chụp thêm để tạo PDF nhiều trang</p>
      </footer>
    </DialogContent>
  </Dialog>;
}
