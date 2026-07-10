// Trajectory stepping — pure, testable. The controller ticks this each frame to
// ease the joint vector toward a target under a per-joint velocity cap.

/** Move q one tick toward target, each joint limited to maxDelta (radians). */
export function stepToward(
  q: number[],
  target: number[],
  maxDelta: number,
): { q: number[]; done: boolean } {
  const next = q.slice();
  let done = true;
  for (let i = 0; i < q.length; i++) {
    const err = target[i] - q[i];
    if (Math.abs(err) <= maxDelta) {
      next[i] = target[i];
    } else {
      next[i] = q[i] + Math.sign(err) * maxDelta;
      done = false;
    }
  }
  return { q: next, done };
}
