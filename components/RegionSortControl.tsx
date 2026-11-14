import {View} from 'react-native';
import {Pressable} from './ActionPressable';
import {Text} from './ResponsiveText';
import {useTheme} from './AppTheme';
import type {RegionSort} from '../lib/region-sorting';
export function RegionSortControl({value,onChange}:{value:RegionSort;onChange:(value:RegionSort)=>void}){
 const {theme}=useTheme();
 return <View style={{gap:6}}>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>
   {([['alphabet','Алфавит','По алфавиту'],['population','Популярность','По населению'],['catalog','В каталоге','По объявлениям']] as const).map(([key,title,label])=>
    <Pressable key={key} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected:value===key}} onPress={()=>onChange(key)}
      style={{borderWidth:1,borderColor:value===key?theme.accent:theme.border,backgroundColor:value===key?theme.accentSurface:theme.surface,borderRadius:10,paddingHorizontal:10,minHeight:40,justifyContent:'center'}}>
      <Text style={{color:theme.accent,fontSize:12,fontWeight:'700'}}>{title}</Text>
    </Pressable>)}
  </View>
  {value==='population'&&<Text style={{color:theme.muted,fontSize:11}}>Сначала больше жителей · данные на 01.01.2025</Text>}
  {value==='catalog'&&<Text style={{color:theme.muted,fontSize:11}}>Сначала больше объявлений в каталоге</Text>}
 </View>;
}
