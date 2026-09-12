"use client";
import {useEffect,useState,useRef} from "react";
import {Check,RotateCcw} from "lucide-react";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {useBlobURL} from "./blob-image";
import {fullCrop,type ScanPage,type Quad} from "@/lib/scan/types";
import {validQuad} from "@/lib/scan/image-math";

export function CropEditor({page,onClose,onApply,busy}:{page:ScanPage;onClose:()=>void;onApply:(crop:Quad)=>void;busy:boolean}) {
  const [points,setPoints]=useState<Quad>(page.crop),[ratio,setRatio]=useState(1);
  const image=useBlobURL(page.original),surface=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null);
  const [displayWidth,setDisplayWidth]=useState(0);
  useEffect(()=>{
    if(!stage.current)return;
    const observer=new ResizeObserver(entries=>{
      const rect=entries[0].contentRect;
      setDisplayWidth(Math.min(rect.width,rect.height*ratio));
    });
    observer.observe(stage.current);return()=>observer.disconnect();
  },[ratio]);
  useEffect(()=>setPoints(page.crop),[page.id,page.crop]);
  function move(index:number,x:number,y:number) {
    setPoints(current=>current.map((point,i)=>i===index?{x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y))}:point) as Quad);
  }
  return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}>
    <DialogContent className="crop-dialog sm:max-w-3xl" showCloseButton={!busy}>
      <div className="pr-7"><DialogTitle>Căn chỉnh 4 góc</DialogTitle><DialogDescription className="mt-2">Kéo các điểm đến bốn góc trang giấy. Dùng phím mũi tên để chỉnh chính xác.</DialogDescription></div>
      <div className="crop-stage" ref={stage}>
        <div ref={surface} className="crop-surface" style={{width:displayWidth,height:displayWidth/ratio}}>
          {image&&<img src={image} alt="Ảnh gốc để căn chỉnh phối cảnh" onLoad={e=>setRatio(e.currentTarget.naturalWidth/e.currentTarget.naturalHeight)} draggable={false}/>}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="crop-mask" aria-hidden="true">
            <path d={`M0,0H100V100H0Z M${points.map(p=>`${p.x*100},${p.y*100}`).join("L")}Z`} fill="rgba(0,0,0,.6)" fillRule="evenodd"/>
            <polygon points={points.map(p=>`${p.x*100},${p.y*100}`).join(" ")} fill="none" stroke={validQuad(points)?"#65efbc":"#ff7777"} strokeWidth=".45"/>
          </svg>
          {points.map((point,index)=><button key={index} className="crop-handle" aria-label={`Góc ${["trên trái","trên phải","dưới phải","dưới trái"][index]}`} style={{left:`${point.x*100}%`,top:`${point.y*100}%`}}
            onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);}}
            onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId)){const rect=surface.current?.getBoundingClientRect();if(rect)move(index,(event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height);}}}
            onKeyDown={event=>{const step=event.shiftKey?.02:.005;const directions:{[key:string]:[number,number]}={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};const delta=directions[event.key];if(delta){event.preventDefault();move(index,point.x+delta[0],point.y+delta[1]);}}} disabled={busy}><span>{index+1}</span></button>)}
        </div>
      </div>
      {!validQuad(points)&&<p role="alert" className="text-sm text-destructive">Bốn góc không được giao nhau hoặc tạo vùng quá nhỏ.</p>}
      <div className="flex justify-between gap-3"><Button variant="outline" onClick={()=>setPoints(fullCrop())} disabled={busy}><RotateCcw/>Toàn bộ ảnh</Button><Button onClick={()=>onApply(points)} disabled={busy||!validQuad(points)}><Check/>{busy?"Đang xử lý…":"Áp dụng vùng cắt"}</Button></div>
    </DialogContent>
  </Dialog>;
}
