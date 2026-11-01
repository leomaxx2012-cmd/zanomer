import {forwardRef,useImperativeHandle} from 'react';
import type {BackdropTouch} from '../lib/backdrop-touch';

// Native screens use the plain theme background, with no glow layers or animations.
export const LivingBackdrop=forwardRef<BackdropTouch>(function LivingBackdrop(_,ref){
 useImperativeHandle(ref,()=>({move(){},end(){}}),[]);
 return null;
});
