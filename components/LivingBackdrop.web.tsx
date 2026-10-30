import { useEffect, useRef } from 'react';
const css=`
[data-testid="landing-stage"]{isolation:isolate;--pointer-x:50%;--pointer-y:30%;}
.living-backdrop{position:absolute;inset:0;overflow:hidden;pointer-events:none;border-radius:32px;z-index:-1;background:#151723;}
.living-backdrop:after{content:"";position:absolute;inset:0;background:radial-gradient(450px circle at var(--pointer-x) var(--pointer-y),#8e70ff24,transparent 75%);}
.living-grid{position:absolute;inset:0;opacity:.12;background-image:linear-gradient(#9a95b5 1px,transparent 1px),linear-gradient(90deg,#9a95b5 1px,transparent 1px);background-size:60px 60px;mask-image:linear-gradient(to bottom,black,transparent);}
.living-orb{position:absolute;width:450px;height:450px;border-radius:50%;filter:blur(75px);opacity:.28;animation:living-drift 20s ease-in-out infinite alternate;will-change:transform;background:#8155ed;right:-120px;top:-180px;}
.living-orb.second{width:320px;height:320px;background:#3199a3;left:-110px;top:220px;animation-delay:-9s;animation-duration:26s;opacity:.16;}
@keyframes living-drift{from{transform:translate3d(-30px,0,0) scale(.94)}to{transform:translate3d(45px,80px,0) scale(1.12)}}
:is([data-testid="motion-button"],[data-testid="hero-search"]),[data-testid="motion-card"]{transition:transform .2s ease,box-shadow .2s ease;}
@media(hover:hover) and (pointer:fine){:is([data-testid="motion-button"],[data-testid="hero-search"]):hover{transform:translateY(-2px) scale(1.025);box-shadow:0 9px 24px #5143c22b;}[data-testid="motion-card"]:hover{transform:translateY(-4px);box-shadow:0 12px 30px #20253214;}}
:is([data-testid="motion-button"],[data-testid="hero-search"]):active{transform:scale(.975);}
:is([data-testid="motion-button"],[data-testid="hero-search"]):focus-visible{outline:3px solid #a891ff;outline-offset:4px;}
@media(prefers-reduced-motion:reduce){.living-orb{animation:none;will-change:auto;}:is([data-testid="motion-button"],[data-testid="hero-search"]),[data-testid="motion-card"]{transition:none!important;transform:none!important;}.living-backdrop:after{display:none;}}
@media(max-width:600px){.living-orb{filter:blur(45px);width:260px;height:260px;}.living-backdrop{border-radius:22px;}}
`;
export function LivingBackdrop(){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const stage=ref.current?.parentElement;if(!stage)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');let frame=0;
  const move=(e:PointerEvent)=>{if(reduced.matches||e.pointerType!=='mouse'||frame)return;const x=e.clientX,y=e.clientY;frame=requestAnimationFrame(()=>{const b=stage.getBoundingClientRect();stage.style.setProperty('--pointer-x',`${x-b.left}px`);stage.style.setProperty('--pointer-y',`${y-b.top}px`);frame=0;});};
  stage.addEventListener('pointermove',move,{passive:true});return()=>{stage.removeEventListener('pointermove',move);cancelAnimationFrame(frame);};
 },[]);
 return <><style>{css}</style><div ref={ref} aria-hidden="true" className="living-backdrop"><div className="living-grid"/><div className="living-orb"/><div className="living-orb second"/></div></>;
}
