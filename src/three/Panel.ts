import * as THREE from 'three';
import keyConfig from '../assets/key.config.json';

export type KeyState = 'idle' | 'target' | 'touched' | 'fail';

const KEY_SIZE = 0.042;
const KEY_HEIGHT = 0.012;

// Mirrors the console palette: flare = armed, ok = touched, alarm = missed.
const STATE_COLORS: Record<KeyState, number> = {
  idle: 0x46536b,
  target: 0xffa519,
  touched: 0x46d67f,
  fail: 0xff4257,
};

export const KEY_POSITIONS: Record<number, [number, number, number]> = Object.fromEntries(
  Object.entries(keyConfig.keys).map(([k, p]) => [Number(k), [p.x, p.y, p.z]]),
) as Record<number, [number, number, number]>;

function digitTexture(digit: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(digit, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Visual 6-key test panel, built in the arm's BASE FRAME (Z-up) from
 * key.config.json — add `group` to the SceneManager's zUpRoot so the
 * coordinates match the URDF world exactly. Each key's TOP FACE sits at the
 * configured z (0.05 m): that plane is what the stylus must touch.
 */
export class KeyPanel {
  readonly group = new THREE.Group();
  private capMats = new Map<number, THREE.MeshStandardMaterial[]>();

  constructor() {
    const entries = Object.entries(KEY_POSITIONS).map(
      ([k, p]) => [Number(k), p] as [number, [number, number, number]],
    );
    const xs = entries.map(([, p]) => p[0]);
    const ys = entries.map(([, p]) => p[1]);
    const zTop = entries[0][1][2];

    // Base plate under the keys.
    const margin = 0.045;
    const w = Math.max(...xs) - Math.min(...xs) + 2 * margin;
    const h = Math.max(...ys) - Math.min(...ys) + 2 * margin;
    const plateT = 0.03;
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, plateT),
      new THREE.MeshStandardMaterial({ color: 0x1c2536, roughness: 0.8 }),
    );
    plate.position.set(
      (Math.min(...xs) + Math.max(...xs)) / 2,
      (Math.min(...ys) + Math.max(...ys)) / 2,
      zTop - KEY_HEIGHT - plateT / 2,
    );
    plate.castShadow = true;
    this.group.add(plate);

    for (const [key, [x, y, z]] of entries) {
      const side = new THREE.MeshStandardMaterial({
        color: STATE_COLORS.idle,
        roughness: 0.5,
        metalness: 0.1,
      });
      const top = new THREE.MeshStandardMaterial({
        map: digitTexture(String(key)),
        roughness: 0.45,
      });
      // BoxGeometry material order: +x, -x, +y, -y, +z, -z — top face (+z) gets the digit.
      const mats = [side, side, side, side, top, side];
      const cap = new THREE.Mesh(new THREE.BoxGeometry(KEY_SIZE, KEY_SIZE, KEY_HEIGHT), mats);
      cap.position.set(x, y, z - KEY_HEIGHT / 2);
      cap.castShadow = true;
      this.group.add(cap);
      this.capMats.set(key, [side, top]);
    }
  }

  setKeyState(key: number, state: KeyState) {
    const mats = this.capMats.get(key);
    if (!mats) return;
    const [side, top] = mats;
    side.color.setHex(STATE_COLORS[state]);
    top.color.setHex(state === 'idle' ? 0xffffff : STATE_COLORS[state]);
  }

  resetKeys() {
    for (const key of this.capMats.keys()) this.setKeyState(key, 'idle');
  }
}
