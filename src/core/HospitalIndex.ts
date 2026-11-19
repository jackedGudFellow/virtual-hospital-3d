import * as THREE from 'three';
import type {
  CollisionBox,
  DoorLink,
  FloorSpec,
  FloorWalkData,
  HospitalData,
  RoomSpec,
  WallSegment,
  WallSide,
} from './HospitalTypes';

export type { FloorWalkData };

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

interface DoorInterval {
  axis: 'X' | 'Z';
  line: number;
  start: number;
  end: number;
  roomId: string;
}

/**
 * Pure circle-vs-wall-segment and circle-vs-AABB collision resolution with wall sliding.
 */
export function resolveCircleMovement(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  radius: number,
  walls: WallSegment[],
  furniture: CollisionBox[],
): { x: number; z: number } {
  let px = toX;
  let pz = toZ;

  // Prevent tunneling directly across any thin wall segment
  for (const w of walls) {
    if (segmentsIntersect(fromX, fromZ, px, pz, w.x1, w.z1, w.x2, w.z2)) {
      const isHoriz = Math.abs(w.z1 - w.z2) < 1e-4;
      if (isHoriz) {
        pz = fromZ < w.z1 ? w.z1 - radius : w.z1 + radius;
      } else {
        px = fromX < w.x1 ? w.x1 - radius : w.x1 + radius;
      }
    }
  }

  for (let pass = 0; pass < 3; pass += 1) {
    for (const w of walls) {
      const { cx, cz } = closestPointOnSegment(px, pz, w.x1, w.z1, w.x2, w.z2);
      const dx = px - cx;
      const dz = pz - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        if (dist > 1e-5) {
          const push = radius - dist;
          px += (dx / dist) * push;
          pz += (dz / dist) * push;
        } else {
          const isHoriz = Math.abs(w.z1 - w.z2) < 1e-4;
          if (isHoriz) pz += fromZ <= w.z1 ? -radius : radius;
          else px += fromX <= w.x1 ? -radius : radius;
        }
      }
    }

    for (const box of furniture) {
      const cx = Math.max(box.minX, Math.min(px, box.maxX));
      const cz = Math.max(box.minZ, Math.min(pz, box.maxZ));
      const dx = px - cx;
      const dz = pz - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        if (dist > 1e-5) {
          const push = radius - dist;
          px += (dx / dist) * push;
          pz += (dz / dist) * push;
        } else {
          // Inside AABB: push out to nearest face
          const dLeft = Math.abs(px - box.minX);
          const dRight = Math.abs(box.maxX - px);
          const dTop = Math.abs(pz - box.minZ);
          const dBot = Math.abs(box.maxZ - pz);
          const m = Math.min(dLeft, dRight, dTop, dBot);
          if (m === dLeft) px = box.minX - radius;
          else if (m === dRight) px = box.maxX + radius;
          else if (m === dTop) pz = box.minZ - radius;
          else pz = box.maxZ + radius;
        }
      }
    }
  }

  return { x: px, z: pz };
}

/**
 * Computes a door-guided waypoint list from (startX, startZ) to (targetX, targetZ) on a floor.
 */
export function computeDoorPath(
  floorWalk: FloorWalkData,
  startX: number,
  startZ: number,
  targetX: number,
  targetZ: number,
): Array<{ x: number; z: number }> {
  const findRoom = (x: number, z: number): string | null =>
    floorWalk.rooms.find((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ)?.id ?? null;

  const startRoom = findRoom(startX, startZ);
  const endRoom = findRoom(targetX, targetZ);
  if (!startRoom || !endRoom || startRoom === endRoom) {
    return [{ x: targetX, z: targetZ }];
  }

  // BFS over room-to-room doorLinks
  const prev = new Map<string, { room: string; x: number; z: number }>();
  const visited = new Set<string>([startRoom]);
  const queue: string[] = [startRoom];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === endRoom) break;
    for (const link of floorWalk.doorLinks) {
      const next = link.roomA === cur ? link.roomB : link.roomB === cur ? link.roomA : null;
      if (next && !visited.has(next)) {
        visited.add(next);
        prev.set(next, { room: cur, x: link.x, z: link.z });
        queue.push(next);
      }
    }
  }

  if (!visited.has(endRoom)) {
    return [{ x: targetX, z: targetZ }];
  }

  const waypoints: Array<{ x: number; z: number }> = [];
  let cur = endRoom;
  while (cur !== startRoom) {
    const step = prev.get(cur)!;
    waypoints.push({ x: step.x, z: step.z });
    cur = step.room;
  }
  waypoints.reverse();
  waypoints.push({ x: targetX, z: targetZ });
  return waypoints;
}

function closestPointOnSegment(
  px: number,
  pz: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
): { cx: number; cz: number } {
  const vx = x2 - x1;
  const vz = z2 - z1;
  const lenSq = vx * vx + vz * vz;
  if (lenSq < 1e-8) return { cx: x1, cz: z1 };
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (pz - z1) * vz) / lenSq));
  return { cx: x1 + t * vx, cz: z1 + t * vz };
}

function segmentsIntersect(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  dx: number,
  dz: number,
): boolean {
  const cross = (ux: number, uz: number, vx: number, vz: number): number => ux * vz - uz * vx;
  const d1 = cross(dx - cx, dz - cz, ax - cx, az - cz);
  const d2 = cross(dx - cx, dz - cz, bx - cx, bz - cz);
  const d3 = cross(bx - ax, bz - az, cx - ax, cz - az);
  const d4 = cross(bx - ax, bz - az, dx - ax, dz - az);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function buildFurnitureBoxesForRoom(room: RoomSpec, ox: number, oz: number): CollisionBox[] {
  const { x, z, w, d } = room.bounds;
  const cx = ox + x + w / 2;
  const cz = oz + z + d / 2;
  const box = (px: number, pz: number, bw: number, bd: number): CollisionBox => ({
    minX: px - bw / 2,
    maxX: px + bw / 2,
    minZ: pz - bd / 2,
    maxZ: pz + bd / 2,
  });

  switch (room.type) {
    case 'ward-single':
    case 'bmt-ward':
    case 'bmt-isolation':
    case 'isolation':
      return [box(cx - 0.5, cz, 1.1, 2.1)];
    case 'ward-double':
      return [box(ox + x + w * 0.3, cz, 1.1, 2.1), box(ox + x + w * 0.72, cz, 1.1, 2.1)];
    case 'or':
      return [box(cx, cz, 0.85, 2.1)];
    case 'mri':
      return [box(cx, cz - 0.1, 2.2, 2.6)];
    case 'reception':
      return [box(cx, cz, 3.2, 0.9)];
    case 'meeting':
    case 'classroom':
      return [box(cx, cz, 3.4, 1.4)];
    case 'hydrotherapy':
      return [box(cx, cz, 4.5, 3.2)];
    case 'pharmacy-dispensing':
      return [
        box(ox + x + 2.6, oz + z + 8.5, 0.85, 5.4),
        box(ox + x + 5.6, oz + z + 6.0, 0.75, 4.0),
      ];
    case 'pharmacy-storage':
      return [
        box(ox + x + 2.2, oz + z + 4.4, 0.9, 5.2),
        box(ox + x + 5.0, oz + z + 4.4, 0.9, 5.2),
        box(ox + x + 8.0, oz + z + 4.4, 0.9, 5.2),
      ];
    default:
      return [];
  }
}

/**
 * Resolves floor templates and precomputes world-space bounds, areas,
 * door entry waypoints, wall segments, furniture collision boxes, and room search.
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

        this.rooms.set(room.id, {
          floor,
          room,
          areaM2: Math.round(w * d * 10) / 10,
          floorY,
          worldBounds: { minX, maxX, minZ, maxZ },
          center,
          doorEntry: this.computeDoorEntry(room, minX, maxX, minZ, maxZ, floorY, center),
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
        nz = 1;
        break;
      case 'S':
        dx = minX + door.offset + door.width / 2;
        dz = maxZ;
        nz = -1;
        break;
      case 'W':
        dx = minX;
        dz = minZ + door.offset + door.width / 2;
        nx = 1;
        break;
      case 'E':
        dx = maxX;
        dz = minZ + door.offset + door.width / 2;
        nx = -1;
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
    const doorIntervals: DoorInterval[] = [];
    const furniture: CollisionBox[] = [];

    for (const room of floor.rooms) {
      const { x, z, w, d } = room.bounds;
      const minX = ox + x;
      const maxX = ox + x + w;
      const minZ = oz + z;
      const maxZ = oz + z + d;
      rooms.push({ id: room.id, minX, maxX, minZ, maxZ });
      furniture.push(...buildFurnitureBoxesForRoom(room, ox, oz));

      for (const door of room.doors ?? []) {
        if (door.wall === 'N') {
          doorIntervals.push({ axis: 'X', line: minZ, start: minX + door.offset, end: minX + door.offset + door.width, roomId: room.id });
        } else if (door.wall === 'S') {
          doorIntervals.push({ axis: 'X', line: maxZ, start: minX + door.offset, end: minX + door.offset + door.width, roomId: room.id });
        } else if (door.wall === 'W') {
          doorIntervals.push({ axis: 'Z', line: minX, start: minZ + door.offset, end: minZ + door.offset + door.width, roomId: room.id });
        } else {
          doorIntervals.push({ axis: 'Z', line: maxX, start: minZ + door.offset, end: minZ + door.offset + door.width, roomId: room.id });
        }
      }
    }

    // Build deduplicated wall segments with real door gaps
    const wallSeen = new Set<string>();
    const walls: WallSegment[] = [];
    const sides: WallSide[] = ['N', 'S', 'W', 'E'];

    for (const room of floor.rooms) {
      if (room.type === 'courtyard') continue;
      const { x, z, w, d } = room.bounds;
      const minX = ox + x;
      const maxX = ox + x + w;
      const minZ = oz + z;
      const maxZ = oz + z + d;

      for (const side of sides) {
        const isH = side === 'N' || side === 'S';
        const axis: 'X' | 'Z' = isH ? 'X' : 'Z';
        const line = side === 'N' ? minZ : side === 'S' ? maxZ : side === 'W' ? minX : maxX;
        const wallStart = isH ? minX : minZ;
        const wallEnd = isH ? maxX : maxZ;

        const gaps = doorIntervals
          .filter((g) => g.axis === axis && Math.abs(g.line - line) < 0.05 && g.end > wallStart + 0.01 && g.start < wallEnd - 0.01)
          .map((g) => ({ start: Math.max(wallStart, g.start), end: Math.min(wallEnd, g.end) }))
          .sort((a, b) => a.start - b.start);

        let cursor = wallStart;
        const emit = (s: number, e: number): void => {
          if (e - s <= 0.05) return;
          const seg: WallSegment = isH ? { x1: s, z1: line, x2: e, z2: line } : { x1: line, z1: s, x2: line, z2: e };
          const key = `${seg.x1.toFixed(2)},${seg.z1.toFixed(2)},${seg.x2.toFixed(2)},${seg.z2.toFixed(2)}`;
          if (!wallSeen.has(key)) {
            wallSeen.add(key);
            walls.push(seg);
          }
        };

        for (const g of gaps) {
          emit(cursor, g.start);
          cursor = Math.max(cursor, g.end);
        }
        emit(cursor, wallEnd);
      }
    }

    // Build doorLinks for click-to-walk door pathing
    const doorLinks: DoorLink[] = [];
    for (const g of doorIntervals) {
      const mid = (g.start + g.end) / 2;
      const dx = g.axis === 'X' ? mid : g.line;
      const dz = g.axis === 'X' ? g.line : mid;
      for (const r of rooms) {
        if (r.id === g.roomId) continue;
        const touches =
          g.axis === 'X'
            ? (Math.abs(r.minZ - g.line) < 0.05 || Math.abs(r.maxZ - g.line) < 0.05) && Math.min(r.maxX, g.end) - Math.max(r.minX, g.start) > 0.05
            : (Math.abs(r.minX - g.line) < 0.05 || Math.abs(r.maxX - g.line) < 0.05) && Math.min(r.maxZ, g.end) - Math.max(r.minZ, g.start) > 0.05;
        if (touches) {
          doorLinks.push({ roomA: g.roomId, roomB: r.id, x: dx, z: dz });
        }
      }
    }

    return { floorY, rooms, walls, furniture, doorLinks };
  }
}
