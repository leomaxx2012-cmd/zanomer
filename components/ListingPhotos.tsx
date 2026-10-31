import { type Theme } from '../lib/theme';
import { useTheme, useThemedStyles } from './AppTheme';
import { Pressable } from './ActionPressable';
import {useEffect,useState} from 'react';
import {Image,ScrollView,View,StyleSheet} from 'react-native';
import {Text} from './ResponsiveText';
export function ListingPhotos({urls,onChange}:{urls:string[];onChange?:(urls:string[])=>void}){
 const s=useThemedStyles(createStyles);
 const {theme}=useTheme();

 const [index,setIndex]=useState(0);const key=urls.join('|');useEffect(()=>setIndex(0),[key]);
 if(!urls.length)return null;return <View style={s.wrap}>
  <Image source={{uri:urls[index]??urls[0]}} style={s.photo} resizeMode="contain"/>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>{urls.map((uri,i)=><View key={uri} style={s.thumbWrap}><Pressable accessibilityRole="button" accessibilityLabel={`Показать фото ${i+1}`} onPress={()=>setIndex(i)} style={[s.thumb,i===index&&s.selected]}><Image source={{uri}} style={s.thumbImage}/></Pressable>{onChange&&<><Pressable accessibilityRole="button" accessibilityLabel={`Сделать фото ${i+1} обложкой`} onPress={()=>onChange([uri,...urls.filter(x=>x!==uri)])}><Text style={s.link}>{i===0?'✓ Обложка':'На обложку'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Убрать фото ${i+1}`} onPress={()=>onChange(urls.filter(x=>x!==uri))}><Text style={s.remove}>Убрать</Text></Pressable></>}</View>)}</ScrollView>
 </View>;
}
const createStyles = (theme:Theme) => StyleSheet.create({wrap:{gap:10,marginVertical:14},photo:{height:220,width:'100%',backgroundColor:theme.raised,borderRadius:16},row:{gap:12},thumbWrap:{width:90,gap:7},thumb:{width:86,height:62,borderRadius:9,borderWidth:2,borderColor:'transparent',overflow:'hidden'},selected:{borderColor:theme.accentBorder},thumbImage:{width:'100%',height:'100%'},link:{fontSize:11,color:theme.accent,textAlign:'center',paddingVertical:4},remove:{fontSize:11,color:theme.warning,textAlign:'center',paddingVertical:4}});
