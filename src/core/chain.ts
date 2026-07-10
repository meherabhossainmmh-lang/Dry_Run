import type { Vec3 } from './math';
import { norm } from './math';

export type Axis = 'X' | 'Y' | 'Z';

export interface JointSpec {
  name: string;
  label: string;
  /** Translation from the previous joint frame (URDF <origin xyz>, rpy = 0 here). */
  offset: Vec3;
  axis: Axis;
  lower: number;
  upper: number;
}

// Transcribed directly from src/assets/stylus_arm.urdf. Every joint origin is a
// pure +Z translation with rpy = 0, so the whole chain is Trans·Rot per joint.
// GROUND-TRUTH ANCHOR: fk(all-zeros) must equal (0, 0, 1.497 m) — see tests/fk.test.ts.
export const CHAIN: JointSpec[] = [
  { name: 'joint_1',      label: 'J1 · base yaw',     offset: [0, 0, 0.060], axis: 'Z', lower: -3.1416, upper: 3.1416 },
  { name: 'joint_2',      label: 'J2 · shoulder',     offset: [0, 0, 0.250], axis: 'Y', lower: -2.0944, upper: 2.0944 },
  { name: 'joint_3',      label: 'J3 · elbow',        offset: [0, 0, 0.250], axis: 'Y', lower: -2.6180, upper: 2.6180 },
  { name: 'joint_4',      label: 'J4 · forearm roll', offset: [0, 0, 0.250], axis: 'Z', lower: -3.1416, upper: 3.1416 },
  { name: 'joint_5',      label: 'J5 · wrist pitch',  offset: [0, 0, 0.150], axis: 'Y', lower: -2.0944, upper: 2.0944 },
  { name: 'joint_6',      label: 'J6 · tool roll',    offset: [0, 0, 0.250], axis: 'Z', lower: -3.1416, upper: 3.1416 },
  { name: 'stylus_pitch', label: 'J7 · stylus pitch', offset: [0, 0, 0.150], axis: 'Y', lower: -2.0944, upper: 2.0944 },
];

export const NJ = 7;

/** Fixed stylus_tip_frame offset from the last joint (URDF fixed joint). */
export const TIP_OFFSET: Vec3 = [0, 0, 0.137];

/** J2 axis position at q = 0 (0.060 + 0.250). Reach sphere is measured from here. */
export const SHOULDER: Vec3 = [0, 0, 0.310];

/** Straight-line reach from the shoulder = sum of link lengths distal to J2 (≈ 1.187 m). */
export const MAX_REACH =
  CHAIN.slice(2).reduce((sum, j) => sum + norm(j.offset), 0) + norm(TIP_OFFSET);

/** Never plan past this fraction of full reach (keeps clear of the full-stretch singularity). */
export const REACH_SAFETY = 0.97;

/** The surface is solid: no part of the arm may go below this height (meters). */
export const FLOOR_Z = 0.005;

/** Home / FK-anchor pose. */
export const HOME: number[] = [0, 0, 0, 0, 0, 0, 0];
