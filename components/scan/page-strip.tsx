"use client";
import {DndContext,PointerSensor,KeyboardSensor,useSensor,useSensors,closestCenter} from "@dnd-kit/core";
import {SortableContext,useSortable,sortableKeyboardCoordinates,horizontalListSortingStrategy,arrayMove} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {GripVertical,Plus} from "lucide-react";
import {BlobImage} from "./blob-image";
import type {ScanPage} from "@/lib/scan/types";
function PageTile({page,index,selected,onSelect,disabled}:{page:ScanPage;index:number;selected:boolean;onSelect:()=>void;disabled:boolean}) {
  const {attributes,listeners,setNodeRef,transform,transition,isDragging}=useSortable({id:page.id,disabled});
  return <div ref={setNodeRef} className={`page-tile ${selected?"selected":""} ${isDragging?"dragging":""}`} style={{transform:CSS.Transform.toString(transform),transition}}>
    <button className="page-thumb" onClick={onSelect} aria-label={`Mở trang ${index+1}`} aria-current={selected?"page":undefined} disabled={disabled}><BlobImage blob={page.thumbnail} alt={`Trang ${index+1}`}/></button>
    <div className="tile-caption"><span>{String(index+1).padStart(2,"0")}</span><button className="drag-handle" {...attributes} {...listeners} aria-label={`Kéo để sắp xếp trang ${index+1}`} disabled={disabled}><GripVertical size={16}/></button></div>
  </div>;
}
export function PageStrip({pages,selected,onSelect,onReorder,onAdd,disabled}:{pages:ScanPage[];selected:string;onSelect:(id:string)=>void;onReorder:(pages:ScanPage[])=>void;onAdd:()=>void;disabled:boolean}) {
  const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:6}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}));
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({active,over})=>{if(!disabled&&over&&active.id!==over.id){onReorder(arrayMove(pages,pages.findIndex(p=>p.id===active.id),pages.findIndex(p=>p.id===over.id)));}}}>
    <div className="page-strip"><SortableContext items={pages.map(p=>p.id)} strategy={horizontalListSortingStrategy}>{pages.map((page,index)=><PageTile key={page.id} page={page} index={index} selected={selected===page.id} onSelect={()=>onSelect(page.id)} disabled={disabled}/>)}</SortableContext><button className="add-page" onClick={onAdd} disabled={disabled||pages.length>=40}><Plus size={23}/><span>Thêm trang</span></button></div>
  </DndContext>;
}
