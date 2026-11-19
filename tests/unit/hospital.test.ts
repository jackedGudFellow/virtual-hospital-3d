import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeDoorPath, HospitalIndex, resolveCircleMovement } from '../../src/core/HospitalIndex';
import type { HospitalData, RoomTypesMap } from '../../src/core/HospitalTypes';
import type { DrugSpec } from '../../src/rooms/PharmacyTypes';

const root = process.cwd();
const hospitalData = JSON.parse(fs.readFileSync(path.join(root, 'src/data/hospital.json'), 'utf8')) as HospitalData;
const roomTypes = JSON.parse(fs.readFileSync(path.join(root, 'src/data/roomTypes.json'), 'utf8')) as RoomTypesMap;
const drugs = JSON.parse(fs.readFileSync(path.join(root, 'src/data/drugs.json'), 'utf8')) as DrugSpec[];

describe('Walk Collision', () => {
  it('blocks walking through a solid wall beside a doorway', () => {
    const walls = [
      { x1: 0, z1: 0, x2: 4, z2: 0 },
      { x1: 6, z1: 0, x2: 10, z2: 0 },
    ];
    const res = resolveCircleMovement(2, -1, 2, 1, 0.35, walls, []);
    expect(res.z).toBeLessThanOrEqual(-0.34);
  });

  it('allows walking straight through a doorway gap', () => {
    const walls = [
      { x1: 0, z1: 0, x2: 4, z2: 0 },
      { x1: 6, z1: 0, x2: 10, z2: 0 },
    ];
    const res = resolveCircleMovement(5, -1, 5, 1, 0.35, walls, []);
    expect(res.x).toBeCloseTo(5, 3);
    expect(res.z).toBeCloseTo(1, 3);
  });

  it('blocks walking through furniture AABB', () => {
    const furniture = [{ minX: 4, maxX: 6, minZ: 4, maxZ: 6 }];
    const res = resolveCircleMovement(3, 5, 4.5, 5, 0.35, [], furniture);
    expect(res.x).toBeLessThanOrEqual(3.66);
  });

  it('routes across rooms through connecting doors on L1', () => {
    const index = new HospitalIndex(hospitalData);
    const l1Walk = index.getFloorWalkData('L1');
    expect(l1Walk).not.toBeNull();
    const lobby = index.rooms.get('L1.main.lobby')!;
    const pharm = index.rooms.get('L1.pharmacy.dispensing')!;
    const pts = computeDoorPath(l1Walk!, lobby.center.x, lobby.center.z, pharm.center.x, pharm.center.z);
    expect(pts.length).toBeGreaterThanOrEqual(2);
  });
});

describe('HospitalIndex & Data Integrity', () => {
  it('indexes all 5 floors including L5 template clone and finds rooms via search', () => {
    const index = new HospitalIndex(hospitalData);
    expect(index.floors.length).toBe(5);
    expect(index.rooms.size).toBe(153);
    expect(index.rooms.has('L5.inpatient.double-1')).toBe(true);

    expect(index.search('Pharmacy').length).toBeGreaterThanOrEqual(2);
    expect(index.search('ICU').length).toBeGreaterThanOrEqual(2);
    expect(index.search('NICU').length).toBeGreaterThanOrEqual(5);
  });

  it('maps every room type in hospital.json to roomTypes.json and validates 120 drugs', () => {
    const index = new HospitalIndex(hospitalData);
    for (const entry of index.rooms.values()) {
      expect(roomTypes[entry.room.type]).toBeDefined();
      expect(entry.areaM2).toBeGreaterThan(0);
    }
    expect(drugs.length).toBeGreaterThanOrEqual(120);
    expect(new Set(drugs.map((d) => d.cabinet)).size).toBeGreaterThanOrEqual(12);
  });
});
