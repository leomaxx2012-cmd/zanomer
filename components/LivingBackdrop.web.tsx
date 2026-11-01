import {useTheme} from './AppTheme';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type {BackdropTouch} from '../lib/backdrop-touch';
const css=(background:string)=>`
[data-testid="home-page"]{isolation:isolate;--pointer-x:50%;--pointer-y:30%;}
.living-backdrop{position:absolute;inset:0;overflow:hidden;pointer-events:none;border-radius:0;z-index:-1;background:${background};}
.living-backdrop:after{content:"";position:absolute;inset:0;opacity:var(--pointer-glow,1);background:radial-gradient(450px circle at var(--pointer-x) var(--pointer-y),#986cff70 0%,#8e70ff38 35%,transparent 75%);}
[data-testid="motion-card"]{transition:transform .2s ease;}
@media(hover:hover) and (pointer:fine){[data-testid="motion-card"]:hover{transform:translateY(-4px);}}
@media(max-width:599px),(hover:none),(pointer:coarse){.living-backdrop:after{display:none;}}
@media(prefers-reduced-motion:reduce){[data-testid="motion-card"]{transition:none!important;transform:none!important;}.living-backdrop:after{transition:none!important;}}
`;
export const LivingBackdrop=forwardRef<BackdropTouch>(function LivingBackdrop(_,touchRef){
 const {theme}=useTheme();
 const ref=useRef<HTMLDivElement>(null);
 useImperativeHandle(touchRef,()=>({move(){},end(){}}),[]);
 useEffect(()=>{
  const stage=ref.current?.parentElement;if(!stage)return;
  let frame=0;let blockedPress=false;
  const down=(e:PointerEvent)=>{if(e.pointerType!=='mouse')return;blockedPress=!!(e.target instanceof Element&&e.target.closest('[data-motion="button"],button,input,textarea,a,[role="button"],[role="link"]'));if(blockedPress){cancelAnimationFrame(frame);frame=0;stage.style.setProperty('--pointer-glow','0');}};
  const move=(e:PointerEvent)=>{if(e.pointerType!=='mouse'||window.matchMedia('(max-width:599px),(hover:none),(pointer:coarse)').matches||(blockedPress&&e.buttons))return;blockedPress=false;stage.style.setProperty('--pointer-glow','1');if(frame)return;const x=e.clientX,y=e.clientY;frame=requestAnimationFrame(()=>{const b=stage.getBoundingClientRect();stage.style.setProperty('--pointer-x',`${x-b.left}px`);stage.style.setProperty('--pointer-y',`${y-b.top}px`);frame=0;});};
  stage.addEventListener('pointerdown',down,{passive:true});stage.addEventListener('pointermove',move,{passive:true});return()=>{stage.removeEventListener('pointerdown',down);stage.removeEventListener('pointermove',move);cancelAnimationFrame(frame);};
 },[]);
 return <><style>{css(theme.background)}</style><div ref={ref} aria-hidden="true" className="living-backdrop"/></>;
});
