import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { PlateFace } from './PlateFace';

type Section = 'left' | 'digits' | 'right' | 'region';
type Props = {
  vehicle: 'car' | 'motorcycle' | 'truck';
  leftLetter: string; digits: string; rightLetters: string; region: string;
  onOpen: (section: Section) => void;
  labelPrefix?: string;
};

// Search and publication share artwork, hit areas and placeholder positions.
// These are buttons, so Android never opens a competing system keyboard.
export function PlateEditor({vehicle,leftLetter,digits,rightLetters,region,onOpen,labelPrefix=''}: Props) {
  const open = (section: Section) => { Keyboard.dismiss(); onOpen(section); };
  const prefix = (label: string) => labelPrefix ? `${labelPrefix}: ${label}` : label;
  return <View onTouchEnd={event=>event.stopPropagation()} onPointerUp={event=>event.stopPropagation()} style={[styles.plate,vehicle==='motorcycle'&&styles.moto]}>
    <PlateFace vehicle={vehicle} leftLetter={leftLetter||(vehicle==='truck'?'**':'*')} digits={digits||(vehicle==='car'?'***':'****')} rightLetters={rightLetters||'**'} region={region||'*'} />
    {vehicle==='motorcycle'?<>
      <Pressable accessibilityRole="button" accessibilityLabel={prefix('Четыре цифры мото-номера')} accessibilityValue={{text:digits}} onPress={()=>open('digits')} style={[styles.hit,{left:0,top:0,width:'100%',height:'51%'}]} />
      <Pressable accessibilityRole="button" accessibilityLabel={prefix('Две буквы мото-номера')} accessibilityValue={{text:rightLetters}} onPress={()=>open('right')} style={[styles.hit,{left:0,top:'51%',width:'53%',height:'49%'}]} />
    </>:<>
      <Pressable accessibilityRole="button" accessibilityLabel={prefix('Первые буквы номера')} accessibilityValue={{text:leftLetter}} onPress={()=>open('left')} style={[styles.hit,{left:0,top:0,width:vehicle==='truck'?'25%':'15%',height:'100%'}]} />
      <Pressable accessibilityRole="button" accessibilityLabel={prefix('Цифры номера')} accessibilityValue={{text:digits}} onPress={()=>open('digits')} style={[styles.hit,{left:vehicle==='truck'?'25%':'15%',top:0,width:vehicle==='truck'?'51%':'35%',height:'100%'}]} />
      {vehicle==='car'&&<Pressable accessibilityRole="button" accessibilityLabel={prefix('Последние буквы номера')} accessibilityValue={{text:rightLetters}} onPress={()=>open('right')} style={[styles.hit,{left:'50%',top:0,width:'26%',height:'100%'}]} />}
    </>}
    <Pressable accessibilityRole="button" accessibilityLabel={prefix(vehicle==='motorcycle'?'Выбрать регион мото-номера':'Выбрать регион номера')} accessibilityValue={{text:region}} onPress={()=>open('region')} style={[styles.hit,vehicle==='motorcycle'?{left:'53%',top:'51%',width:'47%',height:'49%'}:{left:'76%',top:0,width:'24%',height:'100%'}]} />
  </View>;
}
const styles=StyleSheet.create({
  plate:{alignSelf:'center',width:'100%',maxWidth:520,aspectRatio:520/112,position:'relative'},
  moto:{width:240,maxWidth:'100%',aspectRatio:4/3},
  hit:{position:'absolute',cursor:'pointer'},
});
