import * as THREE from 'three';

/**
 * A fading polyline that traces the stylus tip through the base frame. Add
 * `line` to the zUpRoot and call push() each frame with the tip's base-frame
 * position; points are only added once the tip has moved a couple millimeters,
 * so an idle arm doesn't pile up a blob.
 */
export class TipTrail {
  readonly line: THREE.Line;
  private positions: Float32Array;
  private max: number;
  private count = 0;
  private last = new THREE.Vector3(Infinity, Infinity, Infinity);

  constructor(max = 260) {
    this.max = max;
    this.positions = new Float32Array(max * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setDrawRange(0, 0);
    // --color-signal: the trail is telemetry, like the numbers in the HUD.
    const mat = new THREE.LineBasicMaterial({ color: 0x3fe0c8, transparent: true, opacity: 0.7 });
    this.line = new THREE.Line(geo, mat);
    this.line.frustumCulled = false;
  }

  push(p: THREE.Vector3) {
    if (p.distanceToSquared(this.last) < 2e-6) return; // < ~1.4 mm — skip
    this.last.copy(p);
    if (this.count < this.max) {
      this.positions.set([p.x, p.y, p.z], this.count * 3);
      this.count++;
    } else {
      this.positions.copyWithin(0, 3); // drop oldest point
      this.positions.set([p.x, p.y, p.z], (this.max - 1) * 3);
    }
    const geo = this.line.geometry as THREE.BufferGeometry;
    geo.setDrawRange(0, this.count);
    geo.attributes.position.needsUpdate = true;
    geo.computeBoundingSphere();
  }

  clear() {
    this.count = 0;
    this.last.set(Infinity, Infinity, Infinity);
    (this.line.geometry as THREE.BufferGeometry).setDrawRange(0, 0);
  }
}
