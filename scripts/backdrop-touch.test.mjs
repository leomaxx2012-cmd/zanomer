import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackdropDrag } from '../lib/backdrop-touch.ts';

test('a button tap and small finger jitter do not start a glow drag', () => {
  const drag = createBackdropDrag();
  drag.begin(100, 100);
  assert.equal(drag.move(103, 102), false);
  assert.equal(drag.finish(0), true);
});

test('drag continues when a scrolling child cancels its own touch while a finger remains', () => {
  const drag = createBackdropDrag();
  drag.begin(30, 40);
  assert.equal(drag.move(30, 65), true);
  assert.equal(drag.finish(1), false);
  assert.equal(drag.move(70, 90), true);
  assert.equal(drag.finish(0), true);
  drag.begin(200, 200);
  assert.equal(drag.move(202, 200), false);
});

test('move events can recover after an interrupted native touch stream', () => {
  const drag = createBackdropDrag();
  drag.begin(10, 10);
  drag.finish(0);
  assert.equal(drag.move(40, 50), false);
  assert.equal(drag.move(60, 75), true);
  assert.equal(drag.move(NaN, 75), false);
});
