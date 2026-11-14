import {rgbaToCHW} from './food-utils.mjs';
const PHOTO_CACHE='bodytrack-photo-c93028d9e6eb';
const ASSETS=['./photo-worker.mjs','./food-utils.mjs','./vendor/ort/ort.wasm.min.mjs','./vendor/ort/ort-wasm-simd-threaded.mjs','./vendor/ort/ort-wasm-simd-threaded.wasm','./models/food-clip-q8.onnx','./models/food-labels.json'];
let worker;
export async function photoReady(){const c=await caches.open(PHOTO_CACHE);return (await Promise.all(ASSETS.map(p=>c.match(new URL(p,import.meta.url))))).every(Boolean);}
export async function preparePhoto(onProgress=()=>{}){
  const cache=await caches.open(PHOTO_CACHE);let done=0;
  for(const p of ASSETS){
    const url=new URL(p,import.meta.url);
    if(!await cache.match(url)){
      const response=await fetch(url,{cache:'no-cache'});if(!response.ok||response.redirected||(response.headers.get('content-type')??'').includes('text/html'))throw new Error('识别资源下载失败，请保持联网后重试');
      await cache.put(url,response);
    }
    onProgress(++done,ASSETS.length);
  }
}
export async function decodePhoto(file){
  if(!file||file.size>20_000_000)throw new Error('请选择不超过 20 MB 的照片');
  const url=URL.createObjectURL(file),img=new Image();
  try{img.src=url;await img.decode();if(!img.naturalWidth||!img.naturalHeight)throw new Error('图片无法解码');
    // Resize by shortest edge then center crop, matching CLIP's RGB preprocessing.
    const side=Math.min(img.naturalWidth,img.naturalHeight),sx=(img.naturalWidth-side)/2,sy=(img.naturalHeight-side)/2;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=224;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,224,224);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,sx,sy,side,side,0,0,224,224);
    const pixels=rgbaToCHW(ctx.getImageData(0,0,224,224).data);
    return {pixels,preview:canvas.toDataURL('image/jpeg',.8)};
  }catch{throw new Error('照片格式暂不支持，请选择 JPEG/PNG，或重新拍摄。');}finally{URL.revokeObjectURL(url);}
}
export async function recognizePhoto(pixels){
  if(!await photoReady())throw new Error('请先联网下载本机识别资源');
  worker??=new Worker(new URL('./photo-worker.mjs',import.meta.url),{type:'module'});
  return new Promise((resolve,reject)=>{
    const id=crypto.randomUUID(),timer=setTimeout(()=>{cleanup();worker?.terminate();worker=null;reject(new Error('本机识别耗时较长，请重试或搜索记录食物'));},90000);
    const cleanup=()=>{clearTimeout(timer);worker?.removeEventListener('message',message);worker?.removeEventListener('error',error);};
    const message=e=>{if(e.data.id!==id)return;cleanup();if(e.data.error)reject(new Error(e.data.error));else resolve({...e.data.result,model:e.data.model});};
    const error=()=>{cleanup();worker?.terminate();worker=null;reject(new Error('此浏览器暂无法运行本机识别。可使用食物搜索，或在 Safari 主屏幕 App 重试。'));};
    worker.addEventListener('message',message);worker.addEventListener('error',error);worker.postMessage({id,pixels:pixels.buffer},[pixels.buffer]);
  });
}
