import test from 'node:test';
import assert from 'node:assert/strict';
import { createPageWheelGesture, updatePageWheelGesture } from '../lib/workspace-page-gesture';

test('wheel movement responds before threshold and commits once through an accelerating and decaying tail', () => {
  const state = createPageWheelGesture();
  assert.deepEqual(updatePageWheelGesture(state, 16, 0), { step: 0, offset: 8 });
  assert.deepEqual(updatePageWheelGesture(state, 32, 16), { step: 1, offset: 0 });
  for (const [index, delta] of [55, 70, 60, 40, 25, 12, 6, 3, 1].entries()) {
    assert.equal(updatePageWheelGesture(state, delta, 32 + index * 16).step, 0);
  }
});

test('a deliberate reversal responds immediately while the prior movement is locked', () => {
  const state = createPageWheelGesture();
  assert.equal(updatePageWheelGesture(state, 80, 0).step, 1);
  assert.deepEqual(updatePageWheelGesture(state, -24, 16), { step: 0, offset: -12 });
  assert.equal(updatePageWheelGesture(state, -24, 32).step, -1);
  assert.equal(updatePageWheelGesture(state, 80, 48).step, 1);
});

test('a fresh same-direction impulse after decay does not wait for a long quiet window', () => {
  const state = createPageWheelGesture();
  assert.equal(updatePageWheelGesture(state, 60, 0).step, 1);
  assert.equal(updatePageWheelGesture(state, 30, 16).step, 0);
  assert.equal(updatePageWheelGesture(state, 12, 32).step, 0);
  assert.equal(updatePageWheelGesture(state, 3, 48).step, 0);
  assert.equal(updatePageWheelGesture(state, 55, 64).step, 1);
});

test('a new gesture after a brief pause works and opposite momentum noise cannot retrigger it', () => {
  const state = createPageWheelGesture();
  assert.equal(updatePageWheelGesture(state, -70, 0).step, -1);
  assert.equal(updatePageWheelGesture(state, 2, 16).step, 0);
  assert.equal(updatePageWheelGesture(state, -60, 32).step, 0);
  assert.equal(updatePageWheelGesture(state, -60, 130).step, -1);
});

test('invalid samples do not contaminate the next valid gesture', () => {
  const state = createPageWheelGesture();
  for (const [delta, now] of [[NaN, 0], [Infinity, 0], [20, NaN], [0, 0]]) {
    assert.deepEqual(updatePageWheelGesture(state, delta, now), { step: 0, offset: 0 });
  }
  assert.equal(updatePageWheelGesture(state, 48, 0).step, 1);
});

test('a slow deliberate gesture accumulates before committing without treating acceleration as another page', () => {
  const state = createPageWheelGesture();
  assert.equal(updatePageWheelGesture(state, 16, 0).step, 0);
  assert.equal(updatePageWheelGesture(state, 16, 120).step, 0);
  assert.equal(updatePageWheelGesture(state, 16, 240).step, 1);
  assert.equal(updatePageWheelGesture(state, 50, 256).step, 0);
});
