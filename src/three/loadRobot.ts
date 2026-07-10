import * as THREE from 'three';
import URDFLoader from 'urdf-loader';
import urdfContent from '../assets/stylus_arm.urdf?raw';
import type { JointMeta } from '../state/store';

/** Actuated joints in kinematic order — every q array in the app is length 7 in this order. */
export const JOINT_ORDER = [
  'joint_1',
  'joint_2',
  'joint_3',
  'joint_4',
  'joint_5',
  'joint_6',
  'stylus_pitch',
] as const;

export const JOINT_LABELS = [
  'J1 · base yaw',
  'J2 · shoulder',
  'J3 · elbow',
  'J4 · forearm roll',
  'J5 · wrist pitch',
  'J6 · tool roll',
  'J7 · stylus pitch',
] as const;

// Minimal structural types for the parts of urdf-loader we use.
interface UrdfJoint extends THREE.Object3D {
  setJointValue(v: number): void;
  limit: { lower: number; upper: number };
}
interface UrdfRobot extends THREE.Object3D {
  joints: Record<string, UrdfJoint>;
  links: Record<string, THREE.Object3D>;
}

export interface ArmHandle {
  robot: THREE.Object3D;
  /** The `stylus_tip` TCP frame — its world matrix gives tip position. */
  tip: THREE.Object3D;
  jointMeta: JointMeta[];
  applyQ(q: number[]): void;
}

export function loadArm(): ArmHandle {
  const loader = new URDFLoader();
  const robot = loader.parse(urdfContent) as unknown as UrdfRobot;

  robot.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = false;
    }
  });

  const joints = JOINT_ORDER.map((name) => {
    const j = robot.joints[name];
    if (!j) throw new Error(`URDF joint missing: ${name}`);
    return j;
  });

  const tip = robot.links['stylus_tip'];
  if (!tip) throw new Error('URDF link missing: stylus_tip');

  const jointMeta: JointMeta[] = joints.map((j, i) => ({
    name: JOINT_ORDER[i],
    label: JOINT_LABELS[i],
    lower: Number(j.limit.lower),
    upper: Number(j.limit.upper),
  }));

  return {
    robot,
    tip,
    jointMeta,
    applyQ(q: number[]) {
      for (let i = 0; i < joints.length; i++) joints[i].setJointValue(q[i]);
    },
  };
}
