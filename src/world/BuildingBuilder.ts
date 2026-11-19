import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { DepartmentSpec, FloorSpec, HospitalData } from '../core/HospitalTypes';
import { PharmacyBuilder } from '../rooms/PharmacyBuilder';
import { DrugSpec } from '../rooms/PharmacyTypes';
import { ExteriorBuilder } from './ExteriorBuilder';
import { InteriorBuilder } from './InteriorBuilder';
import { collectRoomOpenings, RoomBuilder, WorldOpening } from './RoomBuilder';

export type FloorViewMode = 'whole' | 'exploded' | 'isolate';

interface FloorRuntime {
  spec: FloorSpec;
  group: THREE.Group;
  targetY: number;
  labels: CSS2DObject[];
  ceilings: THREE.Mesh[];
  materials: THREE.MeshStandardMaterial[];
}

const DEFAULT_DEPT: DepartmentSpec = {
  name: 'General',
  floorColor: '#f1f5f9',
  accentColor: '#64748b',
};

const slabMat = new THREE.MeshStandardMaterial({
  color: 0xcbd5e1,
  roughness: 0.85,
  metalness: 0.05,
});

/**
 * Builds all 3D hospital floors, vertical circulation, exterior facade/roof,
 * and animates floor switcher modes (whole, exploded, isolate).
 */
export class BuildingBuilder {
  public readonly root = new THREE.Group();
  public readonly pharmacyBuilder = new PharmacyBuilder();
  private drugs: DrugSpec[] = [];
  private floors = new Map<string, FloorRuntime>();
  private roomGroups = new Map<string, THREE.Group>();
  private roomCeilings = new Map<string, THREE.Mesh>();
  private roofGroup: THREE.Group | null = null;
  private floorHeight = 3.8;
  private ceilingsVisible = true;
  private labelsVisible = true;
  private viewMode: FloorViewMode = 'whole';
  private isolatedFloorId: string | null = null;
  private hiddenCeilingRoomId: string | null = null;

  constructor() {
    this.root.name = 'hospital-building';
    this.root.userData.updateLabels = (camPos: THREE.Vector3) => this.updateLabelCulling(camPos);
  }

  build(data: HospitalData, drugs: DrugSpec[] = []): void {
    this.clear();
    this.drugs = drugs;
    this.floorHeight = data.building.floorHeight;
    const [offsetX, offsetZ] = data.building.originOffset;
    this.root.position.set(offsetX, 0, offsetZ);

    const resolvedFloors = data.floors.map((floor) => this.resolveTemplate(floor, data.floors));

    for (const floor of resolvedFloors) {
      const runtime = this.buildFloor(floor, data);
      this.floors.set(floor.id, runtime);
      this.root.add(runtime.group);
    }

    const l1 = this.floors.get('L1');
    if (l1) {
      ExteriorBuilder.buildCourtyard(l1.group);
    }

    ExteriorBuilder.buildFacadeAndCanopy(this.root, data);
    this.roofGroup = ExteriorBuilder.buildRoof(data);
    this.root.add(this.roofGroup);

    this.applyFloorMode();
  }

  private resolveTemplate(floor: FloorSpec, allFloors: FloorSpec[]): FloorSpec {
    if (!floor.templateFrom) return floor;
    const src = allFloors.find((f) => f.id === floor.templateFrom);
    if (!src) return floor;

    const prefixFrom = `${src.id}.`;
    const prefixTo = `${floor.id}.`;
    return {
      ...floor,
      footprint: src.footprint.map((r) => ({ ...r })),
      rooms: src.rooms.map((r) => ({
        ...r,
        id: r.id.startsWith(prefixFrom) ? `${prefixTo}${r.id.slice(prefixFrom.length)}` : `${floor.id}.${r.id}`,
      })),
    };
  }

  private buildFloor(floor: FloorSpec, data: HospitalData): FloorRuntime {
    const group = new THREE.Group();
    group.name = `floor-${floor.id}`;
    const baseY = (floor.level - 1) * data.building.floorHeight;
    group.position.y = baseY;

    const slabThickness = data.building.slabThickness;
    for (const rect of floor.footprint) {
      const geo = new THREE.BoxGeometry(rect.w, slabThickness, rect.d);
      const slab = new THREE.Mesh(geo, slabMat.clone());
      slab.position.set(rect.x + rect.w / 2, -slabThickness / 2, rect.z + rect.d / 2);
      slab.receiveShadow = true;
      slab.castShadow = true;
      group.add(slab);
    }

    const floorOpenings: WorldOpening[] = [];
    for (const room of floor.rooms) {
      floorOpenings.push(...collectRoomOpenings(room));
    }

    const labels: CSS2DObject[] = [];
    const ceilings: THREE.Mesh[] = [];

    for (const room of floor.rooms) {
      const dept = data.departments[room.department] ?? DEFAULT_DEPT;
      const built = RoomBuilder.build(room, dept, data.building.wallHeight, floorOpenings);
      if (room.id === 'L1.pharmacy.dispensing') {
        this.pharmacyBuilder.buildDispensing(room, built.group, this.drugs, data.building.originOffset);
      } else if (room.id === 'L1.pharmacy.storage') {
        this.pharmacyBuilder.buildStorage(room, built.group);
      } else {
        InteriorBuilder.populate(room, built.group);
      }
      group.add(built.group);
      this.roomGroups.set(room.id, built.group);
      if (built.ceilingMesh) {
        ceilings.push(built.ceilingMesh);
        this.roomCeilings.set(room.id, built.ceilingMesh);
      }
      labels.push(built.labelObject);
    }

    ExteriorBuilder.buildVerticalCirculation(floor, group, data.building.floorHeight);

    const materials: THREE.MeshStandardMaterial[] = [];
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
        // Clone shared wall/slab materials per floor so ghosting one floor does not affect others
        obj.material = obj.material.clone();
        materials.push(obj.material);
      }
    });

    return { spec: floor, group, targetY: baseY, labels, ceilings, materials };
  }

  setViewMode(mode: FloorViewMode, activeFloorId: string | null = null): void {
    this.viewMode = mode;
    this.isolatedFloorId = activeFloorId;
    this.applyFloorMode();
  }

  private applyFloorMode(): void {
    const explodeGap = 4.6;

    for (const [id, rt] of this.floors) {
      const idx = rt.spec.level - 1;
      rt.targetY = this.viewMode === 'exploded' ? idx * (this.floorHeight + explodeGap) : idx * this.floorHeight;

      const isGhost = this.viewMode === 'isolate' && this.isolatedFloorId !== null && id !== this.isolatedFloorId;
      for (const mat of rt.materials) {
        mat.transparent = isGhost;
        mat.opacity = isGhost ? 0.14 : 1.0;
        mat.depthWrite = !isGhost;
      }

      const showLabels =
        this.labelsVisible &&
        this.viewMode === 'isolate' &&
        id === this.isolatedFloorId;
      for (const lbl of rt.labels) {
        const allow = showLabels && !lbl.userData.isMinorLabel;
        lbl.visible = allow;
        lbl.element.style.display = allow ? '' : 'none';
      }

      const showCeilings = this.ceilingsVisible && this.viewMode === 'whole';
      for (const c of rt.ceilings) {
        c.visible = showCeilings;
      }
    }

    if (this.hiddenCeilingRoomId) {
      const rc = this.roomCeilings.get(this.hiddenCeilingRoomId);
      if (rc) rc.visible = false;
    }

    if (this.roofGroup) {
      this.roofGroup.visible = this.viewMode === 'whole' && this.ceilingsVisible;
    }
  }

  update(dt: number): void {
    const lerpFactor = Math.min(1, dt * 8);
    for (const rt of this.floors.values()) {
      rt.group.position.y += (rt.targetY - rt.group.position.y) * lerpFactor;
    }
    this.pharmacyBuilder.update(dt);
  }

  setCeilingsVisible(visible: boolean): void {
    this.ceilingsVisible = visible;
    this.applyFloorMode();
  }

  setLabelsVisible(visible: boolean): void {
    this.labelsVisible = visible;
    this.applyFloorMode();
  }

  private updateLabelCulling(camPos: THREE.Vector3): void {
    if (!this.labelsVisible || this.viewMode !== 'isolate' || !this.isolatedFloorId) {
      return;
    }
    const rt = this.floors.get(this.isolatedFloorId);
    if (!rt) return;

    const fadeStart = 22;
    const maxDist = 42;
    const worldPos = new THREE.Vector3();

    for (const lbl of rt.labels) {
      if (lbl.userData.isMinorLabel) {
        lbl.visible = false;
        lbl.element.style.display = 'none';
        continue;
      }
      lbl.getWorldPosition(worldPos);
      const dist = camPos.distanceTo(worldPos);
      if (dist > maxDist) {
        lbl.visible = false;
        lbl.element.style.display = 'none';
      } else {
        lbl.visible = true;
        lbl.element.style.display = '';
        const alpha = dist <= fadeStart ? 1 : Math.max(0.15, 1 - (dist - fadeStart) / (maxDist - fadeStart));
        lbl.element.style.opacity = alpha.toFixed(2);
      }
    }
  }

  getFloorGroup(floorId: string): THREE.Group | undefined {
    return this.floors.get(floorId)?.group;
  }

  getRoomGroup(roomId: string): THREE.Group | undefined {
    return this.roomGroups.get(roomId);
  }

  setHiddenCeilingRoom(roomId: string | null): void {
    this.hiddenCeilingRoomId = roomId;
    this.applyFloorMode();
  }

  getRaycastTargets(): THREE.Object3D[] {
    if (this.viewMode === 'isolate' && this.isolatedFloorId) {
      const fg = this.floors.get(this.isolatedFloorId)?.group;
      return fg ? [fg] : [];
    }
    return Array.from(this.floors.values()).map((f) => f.group);
  }

  clear(): void {
    this.root.clear();
    this.floors.clear();
    this.roomGroups.clear();
    this.roomCeilings.clear();
    this.roofGroup = null;
  }
}
