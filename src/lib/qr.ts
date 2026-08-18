import QRCode from "qrcode";
import { convertIndexedToRgb, decode, encode, type DecodedPng } from "fast-png";
import { effectiveErrorCorrection, normalizeHex, scannability, type ErrorCorrection } from "./domain";

export interface QrStyle { foreground:string;background:string;errorCorrection:ErrorCorrection;logo?:Uint8Array|null;logoMime?:string|null; }
export function validateLogoPng(bytes:Uint8Array){try{const png=decode(bytes,{checkCrc:true});if(png.width<1||png.height<1||png.width>2048||png.height>2048)throw new Error();return png}catch{throw new Error("Logo is not a valid PNG image.")}}
export async function qrSvg(value:string, style:QrStyle, size=1024) {
  const fg=normalizeHex(style.foreground), bg=normalizeHex(style.background), level=effectiveErrorCorrection(style.errorCorrection,!!style.logo);
  let svg=await QRCode.toString(value,{type:"svg",width:size,margin:4,errorCorrectionLevel:level,color:{dark:fg,light:bg}});
  if(style.logo?.length){ const b64=uint8ToBase64(style.logo); const box=Math.round(size*.2); const x=(size-box)/2; const pad=Math.round(size*.018); svg=svg.replace("</svg>",`<rect x="${x-pad}" y="${x-pad}" width="${box+pad*2}" height="${box+pad*2}" rx="${pad}" fill="${bg}"/><image href="data:${style.logoMime||"image/png"};base64,${b64}" x="${x}" y="${x}" width="${box}" height="${box}" preserveAspectRatio="xMidYMid meet"/></svg>`); }
  return {svg,check:scannability(fg,bg,!!style.logo),level};
}
export async function qrPng(value:string, style:QrStyle, size=2048):Promise<Uint8Array>{
  const foreground=normalizeHex(style.foreground),background=normalizeHex(style.background),dark=[Number.parseInt(foreground.slice(1,3),16),Number.parseInt(foreground.slice(3,5),16),Number.parseInt(foreground.slice(5,7),16)],bgRgb=[Number.parseInt(background.slice(1,3),16),Number.parseInt(background.slice(3,5),16),Number.parseInt(background.slice(5,7),16)];
  const model=QRCode.create(value,{errorCorrectionLevel:effectiveErrorCorrection(style.errorCorrection,!!style.logo)}),modules=model.modules.size,scale=Math.max(1,Math.floor(size/(modules+8))),startModules=Math.floor((size-modules*scale)/2),pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4;pixels[i]=bgRgb[0];pixels[i+1]=bgRgb[1];pixels[i+2]=bgRgb[2];pixels[i+3]=255;}
  for(let row=0;row<modules;row++)for(let col=0;col<modules;col++)if(model.modules.get(row,col))for(let y=0;y<scale;y++)for(let x=0;x<scale;x++){const i=((startModules+row*scale+y)*size+startModules+col*scale+x)*4;pixels[i]=dark[0];pixels[i+1]=dark[1];pixels[i+2]=dark[2];}
  if(!style.logo?.length)return encode({width:size,height:size,data:pixels,channels:4,depth:8});
  const logo=toRgba(decode(style.logo));
  const box=Math.round(size*.18),pad=Math.round(size*.022),start=Math.floor((size-box)/2),padStart=start-pad,padEnd=start+box+pad;
  for(let y=padStart;y<padEnd;y++)for(let x=padStart;x<padEnd;x++){const i=(y*size+x)*4;pixels[i]=bgRgb[0];pixels[i+1]=bgRgb[1];pixels[i+2]=bgRgb[2];pixels[i+3]=255;}
  for(let y=0;y<box;y++)for(let x=0;x<box;x++){const sx=Math.min(logo.width-1,Math.floor(x*logo.width/box)),sy=Math.min(logo.height-1,Math.floor(y*logo.height/box));const si=(sy*logo.width+sx)*4,di=((start+y)*size+start+x)*4,a=logo.data[si+3]/255;for(let c=0;c<3;c++)pixels[di+c]=Math.round(logo.data[si+c]*a+pixels[di+c]*(1-a));pixels[di+3]=255;}
  return encode({width:size,height:size,data:pixels,channels:4,depth:8});
}
function uint8ToBase64(bytes:Uint8Array){ let binary=""; for(let i=0;i<bytes.length;i+=0x8000) binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000)); return btoa(binary); }

function toRgba(image:DecodedPng){
  const indexed=image.palette?convertIndexedToRgb(image):image.data,channels=image.palette?.[0]?.length??image.channels,max=image.depth===16?65535:255,out=new Uint8Array(image.width*image.height*4);
  for(let p=0;p<image.width*image.height;p++){const i=p*channels,o=p*4,get=(n:number)=>Math.round(Number(indexed[i+n]??0)*255/max);if(channels===1){out[o]=out[o+1]=out[o+2]=get(0);out[o+3]=255}else if(channels===2){out[o]=out[o+1]=out[o+2]=get(0);out[o+3]=get(1)}else{out[o]=get(0);out[o+1]=get(1);out[o+2]=get(2);out[o+3]=channels===4?get(3):255}}
  return {width:image.width,height:image.height,data:out};
}
