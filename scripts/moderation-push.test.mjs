import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=fs.readFileSync(new URL('../supabase/functions/notify/index.ts',import.meta.url),'utf8');
function load(createClient=()=>({})) {
 const exports={};let handler;
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {exports,require:()=>({createClient}),Deno:{serve:fn=>{handler=fn;},env:{get:()=> 'test'}},Response,Request,AbortSignal,fetch:()=>{throw Error('Unexpected real fetch');},console});
 return {deliver:exports.deliverModerationPushJobs,handler};
}
function fakeAdmin(jobs,tokens) {
 const updates=[],deleted=[],claimed=new Set();
 return {updates,deleted,rpc:async()=>({data:jobs.filter(j=>{if(claimed.has(j.id))return false;claimed.add(j.id);return true;}),error:null}),
  from(table){let patch,owner,job,removing=false,values;const q={select(){return q;},update(p){patch=p;return q;},eq(k,v){if(k==='owner_id')owner=v;else if(k==='id')job=v;return q;},delete(){removing=true;return q;},in(k,v){values=v;return q;},
   then(resolve){if(table==='auto_push_tokens'){if(removing)deleted.push(...values);return Promise.resolve({data:removing?[]:(tokens[owner]??[]).map(token=>({token})),error:null}).then(resolve);} updates.push({id:job,...patch});if(patch?.push_claimed_at===null)claimed.delete(job);return Promise.resolve({error:null}).then(resolve);}};return q;}};
}
const jobs=[{id:'job-subject',owner_id:'subject',title:'Предупреждение от модератора',body:'Текст модератора'},{id:'job-reporter',owner_id:'reporter',title:'Результат вашей жалобы',body:'По вашей жалобе пользователь заблокирован.'}];
test('sends the stored decision to its recipient and result to reporter, without duplicate retries',async()=>{
 const admin=fakeAdmin(jobs,{subject:['token-a','token-a'],reporter:['token-b']});const calls=[];const {deliver}=load();
 const fetcher=async(url,options)=>{assert.equal(url,'https://exp.host/--/api/v2/push/send');const messages=JSON.parse(options.body);calls.push(...messages);return Response.json({data:messages.map(()=>({status:'ok',id:'ticket'}))});};
 const result=await deliver(admin,jobs.map(j=>j.id),'moderator',fetcher);
 assert.equal(result.sent,2);assert.deepEqual(calls.map(m=>[m.to,m.title,m.body]),[['token-a',jobs[0].title,jobs[0].body],['token-b',jobs[1].title,jobs[1].body]]);
 assert.ok(calls.every(m=>m.data.kind==='moderation-notice'&&m.channelId==='matches'));
 assert.ok(admin.updates.every(u=>u.push_sent_at));
 await deliver(admin,jobs.map(j=>j.id),'moderator',fetcher);assert.equal(calls.length,2);
});
test('network failure leaves a retryable queue and no-device accounts keep their in-app record',async()=>{
 const {deliver}=load();const admin=fakeAdmin([jobs[0]],{subject:['token-a']});
 await deliver(admin,['job-subject'],'moderator',async()=>{throw Error('offline');});
 assert.equal(admin.updates.at(-1).push_claimed_at,null);assert.ok(!admin.updates.at(-1).push_sent_at);
 const noDevice=fakeAdmin([jobs[0]],{});await deliver(noDevice,['job-subject'],'moderator',async()=>{throw Error('must not fetch');});assert.ok(noDevice.updates[0].push_sent_at);
});
test('ordinary users cannot make the server send a moderation notification',async()=>{
 let claimCalled=false;
 const admin={from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null})}),rpc:async()=>{claimCalled=true;}};
 const userClient={auth:{getUser:async()=>({data:{user:{id:'ordinary-user'}}})}};
 const {handler}=load((url,key,options)=>options?userClient:admin);
 const response=await handler(new Request('https://example.test/notify',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({kind:'moderation-batch',ids:['11111111-1111-4111-8111-111111111111']})}));
 assert.equal(response.status,403);assert.equal(claimCalled,false);
});
