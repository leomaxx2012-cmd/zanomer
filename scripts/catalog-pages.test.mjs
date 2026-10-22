import test from 'node:test';
import assert from 'node:assert/strict';
import { collectCatalogPages } from '../lib/catalog-pages.ts';

test('collects complete history in order, stopping at a short page', async () => {
  const starts=[];
  const result=await collectCatalogPages([0],null,2,async start=>{
    starts.push(start);return {data:start===1?[1,2]:[3],error:null};
  });
  assert.deepEqual(starts,[1,3]); assert.deepEqual(result.data,[0,1,2,3]);
});
test('keeps successful pages on rejected request or server error',async()=>{
  for(const throws of [false,true]){
    const result=await collectCatalogPages([0],8,2,async start=>{
      if(start===3){if(throws)throw Error('offline');return {data:null,error:Error('offline')};}
      return {data:[1,2],error:null};
    });
    assert.deepEqual(result.data,[0,1,2]); assert.ok(result.error);
  }
});
test('respects exact row count and cancellation',async()=>{
  let calls=0;
  await collectCatalogPages([0,1],2,2,async()=>{calls++;return {data:[],error:null};});
  await collectCatalogPages([0],10,2,async()=>{calls++;return {data:[],error:null};},()=>false);
  assert.equal(calls,0);
});
