import test from 'node:test';
import assert from 'node:assert/strict';
import { nextPlateSection, appendPlateCharacter } from '../lib/plate-editing.ts';
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

test('publication keypad fills every vehicle then opens the region without a phantom section',()=>{
 for(const [format,start,characters,expected] of [
  [{left:1,digits:3,right:2},'left','А123ВВ',{left:'А',digits:'123',right:'ВВ'}],
  [{left:2,digits:4,right:0},'left','АА1234',{left:'АА',digits:'1234',right:''}],
  [{left:0,digits:4,right:2},'digits','1234АА',{left:'',digits:'1234',right:'АА'}],
 ]){
  const values={left:'',digits:'',right:''};let section=start;
  for(const value of characters){assert.notEqual(section,'region');values[section]=appendPlateCharacter(values[section],value,format[section]);section=nextPlateSection(section,values[section],format)}
  assert.equal(section,'region');assert.deepEqual(values,expected);
 }
});
test('editing a full field replaces it; deleting one trailer letter keeps the other',()=>{
 assert.equal(appendPlateCharacter('АА','В',2),'В');
 assert.equal(appendPlateCharacter('123','4',3),'4');
 assert.equal(appendPlateCharacter('АА'.slice(0,-1),'В',2),'АВ');
});
