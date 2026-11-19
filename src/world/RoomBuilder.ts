import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { DepartmentSpec, RoomSpec, WallSide } from '../core/HospitalTypes';

export interface WorldOpening {
  axis: 'X' | 'Z';
  /** Coordinate perpendicular to the wall (z for N/S walls, x for E/W walls) */
  lineCoord: number;
  start: number;
  end: number;
  bottomY: number;
  topY: number;
  isWindow: boolean;
}

export interface RoomBuildResult {
  group: THREE.Group;
  floorMesh: THREE.Mesh;
  ceilingMesh: THREE.Mesh | null;
  labelObject: CSS2DObject;
}

const WALL_THICKNESS = 0.12;
const DOOR_HEIGHT = 2.25;
const WINDOW_SILL = 0.9;
const WINDOW_HEAD = 2.45;

const sharedWallMat = new THREE.MeshStandardMaterial({
  color: 0xf8fafc,
  roughness: 0.78,
  metalness: 0.04,
});

const sharedCeilingMat = new THREE.MeshStandardMaterial({
  color: 0xf1f5f9,
  roughness: 0.9,
  metalness: 0.02,
  side: THREE.DoubleSide,
});

const sharedGlassMat = new THREE.MeshPhysicalMaterial({
  color: 0xbae6fd,
  transparent: true,
  opacity: 0.35,
  roughness: 0.1,
  metalness: 0.1,
  depthWrite: false,
});

/**
 * Extracts world-space openings for a room's own declared doors and windows.
 */
export function collectRoomOpenings(room: RoomSpec): WorldOpening[] {
  const openings: WorldOpening[] = [];
  const { x, z, w, d } = room.bounds;

  for (const door of room.doors ?? []) {
    openings.push(toWorldOpening(door.wall, door.offset, door.width, 0, DOOR_HEIGHT, false, x, z, w, d));
  }
  for (const win of room.windows ?? []) {
    openings.push(toWorldOpening(win.wall, win.offset, win.width, WINDOW_SILL, WINDOW_HEAD, true, x, z, w, d));
  }
  return openings;
}

function toWorldOpening(
  wall: WallSide,
  offset: number,
  width: number,
  bottomY: number,
  topY: number,
  isWindow: boolean,
  x: number,
  z: number,
  w: number,
  d: number,
): WorldOpening {
  switch (wall) {
    case 'N':
      return { axis: 'X', lineCoord: z, start: x + offset, end: x + offset + width, bottomY, topY, isWindow };
    case 'S':
      return { axis: 'X', lineCoord: z + d, start: x + offset, end: x + offset + width, bottomY, topY, isWindow };
    case 'W':
      return { axis: 'Z', lineCoord: x, start: z + offset, end: z + offset + width, bottomY, topY, isWindow };
    case 'E':
      return { axis: 'Z', lineCoord: x + w, start: z + offset, end: z + offset + width, bottomY, topY, isWindow };
  }
}

/**
 * Builds 3D floor, walls (with real door/window openings), ceiling, and label for one room.
 */
export class RoomBuilder {
  static build(
    room: RoomSpec,
    dept: DepartmentSpec,
    wallHeight: number,
    floorOpenings: WorldOpening[],
  ): RoomBuildResult {
    const group = new THREE.Group();
    group.name = room.id;
    group.userData.id = room.id;
    group.userData.room = room;

    const { x, z, w, d } = room.bounds;

    // Floor surface colored by department
    const floorGeo = new THREE.PlaneGeometry(Math.max(0.1, w - 0.02), Math.max(0.1, d - 0.02));
    const floorMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(dept.floorColor),
      roughness: 0.72,
      metalness: 0.03,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(x + w / 2, 0.02, z + d / 2);
    floorMesh.receiveShadow = true;
    floorMesh.userData.id = room.id;
    group.add(floorMesh);

    // Build 4 perimeter walls unless this is an open courtyard without walls
    if (room.type !== 'courtyard') {
      const sides: WallSide[] = ['N', 'S', 'W', 'E'];
      for (const side of sides) {
        this.buildWallSide(group, room, side, wallHeight, floorOpenings);
      }
    }

    // Optional ceiling
    let ceilingMesh: THREE.Mesh | null = null;
    if (room.ceiling !== false) {
      const ceilGeo = new THREE.PlaneGeometry(w, d);
      ceilingMesh = new THREE.Mesh(ceilGeo, sharedCeilingMat);
      ceilingMesh.rotation.x = Math.PI / 2;
      ceilingMesh.position.set(x + w / 2, wallHeight, z + d / 2);
      ceilingMesh.userData.id = room.id;
      group.add(ceilingMesh);
    }

    // Room label badge
    const labelDiv = document.createElement('div');
    labelDiv.className = 'room-label';
    labelDiv.textContent = room.name;
    labelDiv.style.borderLeftColor = dept.accentColor;
    const labelObject = new CSS2DObject(labelDiv);
    labelObject.position.set(x + w / 2, 0.5, z + d / 2);
    group.add(labelObject);

    return { group, floorMesh, ceilingMesh, labelObject };
  }

  private static buildWallSide(
    group: THREE.Group,
    room: RoomSpec,
    side: WallSide,
    wallHeight: number,
    floorOpenings: WorldOpening[],
  ): void {
    const { x, z, w, d } = room.bounds;
    const isHorizontal = side === 'N' || side === 'S';
    const axis: 'X' | 'Z' = isHorizontal ? 'X' : 'Z';
    const lineCoord =
      side === 'N' ? z : side === 'S' ? z + d : side === 'W' ? x : x + w;
    const wallStart = isHorizontal ? x : z;
    const wallEnd = isHorizontal ? x + w : z + d;

    // Inset wall center slightly inside room bounds to avoid z-fighting with neighbor rooms
    const inset =
      side === 'N' || side === 'W' ? WALL_THICKNESS / 2 : -WALL_THICKNESS / 2;
    const fixedPos = lineCoord + inset;

    // Find all openings along this wall line that overlap [wallStart, wallEnd]
    const matching = floorOpenings
      .filter(
        (op) =>
          op.axis === axis &&
          Math.abs(op.lineCoord - lineCoord) < 0.05 &&
          op.end > wallStart + 0.01 &&
          op.start < wallEnd - 0.01,
      )
      .map((op) => ({
        ...op,
        start: Math.max(wallStart, op.start),
        end: Math.min(wallEnd, op.end),
      }))
      .sort((a, b) => a.start - b.start);

    let cursor = wallStart;

    for (const op of matching) {
      if (op.start > cursor + 0.01) {
        this.addWallBox(group, room.id, isHorizontal, fixedPos, cursor, op.start, 0, wallHeight);
      }

      // Sill below window
      if (op.bottomY > 0.01) {
        this.addWallBox(group, room.id, isHorizontal, fixedPos, op.start, op.end, 0, op.bottomY);
      }

      // Lintel above door or window
      if (op.topY < wallHeight - 0.01) {
        this.addWallBox(group, room.id, isHorizontal, fixedPos, op.start, op.end, op.topY, wallHeight);
      }

      // Glass pane for windows
      if (op.isWindow) {
        this.addWindowGlass(group, room.id, isHorizontal, fixedPos, op.start, op.end, op.bottomY, op.topY);
      }

      cursor = Math.max(cursor, op.end);
    }

    if (cursor < wallEnd - 0.01) {
      this.addWallBox(group, room.id, isHorizontal, fixedPos, cursor, wallEnd, 0, wallHeight);
    }
  }

  private static addWallBox(
    group: THREE.Group,
    roomId: string,
    isHorizontal: boolean,
    fixedPos: number,
    start: number,
    end: number,
    bottomY: number,
    topY: number,
  ): void {
    const length = end - start;
    const height = topY - bottomY;
    if (length <= 0.01 || height <= 0.01) return;

    const geo = isHorizontal
      ? new THREE.BoxGeometry(length, height, WALL_THICKNESS)
      : new THREE.BoxGeometry(WALL_THICKNESS, height, length);

    const mesh = new THREE.Mesh(geo, sharedWallMat);
    const mid = (start + end) / 2;
    mesh.position.set(
      isHorizontal ? mid : fixedPos,
      bottomY + height / 2,
      isHorizontal ? fixedPos : mid,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.id = roomId;
    group.add(mesh);
  }

  private static addWindowGlass(
    group: THREE.Group,
    roomId: string,
    isHorizontal: boolean,
    fixedPos: number,
    start: number,
    end: number,
    bottomY: number,
    topY: number,
  ): void {
    const length = end - start;
    const height = topY - bottomY;
    if (length <= 0.01 || height <= 0.01) return;

    const geo = isHorizontal
      ? new THREE.BoxGeometry(length, height, 0.03)
      : new THREE.BoxGeometry(0.03, height, length);

    const glass = new THREE.Mesh(geo, sharedGlassMat);
    const mid = (start + end) / 2;
    glass.position.set(
      isHorizontal ? mid : fixedPos,
      bottomY + height / 2,
      isHorizontal ? fixedPos : mid,
    );
    glass.userData.id = roomId;
    group.add(glass);
  }
}
