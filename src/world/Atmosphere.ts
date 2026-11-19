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
}

/**
 * Adds living atmosphere: instanced low-poly corridor NPCs and an animated elevator cab.
 */
export class Atmosphere {
  public readonly group = new THREE.Group();
  private npcMesh: THREE.InstancedMesh;
  private walkers: NpcWalker[] = [];
  private dummy = new THREE.Object3D();

  private liftCab: THREE.Mesh;
  private liftTime = 0;
  private maxLiftY = 15.2;

  constructor(data: HospitalData) {
    this.group.name = 'hospital-atmosphere';
    const [ox, oz] = data.building.originOffset;
    this.group.position.set(ox, 0, oz);
    this.maxLiftY = (data.floors.length - 1) * data.building.floorHeight;

    // Instanced low-poly corridor silhouettes
    const npcGeo = new THREE.CapsuleGeometry(0.22, 1.15, 4, 8);
    const npcMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.7,
      metalness: 0.1,
    });

    const floorLevels = [0, 1, 2, 3];
    for (const lvl of floorLevels) {
      const fy = lvl * data.building.floorHeight;
      this.walkers.push(
        { floorY: fy, xMin: 4, xMax: 52, z: 23.6, x: 10 + lvl * 8, dir: 1, speed: 1.3 },
        { floorY: fy, xMin: 6, xMax: 50, z: 24.4, x: 42 - lvl * 7, dir: -1, speed: 1.15 },
        { floorY: fy, xMin: 4, xMax: 52, z: 44.0, x: 18 + lvl * 6, dir: 1, speed: 1.25 },
      );
    }

    this.npcMesh = new THREE.InstancedMesh(npcGeo, npcMat, this.walkers.length);
    this.npcMesh.castShadow = true;
    this.group.add(this.npcMesh);

    // Animated elevator cab inside North Lifts core (x: 20.2, z: 17.6)
    this.liftCab = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 2.4, 1.8),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.75,
      }),
    );
    this.liftCab.position.set(20.2, 1.2, 17.6);
    this.group.add(this.liftCab);
  }

  update(dt: number): void {
    for (let i = 0; i < this.walkers.length; i += 1) {
      const w = this.walkers[i];
      w.x += w.dir * w.speed * dt;
      if (w.x >= w.xMax) {
        w.x = w.xMax;
        w.dir = -1;
      } else if (w.x <= w.xMin) {
        w.x = w.xMin;
        w.dir = 1;
      }
      this.dummy.position.set(w.x, w.floorY + 0.85, w.z);
      this.dummy.rotation.y = w.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      this.dummy.updateMatrix();
      this.npcMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.npcMesh.instanceMatrix.needsUpdate = true;

    // Smooth oscillating elevator travel between L1 and L5
    this.liftTime += dt * 0.35;
    const t = (Math.sin(this.liftTime) + 1) / 2;
    this.liftCab.position.y = 1.25 + t * this.maxLiftY;
  }
}
