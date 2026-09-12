"use client";
import {useEffect,useState} from "react";
import {Skeleton} from "@/components/ui/skeleton";
export function useBlobURL(blob?:Blob) {
  const [url,setURL]=useState("");
  useEffect(()=>{if(!blob){setURL("");return;}const next=URL.createObjectURL(blob);setURL(next);return()=>URL.revokeObjectURL(next);},[blob]);
  return url;
}
export function BlobImage({blob,alt,className}: {blob?:Blob;alt:string;className?:string}) {
  const url=useBlobURL(blob);
  return url?<img src={url} alt={alt} className={className} draggable={false}/>:<Skeleton className={className}/>;
}
