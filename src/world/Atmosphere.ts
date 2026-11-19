import * as THREE from 'three';
import { HospitalData } from '../core/HospitalTypes';

interface NpcWalker {
  floorY: number;
  xMin: number;
  xMax: number;
  z: number;
  x: number;
  dir: 1 | -1;
  speed: number;
  phase: number;
}

/**
 * Living hospital atmosphere: colorful bobbing corridor staff/visitors,
 * dual animated elevators, cruising ambulance with pulsing beacon, drifting clouds,
 * and a floor click-to-move ripple ring.
 */
export class Atmosphere {
  public readonly group = new THREE.Group();
  private npcMesh: THREE.InstancedMesh;
  private walkers: NpcWalker[] = [];
  private dummy = new THREE.Object3D();

  private liftCabA: THREE.Mesh;
  private liftCabB: THREE.Mesh;
  private liftTime = 0;
  private maxLiftY = 15.2;

  private ambulance = new THREE.Group();
  private beaconMat: THREE.MeshStandardMaterial;
  private ambX = -10;

  private clouds: THREE.Group[] = [];
  private walkRing: THREE.Mesh;
  private walkRingTimer = 0;
  private originOffset: number[];

  constructor(data: HospitalData) {
    this.group.name = 'hospital-atmosphere';
    this.originOffset = data.building.originOffset;
    const [ox, oz] = this.originOffset;
    this.group.position.set(ox, 0, oz);
    this.maxLiftY = (data.floors.length - 1) * data.building.floorHeight;

    // 1. Colorful instanced corridor staff & visitors (scrubs, white coats, visitors)
    const npcGeo = new THREE.CapsuleGeometry(0.22, 1.15, 4, 8);
    const npcMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.08 });

    const palette = [0x0f768a, 0x0284c7, 0xf8fafc, 0xf97316, 0xec4899, 0x10b981, 0x6366f1];
    for (let lvl = 0; lvl < 4; lvl += 1) {
      const fy = lvl * data.building.floorHeight;
      this.walkers.push(
        { floorY: fy, xMin: 4, xMax: 52, z: 23.4, x: 8 + lvl * 9, dir: 1, speed: 1.4, phase: lvl },
        { floorY: fy, xMin: 6, xMax: 50, z: 24.6, x: 46 - lvl * 8, dir: -1, speed: 1.25, phase: lvl + 2 },
        { floorY: fy, xMin: 4, xMax: 52, z: 43.8, x: 16 + lvl * 7, dir: 1, speed: 1.35, phase: lvl + 4 },
        { floorY: fy, xMin: 10, xMax: 48, z: 44.6, x: 38 - lvl * 5, dir: -1, speed: 1.15, phase: lvl + 1 },
      );
    }

    this.npcMesh = new THREE.InstancedMesh(npcGeo, npcMat, this.walkers.length);
    this.npcMesh.castShadow = true;
    const color = new THREE.Color();
    for (let i = 0; i < this.walkers.length; i += 1) {
      color.setHex(palette[i % palette.length]);
      this.npcMesh.setColorAt(i, color);
    }
    if (this.npcMesh.instanceColor) this.npcMesh.instanceColor.needsUpdate = true;
    this.group.add(this.npcMesh);

    // 2. Dual animated glass elevator cabs in North Core
    const liftMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.8,
    });
    this.liftCabA = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 1.8), liftMat);
    this.liftCabA.position.set(20.2, 1.2, 17.6);
    this.liftCabB = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 1.8), liftMat);
    this.liftCabB.position.set(23.0, 1.2, 17.6);
    this.group.add(this.liftCabA, this.liftCabB);

    // 3. Cruising Ambulance along South Entrance Driveway (z = 73.5)
    const ambBody = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 1.9, 1.9),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }),
    );
    ambBody.position.y = 1.2;
    const ambStripe = new THREE.Mesh(
      new THREE.BoxGeometry(4.44, 0.32, 1.94),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 }),
    );
    ambStripe.position.y = 1.05;
    const ambCab = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.35, 1.8),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3 }),
    );
    ambCab.position.set(2.5, 0.95, 0);
    this.beaconMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.2,
    });
    const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.9), this.beaconMat);
    beacon.position.set(1.6, 2.25, 0);
    this.ambulance.add(ambBody, ambStripe, ambCab, beacon);
    this.ambulance.position.set(this.ambX, 0, 73.5);
    this.group.add(this.ambulance);

    // 4. Soft drifting clouds in the sky
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      transparent: true,
      opacity: 0.85,
    });
    for (let c = 0; c < 5; c += 1) {
      const cg = new THREE.Group();
      for (let p = 0; p < 3; p += 1) {
        const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(3.2 - p * 0.5, 1), cloudMat);
        puff.position.set((p - 1) * 3.0, (p % 2) * 0.8, 0);
        puff.scale.set(1.4, 0.65, 1.0);
        cg.add(puff);
      }
      cg.position.set(-20 + c * 28, 42 + (c % 2) * 4, -18 + (c % 3) * 34);
      this.clouds.push(cg);
      this.group.add(cg);
    }

    // 5. Walk-mode click-to-move floor ripple ring
    this.walkRing = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.36, 24),
      new THREE.MeshBasicMaterial({ color: 0x0f768a, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    this.walkRing.rotation.x = -Math.PI / 2;
    this.walkRing.visible = false;
    this.group.add(this.walkRing);
  }

  showWalkMarker(worldPos: THREE.Vector3): void {
    const [ox, oz] = this.originOffset;
    this.walkRing.position.set(worldPos.x - ox, worldPos.y + 0.05, worldPos.z - oz);
    this.walkRing.scale.setScalar(0.6);
    this.walkRing.visible = true;
    this.walkRingTimer = 0.65;
  }

  update(dt: number): void {
    this.liftTime += dt;

    // Bobbing staff & visitors
    for (let i = 0; i < this.walkers.length; i += 1) {
      const w = this.walkers[i];
      w.x += w.dir * w.speed * dt;
      w.phase += dt * 7.5;
      if (w.x >= w.xMax) {
        w.x = w.xMax;
        w.dir = -1;
      } else if (w.x <= w.xMin) {
        w.x = w.xMin;
        w.dir = 1;
      }
      const bob = Math.abs(Math.sin(w.phase)) * 0.09;
      this.dummy.position.set(w.x, w.floorY + 0.85 + bob, w.z);
      this.dummy.rotation.y = w.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      this.dummy.updateMatrix();
      this.npcMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.npcMesh.instanceMatrix.needsUpdate = true;

    // Dual elevators
    const tA = (Math.sin(this.liftTime * 0.38) + 1) / 2;
    const tB = (Math.sin(this.liftTime * 0.38 + Math.PI) + 1) / 2;
    this.liftCabA.position.y = 1.25 + tA * this.maxLiftY;
    this.liftCabB.position.y = 1.25 + tB * this.maxLiftY;

    // Cruising ambulance + pulsing beacon
    this.ambX += dt * 5.2;
    if (this.ambX > 82) this.ambX = -14;
    this.ambulance.position.x = this.ambX;
    const flash = Math.sin(this.liftTime * 9) > 0;
    this.beaconMat.color.setHex(flash ? 0x38bdf8 : 0xef4444);
    this.beaconMat.emissive.setHex(flash ? 0x0284c7 : 0xdc2626);

    // Drifting clouds
    for (const cloud of this.clouds) {
      cloud.position.x += dt * 1.1;
      if (cloud.position.x > 105) cloud.position.x = -35;
    }

    // Floor click-to-move ring fade
    if (this.walkRingTimer > 0) {
      this.walkRingTimer -= dt;
      const s = 1 + (0.65 - this.walkRingTimer) * 1.4;
      this.walkRing.scale.setScalar(s);
      if (this.walkRingTimer <= 0) this.walkRing.visible = false;
    }
  }
}
