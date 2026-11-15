import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sodiumProgress} from '../dist/core.mjs';
const meal=(sodium,grams=100)=>({per100:{sodium},grams});
test('sodium reference is 2,000 mg and actual grams determine daily progress',()=>{
  const p=sodiumProgress([meal(500,150),meal(250)]);
  assert.equal(p.value,1000);assert.equal(p.limit,2000);assert.equal(p.widthPercent,50);assert.equal(p.percent,50);assert.equal(p.status,'normal');assert(p.reference);
});
test('early warning, exact limit and excess use unrounded intake and cap only the visual bar',()=>{
  assert.equal(sodiumProgress([meal(1599.9)]).status,'normal');assert.equal(sodiumProgress([meal(1600)]).status,'near');
  assert.equal(sodiumProgress([meal(2000)]).status,'limit');
  const p=sodiumProgress([meal(2500)]);assert.equal(p.status,'exceeded');assert.equal(p.excess,500);assert.equal(p.percent,125);assert.equal(p.widthPercent,100);
});
test('custom sodium limit takes precedence, and clearing it uses the reference again',()=>{
  const p=sodiumProgress([meal(1500)],1000);assert.equal(p.limit,1000);assert.equal(p.excess,500);assert.equal(p.status,'exceeded');assert.equal(p.reference,false);
  assert.equal(sodiumProgress([meal(1500)],null).status,'normal');
});
test('no meal, explicitly zero sodium and unknown sodium remain distinct',()=>{
  const empty=sodiumProgress([]);assert.equal(empty.status,'empty');assert.equal(empty.widthPercent,0);
  const zero=sodiumProgress([meal(0)]);assert.equal(zero.status,'normal');assert.equal(zero.value,0);assert.equal(zero.partial,false);
  const unknown=sodiumProgress([meal(null)]);assert.equal(unknown.status,'unknown');assert.equal(unknown.value,null);assert.equal(unknown.percent,null);assert.equal(unknown.widthPercent,0);assert.equal(unknown.unknownCount,1);
});
test('partial totals keep unknown values visible and already-known excess still warns',()=>{
  const low=sodiumProgress([meal(500),meal(null)]);assert.equal(low.value,500);assert.equal(low.partial,true);assert.equal(low.unknownCount,1);
  const high=sodiumProgress([meal(2500),meal(null)]);assert.equal(high.status,'exceeded');assert.equal(high.excess,500);assert.equal(high.partial,true);
});
test('zero and very large custom limits never produce an invalid visual range',()=>{
  for(const limit of [0,.1,1e7])for(const value of [0,100,2000]){const p=sodiumProgress([meal(value)],limit);assert(Number.isFinite(p.widthPercent));assert(p.widthPercent>=0&&p.widthPercent<=100);}
  assert.throws(()=>sodiumProgress([],NaN));assert.throws(()=>sodiumProgress([],-1));
});
