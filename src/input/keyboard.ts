import type { Vec3 } from '../core/math';
import { motion, JOG_GEARS } from '../state/controller';
import { pinRunner } from '../state/pinRunner';
import { useArmStore } from '../state/store';

// Letter keys jog individual joints (hold to jog). key → [joint index, sign]
const JOG_KEYS: Record<string, [number, number]> = {
  a: [0, +1], d: [0, -1], // J1 base yaw
  w: [1, +1], s: [1, -1], // J2 shoulder
  q: [2, +1], e: [2, -1], // J3 elbow
  z: [3, +1], x: [3, -1], // J4 forearm roll
  r: [4, +1], f: [4, -1], // J5 wrist pitch
  t: [5, +1], g: [5, -1], // J6 tool roll
  y: [6, +1], h: [6, -1], // J7 stylus pitch
};

// Arrow / Page keys jog the tip in the base frame (resolved-rate IK).
const CART_KEYS: Record<string, { dir: Vec3; id: string }> = {
  arrowup: { dir: [1, 0, 0], id: '+x' },
  arrowdown: { dir: [-1, 0, 0], id: '-x' },
  arrowleft: { dir: [0, 1, 0], id: '+y' },
  arrowright: { dir: [0, -1, 0], id: '-y' },
  pageup: { dir: [0, 0, 1], id: '+z' },
  pagedown: { dir: [0, 0, -1], id: '-z' },
};

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t) return false;
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable === true;
}

/** Attach keyboard jog controls to the window. Returns a teardown fn. */
export function installKeyboard(): () => void {
  const down = (e: KeyboardEvent) => {
    if (isTyping(e.target)) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      pinRunner.abort(); // no-op if no PIN running
      motion.dispatch({ type: 'stop', source: 'keyboard' });
      return;
    }
    if (k === '0') {
      motion.dispatch({ type: 'home', source: 'keyboard' });
      e.preventDefault();
      return;
    }
    if (k === '[' || k === ']') {
      const st = useArmStore.getState();
      const next = Math.max(0, Math.min(JOG_GEARS.length - 1, st.gear + (k === ']' ? 1 : -1)));
      if (next !== st.gear) {
        st.setGear(next);
        st.log('keyboard', `gear → ${JOG_GEARS[next].label} (${JOG_GEARS[next].mult}×)`);
      }
      e.preventDefault();
      return;
    }
    const map = JOG_KEYS[k];
    if (map) {
      if (!e.repeat) motion.beginJog(map[0], map[1], 'keyboard');
      e.preventDefault();
      return;
    }
    const cart = CART_KEYS[k];
    if (cart) {
      if (!e.repeat) motion.beginCartJog(cart.id, cart.dir, 'keyboard');
      e.preventDefault();
    }
  };
  const up = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    const map = JOG_KEYS[k];
    if (map) motion.endJog(map[0]);
    const cart = CART_KEYS[k];
    if (cart) motion.endCartJog(cart.id);
  };
  // Releasing focus (alt-tab, click-away) must not leave anything jogging forever.
  const stopAll = () => motion.releaseAll();

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', stopAll);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', stopAll);
  };
}
