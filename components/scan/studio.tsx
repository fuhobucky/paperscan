"use client";
import {useCallback,useEffect,useRef,useState,type CSSProperties} from "react";
import {ScanLine,Plus,Upload,Search,FolderOpen,FileText,ShieldCheck,ChevronRight,ChevronLeft,Download,MoreHorizontal,Trash2,RotateCw,Crop,SlidersHorizontal,Sparkles,Check,ArrowLeft,TextSelect,Moon,Sun,Smartphone,WifiOff,CheckCheck,Copy,Share2,LoaderCircle,ArrowUp,ArrowDown,RotateCcw,Camera,Monitor,HardDrive,Info,X,ZoomIn,ZoomOut} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Sidebar,SidebarContent,SidebarFooter,SidebarHeader,SidebarProvider,SidebarTrigger,useSidebar} from "@/components/ui/sidebar";
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from "@/components/ui/sheet";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger,DropdownMenuSeparator} from "@/components/ui/dropdown-menu";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogAction,AlertDialogCancel} from "@/components/ui/alert-dialog";
import {Progress} from "@/components/ui/progress";
import {Empty,EmptyHeader,EmptyTitle,EmptyDescription} from "@/components/ui/empty";
import {Toaster,toast} from "sonner";
import {BlobImage} from "./blob-image";
import {CameraOverlay} from "./camera";
import {CropEditor} from "./crop-editor";
import {PageStrip} from "./page-strip";
import {usePWA} from "./pwa";
import {registerScanTools} from "@/lib/scan/webmcp";
import {listDocuments,saveDocument,deleteDocument} from "@/lib/scan/storage";
import {newPage,editPage} from "@/lib/scan/images";
import {importFiles,makePDF,download,safeName} from "@/lib/scan/import-export";
import {fullCrop,filters,MAX_PAGES,errorMessage,type ScanDocument,type ScanPage,type Filter,type Quad,type ProgressInfo} from "@/lib/scan/types";

const date=(stamp:number)=>new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric"}).format(stamp);
function DocumentList({documents,selected,choose,busy}:{documents:ScanDocument[];selected:string|null;choose:(id:string)=>void;busy:boolean}) {
  const sidebar=useSidebar();
  return <div className="document-list">{documents.map(doc=><button key={doc.id} className={`document-item ${selected===doc.id?"active":""}`} disabled={busy} onClick={()=>{choose(doc.id);sidebar.setOpenMobile(false);}}>
    <BlobImage blob={doc.pages[0]?.thumbnail} alt="" className="document-mini"/>
    <span className="document-info"><strong>{doc.title}</strong><span>{date(doc.createdAt)}</span><small>{doc.pages.length} trang</small></span>
    {selected===doc.id&&<ChevronRight size={16} className="shrink-0 text-primary"/>}
  </button>)}</div>;
}

export default function Studio() {
  const [documents,setDocuments]=useState<ScanDocument[]>([]),[selected,setSelected]=useState<string|null>(null),[pageID,setPageID]=useState("");
  const [query,setQuery]=useState(""),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState("");
  const [busy,setBusy]=useState<ProgressInfo|null>(null),[camera,setCamera]=useState<{target:string|null}|null>(null),[cropOpen,setCropOpen]=useState(false);
  const [toolsOpen,setToolsOpen]=useState(false),[ocrOpen,setOCROpen]=useState(false),[installOpen,setInstallOpen]=useState(false);
  const [rename,setRename]=useState<string|null>(null),[deleting,setDeleting]=useState<"document"|"page"|null>(null),[shareFile,setShareFile]=useState<File|null>(null);
  const [dark,setDark]=useState(false),[dragging,setDragging]=useState(false),[zoom,setZoom]=useState(100),[ocrRunning,setOCRRunning]=useState(false);
  const docsRef=useRef(documents),busyRef=useRef(false),fileInput=useRef<HTMLInputElement>(null),importTarget=useRef<string|null>(null);
  const broadcast=useRef<BroadcastChannel|null>(null),ocrController=useRef<AbortController|null>(null),swipe=useRef<{x:number;y:number}|null>(null);
  const pwa=usePWA();
  const current=documents.find(doc=>doc.id===selected),page=current?.pages.find(p=>p.id===pageID)??current?.pages[0];
  const pageIndex=current?.pages.findIndex(p=>p.id===page?.id)??0;
  const filtered=documents.filter(doc=>doc.title.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")));
  docsRef.current=documents;

  const refresh=useCallback(async()=>{const docs=await listDocuments();setDocuments(docs);docsRef.current=docs;return docs;},[]);
  useEffect(()=>{
    let active=true;
    listDocuments().then(docs=>{if(active){setDocuments(docs);docsRef.current=docs;if(window.innerWidth>=768&&docs[0]){setSelected(docs[0].id);setPageID(docs[0].pages[0].id);}}}).catch(e=>{if(active)setLoadError(errorMessage(e));}).finally(()=>{if(active)setLoading(false);});
    try {const value=localStorage.getItem("paperscan-theme");setDark(value?value==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches);}catch{}
    const channel=typeof BroadcastChannel!=="undefined"?new BroadcastChannel("paperscan-documents"):null;
    broadcast.current=channel;
    if(channel)channel.onmessage=()=>{void refresh().catch(()=>{});};
    const beforeUnload=(event:BeforeUnloadEvent)=>{if(busyRef.current){event.preventDefault();event.returnValue="";}};
    window.addEventListener("beforeunload",beforeUnload);
    return()=>{active=false;channel?.close();ocrController.current?.abort();window.removeEventListener("beforeunload",beforeUnload);};
  },[refresh]);
  useEffect(()=>{document.documentElement.classList.toggle("dark",dark);},[dark]);
  useEffect(()=>registerScanTools(()=>docsRef.current,id=>{
    const doc=docsRef.current.find(d=>d.id===id);
    if(doc){setSelected(doc.id);setPageID(doc.pages[0].id);}
  },()=>busyRef.current),[]);
  useEffect(()=>{setZoom(100);},[page?.id]);
  function toggleTheme(){setDark(value=>{try{localStorage.setItem("paperscan-theme",value?"light":"dark");}catch{}return !value;});}
  function choose(id:string){const doc=docsRef.current.find(d=>d.id===id);if(doc){setSelected(id);setPageID(doc.pages[0].id);}}
  async function commit(doc:ScanDocument){const saved=await saveDocument(doc);setDocuments(current=>[saved,...current.filter(d=>d.id!==saved.id)].sort((a,b)=>b.modifiedAt-a.modifiedAt));broadcast.current?.postMessage("changed");return saved;}
  async function run(message:string,action:()=>Promise<void>) {
    if(busyRef.current)return false;
    busyRef.current=true;setBusy({message});
    try{await action();return true;}
    catch(error){if(!(error instanceof DOMException&&error.name==="AbortError"))toast.error(errorMessage(error));else toast("Đã hủy nhận diện.");void refresh().catch(()=>{});return false;}
    finally{busyRef.current=false;setBusy(null);}
  }
  function promptImport(target:string|null){if(busyRef.current)return;importTarget.current=target;fileInput.current?.click();}
  async function addPages(pages:ScanPage[],target:string|null,title?:string) {
    if(!pages.length)return;
    let doc=target?docsRef.current.find(d=>d.id===target):undefined;
    if(target&&!doc)throw new Error("Tài liệu không còn tồn tại. Hãy nhập thành tài liệu mới.");
    if(!doc)doc={id:crypto.randomUUID(),title:title||`Tài liệu ${date(Date.now())}`,createdAt:Date.now(),modifiedAt:Date.now(),revision:0,pages:[]};
    const saved=await commit({...doc,pages:[...doc.pages,...pages]});setSelected(saved.id);setPageID(pages[0].id);
    toast.success(`Đã lưu ${pages.length} trang trên thiết bị`);
  }
  async function receiveFiles(files:File[],target:string|null) {
    if(!files.length)return;
    await run("Đang mở tài liệu…",async()=>{
      const remaining=MAX_PAGES-(docsRef.current.find(d=>d.id===target)?.pages.length??0);
      const pages=await importFiles(files,remaining,setBusy);
      const title=files[0]?.name.replace(/\.[^.]+$/,"").slice(0,100);
      await addPages(pages,target,title);
    });
  }
  async function receiveShots(shots:Blob[],target:string|null) {
    setCamera(null);
    const success=await run("Đang lưu ảnh vừa chụp…",async()=>{
      const pages:ScanPage[]=[];
      for(let i=0;i<shots.length;i++){setBusy({message:`Đang lưu trang ${i+1}/${shots.length}…`,percent:(i+1)/shots.length*100});pages.push(await newPage(shots[i]));}
      await addPages(pages,target);
    });
    if(success)setCropOpen(true);
  }
  async function changePage(changes:Partial<Pick<ScanPage,"filter"|"rotation"|"crop">>,closeCrop=false) {
    if(!current||!page)return;
    const success=await run("Đang chỉnh ảnh…",async()=>{const edited=await editPage(page,changes);await commit({...current,pages:current.pages.map(p=>p.id===page.id?edited:p)});});
    if(success&&closeCrop)setCropOpen(false);
  }
  async function reorder(pages:ScanPage[]){if(current)await run("Đang lưu thứ tự trang…",async()=>{await commit({...current,pages});});}
  async function movePage(delta:number){if(!current)return;const next=pageIndex+delta;if(next<0||next>=current.pages.length)return;const pages=[...current.pages];[pages[pageIndex],pages[next]]=[pages[next],pages[pageIndex]];await reorder(pages);}
  async function startOCR(){
    if(!current)return;
    setOCROpen(true);setOCRRunning(true);const controller=new AbortController();ocrController.current=controller;
    await run("Đang chuẩn bị OCR…",async()=>{const {recognizePages}=await import("@/lib/scan/ocr");const pages=await recognizePages(current.pages,setBusy,controller.signal);if(controller.signal.aborted)throw new DOMException("Hủy","AbortError");await commit({...current,pages});toast.success("Đã nhận diện và lưu văn bản");});
    setOCRRunning(false);ocrController.current=null;
  }
  async function exportPDF(){if(current)await run("Đang tạo PDF…",async()=>setShareFile(await makePDF(current,setBusy)));}
  function exportImage(){if(current&&page)setShareFile(new File([page.rendered],`${safeName(current.title)}-${pageIndex+1}.jpg`,{type:"image/jpeg"}));}
  const text=current?.pages.map((p,i)=>`Trang ${i+1}\n${p.text|| (p.ocrAt?"Không tìm thấy văn bản.":"Chưa nhận diện.")}`).join("\n\n")||"";
  async function copyText(){try{await navigator.clipboard.writeText(text);toast.success("Đã sao chép văn bản");}catch{toast.error("Không thể truy cập clipboard. Bạn có thể chọn và sao chép văn bản bên dưới.");}}
  async function remove(){
    const kind=deleting;setDeleting(null);if(!current)return;
    await run("Đang xóa…",async()=>{
      if(kind==="document"){await deleteDocument(current);await refresh();setSelected(null);broadcast.current?.postMessage("changed");}
      else if(page&&current.pages.length>1){const saved=await commit({...current,pages:current.pages.filter(p=>p.id!==page.id)});setPageID(saved.pages[Math.min(pageIndex,saved.pages.length-1)].id);}
    });
  }
  function navigatePage(delta:number){if(current){const next=current.pages[pageIndex+delta];if(next)setPageID(next.id);}}

  const editor=page?<div className="editor-controls">
    <div className="section-label"><SlidersHorizontal size={17}/>Bộ lọc ảnh</div>
    <div className="filter-grid">{filters.map(filter=><button key={filter.id} className={`filter-option ${page.filter===filter.id?"active":""}`} disabled={!!busy} onClick={()=>{if(page.filter!==filter.id)void changePage({filter:filter.id});}} aria-pressed={page.filter===filter.id}>
      <span className={`filter-preview filter-${filter.id}`}><BlobImage blob={page.originalThumbnail??page.thumbnail} alt=""/>{page.filter===filter.id&&<span className="filter-check"><Check size={12}/></span>}</span><strong>{filter.name}</strong>
    </button>)}</div>
    <p className="filter-note">{filters.find(f=>f.id===page.filter)?.description}</p>
    <div className="control-divider"/><div className="section-label">Chỉnh sửa trang</div>
    <div className="edit-grid"><Button variant="outline" onClick={()=>{setToolsOpen(false);setCropOpen(true);}} disabled={!!busy}><Crop/>Cắt 4 góc</Button><Button variant="outline" onClick={()=>void changePage({rotation:(page.rotation+1)%4})} disabled={!!busy}><RotateCw/>Xoay 90°</Button></div>
    <Button variant="ghost" className="reset-button" onClick={()=>void changePage({crop:fullCrop(),rotation:0,filter:"original"})} disabled={!!busy}><RotateCcw size={15}/>Khôi phục ảnh gốc</Button>
    <div className="control-divider"/><div className="ocr-card"><span className="ocr-icon"><TextSelect size={22}/></span><h3>Từ hình ảnh thành văn bản</h3><p>Nhận diện tiếng Việt và tiếng Anh, ngay trên thiết bị.</p><Button onClick={()=>{setToolsOpen(false);void startOCR();}} disabled={!!busy} variant="outline"><Sparkles size={16}/>{current?.pages.every(p=>p.ocrAt)?"Nhận diện lại":"Nhận diện văn bản"}</Button>{current?.pages.some(p=>p.ocrAt)&&<button className="text-link" onClick={()=>{setToolsOpen(false);setOCROpen(true);}}>Xem văn bản đã lưu<ChevronRight size={14}/></button>}</div>
    <div className="page-information"><span>Độ phân giải</span><strong>{page.width} × {page.height}</strong></div>
  </div>:null;

  return <SidebarProvider style={{"--sidebar-width":"286px"} as CSSProperties} className="studio-provider">
    <Toaster position="top-center" richColors theme={dark?"dark":"light"}/>
    <input ref={fileInput} type="file" accept="image/*,application/pdf" multiple className="sr-only" aria-label="Nhập ảnh hoặc PDF" onChange={e=>{const files=Array.from(e.currentTarget.files??[]);e.currentTarget.value="";void receiveFiles(files,importTarget.current);}}/>
    <header className="studio-header"><div className="brand"><span className="brand-mark"><ScanLine size={23}/></span><span>PaperScan<span className="brand-studio"> Studio</span></span><span className="beta-label">WEB APP</span></div><div className="header-actions"><span className="privacy-label"><ShieldCheck size={16}/>Chỉ trên thiết bị này</span><button className="icon-button" onClick={toggleTheme} aria-label={dark?"Giao diện sáng":"Giao diện tối"}>{dark?<Sun size={19}/>:<Moon size={19}/>}</button><Button variant="outline" onClick={()=>setInstallOpen(true)} className="install-top"><Download size={16}/>{pwa.installed?"Đã cài đặt":"Cài ứng dụng"}</Button></div></header>
    <div className="studio-body">
      <Sidebar className="scan-sidebar" collapsible="offcanvas"><SidebarHeader className="library-header"><div className="library-title"><h2>Thư viện</h2><span>{documents.length}</span></div><Button onClick={()=>setCamera({target:null})} disabled={!!busy||loading||!!loadError} className="new-scan"><Plus/>Quét tài liệu mới</Button><div className="library-search"><Search size={17}/><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm tài liệu…" aria-label="Tìm tài liệu"/></div></SidebarHeader><SidebarContent className="library-content"><div className="list-label"><span>TÀI LIỆU CỦA BẠN</span><span>Mới nhất</span></div>{loading?<p className="library-empty">Đang mở thư viện…</p>:filtered.length?<DocumentList documents={filtered} selected={selected} choose={choose} busy={!!busy}/>:<p className="library-empty">{query?"Không tìm thấy tài liệu.":"Tài liệu đã quét sẽ xuất hiện ở đây."}</p>}<button className="import-sidebar" onClick={()=>promptImport(null)} disabled={!!busy||loading||!!loadError}><Upload size={17}/>Nhập ảnh hoặc PDF</button></SidebarContent><SidebarFooter className="library-footer"><div className="local-storage"><HardDrive size={18}/><div><strong>Lưu trên thiết bị</strong><span>Không tải tài liệu lên máy chủ</span></div></div><button className={`offline-status ${pwa.ready?"is-ready":""}`} onClick={()=>setInstallOpen(true)}>{!pwa.online?<WifiOff size={15}/>:pwa.ready?<CheckCheck size={15}/>:<Download size={15}/>}<span>{!pwa.online?"Bạn đang ngoại tuyến":pwa.ready?"Đã sẵn sàng dùng offline":pwa.failed?"Thiết lập chế độ offline":"Đang chuẩn bị offline…"}</span></button></SidebarFooter></Sidebar>
      <main className={`workspace ${dragging?"is-dragging":""}`} onDragOver={event=>{if(event.dataTransfer.types.includes("Files")){event.preventDefault();setDragging(true);}}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDragging(false);}} onDrop={event=>{event.preventDefault();setDragging(false);if(!busy&&event.dataTransfer.files.length)void receiveFiles(Array.from(event.dataTransfer.files),selected);}}>
        <div className="workspace-toolbar"><div className="breadcrumb"><SidebarTrigger className="md:hidden" aria-label="Mở thư viện"/>{current?<><button className="icon-button mobile-back" onClick={()=>setSelected(null)} aria-label="Về thư viện"><ArrowLeft size={20}/></button><FolderOpen size={17} className="desktop-icon"/><span className="breadcrumb-label">Thư viện</span><ChevronRight size={14}/><button className="document-title" onClick={()=>setRename(current.title)} disabled={!!busy}>{current.title}</button></>:<><FolderOpen size={18}/><span>Tất cả tài liệu</span></>}</div>{current&&<div className="workspace-actions"><span className="saved-label"><Check size={14}/>Đã lưu</span><Button onClick={()=>void exportPDF()} disabled={!!busy}><Download size={16}/><span>Xuất PDF</span></Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Tùy chọn tài liệu" disabled={!!busy}><MoreHorizontal/></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={()=>setRename(current.title)}>Đổi tên tài liệu</DropdownMenuItem><DropdownMenuItem onClick={exportImage}>Xuất ảnh JPEG trang này</DropdownMenuItem><DropdownMenuItem onClick={()=>setOCROpen(true)}>Xem văn bản OCR</DropdownMenuItem><DropdownMenuSeparator/><DropdownMenuItem variant="destructive" onClick={()=>setDeleting("document")}><Trash2/>Xóa tài liệu</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>}</div>
        {loadError?<Empty><EmptyHeader><EmptyTitle>Chưa mở được thư viện</EmptyTitle><EmptyDescription>{loadError}</EmptyDescription></EmptyHeader><Button onClick={()=>{setLoading(true);refresh().then(()=>setLoadError("")).catch(e=>setLoadError(errorMessage(e))).finally(()=>setLoading(false));}}>Thử lại</Button></Empty>:current&&page?<div className="document-workspace"><section className="viewer-column"><div className="page-toolbar"><div className="page-counter"><FileText size={16}/><span>Trang {pageIndex+1}<span className="muted"> / {current.pages.length}</span></span></div><div className="viewer-toolbuttons"><Button variant="ghost" size="icon" aria-label="Thu nhỏ" onClick={()=>setZoom(z=>Math.max(50,z-25))} disabled={zoom<=50}><ZoomOut size={17}/></Button><span className="zoom-label">{zoom}%</span><Button variant="ghost" size="icon" aria-label="Phóng to" onClick={()=>setZoom(z=>Math.min(200,z+25))} disabled={zoom>=200}><ZoomIn size={17}/></Button><span className="toolbar-separator"/><Button variant="ghost" size="icon" aria-label="Xóa trang hiện tại" disabled={!!busy||current.pages.length===1} onClick={()=>setDeleting("page")}><Trash2 size={17}/></Button><Button variant="outline" className="mobile-edit" onClick={()=>setToolsOpen(true)} disabled={!!busy}><SlidersHorizontal size={17}/>Chỉnh sửa</Button></div></div>
          <div className="document-canvas" onPointerDown={e=>{if(e.pointerType==="touch"&&e.isPrimary)swipe.current={x:e.clientX,y:e.clientY};}} onPointerUp={e=>{const start=swipe.current;swipe.current=null;if(start&&zoom===100&&Math.abs(e.clientX-start.x)>70&&Math.abs(e.clientY-start.y)<50)navigatePage(e.clientX>start.x?-1:1);}}><div className="document-paper" style={{width:`${Math.round(450*zoom/100)}px`,"--page-zoom":zoom/100} as CSSProperties}><BlobImage blob={page.rendered} alt={`Trang ${pageIndex+1} — ${current.title}`}/></div></div>
          <div className="viewer-bottom"><span>{filters.find(f=>f.id===page.filter)?.name}<span className="dot-separator">·</span>{page.ocrAt?"Đã nhận diện văn bản":"Chưa nhận diện văn bản"}</span><div><button className="icon-button" onClick={()=>navigatePage(-1)} disabled={pageIndex===0} aria-label="Trang trước"><ChevronLeft size={17}/></button><button className="icon-button" onClick={()=>navigatePage(1)} disabled={pageIndex===current.pages.length-1} aria-label="Trang sau"><ChevronRight size={17}/></button></div></div>
          <div className="pages-section"><div className="pages-heading"><h3>Các trang <span>{current.pages.length}</span></h3><div className="page-order-actions"><span>Kéo để sắp xếp</span><button className="icon-button" onClick={()=>void movePage(-1)} disabled={!!busy||pageIndex===0} aria-label="Đưa trang lên trước"><ArrowUp size={15}/></button><button className="icon-button" onClick={()=>void movePage(1)} disabled={!!busy||pageIndex===current.pages.length-1} aria-label="Đưa trang ra sau"><ArrowDown size={15}/></button></div></div><PageStrip pages={current.pages} selected={page.id} onSelect={setPageID} onReorder={pages=>void reorder(pages)} onAdd={()=>promptImport(current.id)} disabled={!!busy}/></div>
        </section><aside className="inspector">{editor}<div className="inspector-tip"><ShieldCheck size={17}/><p>Ảnh gốc luôn được giữ lại. Bạn có thể chỉnh sửa bất cứ lúc nào.</p></div></aside></div>:<div className="empty-workspace"><div className="empty-main"><span className="empty-kicker">ÍT GIẤY TỜ HƠN. NHIỀU KHÔNG GIAN HƠN.</span><h1>Từ trang giấy<br/>đến <span>mọi nơi.</span></h1><p>Quét, chỉnh sửa và lưu tài liệu của bạn.<br/>Một không gian gọn gàng, ngay trên thiết bị.</p><div className="capture-choices"><button className="capture-choice primary-choice" onClick={()=>setCamera({target:null})} disabled={!!busy||loading||!!loadError}><span className="choice-icon"><ScanLine size={30}/></span><strong>Quét tài liệu</strong><span>Mở camera và chụp trang giấy</span><span className="choice-action">Bắt đầu quét<ChevronRight size={16}/></span></button><button className="capture-choice" onClick={()=>promptImport(null)} disabled={!!busy||loading||!!loadError}><span className="choice-icon"><Upload size={28}/></span><strong>Nhập ảnh hoặc PDF</strong><span>Chọn tệp hoặc kéo thả vào đây</span><span className="choice-action">Chọn từ thiết bị<ChevronRight size={16}/></span></button></div><div className="empty-formats"><span>JPG, PNG, WEBP, PDF</span><span>·</span><span>Tối đa 40 MB / tệp</span></div><div className="empty-benefits"><span><Crop size={16}/>Cắt 4 góc</span><span><TextSelect size={16}/>OCR Việt + Anh</span><span><WifiOff size={16}/>Dùng ngoại tuyến</span></div></div>{documents.length>0&&<section className="mobile-documents"><h2>Tài liệu gần đây <span>{documents.length}</span></h2><DocumentList documents={filtered} selected={selected} choose={choose} busy={!!busy}/></section>}</div>}
        {dragging&&<div className="drop-overlay"><Upload size={42}/><strong>{current?"Thả để thêm trang":"Thả ảnh hoặc PDF tại đây"}</strong><span>Tệp được xử lý trên thiết bị của bạn</span></div>}
      </main>
    </div>
    <button className="scan-fab" onClick={()=>setCamera({target:current?.id??null})} disabled={!!busy||loading||!!loadError||(current?.pages.length??0)>=40} aria-label={current?"Chụp thêm trang":"Quét tài liệu mới"}><ScanLine size={24}/><span>{current?"Chụp thêm":"Quét tài liệu"}</span></button>
    {busy&&<div className="job-status" role="status" aria-live="polite"><LoaderCircle className="animate-spin" size={19}/><div><strong>{busy.message}</strong>{busy.percent!==undefined&&<Progress value={busy.percent} className="h-1 mt-2"/>}</div>{ocrRunning&&<Button variant="ghost" size="sm" onClick={()=>ocrController.current?.abort()}>Hủy</Button>}</div>}
    {camera&&<CameraOverlay remaining={40-(documents.find(d=>d.id===camera.target)?.pages.length??0)} onClose={()=>setCamera(null)} onSave={shots=>void receiveShots(shots,camera.target)} onImport={()=>{const target=camera.target;setCamera(null);promptImport(target);}}/>}
    {cropOpen&&page&&<CropEditor page={page} busy={!!busy} onClose={()=>setCropOpen(false)} onApply={crop=>void changePage({crop},true)}/>}
    <Sheet open={toolsOpen} onOpenChange={setToolsOpen}><SheetContent side="bottom" className="tools-sheet"><SheetHeader><SheetTitle>Chỉnh sửa trang {pageIndex+1}</SheetTitle><SheetDescription>Bộ lọc và công cụ xử lý ảnh</SheetDescription></SheetHeader>{editor}</SheetContent></Sheet>
    <Sheet open={ocrOpen} onOpenChange={setOCROpen}><SheetContent className="ocr-sheet sm:max-w-xl"><SheetHeader><SheetTitle>Văn bản tài liệu</SheetTitle><SheetDescription>OCR tiếng Việt + Anh · Hãy kiểm tra lại nội dung quan trọng.</SheetDescription></SheetHeader><div className="ocr-actions"><Button onClick={()=>void startOCR()} disabled={!!busy}><Sparkles size={16}/>{current?.pages.some(p=>p.ocrAt)?"Nhận diện lại":"Nhận diện tất cả"}</Button><Button variant="outline" onClick={()=>void copyText()} disabled={!current?.pages.some(p=>p.text)}><Copy size={16}/>Sao chép</Button></div><Textarea aria-label="Văn bản nhận diện" value={text} readOnly className="ocr-text"/><p className="ocr-footnote">Văn bản lưu cùng tài liệu. PDF xuất ra chứa ảnh các trang.</p></SheetContent></Sheet>
    <Dialog open={rename!==null} onOpenChange={open=>{if(!open)setRename(null);}}><DialogContent><DialogTitle>Đổi tên tài liệu</DialogTitle><DialogDescription>Một cái tên dễ tìm cho tài liệu của bạn.</DialogDescription><form onSubmit={e=>{e.preventDefault();const title=rename?.trim();if(title&&current){setRename(null);void run("Đang lưu tên…",async()=>{await commit({...current,title:title.slice(0,100)});});}}}><Input autoFocus value={rename??""} onChange={e=>setRename(e.target.value)} maxLength={100} aria-label="Tên tài liệu"/><Button className="mt-5 w-full" type="submit" disabled={!rename?.trim()}>Lưu tên</Button></form></DialogContent></Dialog>
    <AlertDialog open={!!deleting} onOpenChange={open=>{if(!open)setDeleting(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{deleting==="document"?"Xóa tài liệu này?":"Xóa trang này?"}</AlertDialogTitle><AlertDialogDescription>{deleting==="document"?"Tất cả các trang và văn bản OCR của tài liệu sẽ bị xóa khỏi thiết bị.":"Trang đang chọn sẽ bị xóa. Các trang khác được giữ lại."} Thao tác này không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Giữ lại</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={()=>void remove()}>Xóa</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Dialog open={!!shareFile} onOpenChange={open=>{if(!open)setShareFile(null);}}><DialogContent><div className="export-icon"><CheckCheck size={26}/></div><DialogTitle>Tệp của bạn đã sẵn sàng</DialogTitle><DialogDescription className="break-all">{shareFile?.name} · {((shareFile?.size??0)/1024/1024).toFixed(1)} MB</DialogDescription><div className="flex flex-col gap-3"><Button onClick={()=>{if(shareFile)download(shareFile);}}><Download/>Tải về thiết bị</Button><Button variant="outline" onClick={()=>{if(!shareFile)return;if(navigator.canShare?.({files:[shareFile]})){void navigator.share({files:[shareFile],title:shareFile.name}).catch(e=>{if(e.name!=="AbortError")toast.error("Chưa chia sẻ được. Hãy tải tệp về trước.");});}else{download(shareFile);toast("Trình duyệt chưa hỗ trợ chia sẻ tệp. Đã chuyển sang tải về.");}}}><Share2/>Chia sẻ tệp</Button></div></DialogContent></Dialog>
    <Dialog open={installOpen} onOpenChange={setInstallOpen}><DialogContent className="install-dialog"><span className="brand-mark"><ScanLine size={28}/></span><DialogTitle>PaperScan, luôn bên bạn</DialogTitle><DialogDescription>Cài lên màn hình chính để mở nhanh như một ứng dụng.</DialogDescription><div className="install-guide"><div><Smartphone size={21}/><p><strong>iPhone / iPad</strong><span>Mở bằng Safari → Chia sẻ → Thêm vào Màn hình chính.</span></p></div><div><Monitor size={21}/><p><strong>Android / Desktop</strong><span>Dùng nút cài đặt của trình duyệt hoặc menu → Cài đặt ứng dụng.</span></p></div></div>{pwa.canInstall&&<Button onClick={()=>void pwa.prompt()}><Download/>Cài PaperScan</Button>}<div className="offline-detail"><CheckCheck size={20}/><div><strong>{pwa.ready?"Bộ công cụ offline đã sẵn sàng":pwa.failed?"Chưa chuẩn bị xong offline":"Đang tải bộ công cụ offline…"}</strong><p>{pwa.ready?"Camera, bộ lọc, PDF và OCR Việt/Anh có thể dùng khi mất mạng.":"Giữ mạng và trang này mở trong lần đầu để tải bộ nhận diện. Việc này có thể mất vài phút."}</p>{pwa.failed&&<Button size="sm" variant="outline" onClick={pwa.retry}>Thử tải lại</Button>}</div></div><p className="storage-note">Tài liệu thuộc trình duyệt và thiết bị này. Hãy xuất bản PDF cần giữ lâu trước khi xóa dữ liệu trình duyệt.</p><Button variant="ghost" onClick={()=>{void navigator.storage?.persist?.().then(granted=>toast(granted?"Đã bật lưu trữ bền vững khi trình duyệt hỗ trợ.":"Trình duyệt sẽ tự quản lý dung lượng lưu trữ.")).catch(()=>toast("Trình duyệt chưa hỗ trợ tùy chọn này."));}}><HardDrive size={16}/>Ưu tiên giữ dữ liệu trên thiết bị</Button></DialogContent></Dialog>
  </SidebarProvider>;
}
