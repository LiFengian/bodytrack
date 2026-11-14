import * as ort from './vendor/ort/ort.wasm.min.mjs';
import {rankLogits,selectPhotoCandidates} from './food-utils.mjs';
ort.env.wasm.numThreads=1; // Works without SharedArrayBuffer or cross-origin isolation.
ort.env.wasm.proxy=false;
ort.env.wasm.wasmPaths=new URL('./vendor/ort/',import.meta.url).href;
ort.env.logLevel='error';
let sessionPromise;
const session=()=>sessionPromise??=ort.InferenceSession.create(new URL('./models/food-clip-q8.onnx',import.meta.url).href,{executionProviders:['wasm'],graphOptimizationLevel:'all'}).catch(e=>{sessionPromise=null;throw e;});
self.onmessage=async event=>{
  const {id,pixels}=event.data;
  try{
    const model=await session(),r=await fetch(new URL('./models/food-labels.json',import.meta.url));if(!r.ok)throw new Error('识别标签加载失败');const data=await r.json();
    const tokens=data.tokens,inputs={pixel_values:new ort.Tensor('float32',new Float32Array(pixels),[1,3,224,224])};
    const ids=new BigInt64Array(tokens.flatMap(t=>t.ids.map(BigInt))),mask=new BigInt64Array(tokens.flatMap(t=>t.mask.map(BigInt)));
    if(model.inputNames.includes('input_ids'))inputs.input_ids=new ort.Tensor('int64',ids,[tokens.length,77]);
    if(model.inputNames.includes('attention_mask'))inputs.attention_mask=new ort.Tensor('int64',mask,[tokens.length,77]);
    const output=await model.run(inputs),logits=output.logits_per_image;
    if(!logits)throw new Error('模型输出不匹配');
    const result=selectPhotoCandidates(rankLogits(Array.from(logits.data),data.labels));
    for(const tensor of Object.values(output))tensor.dispose();for(const tensor of Object.values(inputs))tensor.dispose();
    self.postMessage({id,result,model:data.model});
  }catch(error){self.postMessage({id,error:`本机识别未完成：${error.message??error}。可重试，或直接搜索食物记录。`});}
};
