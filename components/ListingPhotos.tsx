import {useEffect,useState} from 'react';
import {Image,Pressable,ScrollView,View,StyleSheet} from 'react-native';
import {Text} from './ResponsiveText';
export function ListingPhotos({urls,onChange}:{urls:string[];onChange?:(urls:string[])=>void}){
 const [index,setIndex]=useState(0);const key=urls.join('|');useEffect(()=>setIndex(0),[key]);
 if(!urls.length)return null;return <View style={s.wrap}>
  <Image source={{uri:urls[index]??urls[0]}} style={s.photo} resizeMode="contain"/>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>{urls.map((uri,i)=><View key={uri} style={s.thumbWrap}><Pressable accessibilityRole="button" accessibilityLabel={`Показать фото ${i+1}`} onPress={()=>setIndex(i)} style={[s.thumb,i===index&&s.selected]}><Image source={{uri}} style={s.thumbImage}/></Pressable>{onChange&&<><Pressable accessibilityRole="button" accessibilityLabel={`Сделать фото ${i+1} обложкой`} onPress={()=>onChange([uri,...urls.filter(x=>x!==uri)])}><Text style={s.link}>{i===0?'✓ Обложка':'На обложку'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Убрать фото ${i+1}`} onPress={()=>onChange(urls.filter(x=>x!==uri))}><Text style={s.remove}>Убрать</Text></Pressable></>}</View>)}</ScrollView>
 </View>;
}
const s=StyleSheet.create({wrap:{gap:10,marginVertical:14},photo:{height:220,width:'100%',backgroundColor:'#F3F2F7',borderRadius:16},row:{gap:12},thumbWrap:{width:90,gap:7},thumb:{width:86,height:62,borderRadius:9,borderWidth:2,borderColor:'transparent',overflow:'hidden'},selected:{borderColor:'#6551D3'},thumbImage:{width:'100%',height:'100%'},link:{fontSize:11,color:'#5143C2',textAlign:'center',paddingVertical:4},remove:{fontSize:11,color:'#B42318',textAlign:'center',paddingVertical:4}});
