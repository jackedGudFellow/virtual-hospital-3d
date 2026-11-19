export type WallSide = 'N' | 'S' | 'E' | 'W';

export interface RectBounds {
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface DoorSpec {
  wall: WallSide;
  /** Offset along the wall from its start corner (x for N/S, z for E/W) in meters */
  offset: number;
  width: number;
  targetRoom?: string;
}

export interface WindowSpec {
  wall: WallSide;
  offset: number;
  width: number;
}

export interface RoomSpec {
  id: string;
  name: string;
  type: string;
  department: string;
  bounds: RectBounds;
  doors?: DoorSpec[];
  windows?: WindowSpec[];
  ceiling?: boolean;
}

export interface FloorSpec {
  id: string;
  level: number;
  name: string;
  templateFrom?: string;
  footprint: RectBounds[];
  rooms: RoomSpec[];
}

export interface DepartmentSpec {
  name: string;
  floorColor: string;
  accentColor: string;
}

export interface BuildingConfig {
  name: string;
  floorHeight: number;
  wallHeight: number;
  slabThickness: number;
  originOffset: number[];
}

export interface HospitalData {
  building: BuildingConfig;
  departments: Record<string, DepartmentSpec>;
  floors: FloorSpec[];
}

export interface RoomTypeSpec {
  name: string;
  department: string;
  description: string;
  equipment: string[];
}

export type RoomTypesMap = Record<string, RoomTypeSpec>;

export interface WallSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface DoorLink {
  roomA: string;
  roomB: string;
  x: number;
  z: number;
}

export interface FloorWalkData {
  floorY: number;
  rooms: Array<{
    id: string;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  }>;
  walls: WallSegment[];
  furniture: CollisionBox[];
  doorLinks: DoorLink[];
}
