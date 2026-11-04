import test from 'node:test';
import assert from 'node:assert/strict';
import {banDurationMinutes,banExpiryText} from '../lib/account-ban.ts';

test('custom ban durations preserve the moderator choice',()=>{
 assert.equal(banDurationMinutes('15','minutes',false),15);
 assert.equal(banDurationMinutes('2','hours',false),120);
 assert.equal(banDurationMinutes('17','days',false),24480);
 assert.equal(banDurationMinutes('','days',true),null);
});
test('invalid and overflowing durations cannot become a permanent ban',()=>{
 for(const value of ['','0','-1','1.5','abc','Infinity','999999999999999999999'])assert.throws(()=>banDurationMinutes(value,'days',false));
});
test('ban expiry is shown in Moscow time and permanent bans are explicit',()=>{
 assert.equal(banExpiryText(null),'Бессрочно');
 assert.match(banExpiryText('2026-11-05T10:30:00Z'),/05\.11\.2026.*13:30.*МСК/);
});
