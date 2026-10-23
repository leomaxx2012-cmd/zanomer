import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createSessionSafeFetch } from '../lib/network-request.ts';
import { publicationSession } from '../lib/publication-session.ts';

function fixture(transport) {
  const storageKey = 'test-session';
  const expires_at = Math.floor(Date.now() / 1000) - 120;
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const access_token = `${encode({alg:'HS256',typ:'JWT'})}.${encode({exp:expires_at,sub:'test-user'})}.signature`;
  const stored = new Map([[storageKey,JSON.stringify({access_token,refresh_token:'test-refresh',expires_at,expires_in:3600,token_type:'bearer',user:{id:'test-user',user_metadata:{display_name:'Test'}}})]]);
  const client = createClient('https://example.test','test-key',{
    global:{fetch:createSessionSafeFetch(transport)},
    auth:{storageKey,storage:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},persistSession:true,autoRefreshToken:false,detectSessionInUrl:false},
  });
  return {client,stored,storageKey};
}

test('SDK keeps the saved session across a VPN gateway failure', {timeout:45000}, async () => {
  const {client,stored,storageKey}=fixture(async ()=>new Response('<html>VPN gateway</html>',{status:403}));
  let signedOut=false;
  const {data:listener}=client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')signedOut=true;});
  try {
    const result=await publicationSession(()=>client.auth.getSession());
    assert.equal(result.status,'unavailable','a VPN refresh failure must keep the publication form open, not demand sign-in');
    assert.ok(stored.has(storageKey),'transient failure must not delete credentials');
    assert.equal(signedOut,false);
  } finally { listener.subscription.unsubscribe(); client.auth.stopAutoRefresh(); }
});

test('SDK still removes a genuinely revoked expired session', async () => {
  const {client,stored,storageKey}=fixture(async ()=>Response.json({code:'refresh_token_not_found',msg:'Invalid Refresh Token'},{status:400,headers:{'x-supabase-api-version':'2024-01-01'}}));
  try {
    const {error}=await client.auth.getSession();
    assert.ok(error);
    assert.equal(stored.has(storageKey),false);
  } finally { client.auth.stopAutoRefresh(); }
});
