import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface WalkBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  floorY: number;
}

interface TweenWaypoint {
  pos: THREE.Vector3;
  lookAt: THREE.Vector3;
}

interface ActiveTween {
  waypoints: TweenWaypoint[];
  duration: number;
  elapsed: number;
  startPos: THREE.Vector3;
  startLook: THREE.Vector3;
  onComplete?: () => void;
}

const PLAYER_RADIUS = 0.45;
const EYE_HEIGHT = 1.65;
const WALK_SPEED = 4.2;

/**
 * Manages OrbitControls, smooth fly-to tweens (including through-door entry),
 * and first-person walk mode with AABB wall collision.
 */
export class CameraRig {
  public readonly controls: OrbitControls;
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;

  private tween: ActiveTween | null = null;
  private walkMode = false;
  private walkBounds: WalkBounds | null = null;
  private yaw = 0;
  private pitch = 0;
  private keys = new Set<string>();
  private joystickInput = { x: 0, y: 0 };
  private isLooking = false;
  private lastPointer = { x: 0, y: 0 };

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 160;
    this.controls.target.set(6, 7, 0);
    this.controls.update();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  isWalking(): boolean {
    return this.walkMode;
  }

  setWalkInput(x: number, y: number): void {
    this.joystickInput.x = x;
    this.joystickInput.y = y;
  }

  getYaw(): number {
    if (this.walkMode) return this.yaw;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return Math.atan2(-dir.x, -dir.z);
  }

  setTopDownPreset(): void {
    this.exitWalkMode();
    this.tween = null;
    this.controls.enabled = true;
    this.controls.target.set(6, 0, 0);
    this.camera.position.set(6, 95, 0.01);
    this.controls.update();
  }

  setOrbitPreset(): void {
    this.exitWalkMode();
    this.flyToOrbit(new THREE.Vector3(6, 7, 0), new THREE.Vector3(60, 44, 64), 0.75);
  }

  flyToOrbit(target: THREE.Vector3, camPos: THREE.Vector3, duration = 0.65): void {
    this.exitWalkMode();
    this.controls.enabled = false;
    this.tween = {
      waypoints: [{ pos: camPos.clone(), lookAt: target.clone() }],
      duration,
      elapsed: 0,
      startPos: this.camera.position.clone(),
      startLook: this.controls.target.clone(),
      onComplete: () => {
        this.controls.target.copy(target);
        this.controls.enabled = true;
        this.controls.update();
      },
    };
  }

  flyThroughDoor(
    outside: THREE.Vector3,
    inside: THREE.Vector3,
    lookAt: THREE.Vector3,
    bounds: WalkBounds,
  ): void {
    this.walkMode = false;
    this.controls.enabled = false;
    this.tween = {
      waypoints: [
        { pos: outside.clone(), lookAt: inside.clone() },
        { pos: inside.clone(), lookAt: lookAt.clone() },
      ],
      duration: 1.05,
      elapsed: 0,
      startPos: this.camera.position.clone(),
      startLook: this.controls.target.clone(),
      onComplete: () => {
        this.enterWalkMode(bounds, lookAt);
      },
    };
  }

  private enterWalkMode(bounds: WalkBounds, lookAt: THREE.Vector3): void {
    this.walkMode = true;
    this.walkBounds = bounds;
    this.controls.enabled = false;
    this.camera.lookAt(lookAt);

    const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = euler.y;
    this.pitch = THREE.MathUtils.clamp(euler.x, -1.15, 1.15);
    this.clampPositionToBounds();
  }

  faceInWalkMode(pos: THREE.Vector3, lookAt: THREE.Vector3): void {
    if (!this.walkMode || !this.walkBounds) return;
    this.camera.position.set(pos.x, this.walkBounds.floorY + EYE_HEIGHT, pos.z);
    this.clampPositionToBounds();
    this.camera.lookAt(lookAt);
    const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = euler.y;
    this.pitch = THREE.MathUtils.clamp(euler.x, -1.15, 1.15);
  }

  exitWalkMode(): void {
    if (!this.walkMode) return;
    this.walkMode = false;
    this.walkBounds = null;
    this.isLooking = false;
    this.keys.clear();
    this.joystickInput = { x: 0, y: 0 };

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.controls.target.copy(this.camera.position).addScaledVector(dir, 4);
    this.controls.enabled = true;
    this.controls.update();
  }

  update(dt = 0.016): void {
    if (this.tween) {
      this.updateTween(dt);
      return;
    }
    if (this.walkMode) {
      this.updateWalk(dt);
      return;
    }
    this.controls.update();
  }

  private updateTween(dt: number): void {
    const tw = this.tween;
    if (!tw) return;

    tw.elapsed += dt;
    const rawT = Math.min(1, tw.elapsed / tw.duration);
    const t = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

    if (tw.waypoints.length === 1) {
      const wp = tw.waypoints[0];
      this.camera.position.lerpVectors(tw.startPos, wp.pos, t);
      const look = new THREE.Vector3().lerpVectors(tw.startLook, wp.lookAt, t);
      this.camera.lookAt(look);
      this.controls.target.copy(look);
    } else {
      const [wp0, wp1] = tw.waypoints;
      if (t < 0.55) {
        const localT = t / 0.55;
        this.camera.position.lerpVectors(tw.startPos, wp0.pos, localT);
        const look = new THREE.Vector3().lerpVectors(tw.startLook, wp0.lookAt, localT);
        this.camera.lookAt(look);
      } else {
        const localT = (t - 0.55) / 0.45;
        this.camera.position.lerpVectors(wp0.pos, wp1.pos, localT);
        const look = new THREE.Vector3().lerpVectors(wp0.lookAt, wp1.lookAt, localT);
        this.camera.lookAt(look);
      }
    }

    if (rawT >= 1) {
      const cb = tw.onComplete;
      this.tween = null;
      cb?.();
    }
  }

  private updateWalk(dt: number): void {
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

    let forward = 0;
    let strafe = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) forward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) forward -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) strafe += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) strafe -= 1;

    forward += this.joystickInput.y;
    strafe += this.joystickInput.x;

    if (Math.abs(forward) > 0.01 || Math.abs(strafe) > 0.01) {
      const fwdVec = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const rightVec = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const move = new THREE.Vector3()
        .addScaledVector(fwdVec, forward)
        .addScaledVector(rightVec, strafe);
      if (move.lengthSq() > 1) move.normalize();
      this.camera.position.addScaledVector(move, WALK_SPEED * dt);
    }

    this.clampPositionToBounds();
  }

  private clampPositionToBounds(): void {
    if (!this.walkBounds) return;
    const { minX, maxX, minZ, maxZ, floorY } = this.walkBounds;
    const padX = Math.min(PLAYER_RADIUS, (maxX - minX) * 0.3);
    const padZ = Math.min(PLAYER_RADIUS, (maxZ - minZ) * 0.3);
    this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, minX + padX, maxX - padX);
    this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z, minZ + padZ, maxZ - padZ);
    this.camera.position.y = floorY + EYE_HEIGHT;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.walkMode) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.walkMode) return;
    this.isLooking = true;
    this.lastPointer = { x: e.clientX, y: e.clientY };
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.walkMode || !this.isLooking) return;
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.yaw -= dx * 0.0045;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0045, -1.15, 1.15);
  };

  private onPointerUp = (): void => {
    this.isLooking = false;
  };

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.controls.dispose();
  }
}
