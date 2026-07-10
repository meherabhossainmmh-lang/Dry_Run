import * as THREE from 'three';

/**
 * A fading polyline that traces the stylus tip through the base frame. Add
 * `line` to the zUpRoot and call push() with the tip position; call update(dt)
 * to fade/remove points older than ~2.5 seconds.
 */
export class TipTrail {
  readonly line: THREE.Line;
  private points: { x: number; y: number; z: number; age: number }[] = [];
  private maxAge = 2.5; // seconds
  private maxPoints = 500;
  private last = new THREE.Vector3(Infinity, Infinity, Infinity);

  constructor() {
    const geo = new THREE.BufferGeometry();
    // Start with an empty position attribute
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    
    const mat = new THREE.LineBasicMaterial({ 
      color: 0x3fe0c8, 
      transparent: true, 
      opacity: 0.7 
    });
    this.line = new THREE.Line(geo, mat);
    this.line.frustumCulled = false;
  }

  push(p: THREE.Vector3) {
    // Only add points if we've moved significantly
    if (p.distanceToSquared(this.last) < 2e-6) return; 
    this.last.copy(p);

    this.points.push({ x: p.x, y: p.y, z: p.z, age: 0 });

    // Hard limit on point count
    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }

    this.updateGeometry();
  }

  update(dt: number) {
    if (this.points.length === 0) return;

    let changed = false;
    for (const p of this.points) {
      p.age += dt;
    }

    // Remove points older than maxAge
    while (this.points.length > 0 && this.points[0].age > this.maxAge) {
      this.points.shift();
      changed = true;
    }

    if (changed) {
      this.updateGeometry();
    }
  }

  private updateGeometry() {
    const geo = this.line.geometry as THREE.BufferGeometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;

    // Check if we need to resize the buffer
    if (posAttr.count !== this.points.length) {
      const newArray = new Float32Array(this.points.length * 3);
      for (let i = 0; i < this.points.length; i++) {
        const p = this.points[i];
        newArray[i * 3] = p.x;
        newArray[i * 3 + 1] = p.y;
        newArray[i * 3 + 2] = p.z;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(newArray, 3));
    } else {
      // Just update existing values
      const array = posAttr.array as Float32Array;
      for (let i = 0; i < this.points.length; i++) {
        const p = this.points[i];
        array[i * 3] = p.x;
        array[i * 3 + 1] = p.y;
        array[i * 3 + 2] = p.z;
      }
      posAttr.needsUpdate = true;
    }

    geo.setDrawRange(0, this.points.length);
    geo.computeBoundingSphere();
  }

  clear() {
    this.points = [];
    this.last.set(Infinity, Infinity, Infinity);
    this.updateGeometry();
  }
}
