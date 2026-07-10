import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

type FrameCallback = (dt: number) => void;

/**
 * Owns the WebGL renderer, scene, camera, lights and the animation loop.
 * All robot-domain objects live inside `zUpRoot` (URDF is Z-up, three.js is
 * Y-up) — nothing robot-related is ever added to the scene directly.
 */
export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly zUpRoot: THREE.Group;

  private frameCbs = new Set<FrameCallback>();
  private raf = 0;
  private ro: ResizeObserver;
  private lastT = performance.now();
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);

    // Matched to --color-void / --color-hairline in index.css: the scene and the
    // console around it should read as one machine, not a widget on a page.
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070a);
    this.scene.fog = new THREE.Fog(0x05070a, 5, 13);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.01, 50);
    this.camera.position.set(1.8, 1.4, 1.8);

    // Frame the arm and the keypad together, with the arm's mid-span on the
    // horizon rather than the floor — the stage is wide and short, and the
    // stylus must clear the top edge at the fully-extended home pose.
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0.3, 0.55, 0.1);
    this.controls.enableDamping = true;
    this.controls.maxDistance = 8;
    this.controls.minDistance = 0.3;

    const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x33281c, 1.0);
    const dir = new THREE.DirectionalLight(0xffffff, 2.6);
    dir.position.set(2.5, 4, 2);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 12;
    dir.shadow.camera.left = -2.5;
    dir.shadow.camera.right = 2.5;
    dir.shadow.camera.top = 2.5;
    dir.shadow.camera.bottom = -2.5;
    const fill = new THREE.DirectionalLight(0x8fb0ff, 0.6);
    fill.position.set(-2, 1.5, -1.5);
    this.scene.add(hemi, dir, fill);

    const grid = new THREE.GridHelper(4, 40, 0x2c3947, 0x161d27);
    this.scene.add(grid);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.ShadowMaterial({ opacity: 0.35 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // The single URDF Z-up → three.js Y-up conversion in the whole app.
    this.zUpRoot = new THREE.Group();
    this.zUpRoot.rotation.x = -Math.PI / 2;
    this.zUpRoot.updateMatrixWorld(true);
    this.scene.add(this.zUpRoot);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();

    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const now = performance.now();
      // Clamp dt so a background-tab pause can't produce a giant step.
      const dt = Math.min((now - this.lastT) / 1000, 0.05);
      this.lastT = now;
      this.controls.update();
      for (const cb of this.frameCbs) cb(dt);
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  onFrame(cb: FrameCallback): () => void {
    this.frameCbs.add(cb);
    return () => this.frameCbs.delete(cb);
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
