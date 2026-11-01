import {useState,type PropsWithChildren} from 'react';
import {View} from 'react-native';
import {Pressable} from './ActionPressable';
import {Text} from './ResponsiveText';
import {useTheme} from './AppTheme';

export function FilterSection({title,summary,children}:PropsWithChildren<{title:string;summary:string}>) {
 const {theme}=useTheme();
 const [expanded,setExpanded]=useState(true);
 return <View style={{width:'100%'}}>
  <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{expanded}} onPress={()=>setExpanded(value=>!value)} style={{minHeight:40,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}>
   <View style={{flex:1,gap:3}}>
    <Text style={{color:theme.text,fontSize:13,fontWeight:'900'}}>{title}</Text>
    {!expanded&&<Text style={{color:theme.muted,fontSize:12,lineHeight:17}}>{summary}</Text>}
   </View>
   <Text accessible={false} style={{color:theme.accent,fontSize:18}}>{expanded?'⌃':'⌄'}</Text>
  </Pressable>
  {expanded&&children}
 </View>;
}
