import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),tokenizer=JSON.parse(await readFile(new URL('artifacts/food-assets/tinyclip-tokenizer.json',root),'utf8'));
const labels=[['chicken','鸡胸肉 / 鸡肉','chicken breast'],['eggs','鸡蛋','boiled eggs'],['eggwhite','蛋清','egg whites'],['beef','牛肉','beef steak'],['salmon','三文鱼','salmon fish'],['shrimp','虾仁','cooked shrimp'],['tuna','金枪鱼','canned tuna'],['tofu','豆腐','tofu'],['milk','牛奶','a glass of milk'],['yogurt','酸奶','plain yogurt'],['edamame','毛豆','edamame soybeans'],['rice','米饭 / 米','a bowl of rice'],['oats','干燕麦','rolled oats'],['oatmeal','燕麦粥','a bowl of oatmeal'],['sweetpotato','红薯','sweet potatoes'],['potato','土豆','potatoes'],['corn','玉米','sweet corn'],['bread','面包','bread slices'],['pasta','意大利面','pasta'],['quinoa','藜麦','quinoa'],['banana','香蕉','a banana'],['apple','苹果','an apple'],['avocado','牛油果','an avocado'],['broccoli','西兰花','broccoli'],['spinach','菠菜','spinach'],['tomato','番茄','tomatoes'],['cucumber','黄瓜','a cucumber'],['almond','杏仁','almonds'],['walnut','核桃','walnuts'],['peanutbutter','花生酱','peanut butter'],['oliveoil','橄榄油','olive oil'],['coffee','黑咖啡','a cup of coffee'],['nonfood','不是食物 / 无法匹配','a non food object, a phone, a computer, a person, an animal, or a document']].map(([group,name,caption])=>({group,name,prompt:`a photo of ${caption}.`}));
// Frozen ASCII-only CLIP BPE prompts; this tokenizer never processes user text.
const vocab=tokenizer.model.vocab;
const ranks=new Map(tokenizer.model.merges.map((m,i)=>[Array.isArray(m)?m.join(' '):m,i]));
function bpe(token){
  let chars=[...token];chars[chars.length-1]+='</w>';
  while(chars.length>1){let best=-1,bestRank=Infinity;for(let i=0;i<chars.length-1;i++){const rank=ranks.get(`${chars[i]} ${chars[i+1]}`);if(rank!==undefined&&rank<bestRank){best=i;bestRank=rank;}}if(best<0)break;chars.splice(best,2,chars[best]+chars[best+1]);}
  return chars.map(x=>{if(vocab[x]===undefined)throw new Error(`Missing BPE token ${x}`);return vocab[x];});
}
const tokens=labels.map(l=>{
  const words=l.prompt.toLowerCase().match(/[a-z]+|[0-9]|[^\s\w]+/g),ids=[vocab['<|startoftext|>'],...words.flatMap(bpe),vocab['<|endoftext|>']];
  if(ids.length>77)throw new Error('Prompt too long');const mask=ids.map(()=>1);while(ids.length<77){ids.push(vocab['<|endoftext|>']);mask.push(0);}return {ids,mask};
});
const metadata=JSON.parse(await readFile(new URL('artifacts/food-assets/tinyclip-metadata.json',root),'utf8'));
await writeFile(new URL('dist/models/food-labels.json',root),JSON.stringify({model:metadata.id,revision:metadata.sha,sequenceLength:77,labels,tokens}));
console.log(`Built ${labels.length} fixed food/nonfood prompts from the model's exact tokenizer.`);
