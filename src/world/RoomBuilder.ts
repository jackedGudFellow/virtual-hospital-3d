import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { DepartmentSpec, RoomSpec, WallSide } from '../core/HospitalTypes';

export interface WorldOpening {
  axis: 'X' | 'Z';
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

const sharedFrameMat = new THREE.MeshStandardMaterial({
  color: 0x334155,
  roughness: 0.45,
  metalness: 0.35,
});

const sharedCeilingMat = new THREE.MeshStandardMaterial({
  color: 0xf1f5f9,
  roughness: 0.9,
  metalness: 0.02,
  side: THREE.DoubleSide,
});

const sharedGlassMat = new THREE.MeshStandardMaterial({
  color: 0x7dd3fc,
  emissive: 0x000000,
  emissiveIntensity: 0,
  transparent: true,
  opacity: 0.42,
  roughness: 0.12,
  metalness: 0.15,
  depthWrite: false,
});

const floorTexCache = new Map<string, THREE.CanvasTexture>();

function getFloorTileTexture(hexColor: string): THREE.CanvasTexture {
  const cached = floorTexCache.get(hexColor);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = hexColor;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle checkerboard tonal variation + clinical tile grout lines
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      if ((x + y) % 2 === 0) ctx.fillRect(x * 64, y * 64, 64, 64);
    }
  }
  ctx.strokeStyle = 'rgba(15, 42, 67, 0.09)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  floorTexCache.set(hexColor, tex);
  return tex;
}

export function setWindowNightGlow(night: boolean): void {
  if (night) {
    sharedGlassMat.emissive.setHex(0xfef08a);
    sharedGlassMat.emissiveIntensity = 0.65;
    sharedGlassMat.opacity = 0.72;
  } else {
    sharedGlassMat.emissive.setHex(0x000000);
    sharedGlassMat.emissiveIntensity = 0;
    sharedGlassMat.opacity = 0.42;
  }
}

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
 * Builds 3D tiled floor, walls (with door frames, window glass, and department accent strip),
 * ceiling, and smart room label.
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

    // Tiled floor surface tinted by department color
    const floorGeo = new THREE.PlaneGeometry(Math.max(0.1, w - 0.02), Math.max(0.1, d - 0.02));
    const tex = getFloorTileTexture(dept.floorColor).clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, w / 2.4), Math.max(1, d / 2.4));

    const floorMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.62,
      metalness: 0.04,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(x + w / 2, 0.02, z + d / 2);
    floorMesh.receiveShadow = true;
    floorMesh.userData.id = room.id;
    floorMesh.userData.isFloor = true;
    group.add(floorMesh);

    // Build 4 perimeter walls with accent baseboard strip & door frames
    if (room.type !== 'courtyard') {
      const accentMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(dept.accentColor),
        roughness: 0.55,
      });
      const sides: WallSide[] = ['N', 'S', 'W', 'E'];
      for (const side of sides) {
        this.buildWallSide(group, room, side, wallHeight, floorOpenings, accentMat);
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

    // Smart room label badge
    const labelDiv = document.createElement('div');
    labelDiv.className = 'room-label';
    labelDiv.textContent = room.name;
    labelDiv.style.borderLeftColor = dept.accentColor;
    const isMinor = room.type === 'corridor' || room.type === 'air-lock' || room.type === 'courtyard';
    if (isMinor) {
      labelDiv.style.display = 'none';
    }
    const labelObject = new CSS2DObject(labelDiv);
    labelObject.position.set(x + w / 2, 0.5, z + d / 2);
    labelObject.userData.isMinorLabel = isMinor;
    group.add(labelObject);

    return { group, floorMesh, ceilingMesh, labelObject };
  }

  private static buildWallSide(
    group: THREE.Group,
    room: RoomSpec,
    side: WallSide,
    wallHeight: number,
    floorOpenings: WorldOpening[],
    accentMat: THREE.Material,
  ): void {
    const { x, z, w, d } = room.bounds;
    const isHorizontal = side === 'N' || side === 'S';
    const axis: 'X' | 'Z' = isHorizontal ? 'X' : 'Z';
    const lineCoord = side === 'N' ? z : side === 'S' ? z + d : side === 'W' ? x : x + w;
    const wallStart = isHorizontal ? x : z;
    const wallEnd = isHorizontal ? x + w : z + d;

    const inset = side === 'N' || side === 'W' ? WALL_THICKNESS / 2 : -WALL_THICKNESS / 2;
    const fixedPos = lineCoord + inset;

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
        this.addWallSegment(group, room.id, isHorizontal, fixedPos, cursor, op.start, 0, wallHeight, accentMat);
      }

      if (op.bottomY > 0.01) {
        this.addWallBox(group, room.id, isHorizontal, fixedPos, op.start, op.end, 0, op.bottomY, sharedWallMat);
      }

      if (op.topY < wallHeight - 0.01) {
        this.addWallBox(group, room.id, isHorizontal, fixedPos, op.start, op.end, op.topY, wallHeight, sharedWallMat);
      }

      if (op.isWindow) {
        this.addWindowGlass(group, room.id, isHorizontal, fixedPos, op.start, op.end, op.bottomY, op.topY);
      } else {
        // Door header trim bar so openings read clearly
        this.addWallBox(group, room.id, isHorizontal, fixedPos, op.start, op.end, op.topY - 0.07, op.topY, sharedFrameMat);
      }

      cursor = Math.max(cursor, op.end);
    }

    if (cursor < wallEnd - 0.01) {
      this.addWallSegment(group, room.id, isHorizontal, fixedPos, cursor, wallEnd, 0, wallHeight, accentMat);
    }
  }

  private static addWallSegment(
    group: THREE.Group,
    roomId: string,
    isHorizontal: boolean,
    fixedPos: number,
    start: number,
    end: number,
    bottomY: number,
    topY: number,
    accentMat: THREE.Material,
  ): void {
    this.addWallBox(group, roomId, isHorizontal, fixedPos, start, end, bottomY, topY, sharedWallMat);
    // Subtle colored baseboard stripe at floor level for visual depth & department identity
    const stripeGeo = isHorizontal
      ? new THREE.BoxGeometry(end - start, 0.12, WALL_THICKNESS + 0.015)
      : new THREE.BoxGeometry(WALL_THICKNESS + 0.015, 0.12, end - start);
    const stripe = new THREE.Mesh(stripeGeo, accentMat);
    const mid = (start + end) / 2;
    stripe.position.set(isHorizontal ? mid : fixedPos, 0.06, isHorizontal ? fixedPos : mid);
    stripe.userData.id = roomId;
    group.add(stripe);
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
    mat: THREE.Material,
  ): void {
    const length = end - start;
    const height = topY - bottomY;
    if (length <= 0.01 || height <= 0.01) return;

    const geo = isHorizontal
      ? new THREE.BoxGeometry(length, height, WALL_THICKNESS)
      : new THREE.BoxGeometry(WALL_THICKNESS, height, length);

    const mesh = new THREE.Mesh(geo, mat);
    const mid = (start + end) / 2;
    mesh.position.set(isHorizontal ? mid : fixedPos, bottomY + height / 2, isHorizontal ? fixedPos : mid);
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
    glass.position.set(isHorizontal ? mid : fixedPos, bottomY + height / 2, isHorizontal ? fixedPos : mid);
    glass.userData.id = roomId;
    group.add(glass);
  }
}
