import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SceneManager } from '../three/SceneManager';
import { loadArm } from '../three/loadRobot';
import { KeyPanel } from '../three/Panel';
import type { KeyState } from '../three/Panel';
import { TipTrail } from '../three/TipTrail';
import { useArmStore } from '../state/store';
import { motion } from '../state/controller';
import { pinRunner } from '../state/pinRunner';

const KEYS = [1, 2, 3, 4, 5, 6];

/** Mounts the three.js scene and bridges it to the zustand store:
 *  motion/PIN pipeline → store.q → robot joints (every frame)
 *  tip world position → store.tcp (10 Hz) + tip trail + key highlights */
export default function Viewport() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;
    const sm = new SceneManager(el);
    const store = useArmStore.getState();

    let offFrame: (() => void) | undefined;
    try {
      const arm = loadArm();
      sm.zUpRoot.add(arm.robot);
      const panel = new KeyPanel();
      sm.zUpRoot.add(panel.group);
      const trail = new TipTrail();
      sm.zUpRoot.add(trail.line);
      store.setJointMeta(arm.jointMeta);
      store.log('system', `URDF loaded — ${arm.jointMeta.length} joints, TCP frame "stylus_tip"`);
      store.log('system', 'Key panel placed from key.config.json (6 keys, top face z = 50 mm)');
      pinRunner.warmup(); // precompute IK key poses so the first PIN run has no hitch

      const tipWorld = new THREE.Vector3();
      const baseInv = new THREE.Matrix4().copy(sm.zUpRoot.matrixWorld).invert();
      let acc = 0.1; // publish telemetry immediately on first frame

      offFrame = sm.onFrame((dt) => {
        if (pinRunner.active) pinRunner.tick(dt);
        else motion.tick(dt);

        const st = useArmStore.getState();
        arm.applyQ(st.q);
        arm.robot.updateMatrixWorld(true);
        tipWorld.setFromMatrixPosition(arm.tip.matrixWorld).applyMatrix4(baseInv);
        trail.push(tipWorld);

        // Key highlights from PIN progress.
        const pp = st.pinProgress;
        const activeKey = pp.running ? pp.pin[pp.index] : -1;
        for (const d of KEYS) {
          const res = pp.results.find((r) => r.key === d);
          let state: KeyState = 'idle';
          if (res) state = res.ok ? 'touched' : 'fail';
          else if (d === activeKey) state = 'target';
          panel.setKeyState(d, state);
        }

        acc += dt;
        if (acc >= 0.1) {
          acc = 0;
          st.setTcp([tipWorld.x, tipWorld.y, tipWorld.z]);
        }
      });
    } catch (e) {
      store.log('system', `Failed to load URDF: ${String(e)}`, 'error');
    }

    return () => {
      offFrame?.();
      sm.dispose();
    };
  }, []);

  return <div ref={ref} className="h-full w-full" />;
}
