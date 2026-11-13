import { Pressable } from './ActionPressable';
import { Keyboard, StyleSheet, View } from 'react-native';
import { PlateFace } from './PlateFace';
import { useTheme } from './AppTheme';
import type { PlatePosition } from '../lib/plate-editing';

type Section = 'left' | 'digits' | 'right' | 'region';
type Props = {
  vehicle: 'car' | 'motorcycle' | 'truck';
  leftLetter: string; digits: string; rightLetters: string; region: string;
  onOpen: (section: Section, index: number) => void;
  activePosition?: PlatePosition | null;
  labelPrefix?: string;
};

// Search and publication share artwork, hit areas and placeholder positions.
// These are buttons, so Android never opens a competing system keyboard.
export function PlateEditor({vehicle,leftLetter,digits,rightLetters,region,onOpen,activePosition,labelPrefix=''}: Props) {
  const {theme} = useTheme();
  const open = (section: Section, index = 0) => { Keyboard.dismiss(); onOpen(section, index); };
  const prefix = (label: string) => labelPrefix ? `${labelPrefix}: ${label}` : label;
  const group = (section: PlatePosition['section'], label: string, value: string, left: number, top: number, width: number, height: number, count: number) =>
    Array.from({length:count},(_,index)=><Pressable key={`${section}:${index}`} accessibilityRole="button"
      accessibilityLabel={prefix(index === 0 ? label : `${label}: позиция ${index + 1}`)} accessibilityValue={{text:value[index] || '*'}}
      accessibilityState={{selected:activePosition?.section===section && activePosition.index===index}}
      onPress={()=>open(section,index)} style={[styles.hit,{left:`${left + index * width / count}%`,top:`${top}%`,width:`${width / count}%`,height:`${height}%`}]} />);
  return <View onTouchEnd={event=>event.stopPropagation()} onPointerUp={event=>event.stopPropagation()} style={[styles.plate,vehicle==='motorcycle'&&styles.moto]}>
    <PlateFace vehicle={vehicle} leftLetter={leftLetter.padEnd(vehicle==='truck'?2:1,'*')} digits={digits.padEnd(vehicle==='car'?3:4,'*')} rightLetters={rightLetters.padEnd(2,'*')} region={region||'*'} activePosition={activePosition} highlightColor={theme.accent} />
    {vehicle==='motorcycle'?<>
      {group('digits','Четыре цифры мото-номера',digits,0,0,100,51,4)}
      {group('right','Две буквы мото-номера',rightLetters,0,51,53,49,2)}
    </>:<>
      {group('left','Первые буквы номера',leftLetter,0,0,vehicle==='truck'?25:15,100,vehicle==='truck'?2:1)}
      {group('digits','Цифры номера',digits,vehicle==='truck'?25:15,0,vehicle==='truck'?51:35,100,vehicle==='truck'?4:3)}
      {vehicle==='car'&&group('right','Последние буквы номера',rightLetters,50,0,26,100,2)}
    </>}
    <Pressable accessibilityRole="button" accessibilityLabel={prefix(vehicle==='motorcycle'?'Выбрать регион мото-номера':'Выбрать регион номера')} accessibilityValue={{text:region}} onPress={()=>open('region')} style={[styles.hit,vehicle==='motorcycle'?{left:'53%',top:'51%',width:'47%',height:'49%'}:{left:'76%',top:0,width:'24%',height:'100%'}]} />
  </View>;
}
const styles=StyleSheet.create({
  plate:{alignSelf:'center',width:'100%',maxWidth:520,aspectRatio:520/112,position:'relative'},
  moto:{width:240,maxWidth:'100%',aspectRatio:4/3},
  hit:{position:'absolute',cursor:'pointer'},
});
