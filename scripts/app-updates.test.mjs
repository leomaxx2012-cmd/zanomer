import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppUpdateManager } from '../lib/app-updates.ts';

function fixture(overrides = {}) {
  const calls = {check:0, fetch:0, reload:0};
  let time = 1000;
  const transport = {
    async check() { calls.check++; return {isAvailable:true}; },
    async fetch() { calls.fetch++; return {isNew:true}; },
    async reload() { calls.reload++; },
    ...overrides,
  };
  return {calls, transport, manager:createAppUpdateManager(transport,'active',()=>time), advance(ms) {time+=ms;} };
}

test('download does not interrupt an active search; background applies it once', async () => {
  const f = fixture();
  await f.manager.check();
  assert.deepEqual(f.calls, {check:1,fetch:1,reload:0});
  await f.manager.changeState('inactive');
  assert.equal(f.calls.reload,0);
  await f.manager.changeState('background');
  await f.manager.changeState('background');
  assert.equal(f.calls.reload,1);
});

test('network failure is contained and retry succeeds after connectivity returns', async () => {
  let offline = true;
  const f = fixture({async check() { if(offline) throw Error('offline'); return {isAvailable:true}; }});
  await f.manager.check();
  assert.equal(f.calls.reload,0);
  offline=false; f.advance(60_001);
  await f.manager.changeState('background');
  await f.manager.changeState('active');
  assert.equal(f.calls.fetch,1);
  assert.equal(f.calls.reload,0);
  await f.manager.changeState('background');
  assert.equal(f.calls.reload,1);
});

test('frequent app switches and parallel calls cannot duplicate checks', async () => {
  const f = fixture({async check() { f.calls.check++; return {isAvailable:false}; }});
  await Promise.all([f.manager.check(),f.manager.check()]);
  await f.manager.changeState('background'); await f.manager.changeState('active');
  assert.equal(f.calls.check,1);
  f.advance(15*60_000+1);
  await f.manager.changeState('background'); await f.manager.changeState('active');
  assert.equal(f.calls.check,2);
});

test('an update finishing while already in background is applied', async () => {
  let finish;
  const f=fixture({fetch:()=>new Promise(resolve=>{finish=resolve;})});
  const checking=f.manager.check();
  await Promise.resolve();
  await f.manager.changeState('background');
  finish({isNew:true}); await checking;
  assert.equal(f.calls.reload,1);
});

test('cleanup while downloading prevents a delayed reload', async () => {
  let finish;
  const f=fixture({fetch:()=>new Promise(resolve=>{finish=resolve;})});
  const checking=f.manager.check(); await Promise.resolve();
  f.manager.dispose(); finish({isNew:true}); await checking;
  await f.manager.changeState('background');
  assert.equal(f.calls.reload,0);
});

test('failed background reload remains available for retry; server rollback is supported', async () => {
  let fail=true;
  const f=fixture({check:async()=>({isAvailable:false,isRollBackToEmbedded:true}),fetch:async()=>({isNew:false,isRollBackToEmbedded:true}),async reload(){f.calls.reload++;if(fail)throw Error('suspended');}});
  await f.manager.check(); await f.manager.changeState('background');
  fail=false; await f.manager.changeState('active'); await f.manager.changeState('background');
  assert.equal(f.calls.reload,2);
});

test('manual check retries immediately after an error without parallel downloads', async () => {
  const states=[];
  let online=false, checks=0;
  const manager=createAppUpdateManager({check:async()=>{checks++;if(!online)throw Error('network');return {isAvailable:true};},fetch:async()=>({isNew:true}),reload:async()=>{}},'active',()=>1000,s=>states.push(s.phase));
  await manager.check(); online=true;
  await manager.check(); assert.equal(checks,1);
  await manager.check(true); assert.equal(checks,2);
  assert.deepEqual(states,['checking','error','checking','downloading','ready']);
});

test('an unfinished download is an error, not a successful check with a 15 minute delay', async () => {
  const states=[];
  const manager=createAppUpdateManager({check:async()=>({isAvailable:true}),fetch:async()=>({isNew:false}),reload:async()=>{}},'active',()=>1000,s=>states.push(s.phase));
  await manager.check(); assert.equal(states.at(-1),'error');
});

test('foreground reload requires explicit apply and a downloaded update', async () => {
  let reloads=0;
  const manager=createAppUpdateManager({check:async()=>({isAvailable:true}),fetch:async()=>({isNew:true}),reload:async()=>{reloads++;}},'active');
  await manager.applyNow(); assert.equal(reloads,0);
  await manager.check(); assert.equal(reloads,0);
  await manager.applyNow(); assert.equal(reloads,1);
});

test('failed manual reload keeps the apply action available for a later retry', async () => {
  const states=[];let fail=true,reloads=0;
  const manager=createAppUpdateManager({check:async()=>({isAvailable:true}),fetch:async()=>({isNew:true}),reload:async()=>{reloads++;if(fail)throw Error('reload failed');}},'active',Date.now,s=>states.push(s.phase));
  await manager.check();await manager.applyNow();assert.equal(states.at(-1),'ready');
  fail=false;await manager.applyNow();assert.equal(reloads,2);
});
