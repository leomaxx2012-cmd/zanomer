import {useState} from 'react';
import {View} from 'react-native';
import {Pressable} from './ActionPressable';
import {Text} from './ResponsiveText';
import {useTheme} from './AppTheme';
import type {PlatePosition} from '../lib/plate-editing';

const letters=['А','В','Е','К','М','Н','О','Р','С','Т','У','Х'];
const digits=['0','1','2','3','4','5','6','7','8','9'];
export function PlateKeyboard({section,value,onChoose,onErase,allowWildcard=true}:{
  section:PlatePosition['section'];value:string;onChoose:(value:string)=>void;onErase:()=>void;allowWildcard?:boolean;
}) {
 const {theme}=useTheme();const [width,setWidth]=useState(0);
 const keys=section==='digits'?digits:letters;
 const columns=width>0&&width<280?4:5;
 const rows=Math.ceil((letters.length+(allowWildcard?2:1))/columns);
 const keyStyle={width:Math.max(1,Math.floor((width-8*(columns-1))/columns)),height:44,borderWidth:1,borderColor:theme.border,borderRadius:9,alignItems:'center' as const,justifyContent:'center' as const};
 return <View onTouchEnd={event=>event.stopPropagation()} onPointerUp={event=>event.stopPropagation()}
   style={{alignSelf:'center',width:'100%',maxWidth:588,marginTop:8,padding:10,borderWidth:1,borderColor:theme.border,borderRadius:12,backgroundColor:theme.surface}}>
   <Text style={{fontSize:12,color:theme.muted,marginBottom:8}}>{section==='digits'?'Цифры':'Буквы'}</Text>
   <View onLayout={event=>setWidth(event.nativeEvent.layout.width)} style={{height:rows*44+(rows-1)*8,flexDirection:'row',flexWrap:'wrap',alignContent:'flex-start',gap:8}}>
    {keys.map(key=><Pressable key={key} accessibilityRole="button" accessibilityLabel={`Ввести символ ${key}`} accessibilityState={{selected:key===value}}
      onPress={()=>onChoose(key)} style={[keyStyle,{backgroundColor:key===value?theme.accentSurface:theme.surface,borderColor:key===value?theme.accent:theme.border}]}>
      <Text allowFontScaling={false} style={{color:theme.accent,fontSize:17,fontWeight:'800'}}>{key}</Text>
    </Pressable>)}
    {allowWildcard&&<Pressable accessibilityRole="button" accessibilityLabel="Любой символ номера" onPress={()=>onChoose('*')} style={keyStyle}><Text style={{color:theme.accent,fontSize:19}}>*</Text></Pressable>}
    <Pressable accessibilityRole="button" accessibilityLabel="Удалить выбранный символ номера" onPress={onErase} style={keyStyle}><Text style={{color:theme.accent,fontSize:19}}>⌫</Text></Pressable>
   </View>
 </View>;
}
