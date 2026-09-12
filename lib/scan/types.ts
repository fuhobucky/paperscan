export type Filter = "original" | "bw" | "magic" | "gray";
export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point];
export const fullCrop = (): Quad => [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
export const filters: {id: Filter; name: string; description: string}[] = [
  {id:"original",name:"Gốc",description:"Giữ màu tự nhiên"},
  {id:"bw",name:"Đen trắng",description:"Chữ đậm, nền giấy sáng"},
  {id:"magic",name:"Magic Color",description:"Tăng độ rõ và màu sắc"},
  {id:"gray",name:"Thang xám",description:"Nhẹ nhàng, dễ đọc"},
];
export type ScanPage = {
  id: string; original: Blob; rendered: Blob; thumbnail: Blob; originalThumbnail?: Blob;
  width: number; height: number; crop: Quad; rotation: number; filter: Filter;
  text: string; ocrAt?: number;
};
export type ScanDocument = {
  id: string; title: string; createdAt: number; modifiedAt: number; revision: number; pages: ScanPage[];
};
export type ProgressInfo = { message: string; percent?: number };
export const MAX_PAGES = 40;
export const MAX_FILE_SIZE = 40 * 1024 * 1024;
export function errorMessage(error: unknown): string {
  if(error instanceof DOMException && error.name === "QuotaExceededError") return "Bộ nhớ thiết bị đã đầy. Hãy xuất PDF và xóa tài liệu không còn cần thiết.";
  return error instanceof Error ? error.message : "Không thể hoàn tất. Vui lòng thử lại.";
}
