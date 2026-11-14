import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as C from '../dist/core.mjs';

const day='2026-11-14';
const values=(extra={})=>({date:day,mode:'stairs',durationMinutes:20,...extra});

test('cardio can be logged during strength training, on rest days and on missed days without advancing the cycle',()=>{
  const s=C.initialState(day),running=C.startSession(s,day),before=C.clone(s);
  C.saveCardio(s,values(),null,day);
  assert.deepEqual(s.sessions,before.sessions);assert.deepEqual(C.nextOccurrence(s,day),C.nextOccurrence(before,day));
  C.completeSession(s,running.id);C.skipOccurrence(s,'2026-11-15');
  const rest=C.nextOccurrence(s,'2026-11-16');assert.equal(rest.trainingDay,null);
  C.saveCardio(s,values({date:'2026-11-16'}),null,'2026-11-16');assert.deepEqual(C.nextOccurrence(s,'2026-11-16'),rest);
  C.saveCardio(s,values({date:'2027-01-01'}),null,'2027-01-01');assert.deepEqual(C.nextOccurrence(s,'2027-01-01'),rest);C.validateState(s);
});

test('editing cardio preserves identity and creation time; unknown metrics remain null',()=>{
  const s=C.initialState(day),entry=C.clone(C.saveCardio(s,values(),null,day));
  assert.equal(entry.floors,null);assert.equal(entry.level,null);assert.equal(entry.effort,null);assert(!('kcal' in entry));
  const updated=C.saveCardio(s,values({mode:'stair-machine',durationMinutes:30.5,floors:50,level:6,effort:'hard',notes:'腿部疲劳'}),entry.id,day);
  assert.equal(s.cardio.length,1);assert.equal(updated.id,entry.id);assert.equal(updated.createdAt,entry.createdAt);assert.equal(updated.durationMinutes,30.5);
  assert.equal(updated.level,6);C.validateState(s);
});

test('invalid cardio is rejected before mutation, including future dates and inappropriate machine levels',()=>{
  const s=C.initialState(day);
  for(const invalid of [{durationMinutes:0},{durationMinutes:NaN},{durationMinutes:Infinity},{durationMinutes:1441},{date:'2026-02-30'},{date:'2026-11-15'},{floors:1.5},{floors:0},{level:5},{mode:'cycling'},{effort:'unknown'},{notes:'x'.repeat(10001)}]){
    assert.throws(()=>C.saveCardio(s,values(invalid),null,day));assert.equal(s.cardio.length,0);
  }
  assert.throws(()=>C.saveCardio(s,values(),'missing',day),/找不到/);
  C.saveCardio(s,values(),null,day);s.cardio[0].id=s.activations[0].id;assert.throws(()=>C.validateState(s),/ID 重复/);
});

test('legacy v1 migration preserves every existing record and does not mutate its source',async()=>{
  const backup=JSON.parse(await readFile(new URL('../dist/examples/backup-v1.json',import.meta.url),'utf8'));
  const before=C.clone(backup.data),migrated=C.parseBackup(JSON.stringify(backup));
  assert.equal(migrated.dataVersion,2);assert.deepEqual(migrated.cardio,[]);assert.deepEqual(backup.data,before);
  const {dataVersion,cardio,...rest}=migrated;assert.deepEqual(rest,((({dataVersion,...rest})=>rest)(before)));
  assert.deepEqual(C.migrateState(migrated),migrated);
  const bad=C.clone(before);bad.unknownRecords=[{id:'keep-me'}];assert.throws(()=>C.migrateState(bad),/无法识别/);assert.equal(bad.dataVersion,1);
  assert.throws(()=>C.migrateState({...before,cardio:[{}]}),/版本 1/);
});

test('cardio survives full backup and rejects invalid or mismatched backup versions',()=>{
  const s=C.initialState(day);C.saveCardio(s,values({floors:35,notes:'稳定完成'}),null,day);
  const backup=C.createBackup(s);assert.equal(backup.schemaVersion,'1.1');assert.deepEqual(C.parseBackup(JSON.stringify(backup)),s);
  const bad=C.clone(backup);bad.data.cardio[0].durationMinutes=-1;assert.throws(()=>C.parseBackup(JSON.stringify(bad)),/时长/);
  bad.data=C.clone(s);bad.schemaVersion='1.0';assert.throws(()=>C.parseBackup(JSON.stringify(bad)),/版本不匹配/);
  bad.schemaVersion='99';assert.throws(()=>C.parseBackup(JSON.stringify(bad)),/完整备份/);
});

test('date-range JSON, separate cardio CSV and ChatGPT report retain actuals without changing completion or nutrition',()=>{
  const s=C.initialState(day),baseline=C.exportRecords(s,day,day);
  const entry=C.saveCardio(s,values({floors:24,effort:'moderate',notes:'=SUM(1,2)\n如实记录'}),null,day);
  C.saveCardio(s,values({date:'2026-11-15',durationMinutes:15}),null,'2026-11-15');
  const r=C.exportRecords(s,day,day);assert.equal(r.schemaVersion,'1.1');assert.equal(r.cardio.length,1);assert.equal(r.cardio[0].id,entry.id);
  assert.deepEqual(r.completion,baseline.completion);assert.deepEqual(r.dailyNutrition,baseline.dailyNutrition);assert.equal(r.sessions.length,0);
  const exported=C.cardioCSV(r);assert.match(exported,new RegExp(entry.id));assert.match(exported,/'=SUM/);assert.match(exported,/适中/);assert.match(C.summaryReport(r),/共 1 次，20 分钟/);
  assert.match(C.summaryReport(r),/不推进力量训练周期/);r.cardio[0].durationMinutes=99;assert.equal(s.cardio[0].durationMinutes,20);
});

test('cardio totals group multiple real sessions on the same date without filling unrecorded days',()=>{
  const s=C.initialState(day);C.saveCardio(s,values({durationMinutes:10.5}),null,day);C.saveCardio(s,values({durationMinutes:15}),null,day);
  C.saveCardio(s,values({date:'2026-11-16',durationMinutes:20}),null,'2026-11-16');
  assert.deepEqual(C.cardioSummary(s.cardio),{count:3,totalMinutes:45.5,daily:[{date:day,minutes:25.5},{date:'2026-11-16',minutes:20}]});
  assert.deepEqual(C.cardioSummary([]),{count:0,totalMinutes:0,daily:[]});
});
