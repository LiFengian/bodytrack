import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as C from '../dist/core.mjs';

const loadJson=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const catalog=await loadJson('../dist/foods.json');
const banana=catalog.foods.find(f=>f.id==='usda-sr-173944');
const bread=catalog.foods.find(f=>f.id==='usda-sr-172688');
const day='2026-11-27';
const progress=(meals,limit)=>C.nutritionLimitProgress('addedSugars',C.aggregateNutrition(meals).addedSugars,meals.length,limit);

test('natural sugar and missing added sugar are distinct in the preset catalog',()=>{
  assert.equal(banana.per100.totalSugars,12.23);
  assert.equal(banana.per100.addedSugars,0);
  assert.equal(bread.per100.totalSugars,4.34);
  assert.equal(bread.per100.addedSugars,null);
  const meals=[C.mealFromFood(banana,200,day,'早餐'),C.mealFromFood(bread,100,day,'午餐')];
  assert.equal(C.aggregateNutrition(meals).totalSugars.value,28.8);
  assert.deepEqual(C.aggregateNutrition(meals).addedSugars,{value:0,unknownCount:1,complete:false});
});

test('added sugar redline uses grams eaten, a 25 g default, and a custom limit',()=>{
  const item={per100:{totalSugars:20,addedSugars:10},grams:200};
  assert.equal(progress([item]).status,'near');
  assert.equal(progress([item]).limit,25);
  item.grams=250;
  assert.equal(progress([item]).status,'limit');
  const partial=progress([item,{per100:{totalSugars:12},grams:100}],20);
  assert.equal(partial.status,'exceeded');assert.equal(partial.excess,5);assert(partial.partial);
  assert.equal(partial.widthPercent,100);
  assert.equal(progress([{per100:{totalSugars:40},grams:100}]).status,'unknown');
});

test('legacy v2 backup restores and receives only matching catalog sugar fields',async()=>{
  const backup=await loadJson('../dist/examples/backup-v2.json');
  const state=C.parseBackup(JSON.stringify(backup));
  assert.deepEqual(state,{...backup.data,dataVersion:3});
  const old=C.mealFromFood(banana,100,day,'早餐');
  for(const key of C.SUGAR_NUTRIENTS)delete old.per100[key];
  const other={...C.clone(old),id:C.uid(),source:'包装食品标签'};
  const explicitUnknown={...C.clone(old),id:C.uid(),per100:{...old.per100,totalSugars:null,addedSugars:null}};
  state.meals.push(old,other,explicitUnknown);
  const before=C.clone(state);
  const presets=[{...banana,catalogVersion:catalog.version}];
  assert.equal(C.fillCatalogSugars(state,presets,{checkOnly:true}),1);
  assert.deepEqual(state,before);
  assert.equal(C.fillCatalogSugars(state,presets),1);
  assert.deepEqual(old,{...before.meals.at(-3),catalogVersion:2,per100:{...before.meals.at(-3).per100,totalSugars:12.23,addedSugars:0}});
  assert.deepEqual(state.meals.slice(-2),before.meals.slice(-2));
  assert.equal(C.fillCatalogSugars(state,presets),0);
});

test('custom sugar corrections recompute old meals and survive backup, report and CSV',()=>{
  const state=C.initialState(day),food={...C.clone(banana),id:'custom',name:'测试食物'};
  state.meals.push(C.mealFromFood(food,125,day,'晚餐'));
  food.per100.totalSugars=30;food.per100.addedSugars=31;
  assert.throws(()=>C.saveCustomFood(state,food),/添加糖不能超过总糖/);
  food.per100.addedSugars=12;
  assert.equal(C.saveCustomFood(state,food),1);
  state.settings.targets.addedSugars=30;
  const restored=C.parseBackup(JSON.stringify(C.createBackup(state)));
  const records=C.exportRecords(restored,day,day);
  assert.equal(records.dailyNutrition[0].nutrients.addedSugars.value,15);
  assert.equal(records.nutritionTargets.addedSugars,30);
  assert.match(C.nutritionCSV(records),/"总糖\(g\)","添加糖\(g\)"/);
  assert.match(C.summaryReport(records),/总糖 37\.5g，添加糖 15g/);
  const recipe=C.composeRecipe('测试菜谱','软件测试',state.meals,150);
  assert.equal(recipe.per100.addedSugars,10);
});
