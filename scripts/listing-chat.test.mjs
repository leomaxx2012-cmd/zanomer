import test from 'node:test';
import assert from 'node:assert/strict';
import {belongsToConversation,groupChatThreads} from '../lib/listing-chat.ts';
const msg=(id,listing,sender,recipient,date)=>({id,listing_id:listing,sender_id:sender,recipient_id:recipient,body:'Test',created_at:date});
const messages=[msg('1','plate-a','buyer-a','seller','2026-11-01T10:00:00Z'),msg('2','plate-a','buyer-b','seller','2026-11-01T11:00:00Z'),msg('3','plate-a','seller','buyer-a','2026-11-01T12:00:00Z'),msg('4','plate-b','buyer-a','seller','2026-11-01T13:00:00Z'),msg('5','plate-a','outsider-a','outsider-b','2026-11-01T14:00:00Z')];
test('seller gets separate threads for each buyer and listing with latest replies',()=>{
 const threads=groupChatThreads(messages,'seller');
 assert.deepEqual(threads.map(t=>[t.listingId,t.partnerId,t.lastMessage.id]),[['plate-b','buyer-a','4'],['plate-a','buyer-a','3'],['plate-a','buyer-b','2']]);
});
test('opening or receiving a message never mixes other buyers or listings',()=>{
 assert.deepEqual(messages.filter(m=>belongsToConversation(m,'plate-a','seller','buyer-a')).map(m=>m.id),['1','3']);
 assert.deepEqual(messages.filter(m=>belongsToConversation(m,'plate-a','buyer-a','seller')).map(m=>m.id),['1','3']);
});
test('anonymous, self and unrelated messages cannot form an inbox thread',()=>{
 assert.deepEqual(groupChatThreads(messages,''),[]);
 assert.deepEqual(groupChatThreads([msg('x','plate-a','seller','seller','2026-11-01')],'seller'),[]);
 assert.equal(belongsToConversation(messages[0],'plate-a','seller','seller'),false);
});
