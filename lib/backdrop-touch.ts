export type BackdropTouch = { move: (x:number,y:number)=>void; end:()=>void };

// Bubble the touch normally, but let the page distinguish controls from empty space.
const controlTouches = new WeakSet<object>();
export function markBackdropControlTouch(event: object) { controlTouches.add(event); }
export function isBackdropControlTouch(event: object) { return controlTouches.has(event); }

// Observe a drag without claiming the ScrollView's responder or swallowing taps.
export function createBackdropDrag() {
  let start: { x: number; y: number; dragging: boolean } | null = null;
  return {
    begin(x: number, y: number) { start = { x, y, dragging: false }; },
    move(x: number, y: number) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      if (!start) { start = { x, y, dragging: false }; return false; }
      if (Math.hypot(x - start.x, y - start.y) > 8) start.dragging = true;
      return start.dragging;
    },
    finish(remainingTouches: number) {
      if (remainingTouches > 0) return false;
      start = null;
      return true;
    },
  };
}
