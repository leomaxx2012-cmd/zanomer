import {forwardRef,useEffect,useImperativeHandle,useRef} from 'react';
import {AccessibilityInfo,Animated,StyleSheet,View,useWindowDimensions} from 'react-native';
import {useTheme} from './AppTheme';
import type {BackdropTouch} from '../lib/backdrop-touch';

// Static translucent rings approximate a soft radial glow without a native dependency.
const rings=Array.from({length:32},(_,i)=>1-i/32);
export const LivingBackdrop=forwardRef<BackdropTouch>(function LivingBackdrop(_,ref){
 const {mode}=useTheme();
 const {width}=useWindowDimensions();
 const radius=Math.min(width*0.6,260);
 const position=useRef(new Animated.ValueXY({x:0,y:0})).current;
 const opacity=useRef(new Animated.Value(0)).current;
 const reduced=useRef(false);
 const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const end=()=>{clearTimeout(timer.current);Animated.timing(opacity,{toValue:0,duration:400,useNativeDriver:true}).start();};
 useEffect(()=>{
  let active=true;
  void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(active){reduced.current=value;if(value)opacity.setValue(0);}});
  const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',value=>{reduced.current=value;if(value)opacity.setValue(0);});
  return()=>{active=false;listener.remove();clearTimeout(timer.current);opacity.stopAnimation();};
 },[opacity]);
 useEffect(()=>{opacity.setValue(0);clearTimeout(timer.current);},[mode,opacity]);
 useImperativeHandle(ref,()=>({move(x,y){
  if(mode!=='dark'||reduced.current)return;
  clearTimeout(timer.current);opacity.stopAnimation();
  position.setValue({x:x-radius,y:y-radius});opacity.setValue(1);
  // Also fade when a child consumes touch-end (for example the plate editor).
  timer.current=setTimeout(end,900);
 },end}),[mode,position,opacity,radius]);
 if(mode!=='dark')return null;
 return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={styles.layer}>
  <Animated.View renderToHardwareTextureAndroid shouldRasterizeIOS style={{position:'absolute',left:0,top:0,width:radius*2,height:radius*2,opacity,transform:position.getTranslateTransform()}}>
   {rings.map((ratio,i)=>{const diameter=radius*2*ratio;return <View key={i} style={{position:'absolute',left:radius-diameter/2,top:radius-diameter/2,width:diameter,height:diameter,borderRadius:diameter/2,backgroundColor:'rgba(152,108,255,0.019)'}}/>;})}
  </Animated.View>
 </View>;
});
const styles=StyleSheet.create({layer:{...StyleSheet.absoluteFillObject,overflow:'hidden'}});
