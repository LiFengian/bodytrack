import {rgbaToCHW} from './food-utils.mjs';
const PHOTO_CACHE='bodytrack-photo-c93028d9e6eb';
const ASSETS=['./photo-worker.mjs','./food-utils.mjs','./vendor/ort/ort.wasm.min.mjs','./vendor/ort/ort-wasm-simd-threaded.mjs','./vendor/ort/ort-wasm-simd-threaded.wasm','./models/food-clip-q8.onnx','./models/food-labels.json'];
let activeJob,recognitionEpoch=0;
async function pruneOldModels(){
  // Only obsolete recognition resource versions are removed. The current
  // reusable model, application shell and health database stay intact.
  for(const key of await caches.keys())if(key.startsWith('bodytrack-photo-')&&key!==PHOTO_CACHE)await caches.delete(key);
}
export async function photoReady(){
  const c=await caches.open(PHOTO_CACHE),ready=(await Promise.all(ASSETS.map(p=>c.match(new URL(p,import.meta.url))))).every(Boolean);
  if(ready)await pruneOldModels();return ready;
}
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
  await pruneOldModels();
}
export async function decodePhoto(file){
  if(!file||file.size>20_000_000)throw new Error('请选择不超过 20 MB 的照片');
  const url=URL.createObjectURL(file),img=new Image();let canvas;
  try{img.src=url;await img.decode();if(!img.naturalWidth||!img.naturalHeight)throw new Error('图片无法解码');
    // Resize by shortest edge then center crop, matching CLIP's RGB preprocessing.
    const side=Math.min(img.naturalWidth,img.naturalHeight),sx=(img.naturalWidth-side)/2,sy=(img.naturalHeight-side)/2;
    canvas=document.createElement('canvas');canvas.width=canvas.height=224;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,224,224);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,sx,sy,side,side,0,0,224,224);
    const pixels=rgbaToCHW(ctx.getImageData(0,0,224,224).data);
    return {pixels,preview:canvas.toDataURL('image/jpeg',.8)};
  }catch{throw new Error('照片格式暂不支持，请选择 JPEG/PNG，或重新拍摄。');}finally{URL.revokeObjectURL(url);img.removeAttribute('src');if(canvas)canvas.width=canvas.height=0;}
}
export function cancelPhotoRecognition(){recognitionEpoch++;activeJob?.cancel();}
export async function recognizePhoto(pixels){
  cancelPhotoRecognition();const epoch=recognitionEpoch;
  if(!await photoReady())throw new Error('请先联网下载本机识别资源');
  if(epoch!==recognitionEpoch)throw new DOMException('识别已取消','AbortError');
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./photo-worker.mjs',import.meta.url),{type:'module'}),id=crypto.randomUUID();let finished=false;
    const finish=(error,result)=>{
      if(finished)return;finished=true;clearTimeout(timer);
      worker.removeEventListener('message',message);worker.removeEventListener('error',onError);
      // Terminate even on success: image tensors and inference memory are no
      // longer retained. The fixed model remains available in disk cache.
      worker.terminate();if(activeJob===job)activeJob=null;
      if(error)reject(error);else resolve(result);
    };
    const message=e=>{if(e.data.id===id)finish(e.data.error?new Error(e.data.error):null,e.data.error?null:{...e.data.result,model:e.data.model});};
    const onError=()=>finish(new Error('此浏览器暂无法运行本机识别。可使用食物搜索，或在 Safari 主屏幕 App 重试。'));
    const timer=setTimeout(()=>finish(new Error('本机识别耗时较长，请重试或搜索记录食物')),90000);
    const job={cancel:()=>finish(new DOMException('识别已取消','AbortError'))};activeJob=job;
    worker.addEventListener('message',message);worker.addEventListener('error',onError);
    try{worker.postMessage({id,pixels:pixels.buffer},[pixels.buffer]);}catch(error){finish(error);}
  });
}
