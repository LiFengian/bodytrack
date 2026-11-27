import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../dist/core.mjs';

const start='2026-11-14';
function food(extra={}){return {id:C.uid(),name:'测试用标签食物（非食物推荐数据）',state:'packaged',source:'虚构测试夹具',per100:{kcal:120,protein:8,carbs:15,fat:3,fiber:null,sodium:50,...extra}};}
test('built-in plan has complete exercise doses and independent neck/thoracic warmups',()=>{
  const p=C.builtinPlan(start);assert.deepEqual(C.validatePlan(p),[]);
  assert.equal(p.trainingDays.flatMap(d=>d.exercises).length,33);
  assert.deepEqual(p.trainingDays.map(d=>d.exercises.length),[7,7,7,6,6]);
  for(const day of p.trainingDays.slice(0,3)){assert.deepEqual(day.exercises.slice(0,2).map(e=>e.module),['warmup','warmup']);assert.equal(day.exercises[0].holdSeconds,5);}
  assert.match(p.trainingDays[0].exercises[0].precautions,/不强迫颈部后仰/);
});
test('15-day cycle matches requested split; day 16 starts with chest',()=>{
  const p=C.builtinPlan(start);
  assert.deepEqual(Array.from({length:16},(_,i)=>C.cycleDay(p,i)?.id??null),['chest','shoulder',null,'back','arms',null,'legs','chest',null,'shoulder','back',null,'arms','legs',null,'chest']);
});
test('calendar passage cannot advance an uncompleted cycle',()=>{
  const s=C.initialState(start),old=C.nextOccurrence(s,start),future=C.nextOccurrence(s,'2027-01-30');assert.equal(old.index,future.index);assert.equal(future.plannedDate,start);
});
test('swap shoulder and back once, keeping dates, rest, history and the next round intact',()=>{
  const s=C.initialState(start),a=s.activations[0],plan=s.plans[0].plan;
  const chest=C.startSession(s,start);C.completeSession(s,chest.id);
  const history=C.clone(chest),day=C.addDays(start,1),original=C.clone(plan);
  s.adjustments[`${a.id}:1`]=day;
  C.swapTrainingDays(s,a.id,1,3,day);
  assert.deepEqual(C.nextOccurrence(s,day).trainingDay,plan.trainingDays.find(d=>d.id==='back'));
  assert.equal(C.nextOccurrence(s,day).plannedDate,day);
  assert.equal(C.cycleDay(plan,16,a).id,'shoulder');
  assert.deepEqual(s.plans[0].plan,original);assert.deepEqual(s.sessions,[history]);
  const restored=C.parseBackup(JSON.stringify(C.createBackup(s)));
  const back=C.startSession(restored,day);
  assert.equal(back.dayId,'back');assert(back.exercises.some(e=>e.exerciseId==='back-row'));
  C.completeSession(restored,back.id);
  const rest=C.startSession(restored,C.addDays(start,2));assert.equal(rest.dayId,null);C.completeSession(restored,rest.id);
  const later=C.addDays(start,3),skipped=C.skipOccurrence(restored,later);
  assert.equal(skipped.dayId,'shoulder');assert.equal(C.makeupSession(restored,skipped.id,later).dayId,'shoulder');
  const records=C.exportRecords(restored,start,later);
  assert.deepEqual(records.activations[0].dayOverrides,{'1':'back','3':'shoulder'});
  assert.deepEqual(records.sessions.map(s=>s.dayId),['chest','back',null,'shoulder','shoulder']);
});
test('swaps compose using the actual schedule, reverse cleanly and reset on reactivation',()=>{
  const s=C.initialState(start),a=s.activations[0],p=s.plans[0].plan;
  C.swapTrainingDays(s,a.id,0,1,start);
  C.swapTrainingDays(s,a.id,0,3,start);
  assert.deepEqual([0,1,3].map(i=>C.cycleDay(p,i,a).id),['back','chest','shoulder']);
  C.validateState(s);
  C.swapTrainingDays(s,a.id,0,3,start);C.swapTrainingDays(s,a.id,0,1,start);
  assert.equal(a.dayOverrides,undefined);
  C.swapTrainingDays(s,a.id,0,1,start);C.activatePlan(s,s.plans[0].key,start,start);
  assert.equal(C.nextOccurrence(s,start).trainingDay.id,'chest');
  assert.throws(()=>C.swapTrainingDays(s,a.id,0,1,start),/已更新/);
});
test('only pending different training days before the next activation can be exchanged',()=>{
  const s=C.initialState(start),a=s.activations[0];
  C.activatePlan(s,s.plans[0].key,C.addDays(start,4),start);
  const choices=()=>C.swapCandidates(s,C.nextOccurrence(s,start),start).map(o=>o.index);
  assert.deepEqual(choices(),[1,3]);
  for(const target of [0,2,4,7,16])assert.throws(()=>C.swapTrainingDays(s,a.id,0,target,start));
  const session=C.startSession(s,start);
  assert.deepEqual(choices(),[]);assert.throws(()=>C.swapTrainingDays(s,a.id,0,1,start));
  C.completeSession(s,session.id);assert.throws(()=>C.swapTrainingDays(s,a.id,0,1,start));
  const skip=C.skipOccurrence(s,C.addDays(start,1));C.makeupSession(s,skip.id,C.addDays(start,1));
  assert.deepEqual(C.swapCandidates(s,C.nextOccurrence(s,C.addDays(start,1)),C.addDays(start,1)),[]);
});
test('backup validation rejects an unknown day, a rest replacement, or an unbalanced exchange',()=>{
  for(const overrides of [{'0':'unknown'},{'2':'back'},{'1':'back'},{'1':'back','18':'shoulder'},{'-1':'back'}]){
    const s=C.initialState(start);s.activations[0].dayOverrides=overrides;
    assert.throws(()=>C.validateState(s),/交换/);
  }
});
test('late completion shifts the next day and does not skip rest days',()=>{
  const s=C.initialState(start),session=C.startSession(s,'2026-11-20');C.completeSession(s,session.id);
  const next=C.nextOccurrence(s,'2026-11-20');assert.equal(next.index,1);assert.equal(next.plannedDate,'2026-11-21');
  assert.throws(()=>C.startSession(s,'2026-11-20'),/尚未到/);
  const shoulder=C.startSession(s,'2026-11-21');C.completeSession(s,shoulder.id);
  assert.equal(C.nextOccurrence(s,'2026-11-22').trainingDay,null);
  assert.equal(C.nextOccurrence(s,'2026-11-30').index,2);
});
test('rescheduling changes the date, not the pending occurrence',()=>{
  const s=C.initialState(start),o=C.nextOccurrence(s,start);s.adjustments[`${o.activation.id}:0`]='2026-12-01';
  assert.equal(C.nextOccurrence(s,'2026-11-20').plannedDate,'2026-12-01');assert.equal(C.nextOccurrence(s,'2026-12-01').index,0);
});
test('explicit skip advances; makeup is independent and never advances cycle again',()=>{
  const s=C.initialState(start),skipped=C.skipOccurrence(s,start);assert.equal(C.nextOccurrence(s,start).index,1);
  const makeup=C.makeupSession(s,skipped.id,'2026-11-15');assert.equal(makeup.makeupFor,skipped.id);C.completeSession(s,makeup.id);
  assert.equal(C.nextOccurrence(s,'2026-11-15').index,1);assert.throws(()=>C.makeupSession(s,skipped.id,'2026-11-16'),/已经安排/);C.validateState(s);
});
test('one in-progress session; skip and activation cannot silently abandon it',()=>{
  const s=C.initialState(start),one=C.startSession(s,start);assert.equal(C.startSession(s,start).id,one.id);
  assert.throws(()=>C.skipOccurrence(s,start),/先结束/);assert.throws(()=>C.activatePlan(s,s.plans[0].key,start,start),/先结束/);
});
test('all sets have stable unique IDs and unilateral exercises record both sides',()=>{
  const s=C.initialState(start),session=C.startSession(s,start),deadbug=session.exercises.at(-1);
  assert.equal(deadbug.target.perSide,true);assert.equal(deadbug.sets.length,4);assert.deepEqual(deadbug.sets.map(x=>x.side),['left','right','left','right']);
  const ids=session.exercises.flatMap(e=>e.sets.map(x=>x.id));assert.equal(new Set(ids).size,ids.length);
  assert.deepEqual(C.parseBackup(JSON.stringify(C.createBackup(s))).sessions[0].exercises.at(-1).sets.map(x=>x.id),deadbug.sets.map(x=>x.id));
});
test('75% introductory volume leaves independent warmups unchanged',()=>{
  const s=C.initialState(start);s.settings.reducedVolume=true;const session=C.startSession(s,start);
  assert.equal(session.exercises[0].targetSets,2);assert.equal(session.exercises[2].targetSets,2);assert.equal(session.exercises[2].target.sets,3);
});
test('plan activation is date-based, preserves history and starts a new independent cycle',()=>{
  const s=C.initialState(start),session=C.startSession(s,start),snapshot=C.clone(session);C.completeSession(s,session.id);
  const p=C.builtinPlan(start);p.planVersion=2;p.trainingDays[0].exercises[2].sets=4;
  C.savePlan(s,p);C.activatePlan(s,C.planKey(p),'2026-11-20',start);
  assert.equal(C.activePlan(s,'2026-11-19').planVersion,1);assert.equal(C.activePlan(s,'2026-11-20').planVersion,2);
  assert.equal(C.nextOccurrence(s,'2026-11-20').index,0);assert.deepEqual(session.exercises,snapshot.exercises);C.validateState(s);
  C.activatePlan(s,s.plans[0].key,'2026-11-21',start);assert.equal(C.activePlan(s,'2026-11-21').planVersion,1);assert.equal(s.plans.length,2);
});
test('same-day activation selects the newest explicit activation',()=>{
  const s=C.initialState(start),p=C.builtinPlan(start);p.planVersion=2;C.savePlan(s,p);C.activatePlan(s,C.planKey(p),start,start);assert.equal(C.activePlan(s,start).planVersion,2);
});
test('duplicate plan version rejected, imported plan is copied',()=>{
  const s=C.initialState(start);assert.throws(()=>C.savePlan(s,C.builtinPlan(start)),/已存在/);
  const p=C.builtinPlan(start);p.planVersion=2;C.savePlan(s,p);p.name='changed';assert.notEqual(s.plans.at(-1).plan.name,'changed');
});
test('nutrition uses per-100g values without intermediate rounding',()=>{
  const n=C.calculateNutrition(food().per100,75);assert.equal(n.kcal,90);assert.equal(n.protein,6);assert.equal(n.sodium,37.5);assert.equal(n.fiber,null);
  assert.equal(C.calculateNutrition({protein:.333},33).protein,.10989);assert.throws(()=>C.calculateNutrition({},-10),/重量/);
});
test('unknown is never zero; aggregation marks partial totals and all-unknown nutrients',()=>{
  const a=C.mealFromFood(food(),100,start,'早餐'),b=C.mealFromFood(food({kcal:null,protein:null}),50,start,'午餐');
  const n=C.aggregateNutrition([a,b]);assert.deepEqual(n.kcal,{value:120,unknownCount:1,complete:false});assert.deepEqual(n.fiber,{value:null,unknownCount:2,complete:false});assert.equal(n.sodium.value,75);
  assert.deepEqual(C.aggregateNutrition([]).kcal,{value:0,unknownCount:0,complete:true});
});
test('food state and source required; invalid nutrition never accepted',()=>{
  assert.ok(C.validateFood({...food(),state:'unknown'}).length);assert.ok(C.validateFood({...food(),source:''}).length);
  assert.ok(C.validateFood(food({sodium:-1})).length);assert.ok(C.validateFood(food({kcal:NaN})).length);assert.ok(C.validateFood({...food(),per100:{}}).length);
});
test('meals store immutable raw/cooked and nutrient snapshots',()=>{
  const f=food(),m=C.mealFromFood(f,150,start,'晚餐');f.state='cooked';f.per100.protein=100;assert.equal(m.state,'packaged');assert.equal(m.per100.protein,8);
  assert.throws(()=>C.mealFromFood(f,0,start,'晚餐'),/大于/);assert.throws(()=>C.mealFromFood(f,100,'bad','晚餐'),/日期/);
});
test('recipe uses final cooked weight; any incomplete nutrient stays unknown',()=>{
  const r=C.composeRecipe('测试菜谱','测试标签',[{...food(),grams:100},{...food(),grams:50}],300);
  assert.equal(r.per100.kcal,60);assert.equal(r.per100.protein,4);assert.equal(r.per100.fiber,null);assert.equal(r.state,'cooked');
});
test('plan JSON roundtrip and schema semantic rejection',()=>{
  const p=C.builtinPlan(start);assert.deepEqual(C.parsePlan(JSON.stringify(p)),p);
  for(const change of [p=>p.schemaVersion='2.0',p=>p.effectiveDate='2026-02-30',p=>p.trainingDays[0].exercises[0].sets=0,p=>p.cycleDefinition.trainingDayIds[0]='missing',p=>p.trainingDays[1].exercises[0].id=p.trainingDays[0].exercises[0].id,p=>p.trainingDays[0].exercises[0].intensity.rirMin=5]){const bad=C.clone(p);change(bad);assert.throws(()=>C.parsePlan(JSON.stringify(bad)));}
  assert.throws(()=>C.parsePlan('{broken'),/JSON 格式/);assert.throws(()=>C.parsePlan(' '.repeat(2_000_001)),/过大/);
});
test('backup restores all data, IDs and plan history; rejects records as a restore file',()=>{
  const s=C.initialState(start);s.foods.push(food());s.meals.push(C.mealFromFood(s.foods[0],100,start,'早餐'));
  const session=C.startSession(s,start),set=session.exercises[0].sets[0];set.reps=10;set.done=true;session.journal={neck:3,pain:0,diary:'轻柔控制'};C.completeSession(s,session.id);
  const b=C.createBackup(s),restored=C.parseBackup(JSON.stringify(b));assert.deepEqual(restored,s);
  assert.throws(()=>C.parseBackup(JSON.stringify(C.exportRecords(s,start,start))),/完整备份/);
  b.data.dataVersion=99;assert.throws(()=>C.parseBackup(JSON.stringify(b)),/版本/);
});
test('malformed backup is rejected before any mutation',()=>{
  const s=C.initialState(start);C.startSession(s,start);
  const changes=[s=>s.sessions[0].exercises[0].sets[0].reps=-1,s=>s.sessions[0].exercises[0].sets[0].done=true,s=>s.sessions[0].planKey='nonexistent',s=>s.settings.theme='oops',s=>s.sessions.push(C.clone(s.sessions[0])),s=>s.sessions[0].journal.neck=11,s=>s.sessions[0].exercises[0].targetSets=12];
  for(const change of changes){const bad=C.clone(s);change(bad);assert.throws(()=>C.validateState(bad));}assert.equal(s.sessions.length,1);
});
test('exports honor dates, include plans and journals, calculate explicit completion denominator',()=>{
  const s=C.initialState(start);const session=C.startSession(s,start);session.journal.neck=4;C.completeSession(s,session.id);C.skipOccurrence(s,'2026-11-15');
  s.meals.push(C.mealFromFood(food(),50,'2026-11-16','加餐'));
  const r=C.exportRecords(s,start,'2026-11-15');assert.equal(r.sessions.length,2);assert.equal(r.meals.length,0);assert.equal(r.completion.ratio,.5);assert.equal(r.sessions[0].journal.neck,4);assert.equal(r.mediaIncluded,false);assert.equal(r.plans.length,1);
  assert.throws(()=>C.exportRecords(s,'2026-12-01',start),/范围/);assert.match(C.summaryReport(r),/颈/);
});
test('CSV escapes quotes, commas, newlines and spreadsheet formulas',()=>{
  const s=C.csv([['a,b','"quoted"','two\nlines','=SUM(1,2)','  +CMD','@test',null,0]]);
  assert.match(s,/^\uFEFF/);assert.match(s,/"a,b"/);assert.match(s,/""quoted""/);assert.match(s,/'=SUM/);assert.match(s,/'  \+CMD/);assert.match(s,/"0"$/);
});
test('training CSV includes stable IDs, actuals, unilateral data and journals; nutrition CSV keeps unknowns',()=>{
  const s=C.initialState(start);C.startSession(s,start);s.meals.push(C.mealFromFood(food(),100,start,'早餐'));const r=C.exportRecords(s,start,start);
  assert.match(C.trainingCSV(r),new RegExp(s.sessions[0].id));assert.match(C.trainingCSV(r),/left/);assert.match(C.trainingCSV(r),/训练感受JSON/);assert.match(C.nutritionCSV(r),/未知/);
});
test('calendar helpers are timezone-independent across leap days and DST boundaries',()=>{
  assert.equal(C.addDays('2028-02-28',1),'2028-02-29');assert.equal(C.addDays('2028-02-29',1),'2028-03-01');assert.equal(C.addDays('2026-03-08',1),'2026-03-09');assert.equal(C.daysBetween('2026-03-08','2026-03-09'),1);assert.equal(C.isDate('2027-02-29'),false);assert.equal(C.isDate('2026-11-14'),true);
});
test('plan differences surface safety instructions and laterality even with unchanged doses',()=>{
  const old=C.builtinPlan(start),p=C.clone(old);p.trainingDays[0].focus='新目标';p.trainingDays[0].exercises[0].precautions='新的注意事项';p.trainingDays[0].exercises[2].perSide=true;p.trainingDays[0].exercises[2].intensity.rirMin=3;
  const diff=C.planDiff(old,p).join('\n');assert.match(diff,/训练日目标/);assert.match(diff,/注意事项改变/);assert.match(diff,/左右侧记录方式改变/);assert.match(diff,/RIR/);
});
test('historical cycle export ignores sessions recorded after the selected end date',()=>{
  const s=C.initialState(start);C.skipOccurrence(s,'2026-11-20');
  assert.equal(C.nextOccurrence(s,'2026-11-19').index,0);assert.equal(C.nextOccurrence(s,'2026-11-20').index,1);
});
