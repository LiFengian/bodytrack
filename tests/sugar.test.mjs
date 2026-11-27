import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as C from '../dist/core.mjs';

const loadJson=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const catalog=await loadJson('../dist/foods.json');
const banana=catalog.foods.find(f=>f.id==='usda-sr-173944');
const bread=catalog.foods.find(f=>f.id==='usda-sr-172688');
const day='2026-11-27';
const progress=(meals,limit)=>C.nutritionLimitProgress('totalSugars',C.aggregateNutrition(meals).totalSugars,meals.length,limit);

test('total sugar includes natural sugars and new preset meals contain only total sugar',()=>{
  assert.equal(banana.per100.totalSugars,12.23);
  assert.equal(bread.per100.totalSugars,4.34);
  assert(catalog.foods.every(food=>!Object.hasOwn(food.per100,'addedSugars')));
  const meals=[C.mealFromFood(banana,200,day,'早餐'),C.mealFromFood(bread,100,day,'午餐')];
  assert.equal(C.aggregateNutrition(meals).totalSugars.value,28.8);
  assert(!Object.hasOwn(C.aggregateNutrition(meals),'addedSugars'));
});

test('total sugar redline uses grams eaten and waits for a custom limit',()=>{
  const item={per100:{totalSugars:20,addedSugars:10},grams:200};
  assert.equal(progress([item]).status,'unconfigured');
  assert.equal(progress([item]).limit,null);
  assert.equal(progress([item]).value,40);
  assert.equal(progress([item],50).status,'near');
  assert.equal(progress([item],40).status,'limit');
  const partial=progress([item,{per100:{addedSugars:12},grams:100}],30);
  assert.equal(partial.status,'exceeded');assert.equal(partial.excess,10);assert(partial.partial);
  assert.equal(partial.widthPercent,100);
  assert.equal(progress([{per100:{addedSugars:12},grams:100}],30).status,'unknown');
});

test('legacy v2 backup restores and receives only matching catalog sugar fields',async()=>{
  const backup=await loadJson('../dist/examples/backup-v2.json');
  const state=C.parseBackup(JSON.stringify(backup));
  assert.deepEqual(state,{...backup.data,dataVersion:3});
  const old=C.mealFromFood(banana,100,day,'早餐');
  delete old.per100.totalSugars;
  const other={...C.clone(old),id:C.uid(),source:'包装食品标签'};
  const explicitUnknown={...C.clone(old),id:C.uid(),per100:{...old.per100,totalSugars:null,addedSugars:null}};
  state.meals.push(old,other,explicitUnknown);
  const before=C.clone(state);
  const presets=[{...banana,catalogVersion:catalog.version}];
  assert.equal(C.fillCatalogTotalSugars(state,presets,{checkOnly:true}),1);
  assert.deepEqual(state,before);
  assert.equal(C.fillCatalogTotalSugars(state,presets),1);
  assert.deepEqual(old,{...before.meals.at(-3),catalogVersion:catalog.version,per100:{...before.meals.at(-3).per100,totalSugars:12.23}});
  assert.deepEqual(state.meals.slice(-2),before.meals.slice(-2));
  assert.equal(C.fillCatalogTotalSugars(state,presets),0);
});

test('corrections preserve legacy values in full backups and export only total sugar for analysis',()=>{
  const state=C.initialState(day),food={...C.clone(banana),id:'custom',name:'测试食物'};
  const old=C.mealFromFood(food,125,day,'晚餐');
  old.per100.addedSugars=8;
  state.meals.push(old);
  state.foods.push(C.clone(food));
  state.foods[0].per100.addedSugars=8;
  food.per100.totalSugars=6;
  assert.equal(C.saveCustomFood(state,food),1);
  state.settings.targets.addedSugars=25;
  state.settings.targets.totalSugars=40;
  const restored=C.parseBackup(JSON.stringify(C.createBackup(state)));
  assert.equal(restored.meals[0].per100.addedSugars,8);
  assert.equal(restored.foods[0].per100.addedSugars,8);
  assert.equal(restored.settings.targets.addedSugars,25);
  assert(!Object.hasOwn(C.mealFromFood(restored.foods[0],100,day,'晚餐').per100,'addedSugars'));
  const records=C.exportRecords(restored,day,day);
  assert.equal(records.dailyNutrition[0].nutrients.totalSugars.value,7.5);
  assert.equal(records.nutritionTargets.totalSugars,40);
  assert(!JSON.stringify(records).includes('addedSugars'));
  assert.match(C.nutritionCSV(records),/"总糖\(g\)"/);
  assert.doesNotMatch(C.nutritionCSV(records),/添加糖/);
  assert.match(C.summaryReport(records),/总糖 7\.5g/);
  const recipe=C.composeRecipe('测试菜谱','软件测试',state.meals,150);
  assert.equal(recipe.per100.totalSugars,5);
});
