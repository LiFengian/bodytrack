// Shared by browser UI, worker, and tests. Nutrients always come from foods.json.
export function combineFoods(presets,custom){return [...new Map([...presets,...custom].map(f=>[f.id,f])).values()];}
export function searchFoods(foods,query='',category='全部'){
  const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return foods.filter(f=>(category==='全部'||(category==='自定义'?!f.sourceUrl:f.category===category))&&words.every(w=>`${f.name} ${f.sourceDescription??''} ${f.category??''} ${{raw:'生 生重',cooked:'熟 熟重',packaged:'包装 即食'}[f.state]}`.toLowerCase().includes(w)));
}
export function rankLogits(logits,labels){
  if(logits.length!==labels.length||!logits.every(Number.isFinite))throw new Error('识别结果无效，请重试');
  // Relative similarity is deliberately not presented as a calibrated probability.
  return labels.map((label,i)=>({...label,similarity:logits[i]})).sort((a,b)=>b.similarity-a.similarity);
}
export function selectPhotoCandidates(ranked){
  const food=ranked.filter(x=>x.group!=='nonfood'),nonfood=ranked.find(x=>x.group==='nonfood');
  if(!food.length)return {uncertain:true,candidates:[]};
  return {uncertain:!!nonfood&&nonfood.similarity>=food[0].similarity,candidates:food.slice(0,6).map(({group,name})=>({group,name}))};
}
export function rgbaToCHW(rgba,size=224){
  if(rgba.length!==size*size*4)throw new Error('图片尺寸无效');
  const mean=[.48145466,.4578275,.40821073],std=[.26862954,.26130258,.27577711],pixels=size*size,result=new Float32Array(pixels*3);
  for(let p=0;p<pixels;p++)for(let c=0;c<3;c++)result[c*pixels+p]=(rgba[p*4+c]/255-mean[c])/std[c];
  return result;
}
