import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FloorWalkData } from './HospitalIndex';

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

const PLAYER_RADIUS = 0.35;
const EYE_HEIGHT = 1.65;
const WALK_SPEED = 4.6;

/**
 * Manages OrbitControls (Dollhouse / Exterior / Floor framing), smooth fly-to tweens,
 * and toggleable floor-wide first-person Walk Mode with doorway-aware wall collision.
 */
export class CameraRig {
  public readonly controls: OrbitControls;
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;

  private tween: ActiveTween | null = null;
  private walkMode = false;
  private floorWalk: FloorWalkData | null = null;
  private walkTarget: THREE.Vector3 | null = null;
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
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.minDistance = 1.4;
    this.controls.maxDistance = 150;
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

  glideWalkTo(x: number, z: number): void {
    if (!this.walkMode) return;
    this.walkTarget = new THREE.Vector3(x, (this.floorWalk?.floorY ?? 0) + EYE_HEIGHT, z);
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
    this.flyToOrbit(new THREE.Vector3(6, 7, 0), new THREE.Vector3(60, 44, 64), 0.7);
  }

  flyToFloor(floorY: number): void {
    this.exitWalkMode();
    const target = new THREE.Vector3(4, floorY + 1.2, 0);
    const camPos = new THREE.Vector3(46, floorY + 34, 50);
    this.flyToOrbit(target, camPos, 0.65);
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

  flyToRoomDollhouse(center: THREE.Vector3, floorY: number): void {
    this.exitWalkMode();
    const target = new THREE.Vector3(center.x, floorY + 1.0, center.z);
    const camPos = new THREE.Vector3(center.x + 5.2, floorY + 5.4, center.z + 6.2);
    this.flyToOrbit(target, camPos, 0.7);
  }

  faceTarget(pos: THREE.Vector3, lookAt: THREE.Vector3): void {
    if (this.walkMode) {
      this.camera.position.set(pos.x, (this.floorWalk?.floorY ?? 0) + EYE_HEIGHT, pos.z);
      this.camera.lookAt(lookAt);
      const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
      this.yaw = euler.y;
      this.pitch = THREE.MathUtils.clamp(euler.x, -1.15, 1.15);
      return;
    }
    this.flyToOrbit(lookAt, pos, 0.55);
  }

  enterWalkMode(floorWalk: FloorWalkData, startPos: THREE.Vector3, lookAt: THREE.Vector3): void {
    this.tween = null;
    this.walkMode = true;
    this.floorWalk = floorWalk;
    this.controls.enabled = false;
    this.camera.position.set(startPos.x, floorWalk.floorY + EYE_HEIGHT, startPos.z);
    this.camera.lookAt(lookAt);

    const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = euler.y;
    this.pitch = THREE.MathUtils.clamp(euler.x, -1.15, 1.15);
  }

  exitWalkMode(): void {
    if (!this.walkMode) return;
    this.walkMode = false;
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

    const wp = tw.waypoints[0];
    this.camera.position.lerpVectors(tw.startPos, wp.pos, t);
    const look = new THREE.Vector3().lerpVectors(tw.startLook, wp.lookAt, t);
    this.camera.lookAt(look);
    this.controls.target.copy(look);

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
      this.walkTarget = null;
      const fwdVec = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const rightVec = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const move = new THREE.Vector3()
        .addScaledVector(fwdVec, forward)
        .addScaledVector(rightVec, strafe);
      if (move.lengthSq() > 1) move.normalize();
      move.multiplyScalar(WALK_SPEED * dt);

      const curX = this.camera.position.x;
      const curZ = this.camera.position.z;
      if (this.canWalkTo(curX, curZ, curX + move.x, curZ)) {
        this.camera.position.x += move.x;
      }
      if (this.canWalkTo(this.camera.position.x, curZ, this.camera.position.x, curZ + move.z)) {
        this.camera.position.z += move.z;
      }
    } else if (this.walkTarget) {
      const dx = this.walkTarget.x - this.camera.position.x;
      const dz = this.walkTarget.z - this.camera.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.15) {
        this.walkTarget = null;
      } else {
        const step = Math.min(dist, WALK_SPEED * 1.15 * dt);
        const mx = (dx / dist) * step;
        const mz = (dz / dist) * step;
        const curX = this.camera.position.x;
        const curZ = this.camera.position.z;
        let moved = false;
        if (this.canWalkTo(curX, curZ, curX + mx, curZ)) {
          this.camera.position.x += mx;
          moved = true;
        }
        if (this.canWalkTo(this.camera.position.x, curZ, this.camera.position.x, curZ + mz)) {
          this.camera.position.z += mz;
          moved = true;
        }
        if (!moved) this.walkTarget = null;
      }
    }

    if (this.floorWalk) {
      this.camera.position.y = this.floorWalk.floorY + EYE_HEIGHT;
    }
  }

  private canWalkTo(fromX: number, fromZ: number, toX: number, toZ: number): boolean {
    if (!this.floorWalk) return true;
    const fromRoom = this.floorWalk.rooms.find(
      (r) => fromX >= r.minX && fromX <= r.maxX && fromZ >= r.minZ && fromZ <= r.maxZ,
    );
    const toRoom = this.floorWalk.rooms.find(
      (r) =>
        toX >= r.minX + PLAYER_RADIUS * 0.4 &&
        toX <= r.maxX - PLAYER_RADIUS * 0.4 &&
        toZ >= r.minZ + PLAYER_RADIUS * 0.4 &&
        toZ <= r.maxZ - PLAYER_RADIUS * 0.4,
    );

    // Allow staying inside the same room, or moving between corridors
    if (toRoom && fromRoom && (toRoom.id === fromRoom.id || (toRoom.isCorridor && fromRoom.isCorridor))) {
      return true;
    }

    // Allow crossing between rooms if near a declared doorway
    const nearDoor = this.floorWalk.doors.some(
      (d) => Math.hypot(toX - d.x, toZ - d.z) <= d.radius + 0.55,
    );
    return nearDoor;
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
