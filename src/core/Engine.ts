import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { EventBus } from './Events';

export type UpdateCallback = (dt: number, elapsed: number) => void;

const QUALITY_STORAGE_KEY = 'vh3d.quality';

function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function readSavedQuality(): 'low' | 'high' | null {
  try {
    const val = window.localStorage.getItem(QUALITY_STORAGE_KEY);
    return val === 'low' || val === 'high' ? val : null;
  } catch {
    return null;
  }
}

function writeSavedQuality(low: boolean): void {
  try {
    window.localStorage.setItem(QUALITY_STORAGE_KEY, low ? 'low' : 'high');
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

function detectLowEndDevice(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const lowMem = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
  const lowCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  const smallViewport = window.innerWidth < 768;
  return isTouchDevice() || lowMem || lowCores || smallViewport;
}

/**
 * Core Three.js engine managing WebGLRenderer, CSS2DRenderer, post-processing,
 * auto-quality detection, tab-visibility pausing, resize, and main loop.
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
  private manualQualityOverride = false;
  private updateCallbacks = new Set<UpdateCallback>();
  private rafId: number | null = null;
  private running = false;
  private clock = new THREE.Clock();
  private frameCount = 0;
  private fpsAccumTime = 0;

  private startupTime = 0;
  private startupFrames = 0;
  private startupChecked = false;

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

    try {
      const testCanvas = document.createElement('canvas');
      const hasGl = Boolean(
        window.WebGLRenderingContext &&
          (testCanvas.getContext('webgl2') || testCanvas.getContext('webgl')),
      );
      if (!hasGl) {
        throw new Error('WebGL is not supported or is disabled in this browser.');
      }
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Unable to initialize 3D WebGL renderer: ${msg}`);
    }

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

    const saved = readSavedQuality();
    if (saved) {
      this.manualQualityOverride = true;
      this.setLowQuality(saved === 'low', false);
    } else {
      this.setLowQuality(detectLowEndDevice(), false);
    }

    window.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private getTargetPixelRatio(low: boolean): number {
    if (low) return 1;
    const cap = isTouchDevice() ? 1.5 : 2;
    return Math.min(window.devicePixelRatio || 1, cap);
  }

  private setupPostProcessing(width: number, height: number): void {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.16, 0.4, 0.92);
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());
  }

  isLowQuality(): boolean {
    return this.lowQuality;
  }

  setLowQuality(low: boolean, persist = true): void {
    this.lowQuality = low;
    if (persist) {
      this.manualQualityOverride = true;
      writeSavedQuality(low);
    }

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const dpr = this.getTargetPixelRatio(low);

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(width, height);
    }

    this.renderer.shadowMap.enabled = !low;
    this.renderer.shadowMap.needsUpdate = true;

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.DirectionalLight) {
        obj.castShadow = !low;
      }
      if (obj instanceof THREE.Mesh) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m) m.needsUpdate = true;
        }
      }
    });

    this.bus.emit('engine:qualityChanged', { low });
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
    this.running = true;
    this.bus.emit('engine:qualityChanged', { low: this.lowQuality });
    if (this.rafId !== null || document.hidden) return;
    this.clock.start();
    this.clock.getDelta();
    this.scheduleLoop();
  }

  private scheduleLoop(): void {
    const tick = (): void => {
      this.rafId = requestAnimationFrame(tick);
      const dt = Math.min(this.clock.getDelta(), 0.1);
      const elapsed = this.clock.elapsedTime;

      for (const cb of this.updateCallbacks) {
        cb(dt, elapsed);
      }

      // Distance-based CSS2D label culling on scene roots
      for (const child of this.scene.children) {
        if (typeof child.userData?.updateLabels === 'function') {
          child.userData.updateLabels(this.camera.position);
        }
      }

      if (!this.lowQuality && this.composer) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
      this.labelRenderer.render(this.scene, this.camera);

      this.frameCount += 1;
      this.fpsAccumTime += dt;
      if (!this.startupChecked && !this.lowQuality && !this.manualQualityOverride) {
        this.startupTime += dt;
        this.startupFrames += 1;
        if (this.startupTime >= 2.0) {
          this.startupChecked = true;
          const avgFps = this.startupFrames / this.startupTime;
          if (avgFps < 30) {
            this.setLowQuality(true, false);
          }
        }
      }

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
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    } else if (this.running && this.rafId === null) {
      this.clock.getDelta();
      this.scheduleLoop();
    }
  };

  private handleResize = (): void => {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const dpr = this.getTargetPixelRatio(this.lowQuality);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(width, height);
    }
    this.labelRenderer.setSize(width, height);
  };

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.renderer.dispose();
  }
}
