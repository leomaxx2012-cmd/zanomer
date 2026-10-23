import test from 'node:test';
import assert from 'node:assert/strict';
import { nextPlateSection } from '../lib/plate-editing.ts';
test('car advances only when each section is complete',()=>{
 const f={left:1,digits:3,right:2};
 assert.equal(nextPlateSection('left','А',f),'digits');
 assert.equal(nextPlateSection('digits','12',f),'digits');
 assert.equal(nextPlateSection('digits','123',f),'right');
 assert.equal(nextPlateSection('right','В',f),'right');
 assert.equal(nextPlateSection('right','ВВ',f),'region');
});
test('trailer has two letters and four digits, then region',()=>{
 const f={left:2,digits:4,right:0};
 assert.equal(nextPlateSection('left','А',f),'left');
 assert.equal(nextPlateSection('left','АА',f),'digits');
 assert.equal(nextPlateSection('digits','123',f),'digits');
 assert.equal(nextPlateSection('digits','1234',f),'region');
});
test('motorcycle starts with digits; wildcard positions also count',()=>{
 const f={left:0,digits:4,right:2};
 assert.equal(nextPlateSection('digits','1***',f),'right');
 assert.equal(nextPlateSection('right','*',f),'right');
 assert.equal(nextPlateSection('right','**',f),'region');
 assert.equal(nextPlateSection('region','77',f),'region');
});
