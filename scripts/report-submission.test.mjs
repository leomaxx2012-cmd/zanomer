import test from 'node:test';
import assert from 'node:assert/strict';
import {reportReasonError,reportSubmissionError} from '../lib/report-submission.ts';

test('the screenshot reason is rejected locally and the database boundaries match',()=>{
 for(const reason of ['', ' ', 'ит', '  ит  ', '🚗🚗'])assert.match(reportReasonError(reason),/минимум 3/);
 for(const reason of ['мат','спам','  спам  ','🚗🚗🚗','а'.repeat(500)])assert.equal(reportReasonError(reason),null);
 assert.match(reportReasonError('а'.repeat(501)),/до 500/);
});
test('duplicate reports and deleted content have clear messages',()=>{
 assert.match(reportSubmissionError({code:'23505'},'message'),/уже отправил.*сообщение/);
 assert.match(reportSubmissionError({code:'23505'},'comment'),/уже отправил.*комментарий/);
 assert.match(reportSubmissionError({code:'23503'},'message'),/удалено/);
 assert.match(reportSubmissionError({code:'23503'},'comment'),/удалён/);
});
test('access and connection errors preserve the draft without database setup instructions',()=>{
 assert.match(reportSubmissionError({code:'42501'},'message'),/полученное от собеседника/);
 assert.match(reportSubmissionError({code:'PGRST301'},'comment'),/вход в аккаунт/);
 const message=reportSubmissionError({message:'network unavailable'},'message');
 assert.match(message,/Текст сохранён/);
 assert.doesNotMatch(message,/sql|Supabase/);
});
