import type {ScanDocument} from "./types";
type Tool={name:string;title:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean;untrustedContentHint:boolean};execute:(input:unknown)=>unknown|Promise<unknown>};
type Context={registerTool:(tool:Tool,options:{signal:AbortSignal})=>void|Promise<void>};
export function registerScanTools(getDocuments:()=>ScanDocument[],open:(id:string)=>void,isBusy:()=>boolean) {
  const context=(document as Document&{modelContext?:Context}).modelContext;
  if(!context?.registerTool)return()=>{};
  const lifecycle=new AbortController();
  const tools:Tool[]=[{
    name:"list_scanned_documents",title:"Danh sách tài liệu đã quét",description:"Read document names, IDs and page counts saved on this device; does not read OCR text or image content.",
    inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},
    execute(input){if(!input||typeof input!=="object"||Object.keys(input).length)throw new Error("Expected an empty object.");return getDocuments().map(d=>({id:d.id,title:d.title,pageCount:d.pages.length,modifiedAt:d.modifiedAt}));},
  },{
    name:"open_scanned_document",title:"Mở tài liệu trong workspace",description:"Navigate the visible workspace to an existing document. Does not edit or export files.",
    inputSchema:{type:"object",properties:{id:{type:"string"}},required:["id"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},
    async execute(input){if(!input||typeof input!=="object"||!("id" in input)||typeof input.id!=="string"||Object.keys(input).some(k=>k!=="id"))throw new Error("Expected one document id.");if(isBusy())throw new Error("An operation is in progress.");const doc=getDocuments().find(d=>d.id===input.id);if(!doc)throw new Error("Document not found.");open(doc.id);await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));return {opened:true,id:doc.id,pageCount:doc.pages.length};},
  }];
  for(const tool of tools){try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
  return()=>lifecycle.abort();
}
