import { useEffect, useRef } from 'react';
const css=`
[data-testid="home-page"]{isolation:isolate;--pointer-x:50%;--pointer-y:30%;}
.living-backdrop{position:absolute;inset:0;overflow:hidden;pointer-events:none;border-radius:0;z-index:-1;background:#151723;}
.living-backdrop:after{content:"";position:absolute;inset:0;background:radial-gradient(450px circle at var(--pointer-x) var(--pointer-y),#8e70ff24,transparent 75%);}
.living-grid{position:absolute;inset:0;opacity:.12;background-image:linear-gradient(#9a95b5 1px,transparent 1px),linear-gradient(90deg,#9a95b5 1px,transparent 1px);background-size:60px 60px;mask-image:linear-gradient(to bottom,black,transparent);}
[data-testid="motion-card"]{transition:transform .2s ease,box-shadow .2s ease;}
@media(hover:hover) and (pointer:fine){[data-testid="motion-card"]:hover{transform:translateY(-4px);box-shadow:0 12px 30px #20253214;}}
@media(prefers-reduced-motion:reduce){[data-testid="motion-card"]{transition:none!important;transform:none!important;}.living-backdrop:after{display:none;}}
`;
export function LivingBackdrop(){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const stage=ref.current?.parentElement;if(!stage)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');let frame=0;
  const move=(e:PointerEvent)=>{if(reduced.matches||e.pointerType!=='mouse'||frame)return;const x=e.clientX,y=e.clientY;frame=requestAnimationFrame(()=>{const b=stage.getBoundingClientRect();stage.style.setProperty('--pointer-x',`${x-b.left}px`);stage.style.setProperty('--pointer-y',`${y-b.top}px`);frame=0;});};
  stage.addEventListener('pointermove',move,{passive:true});return()=>{stage.removeEventListener('pointermove',move);cancelAnimationFrame(frame);};
 },[]);
 return <><style>{css}</style><div ref={ref} aria-hidden="true" className="living-backdrop"><div className="living-grid"/></div></>;
}
