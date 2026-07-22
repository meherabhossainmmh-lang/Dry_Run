import keyConfig from '../assets/key.config.json';
import type { Vec3 } from './math';
import type { Digit } from './commands';

// Key-panel touch points in the base frame, straight from key.config.json.
// Kept in the pure core (no three.js) so validate()/IK/PIN can reach them; the
// visual KeyPanel in src/three reads the same JSON.
export const KEY_POINTS: Record<Digit, Vec3> = Object.fromEntries(
  Object.entries(keyConfig.keys).map(([k, p]) => [Number(k), [p.x, p.y, p.z] as Vec3]),
) as Record<Digit, Vec3>;

/** Approach direction onto a key (URDF -z). */
export const APPROACH: Vec3 = [0, 0, -1];

/** Hover height above a key's top face before the descent (meters). */
export const KEY_HOVER = 0.06;
