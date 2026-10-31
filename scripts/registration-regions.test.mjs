import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationRegionName,registrationRegionLabel} from '../lib/registration-regions.ts';

test('new codes resolve without any catalogue records',()=>{
  assert.equal(registrationRegionName('790'),'Московская область');
  assert.equal(registrationRegionName('750'),'Московская область');
  assert.equal(registrationRegionName('777'),'Москва');
  assert.equal(registrationRegionName('196'),'Свердловская область');
  assert.equal(registrationRegionName('178'),'Санкт-Петербург');
});
test('two-digit codes and leading zeroes retain the correct region',()=>{
  assert.equal(registrationRegionLabel('05'),'Республика Дагестан · 05');
  assert.equal(registrationRegionLabel('50'),'Московская область · 50');
});
test('unknown and malformed codes never receive invented names',()=>{
  for(const code of ['00','000','120','001','1234','abc']) assert.equal(registrationRegionName(code),undefined);
  assert.equal(registrationRegionLabel('000'),'000');
});
