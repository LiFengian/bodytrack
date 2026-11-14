import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as C from '../dist/core.mjs';
import {searchFoods,combineFoods,rgbaToCHW,rankLogits,selectPhotoCandidates} from '../dist/food-utils.mjs';
const catalog=JSON.parse(await readFile(new URL('../dist/foods.json',import.meta.url),'utf8'));
const foods=catalog.foods;
test('every preset is traceable to official USDA data and passes food validation',()=>{
  assert.equal(foods.length,48);assert.equal(catalog.license,'CC0-1.0');assert.match(catalog.archiveSha256,/^[a-f0-9]{64}$/);
  assert.equal(new Set(foods.map(x=>x.id)).size,foods.length);
  for(const f of foods){assert.deepEqual(C.validateFood(f),[]);assert.match(f.source,/USDA FoodData Central/);assert.match(f.sourceUrl,/^https:\/\/fdc.nal.usda.gov\/food-details\/\d+\/nutrients$/);assert(f.sourceDescription.length>5);for(const k of C.REQUIRED_NUTRIENTS)assert(Object.hasOwn(f.per100,k));}
});
test('cooked and raw rice use distinct USDA records, not a fixed raw-to-cooked conversion',()=>{
  const cooked=foods.find(x=>x.id==='usda-sr-169757'),raw=foods.find(x=>x.id==='usda-sr-169756');
  assert.equal(cooked.state,'cooked');assert.equal(raw.state,'raw');assert.notEqual(raw.id,cooked.id);assert(raw.per100.kcal>cooked.per100.kcal*2);assert.equal(C.calculateNutrition(cooked.per100,150).kcal,195);
});
test('database household portions keep their source IDs and are not fabricated gram estimates',()=>{
  const egg=foods.find(x=>x.id==='usda-sr-171287'),large=egg.portions.find(x=>x.originalLabel==='large');assert.equal(large.grams,50);assert(large.sourcePortionId);assert.equal(C.calculateNutrition(egg.per100,50).protein,egg.per100.protein/2);
});
test('search matches Chinese, English and preparation state; personal foods stay available',()=>{
  assert.equal(searchFoods(foods,'鸡胸').length,2);assert(searchFoods(foods,'rice').length>=4);assert(searchFoods(foods,'米饭 熟').every(f=>f.state==='cooked'));assert(searchFoods(foods,'','蔬菜水果').every(f=>f.category==='蔬菜水果'));
  const personal={...C.clone(foods[0]),id:'personal',name:'我的品牌'};assert.equal(combineFoods(foods,[personal]).length,49);assert.equal(searchFoods(combineFoods(foods,[personal]),'我的品牌').length,1);
});
test('preset meals retain provenance and historical nutrition through backup and export',()=>{
  const state=C.initialState('2026-11-14'),f=C.clone(foods[0]);const meal=C.mealFromFood(f,150,'2026-11-14','午餐');meal.entryMethod='photo-confirmed';meal.portionBasis='manual-estimate';state.meals.push(meal);
  f.per100.kcal=999;assert.notEqual(meal.per100.kcal,999);const restored=C.parseBackup(JSON.stringify(C.createBackup(state)));assert.equal(restored.meals[0].sourceUrl,foods[0].sourceUrl);assert.equal(restored.meals[0].entryMethod,'photo-confirmed');assert.equal(C.exportRecords(restored,'2026-11-14','2026-11-14').meals[0].portionBasis,'manual-estimate');
});
test('image preprocessing applies RGB CHW order and the documented CLIP normalization',()=>{
  const x=rgbaToCHW(new Uint8Array([255,0,128,255]),1);assert.equal(x.length,3);assert(Math.abs(x[0]-(1-.48145466)/.26862954)<1e-6);assert(Math.abs(x[1]-(-.4578275/.26130258))<1e-6);assert(Math.abs(x[2]-((128/255-.40821073)/.27577711))<1e-6);assert.throws(()=>rgbaToCHW(new Uint8Array(3),1),/尺寸/);
});
test('photo outputs are ranked suggestions; nonfood never becomes a nutritional record',()=>{
  const labels=[{group:'rice',name:'米饭'},{group:'nonfood',name:'非食物'},{group:'coffee',name:'咖啡'}];
  const ranked=rankLogits([.1,2,.5],labels),result=selectPhotoCandidates(ranked);assert.equal(result.uncertain,true);assert.equal(result.candidates[0].group,'coffee');assert(!result.candidates.some(x=>x.group==='nonfood'));assert(!('probability' in result.candidates[0]));assert.throws(()=>rankLogits([NaN,1,2],labels),/无效/);
});
test('unsafe source URLs and malformed portions cannot be imported through backups',()=>{
  assert(C.validateFood({...foods[0],sourceUrl:'javascript:alert(1)'}).length);assert(C.validateFood({...foods[0],portions:[{label:'某份量',grams:-1}]}).length);
});
