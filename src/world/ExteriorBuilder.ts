import * as THREE from 'three';
import { FloorSpec, HospitalData, RoomSpec } from '../core/HospitalTypes';

const metalMat = new THREE.MeshStandardMaterial({
  color: 0x94a3b8,
  roughness: 0.35,
  metalness: 0.65,
});

const stairMat = new THREE.MeshStandardMaterial({
  color: 0xcbd5e1,
  roughness: 0.75,
  metalness: 0.1,
});

const facadeFinMat = new THREE.MeshStandardMaterial({
  color: 0xe2e8f0,
  roughness: 0.55,
  metalness: 0.15,
});

const canopyMat = new THREE.MeshStandardMaterial({
  color: 0x0f768a,
  roughness: 0.3,
  metalness: 0.4,
});

const foliageMat = new THREE.MeshStandardMaterial({
  color: 0x22c55e,
  roughness: 0.85,
  metalness: 0.02,
});

const trunkMat = new THREE.MeshStandardMaterial({
  color: 0x78350f,
  roughness: 0.9,
});

const roofMat = new THREE.MeshStandardMaterial({
  color: 0xdbe4ee,
  roughness: 0.85,
  metalness: 0.05,
});

/**
 * Adds vertical circulation (lifts + stairs) per floor, courtyard landscaping,
 * exterior façade fins/canopy, and the L5 roof.
 */
export class ExteriorBuilder {
  static buildVerticalCirculation(floor: FloorSpec, floorGroup: THREE.Group, floorHeight: number): void {
    for (const room of floor.rooms) {
      if (room.type === 'lift-stair') {
        this.addLiftAndStairs(room, floorGroup, floorHeight);
      }
    }
  }

  private static addLiftAndStairs(room: RoomSpec, floorGroup: THREE.Group, floorHeight: number): void {
    const { x, z, w, d } = room.bounds;
    const core = new THREE.Group();
    core.name = `${room.id}.circulation-core`;

    if (w >= 8) {
      // Main North Core: 2 elevator shafts on the left, staircase on the right
      for (let i = 0; i < 2; i += 1) {
        const liftBox = new THREE.Mesh(new THREE.BoxGeometry(2.2, floorHeight - 0.1, 2.2), metalMat);
        liftBox.position.set(x + 2.2 + i * 2.8, (floorHeight - 0.1) / 2, z + 1.6);
        liftBox.castShadow = true;
        liftBox.receiveShadow = true;
        core.add(liftBox);
      }

      // Procedural staircase steps
      const stepCount = 12;
      const stepH = floorHeight / stepCount;
      const stepD = (d - 1.2) / stepCount;
      for (let s = 0; s < stepCount; s += 1) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(2.6, stepH, stepD + 0.04), stairMat);
        step.position.set(x + w - 2.2, s * stepH + stepH / 2, z + 0.6 + s * stepD);
        step.castShadow = true;
        step.receiveShadow = true;
        core.add(step);
      }
    } else {
      // Compact NICU connection shaft
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, floorHeight - 0.1, d * 0.6), metalMat);
      shaft.position.set(x + w / 2, (floorHeight - 0.1) / 2, z + d / 2);
      core.add(shaft);
    }

    floorGroup.add(core);
  }

  static buildCourtyard(l1Group: THREE.Group): void {
    const yard = new THREE.Group();
    yard.name = 'l1-courtyard-landscaping';

    // Central planter bed in North Courtyard (x: 18..32, z: 0..16)
    const planter = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.35, 10),
      new THREE.MeshStandardMaterial({ color: 0x86efac, roughness: 0.9 }),
    );
    planter.position.set(25, 0.18, 8);
    planter.receiveShadow = true;
    yard.add(planter);

    // Stylized trees
    const treePositions = [
      [23, 5],
      [27, 5],
      [25, 10.5],
    ];
    for (const [tx, tz] of treePositions) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.8, 8), trunkMat);
      trunk.position.set(tx, 1.1, tz);
      trunk.castShadow = true;
      yard.add(trunk);

      const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.25, 1), foliageMat);
      crown.position.set(tx, 2.6, tz);
      crown.castShadow = true;
      yard.add(crown);
    }

    // Colorful courtyard flower beds
    const flowerColors = [0xf43f5e, 0xf59e0b, 0xa855f7, 0xec4899];
    for (let i = 0; i < 8; i += 1) {
      const fx = 22 + (i % 4) * 2.0;
      const fz = i < 4 ? 3.8 : 12.2;
      const flower = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.32, 0),
        new THREE.MeshStandardMaterial({ color: flowerColors[i % flowerColors.length], roughness: 0.7 }),
      );
      flower.position.set(fx, 0.55, fz);
      yard.add(flower);
    }

    // Exterior landscaped lawn beds & South entrance driveway plaza
    const lawnMat = new THREE.MeshStandardMaterial({ color: 0x86efac, roughness: 0.92 });
    const plazaMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 });
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });

    const southLawnLeft = new THREE.Mesh(new THREE.BoxGeometry(24, 0.08, 9), lawnMat);
    southLawnLeft.position.set(10, 0.02, 65.5);
    const southLawnRight = new THREE.Mesh(new THREE.BoxGeometry(24, 0.08, 9), lawnMat);
    southLawnRight.position.set(52, 0.02, 65.5);
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(20, 0.09, 10), plazaMat);
    plaza.position.set(31, 0.03, 65.0);
    const driveway = new THREE.Mesh(new THREE.BoxGeometry(96, 0.05, 6.5), roadMat);
    driveway.position.set(34, 0.01, 73.5);
    yard.add(southLawnLeft, southLawnRight, plaza, driveway);

    // Perimeter trees along entrance plaza
    for (const [tx, tz] of [[18, 63], [44, 63], [6, 65], [56, 65], [-5, 30], [-5, 48]]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 2.2, 8), trunkMat);
      trunk.position.set(tx, 1.1, tz);
      trunk.castShadow = true;
      const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 1), foliageMat);
      crown.position.set(tx, 2.9, tz);
      crown.castShadow = true;
      yard.add(trunk, crown);
    }

    l1Group.add(yard);
  }

  static buildFacadeAndCanopy(root: THREE.Group, data: HospitalData): void {
    const totalH = data.floors.length * data.building.floorHeight;
    const facade = new THREE.Group();
    facade.name = 'exterior-facade';

    // South Entrance Canopy at Main Lobby (x: 24..38, z: 60)
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(12, 0.28, 3.6), canopyMat);
    canopy.position.set(31, 3.6, 61.8);
    canopy.castShadow = true;
    facade.add(canopy);

    // Glowing red Hospital Cross emblem on entrance canopy & rooftop
    const crossMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });
    for (const cy of [4.3, totalH + 1.8]) {
      const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.6, 0.2), crossMat);
      vBar.position.set(31, cy, cy < 10 ? 63.55 : 60.1);
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.2), crossMat);
      hBar.position.set(31, cy, cy < 10 ? 63.55 : 60.1);
      facade.add(vBar, hBar);
    }

    for (const px of [25.6, 36.4]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.6, 12), metalMat);
      pillar.position.set(px, 1.8, 63.2);
      pillar.castShadow = true;
      facade.add(pillar);
    }

    // Vertical architectural fins along South and West facades
    for (let x = 4; x <= 52; x += 8) {
      if (x >= 24 && x <= 38) continue; // Keep entrance clear
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, totalH, 0.4), facadeFinMat);
      fin.position.set(x, totalH / 2, 60.2);
      fin.castShadow = true;
      facade.add(fin);
    }
    for (let z = 4; z <= 56; z += 8) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, totalH, 0.25), facadeFinMat);
      fin.position.set(-0.2, totalH / 2, z);
      fin.castShadow = true;
      facade.add(fin);
    }

    root.add(facade);
  }

  static buildRoof(data: HospitalData): THREE.Group {
    const roofGroup = new THREE.Group();
    roofGroup.name = 'building-roof';
    const topY = data.floors.length * data.building.floorHeight;
    roofGroup.position.y = topY;

    const topFloor = data.floors[data.floors.length - 1];
    const template = topFloor.templateFrom
      ? data.floors.find((f) => f.id === topFloor.templateFrom) ?? topFloor
      : topFloor;

    for (const rect of template.footprint) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(rect.w + 0.4, 0.35, rect.d + 0.4), roofMat);
      slab.position.set(rect.x + rect.w / 2, 0.175, rect.z + rect.d / 2);
      slab.receiveShadow = true;
      slab.castShadow = true;
      roofGroup.add(slab);
    }

    // Rooftop HVAC mechanical penthouse
    const penthouse = new THREE.Mesh(new THREE.BoxGeometry(10, 2.2, 6), facadeFinMat);
    penthouse.position.set(10, 1.45, 32);
    penthouse.castShadow = true;
    roofGroup.add(penthouse);

    // Skylight over North Lifts & Stairwell core
    const skylight = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.6, 5),
      new THREE.MeshPhysicalMaterial({
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.55,
        roughness: 0.1,
      }),
    );
    skylight.position.set(25, 0.6, 19);
    roofGroup.add(skylight);

    return roofGroup;
  }
}
