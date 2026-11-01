import {View} from 'react-native';

export const headerIconColors = {fire:'#F47B20',theme:'#F5AE3D',chat:'#B4A7CD',profile:'#288BD2'};

// Draw these two simple symbols in their outline colour on every platform.
export function HeaderIcon({kind}:{kind:'chat'|'profile'}) {
 const color=headerIconColors[kind];
 return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{width:20,height:20}}>
  {kind==='profile' ? <>
   <View style={{position:'absolute',top:0,left:6,width:8,height:8,borderRadius:4,backgroundColor:color}}/>
   <View style={{position:'absolute',bottom:0,left:2,width:16,height:10,borderTopLeftRadius:8,borderTopRightRadius:8,borderBottomLeftRadius:2,borderBottomRightRadius:2,backgroundColor:color}}/>
  </> : <>
   <View style={{position:'absolute',top:2,left:0,width:20,height:14,borderRadius:7,backgroundColor:color,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:2}}>
    {[0,1,2].map(i=><View key={i} style={{width:2,height:2,borderRadius:1,backgroundColor:'#FFFFFF'}}/>)}
   </View>
   <View style={{position:'absolute',left:4,top:12,width:6,height:6,backgroundColor:color,transform:[{rotate:'25deg'}]}}/>
  </>}
 </View>;
}
