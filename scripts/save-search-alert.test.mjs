import test from 'node:test';
import assert from 'node:assert/strict';
import { saveSearchAlert } from '../lib/save-search-alert.ts';

const payload={owner_id:'owner',left_letter:'*',right_letters:'**',digits:'001',region:'Москва',region_code:'77,97',vehicle_type:'car',price_limit:0,enabled:true,updated_at:'now'};
function fixture(replies){
  const calls=[];
  const client={from(table){
    const call={table};calls.push(call);
    const query={select(){return query},match(value){call.criteria=value;return query},limit(){return query},
      eq(key,value){(call.filters??={})[key]=value;return query},
      update(value){call.update=value;return query},insert(value){call.insert=value;return query},
      maybeSingle(){return Promise.resolve(replies.shift())},single(){return Promise.resolve(replies.shift())}};
    return query;
  }};
  return {client,calls};
}
test('saves wildcard and multi-region search without relying on a unique-index definition',async()=>{
  const {client,calls}=fixture([{data:null,error:null},{data:{id:'new'},error:null}]);
  assert.equal((await saveSearchAlert(client,payload)).data.id,'new');
  assert.deepEqual(calls[0].criteria,{owner_id:'owner',left_letter:'*',right_letters:'**',digits:'001',region:'Москва',region_code:'77,97',vehicle_type:'car',price_limit:0});
  assert.deepEqual(calls[1].insert,payload);
});
test('re-enables an existing search with owner-scoped update',async()=>{
  const {client,calls}=fixture([{data:{id:'existing'},error:null},{data:{id:'existing'},error:null}]);
  await saveSearchAlert(client,payload);
  assert.deepEqual(calls[1].filters,{id:'existing',owner_id:'owner'});
  assert.equal(calls.some(call=>call.insert),false);
});
test('duplicate racing insert recovers only the exact same saved search',async()=>{
  const {client,calls}=fixture([{data:null,error:null},{data:null,error:{code:'23505'}},{data:{id:'race'},error:null},{data:{id:'race'},error:null}]);
  assert.equal((await saveSearchAlert(client,payload)).data.id,'race');
  assert.deepEqual(calls[2].criteria,calls[0].criteria);
});
test('does not retry failed network or permission writes',async()=>{
  const {client,calls}=fixture([{data:null,error:null},{data:null,error:{code:'42501'}}]);
  assert.equal((await saveSearchAlert(client,payload)).error.code,'42501');
  assert.equal(calls.length,2);
});
