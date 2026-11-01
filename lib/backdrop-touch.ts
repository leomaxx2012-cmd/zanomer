export type BackdropTouch = { move: (x:number,y:number)=>void; end:()=>void };

// Bubble the touch normally, but let the page distinguish controls from empty space.
const controlTouches = new WeakSet<object>();
export function markBackdropControlTouch(event: object) { controlTouches.add(event); }
export function isBackdropControlTouch(event: object) { return controlTouches.has(event); }
