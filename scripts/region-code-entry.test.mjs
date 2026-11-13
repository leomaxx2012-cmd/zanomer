import test from 'node:test';
import assert from 'node:assert/strict';
import { initialRegionCodeEntry, regionCodeEntryReducer as reduce, validRegionCodeEntry as valid } from '../lib/region-code-entry.ts';

test('right-hand entry starts a new two-digit code without retaining the old third digit',()=>{
  let state=reduce(initialRegionCodeEntry('777'),{type:'select',length:2,index:0});
  state=reduce(state,{type:'digit',digit:'7'});
  assert.equal(valid(state),false);
  state=reduce(state,{type:'digit',digit:'7'});
  assert.equal(state.value,'77');assert.equal(state.position,1);assert.equal(valid(state),true);
});
test('left entry requires three digits; switching formats does not mix the values',()=>{
  let state=reduce(initialRegionCodeEntry('77'),{type:'select',length:3,index:0});
  for(const digit of '12')state=reduce(state,{type:'digit',digit});
  assert.equal(valid(state),false);
  state=reduce(state,{type:'digit',digit:'3'});
  assert.equal(state.value,'123');assert.equal(valid(state),true);
  state=reduce(state,{type:'select',length:2,index:0});
  assert.equal(state.value,'');assert.equal(valid(state),false);
});
test('leading zero, correction, clearing, and cursor bounds work in both formats',()=>{
  let state=reduce(initialRegionCodeEntry(''),{type:'select',length:2,index:0});
  for(const digit of '05')state=reduce(state,{type:'digit',digit});
  assert.equal(state.value,'05');assert.equal(valid(state),true);
  assert.deepEqual(reduce(state,{type:'select',length:2,index:2}),state);
  state=reduce(state,{type:'erase'});assert.equal(state.value,'0');assert.equal(valid(state),false);
  state=reduce(state,{type:'digit',digit:'1'});assert.equal(state.value,'01');
  state=reduce(state,{type:'clear'});assert.equal(state.value,'');assert.equal(state.position,0);
  state=reduce(state,{type:'close'});assert.equal(state.open,false);
  assert.deepEqual(reduce(state,{type:'digit',digit:'7'}),state);
});
