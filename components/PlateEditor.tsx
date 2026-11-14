import { Pressable } from './ActionPressable';
import { Keyboard, StyleSheet, View } from 'react-native';
import { PlateFace } from './PlateFace';
import { useTheme } from './AppTheme';
import {Text} from './ResponsiveText';
import {platePositions, type PlatePosition} from '../lib/plate-editing';

type Section = 'left' | 'digits' | 'right' | 'region';
type Props = {
  vehicle: 'car' | 'motorcycle' | 'truck';
  leftLetter: string; digits: string; rightLetters: string; region: string;
  onOpen: (section: Section, index: number) => void;
  activePosition?: PlatePosition | null;
  keyboardOpen:boolean;
  onToggleKeyboard:()=>void;
  onMove:(direction:-1|1)=>void;
  labelPrefix?: string;
  sideInset?: number;
};

// Search and publication share artwork, hit areas and placeholder positions.
// These are buttons, so Android never opens a competing system keyboard.
export function PlateEditor({vehicle,leftLetter,digits,rightLetters,region,onOpen,activePosition,keyboardOpen,onToggleKeyboard,onMove,labelPrefix='',sideInset=22}: Props) {
  const {theme} = useTheme();
  const open = (section: Section, index = 0) => { Keyboard.dismiss(); onOpen(section, index); };
  const prefix = (label: string) => labelPrefix ? `${labelPrefix}: ${label}` : label;
  const group = (section: PlatePosition['section'], label: string, value: string, left: number, top: number, width: number, height: number, count: number) =>
    Array.from({length:count},(_,index)=><Pressable key={`${section}:${index}`} accessibilityRole="button"
      accessibilityLabel={prefix(index === 0 ? label : `${label}: позиция ${index + 1}`)} accessibilityValue={{text:value[index] || '*'}}
      accessibilityState={{selected:activePosition?.section===section && activePosition.index===index}}
      onPress={()=>open(section,index)} style={[styles.hit,{left:`${left + index * width / count}%`,top:`${top}%`,width:`${width / count}%`,height:`${height}%`}]} />);
  const positions=platePositions(vehicle);
  const selected=activePosition?positions.findIndex(p=>p.section===activePosition.section&&p.index===activePosition.index):0;
  const arrow=(direction:-1|1)=>{
    const disabled=direction===-1?selected<=0:selected>=positions.length-1;
    return <Pressable accessibilityRole="button" accessibilityLabel={prefix(direction===-1?'Предыдущий символ номера':'Следующий символ номера')}
      accessibilityState={{disabled}} disabled={disabled} hitSlop={6} onPress={()=>onMove(direction)}
      style={{width:sideInset-2,height:44,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:theme.border,borderRadius:9,opacity:disabled?0.3:1}}>
      <Text allowFontScaling={false} style={{fontSize:25,color:theme.accent}}>{direction===-1?'‹':'›'}</Text>
    </Pressable>;
  };
  // Arrows use the card padding while staying inside their parent touch area on Android.
  return <View onTouchEnd={event=>event.stopPropagation()} onPointerUp={event=>event.stopPropagation()} style={{alignSelf:'stretch',marginHorizontal:-sideInset}}>
   <View style={{alignSelf:'center',width:'100%',maxWidth:(vehicle==='motorcycle'?240:520)+sideInset*2,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:2}}>
    {arrow(-1)}
    <View style={[styles.plate,vehicle==='motorcycle'&&styles.moto]}>
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
    </View>
    {arrow(1)}
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel={prefix(keyboardOpen?'Скрыть клавиатуру номера':'Открыть клавиатуру номера')}
     aria-expanded={keyboardOpen} onPress={onToggleKeyboard} style={{alignSelf:'center',minWidth:80,minHeight:36,alignItems:'center',justifyContent:'center',marginTop:4}}>
     <Text allowFontScaling={false} style={{color:theme.accent,fontSize:20}}>{keyboardOpen?'⌃':'⌄'}</Text>
   </Pressable>
  </View>;
}
const styles=StyleSheet.create({
  plate:{flex:1,minWidth:0,maxWidth:520,aspectRatio:520/112,position:'relative'},
  moto:{maxWidth:240,aspectRatio:4/3},
  hit:{position:'absolute',cursor:'pointer'},
});
