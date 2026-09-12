"use client";
import {useEffect,useState} from "react";
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export function usePWA() {
  const [online,setOnline]=useState(true),[ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  const [install,setInstall]=useState<InstallEvent|null>(null),[installed,setInstalled]=useState(false),[version,setVersion]=useState(0);
  useEffect(()=>{
    let active=true;
    const connection=()=>setOnline(navigator.onLine);
    connection();window.addEventListener("online",connection);window.addEventListener("offline",connection);
    setInstalled(window.matchMedia("(display-mode: standalone)").matches||!!(navigator as Navigator&{standalone?:boolean}).standalone);
    const prompt=(event:Event)=>{event.preventDefault();setInstall(event as InstallEvent);};
    const done=()=>{setInstall(null);setInstalled(true);};
    window.addEventListener("beforeinstallprompt",prompt);window.addEventListener("appinstalled",done);
    async function register() {
      if(!("serviceWorker" in navigator)||!window.isSecureContext){setFailed(true);return;}
      try {
        const response=await fetch("/sw.js",{cache:"no-store"});
        if(!response.ok || !(response.headers.get("content-type")||"").includes("javascript"))throw new Error("No production worker");
        const registration=await navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"});
        const inspect=()=>{if(active&&registration.active)setReady(true);};
        inspect();
        const follow=()=>{
          const worker=registration.installing;
          worker?.addEventListener("statechange",()=>{
            if(!active)return;
            if(worker.state==="activated")setReady(true);
            if(worker.state==="redundant"&&!registration.active)setFailed(true);
          });
        };
        follow();registration.addEventListener("updatefound",follow);
        navigator.serviceWorker.ready.then(()=>{if(active)setReady(true);});
      } catch {if(active)setFailed(true);}
    }
    void register();
    return()=>{active=false;window.removeEventListener("online",connection);window.removeEventListener("offline",connection);window.removeEventListener("beforeinstallprompt",prompt);window.removeEventListener("appinstalled",done);};
  },[version]);
  return {online,ready,failed,installed,canInstall:!!install,retry:()=>{setFailed(false);setVersion(v=>v+1);},prompt:async()=>{if(install){await install.prompt();const choice=await install.userChoice;if(choice.outcome==="accepted")setInstall(null);}}};
}
