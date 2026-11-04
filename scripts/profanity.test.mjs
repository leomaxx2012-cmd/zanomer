import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {containsProhibitedLanguage,prohibitedWordSource,permittedWordSource} from '../lib/profanity.ts';

test('blocks declensions, derived forms, capitals, yo and invisible separators',()=>{
 for(const word of ['хуи','ХУЙ','хуя','хуями','охуеть','нахуй','хуёвый','пиздец','пиздой','блядью','ебать','ебут','ёбаный','заебал','подъебать','суки','сукин','сучка','fuckers','huyi','х\u200bуи'])assert.equal(containsProhibitedLanguage(word),true,word);
});
test('ordinary conversation and similar harmless roots remain allowed',()=>{
 for(const text of ['Здравствуйте! Какая цена?','Номер А123ВС 777','Учебный пример','Колебания цены','Требуется оформление','Страхуй автомобиль','Себе и для себя','Себестоимость','Хулиганство','Небольшой торг','Сукно','Педикюр','Dickinson'])assert.equal(containsProhibitedLanguage(text),false,text);
});
test('client and database use identical word expressions',()=>{
 const sql=fs.readFileSync(new URL('../supabase/message-profanity.sql',import.meta.url),'utf8');
 assert.ok(sql.includes('$prohibited$'+prohibitedWordSource+'$prohibited$'));
 assert.ok(sql.includes('$permitted$'+permittedWordSource+'$permitted$'));
});
