import type { Point, Quad, Filter } from "./types";

export function validQuad(points: Quad): boolean {
  if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1)) return false;
  let area=0;
  for(let i=0;i<4;i++) {
    const a=points[i], b=points[(i+1)%4], c=points[(i+2)%4];
    if((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x) <= .0005) return false;
    area+=a.x*b.y-b.x*a.y;
  }
  return area>.015;
}

/** Destination-to-source homography, solved with partial-pivot Gaussian elimination. */
export function homography(from: Quad,to: Quad): number[] {
  const rows:number[][]=[];
  for(let i=0;i<4;i++) {
    const {x,y}=from[i], u=to[i].x,v=to[i].y;
    rows.push([x,y,1,0,0,0,-x*u,-y*u,u], [0,0,0,x,y,1,-x*v,-y*v,v]);
  }
  for(let col=0;col<8;col++) {
    let pivot=col;
    for(let r=col+1;r<8;r++) if(Math.abs(rows[r][col])>Math.abs(rows[pivot][col])) pivot=r;
    [rows[col],rows[pivot]]=[rows[pivot],rows[col]];
    const divisor=rows[col][col];
    if(Math.abs(divisor)<1e-10) throw new Error("Bốn góc quá gần nhau. Hãy chỉnh lại vùng cắt.");
    for(let j=col;j<9;j++) rows[col][j]/=divisor;
    for(let r=0;r<8;r++) if(r!==col) {
      const factor=rows[r][col];
      for(let j=col;j<9;j++) rows[r][j]-=factor*rows[col][j];
    }
  }
  return [...rows.map(row=>row[8]),1];
}
export function project(matrix: number[],point: Point): Point {
  const d=matrix[6]*point.x+matrix[7]*point.y+1;
  return {x:(matrix[0]*point.x+matrix[1]*point.y+matrix[2])/d,y:(matrix[3]*point.x+matrix[4]*point.y+matrix[5])/d};
}

export type PixelJob={pixels:Uint8ClampedArray; width:number; height:number; crop:Quad; filter:Filter};
export function processPixels(job:PixelJob) {
  const {pixels,width,height,crop,filter}=job;
  if(!validQuad(crop)) throw new Error("Vùng cắt không hợp lệ. Bốn góc không được giao nhau.");
  const q=crop.map(p=>({x:p.x*(width-1),y:p.y*(height-1)})) as Quad;
  const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
  const outW=Math.max(2,Math.round(Math.max(distance(q[0],q[1]),distance(q[3],q[2])))+1);
  const outH=Math.max(2,Math.round(Math.max(distance(q[0],q[3]),distance(q[1],q[2])))+1);
  const h=homography([{x:0,y:0},{x:outW-1,y:0},{x:outW-1,y:outH-1},{x:0,y:outH-1}],q);
  const output=new Uint8ClampedArray(outW*outH*4);
  for(let y=0;y<outH;y++) for(let x=0;x<outW;x++) {
    const p=project(h,{x,y});
    const sx=Math.max(0,Math.min(width-1,p.x)),sy=Math.max(0,Math.min(height-1,p.y));
    const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1),fx=sx-x0,fy=sy-y0;
    const index=(y*outW+x)*4;
    for(let c=0;c<3;c++) output[index+c]=pixels[(y0*width+x0)*4+c]*(1-fx)*(1-fy)+pixels[(y0*width+x1)*4+c]*fx*(1-fy)+pixels[(y1*width+x0)*4+c]*(1-fx)*fy+pixels[(y1*width+x1)*4+c]*fx*fy;
    output[index+3]=255;
  }
  if(filter!=="original") applyFilter(output,outW,outH,filter);
  return {pixels:output,width:outW,height:outH};
}

function applyFilter(data:Uint8ClampedArray,width:number,height:number,filter:Filter) {
  // Integral luminance image gives B&W a local threshold under uneven paper lighting.
  let integral:Float64Array|undefined;
  const stride=width+1;
  if(filter==="bw") {
    integral=new Float64Array((width+1)*(height+1));
    for(let y=1;y<=height;y++) {
      let row=0;
      for(let x=1;x<=width;x++) {
        const i=((y-1)*width+x-1)*4;
        row+=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
        integral[y*stride+x]=integral[(y-1)*stride+x]+row;
      }
    }
  }
  const radius=Math.max(10,Math.round(Math.min(width,height)/40));
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2];
    const luminance=.2126*r+.7152*g+.0722*b;
    if(filter==="gray") data[i]=data[i+1]=data[i+2]=luminance;
    if(filter==="bw" && integral) {
      const x0=Math.max(0,x-radius),x1=Math.min(width,x+radius+1),y0=Math.max(0,y-radius),y1=Math.min(height,y+radius+1);
      const mean=(integral[y1*stride+x1]-integral[y0*stride+x1]-integral[y1*stride+x0]+integral[y0*stride+x0])/((x1-x0)*(y1-y0));
      data[i]=data[i+1]=data[i+2]=luminance < Math.max(40,mean-13)?0:255;
    }
    if(filter==="magic") {
      for(let c=0;c<3;c++) {
        const saturated=luminance+(data[i+c]-luminance)*1.2;
        data[i+c]=Math.max(0,Math.min(255,(saturated-118)*1.24+132));
      }
    }
  }
}
