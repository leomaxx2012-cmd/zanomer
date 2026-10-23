import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationSession } from '../lib/publication-session.ts';

test('refresh failure must not be interpreted as sign-out', async () => {
  assert.deepEqual(await publicationSession(async () => ({data:{session:null},error:{message:'Network failure'}})), {status:'unavailable'});
  assert.deepEqual(await publicationSession(async () => {throw new TypeError('Failed to fetch');}), {status:'unavailable'});
});

test('successful empty session requires sign-in; saved display identity is not authorization', async () => {
  assert.deepEqual(await publicationSession(async () => ({data:{session:null},error:null})), {status:'signed-out'});
});

test('retry after restored connection returns the SDK user', async () => {
  const session={user:{id:'owner'}};
  let connected=false;
  const read=async()=>({data:{session:connected?session:null},error:connected?null:new Error('offline')});
  assert.equal((await publicationSession(read)).status,'unavailable');
  connected=true;
  assert.deepEqual(await publicationSession(read),{status:'ready',session});
});
