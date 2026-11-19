import * as THREE from 'three';
import { FloorSpec, HospitalData, RoomSpec } from './HospitalTypes';

export interface FloorWalkData {
  floorY: number;
  rooms: Array<{
    id: string;
    isCorridor: boolean;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  }>;
  doors: Array<{ x: number; z: number; radius: number }>;
}

export interface IndexedRoom {
  floor: FloorSpec;
  room: RoomSpec;
  areaM2: number;
  floorY: number;
  worldBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  center: THREE.Vector3;
  doorEntry: {
    outside: THREE.Vector3;
    inside: THREE.Vector3;
    lookAt: THREE.Vector3;
  };
}

/**
 * Resolves floor templates and precomputes world-space bounds, areas,
 * and door entry waypoints for every room across all floors.
 */
export class HospitalIndex {
  public readonly rooms = new Map<string, IndexedRoom>();
  public readonly floors: FloorSpec[] = [];
  public readonly data: HospitalData;

  constructor(data: HospitalData) {
    this.data = data;
    const [ox, oz] = data.building.originOffset;

    for (const rawFloor of data.floors) {
      const floor = this.resolveTemplate(rawFloor, data.floors);
      this.floors.push(floor);
      const floorY = (floor.level - 1) * data.building.floorHeight;

      for (const room of floor.rooms) {
        const { x, z, w, d } = room.bounds;
        const minX = ox + x;
        const maxX = ox + x + w;
        const minZ = oz + z;
        const maxZ = oz + z + d;
        const center = new THREE.Vector3((minX + maxX) / 2, floorY + 1.65, (minZ + maxZ) / 2);

        const doorEntry = this.computeDoorEntry(room, minX, maxX, minZ, maxZ, floorY, center);

        this.rooms.set(room.id, {
          floor,
          room,
          areaM2: Math.round(w * d * 10) / 10,
          floorY,
          worldBounds: { minX, maxX, minZ, maxZ },
          center,
          doorEntry,
        });
      }
    }
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

  private computeDoorEntry(
    room: RoomSpec,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    floorY: number,
    center: THREE.Vector3,
  ): { outside: THREE.Vector3; inside: THREE.Vector3; lookAt: THREE.Vector3 } {
    const eyeY = floorY + 1.65;
    const door = room.doors?.[0];

    if (!door) {
      return {
        outside: new THREE.Vector3(center.x, eyeY + 3.5, center.z + 3.0),
        inside: center.clone(),
        lookAt: new THREE.Vector3(center.x, eyeY, minZ + 1.0),
      };
    }

    const inset = Math.min(1.4, Math.min(room.bounds.w, room.bounds.d) * 0.35);
    const outset = 1.6;
    let dx = center.x;
    let dz = center.z;
    let nx = 0;
    let nz = 0;

    switch (door.wall) {
      case 'N':
        dx = minX + door.offset + door.width / 2;
        dz = minZ;
        nz = 1; // inward normal is +Z
        break;
      case 'S':
        dx = minX + door.offset + door.width / 2;
        dz = maxZ;
        nz = -1; // inward normal is -Z
        break;
      case 'W':
        dx = minX;
        dz = minZ + door.offset + door.width / 2;
        nx = 1; // inward normal is +X
        break;
      case 'E':
        dx = maxX;
        dz = minZ + door.offset + door.width / 2;
        nx = -1; // inward normal is -X
        break;
    }

    return {
      outside: new THREE.Vector3(dx - nx * outset, eyeY, dz - nz * outset),
      inside: new THREE.Vector3(dx + nx * inset, eyeY, dz + nz * inset),
      lookAt: center.clone(),
    };
  }

  search(query: string, limit = 10): IndexedRoom[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results: IndexedRoom[] = [];
    for (const entry of this.rooms.values()) {
      const hay = `${entry.room.name} ${entry.room.type} ${entry.room.department} ${entry.floor.id}`.toLowerCase();
      if (hay.includes(q)) {
        results.push(entry);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  getFloorWalkData(floorId: string): FloorWalkData | null {
    const floor = this.floors.find((f) => f.id === floorId);
    if (!floor) return null;
    const [ox, oz] = this.data.building.originOffset;
    const floorY = (floor.level - 1) * this.data.building.floorHeight;

    const rooms: FloorWalkData['rooms'] = [];
    const doors: FloorWalkData['doors'] = [];

    for (const room of floor.rooms) {
      const { x, z, w, d } = room.bounds;
      const minX = ox + x;
      const maxX = ox + x + w;
      const minZ = oz + z;
      const maxZ = oz + z + d;
      rooms.push({
        id: room.id,
        isCorridor: room.type === 'corridor' || room.type === 'lift-stair',
        minX,
        maxX,
        minZ,
        maxZ,
      });

      for (const door of room.doors ?? []) {
        let dx = minX;
        let dz = minZ;
        if (door.wall === 'N') {
          dx = minX + door.offset + door.width / 2;
          dz = minZ;
        } else if (door.wall === 'S') {
          dx = minX + door.offset + door.width / 2;
          dz = maxZ;
        } else if (door.wall === 'W') {
          dx = minX;
          dz = minZ + door.offset + door.width / 2;
        } else {
          dx = maxX;
          dz = minZ + door.offset + door.width / 2;
        }
        doors.push({ x: dx, z: dz, radius: Math.max(1.2, door.width * 0.75) });
      }
    }

    return { floorY, rooms, doors };
  }
}
