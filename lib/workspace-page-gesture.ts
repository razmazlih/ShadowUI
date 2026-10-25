export type PageWheelGestureState = {
  total: number;
  lastTime: number;
  lastMagnitude: number;
  direction: -1 | 0 | 1;
  committed: boolean;
  decayed: boolean;
};

export function createPageWheelGesture(): PageWheelGestureState {
  return { total: 0, lastTime: -Infinity, lastMagnitude: 0, direction: 0, committed: false, decayed: false };
}

/** Receive normalized horizontal pixels and a monotonic time, independent of RTL.
 * One movement commits once; its momentum is ignored. A deliberate reversal or
 * renewed force after decay starts a new movement without an animation cooldown.
 * Offset gives immediate, bounded feedback while a movement is below threshold.
 */
export function updatePageWheelGesture(state: PageWheelGestureState, delta: number, now: number): { step: -1 | 0 | 1; offset: number } {
  if (!Number.isFinite(delta) || !Number.isFinite(now) || delta === 0) return { step: 0, offset: 0 };
  const direction = Math.sign(delta) as -1 | 1;
  const magnitude = Math.abs(delta);
  const gap = now - state.lastTime;
  const reversal = direction !== state.direction;
  const freshImpulse = state.committed && state.decayed && !reversal && magnitude >= Math.max(24, state.lastMagnitude * 2.4);
  if (gap > (state.committed ? 90 : 240) || now < state.lastTime || freshImpulse || (reversal && (!state.committed || magnitude >= 12))) {
    state.total = 0;
    state.committed = false;
    state.decayed = false;
    state.direction = direction;
  }
  state.lastTime = now;
  // Ignore tiny opposite-sign noise without mistaking the next momentum sample
  // for a renewed impulse in the original direction.
  if (state.committed && reversal) return { step: 0, offset: 0 };
  if (magnitude <= 8 || (state.lastMagnitude > 0 && magnitude < state.lastMagnitude * .7)) state.decayed = true;
  state.lastMagnitude = magnitude;
  if (state.committed) return { step: 0, offset: 0 };
  state.direction = direction;
  state.total += delta;
  if (Math.abs(state.total) >= 48) {
    state.committed = true;
    state.decayed = false;
    return { step: Math.sign(state.total) as -1 | 1, offset: 0 };
  }
  return { step: 0, offset: Math.max(-24, Math.min(24, state.total * .5)) };
}
