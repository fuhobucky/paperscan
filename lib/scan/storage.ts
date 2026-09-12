import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { MAX_PAGES, type ScanDocument } from "./types";

interface ScanDB extends DBSchema { documents: { key: string; value: ScanDocument } }
let promise: Promise<IDBPDatabase<ScanDB>> | undefined;
function db() {
  if(!promise) promise = openDB<ScanDB>("paperscan-studio",1, {
    upgrade(database) { database.createObjectStore("documents", {keyPath:"id"}); },
    blocking() { void promise?.then(database => database.close()); promise=undefined; },
    terminated() { promise=undefined; },
  }).catch(error => {promise=undefined; throw error;});
  return promise;
}
export async function listDocuments() {
  const docs = await (await db()).getAll("documents");
  return docs.sort((a,b) => b.modifiedAt-a.modifiedAt);
}
export async function saveDocument(document: ScanDocument): Promise<ScanDocument> {
  if(!document.pages.length || document.pages.length>MAX_PAGES) throw new Error("Tài liệu cần có từ 1 đến 40 trang.");
  if(new Set(document.pages.map(page=>page.id)).size !== document.pages.length) throw new Error("Mã trang bị trùng.");
  const transaction = (await db()).transaction("documents","readwrite");
  const current = await transaction.store.get(document.id);
  if((current?.revision ?? 0)!==document.revision) {
    transaction.abort(); await transaction.done.catch(()=>{});
    throw new Error("Tài liệu đã thay đổi ở cửa sổ khác. Hãy mở lại tài liệu trước khi sửa.");
  }
  const saved={...document,revision:document.revision+1,modifiedAt:Date.now()};
  await transaction.store.put(saved);
  await transaction.done;
  return saved;
}
export async function deleteDocument(document: ScanDocument) {
  const transaction=(await db()).transaction("documents","readwrite");
  const current=await transaction.store.get(document.id);
  if(current && current.revision!==document.revision) {
    transaction.abort(); await transaction.done.catch(()=>{});
    throw new Error("Tài liệu vừa thay đổi ở cửa sổ khác. Hãy mở lại rồi xóa.");
  }
  await transaction.store.delete(document.id);
  await transaction.done;
}
