import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { EventBus } from './Events';

export type UpdateCallback = (dt: number, elapsed: number) => void;

/**
 * Core Three.js engine managing WebGLRenderer, CSS2DRenderer, Scene, resize, and main loop.
 */
export class Engine {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly labelRenderer: CSS2DRenderer;

  private container: HTMLElement;
  private bus: EventBus;
  private composer: EffectComposer | null = null;
  private lowQuality = false;
  private updateCallbacks = new Set<UpdateCallback>();
  private rafId: number | null = null;
  private clock = new THREE.Clock();
  private frameCount = 0;
  private fpsAccumTime = 0;

  constructor(container: HTMLElement, bus: EventBus) {
    this.container = container;
    this.bus = bus;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe6f2f8);
    this.scene.fog = new THREE.Fog(0xe6f2f8, 80, 240);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 500);
    this.camera.position.set(8, 6, 10);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(width, height);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0';
    this.labelRenderer.domElement.style.left = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(this.labelRenderer.domElement);

    this.setupGround();
    this.setupPostProcessing(width, height);
    window.addEventListener('resize', this.handleResize);
  }

  private setupPostProcessing(width: number, height: number): void {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.16, 0.4, 0.92);
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());
  }

  setLowQuality(low: boolean): void {
    this.lowQuality = low;
    this.renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !low;
  }

  private setupGround(): void {
    const groundGeo = new THREE.PlaneGeometry(300, 300);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xdbe7ee,
      roughness: 0.92,
      metalness: 0.02,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'ground-plane';
    this.scene.add(ground);

    const grid = new THREE.GridHelper(120, 60, 0x9fb3c8, 0xcbd9e6);
    grid.position.y = 0.01;
    grid.name = 'ground-grid';
    this.scene.add(grid);
  }

  onUpdate(cb: UpdateCallback): () => void {
    this.updateCallbacks.add(cb);
    return () => this.updateCallbacks.delete(cb);
  }

  start(): void {
    if (this.rafId !== null) return;
    this.clock.start();
    const tick = (): void => {
      this.rafId = requestAnimationFrame(tick);
      const dt = Math.min(this.clock.getDelta(), 0.1);
      const elapsed = this.clock.elapsedTime;

      for (const cb of this.updateCallbacks) {
        cb(dt, elapsed);
      }

      if (!this.lowQuality && this.composer) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
      this.labelRenderer.render(this.scene, this.camera);

      this.frameCount += 1;
      this.fpsAccumTime += dt;
      if (this.fpsAccumTime >= 0.25) {
        const fps = Math.round(this.frameCount / this.fpsAccumTime);
        const frameTimeMs = Number(((this.fpsAccumTime / this.frameCount) * 1000).toFixed(1));
        this.bus.emit('engine:fps', {
          fps,
          frameTimeMs,
          drawCalls: this.renderer.info.render.calls,
          triangles: this.renderer.info.render.triangles,
        });
        this.frameCount = 0;
        this.fpsAccumTime = 0;
      }
    };
    tick();
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private handleResize = (): void => {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer?.setSize(width, height);
    this.labelRenderer.setSize(width, height);
  };

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
  }
}
