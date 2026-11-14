import test from 'node:test';
import assert from 'node:assert/strict';
import { nextPlateSection, appendPlateCharacter, platePositions, movePlatePosition, nextPlateInputPosition, replacePlateCharacter, plateDeletionPosition } from '../lib/plate-editing.ts';
test('car advances only when each section is complete',()=>{
 const f={left:1,digits:3,right:2};
 assert.equal(nextPlateSection('left','А',f),'digits');
 assert.equal(nextPlateSection('digits','12',f),'digits');
 assert.equal(nextPlateSection('digits','123',f),'right');
 assert.equal(nextPlateSection('right','В',f),'right');
 assert.equal(nextPlateSection('right','ВВ',f),'region');
});

test('typing opens region selection at the end of every vehicle, including repeated entry',()=>{
 for(const vehicle of ['car','motorcycle','truck']){
  const positions=platePositions(vehicle);
  for(let attempt=0;attempt<2;attempt++){
   positions.forEach((position,index)=>assert.deepEqual(nextPlateInputPosition(vehicle,position),positions[index+1]??'region'));
  }
  assert.deepEqual(movePlatePosition(vehicle,positions.at(-1),1),positions.at(-1));
 }
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

test('cursor crosses character groups without wrapping or entering absent groups', () => {
  for (const vehicle of ['car','motorcycle','truck']) {
    const positions = platePositions(vehicle);
    assert.equal(positions.length, 6);
    assert.deepEqual(movePlatePosition(vehicle, positions[0], -1), positions[0]);
    assert.deepEqual(movePlatePosition(vehicle, positions.at(-1), 1), positions.at(-1));
    let cursor = positions[0];
    for (const expected of positions.slice(1)) {
      cursor = movePlatePosition(vehicle, cursor, 1);
      assert.deepEqual(cursor, expected);
    }
    assert.ok(positions.every(position => position.section !== 'region'));
    assert.equal(positions.some(position => position.section === 'left'), vehicle !== 'motorcycle');
    assert.equal(positions.some(position => position.section === 'right'), vehicle !== 'truck');
  }
});

test('editing and erasing the middle digit preserve its neighbours and position', () => {
  assert.equal(replacePlateCharacter('123', '8', 1, 3), '183');
  assert.equal(replacePlateCharacter('183', '*', 1, 3), '1*3');
  assert.equal(replacePlateCharacter('1*3', '0', 1, 3), '103');
  assert.equal(replacePlateCharacter('', '7', 2, 3), '**7');
  assert.equal(replacePlateCharacter('АВ', 'Х', 0, 2), 'ХВ');
  assert.equal(replacePlateCharacter('АВ', '*', 0, 2), '*В');
  assert.equal(replacePlateCharacter('*', '*', 0, 1), '');
  assert.equal(replacePlateCharacter('123', '4', 3, 3), '123');
});

test('backspace after auto-advance erases the character just entered, including group boundaries', () => {
  assert.deepEqual(plateDeletionPosition('car',{left:'А',digits:'1**',right:''},{section:'digits',index:1}),{section:'digits',index:0});
  assert.deepEqual(plateDeletionPosition('car',{left:'А',digits:'123',right:''},{section:'right',index:0}),{section:'digits',index:2});
  assert.deepEqual(plateDeletionPosition('car',{left:'А',digits:'123',right:'ВС'},{section:'digits',index:1}),{section:'digits',index:1});
});
