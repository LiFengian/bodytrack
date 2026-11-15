import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../dist/core.mjs';
const today='2026-11-15',yesterday='2026-11-14';
function fixture(){
  const s=C.initialState(yesterday),food={id:C.uid(),name:'测试食品',state:'packaged',source:'测试标签',per100:{kcal:120,protein:8,carbs:15,fat:3,fiber:null,sodium:50}};
  const other={...C.clone(food),id:C.uid(),state:'raw'};s.foods.push(food,other);
  s.meals.push(C.mealFromFood(food,75,today,'早餐'),C.mealFromFood(food,50,yesterday,'午餐'),C.mealFromFood(other,100,today,'加餐'));
  Object.assign(s.meals[0],{entryMethod:'custom',portionBasis:'weighed'});
  return s;
}
test('food correction automatically recalculates all linked dates and preserves actuals and same-name foods',()=>{
  const s=fixture(),before=C.clone(s),food={...C.clone(s.foods[0]),source:'更正标签',per100:{...s.foods[0].per100,kcal:240,protein:16}};
  assert.equal(C.saveCustomFood(s,food),2);
  assert.equal(C.calculateNutrition(s.meals[0].per100,75).kcal,180);assert.equal(C.calculateNutrition(s.meals[0].per100,75).protein,12);
  assert.equal(s.meals[0].per100.fiber,null);assert.equal(s.meals[0].source,'更正标签');
  for(const meal of s.meals.slice(0,2))for(const key of ['id','foodId','grams','date','meal','createdAt','entryMethod','portionBasis'])assert.deepEqual(meal[key],before.meals.find(m=>m.id===meal.id)[key]);
  assert.equal(s.meals[1].per100.kcal,240);assert.deepEqual(s.meals[2],before.meals[2]);
  food.per100.kcal=1;assert.equal(s.foods[0].per100.kcal,240);assert.equal(s.meals[0].per100.kcal,240);
  C.validateState(s);
});
test('resaving already-changed library parameters repairs old snapshots, exports and backups use corrected nutrition',()=>{
  const s=fixture(),updated={...C.clone(s.foods[0]),per100:{...s.foods[0].per100,kcal:200,fiber:0}};
  // Reproduce records saved before this fix: library updated, meals stale.
  s.foods[0]=C.clone(updated);assert.equal(s.meals[0].per100.kcal,120);
  assert.equal(C.saveCustomFood(s,updated),2);
  assert.equal(s.meals[1].per100.kcal,200);assert.equal(s.meals[2].per100.kcal,120);
  const records=C.exportRecords(s,yesterday,today);
  assert.equal(records.dailyNutrition.find(d=>d.date===today).nutrients.kcal.value,270);
  assert.equal(records.dailyNutrition.find(d=>d.date===yesterday).nutrients.kcal.value,100);
  assert.match(C.nutritionCSV(records),/"150"/);assert.equal(s.meals[0].per100.fiber,0);
  assert.deepEqual(C.parseBackup(JSON.stringify(C.createBackup(s))),s);
});
test('saving a food with no linked meals leaves other records unchanged',()=>{
  const s=fixture(),before=C.clone(s.meals),updated={...C.clone(s.foods[0]),id:C.uid(),per100:{...s.foods[0].per100,protein:10}};
  assert.equal(C.saveCustomFood(s,updated),0);assert.deepEqual(s.meals,before);assert.equal(s.foods.length,3);
});
test('invalid correction values or identity cannot mutate the library or meals',()=>{
  const s=fixture(),before=C.clone(s);
  assert.throws(()=>C.saveCustomFood(s,{...s.foods[0],id:''}));
  assert.throws(()=>C.saveCustomFood(s,{...s.foods[0],per100:{...s.foods[0].per100,kcal:-1}}));
  assert.deepEqual(s,before);
});
test('startup reconciliation detects legacy stale snapshots without mutation and becomes idempotent after repair',()=>{
  const s=fixture();s.foods[0].per100.kcal=240;const before=C.clone(s);
  assert.equal(C.synchronizeFoodMeals(s,{checkOnly:true}),2);assert.deepEqual(s,before);
  assert.equal(C.synchronizeFoodMeals(s),2);assert.equal(s.meals[0].per100.kcal,240);assert.equal(s.meals[1].per100.kcal,240);assert.deepEqual(s.meals[2],before.meals[2]);
  const repaired=C.clone(s);assert.equal(C.synchronizeFoodMeals(s,{checkOnly:true}),0);assert.equal(C.synchronizeFoodMeals(s),0);assert.deepEqual(s,repaired);
});
