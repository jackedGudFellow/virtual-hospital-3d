import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { computeDoorPath, HospitalIndex, resolveCircleMovement } from '../src/core/HospitalIndex.ts';
import type { HospitalData } from '../src/core/HospitalTypes.ts';

const hospitalData = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'src/data/hospital.json'), 'utf8'),
) as HospitalData;

test('resolveCircleMovement blocks walking through a solid wall beside a doorway', () => {
  // Wall along z = 0 from x = 0..4 and x = 6..10 (door gap at x = 4..6)
  const walls = [
    { x1: 0, z1: 0, x2: 4, z2: 0 },
    { x1: 6, z1: 0, x2: 10, z2: 0 },
  ];
  const res = resolveCircleMovement(2, -1, 2, 1, 0.35, walls, []);
  assert.ok(res.z <= -0.34, `Expected player to be stopped on z <= -0.35, got z=${res.z}`);
});

test('resolveCircleMovement allows walking straight through a doorway gap', () => {
  const walls = [
    { x1: 0, z1: 0, x2: 4, z2: 0 },
    { x1: 6, z1: 0, x2: 10, z2: 0 },
  ];
  const res = resolveCircleMovement(5, -1, 5, 1, 0.35, walls, []);
  assert.ok(Math.abs(res.x - 5) < 1e-4 && Math.abs(res.z - 1) < 1e-4, `Expected pass-through to (5,1), got (${res.x},${res.z})`);
});

test('resolveCircleMovement blocks walking through furniture AABB', () => {
  const furniture = [{ minX: 4, maxX: 6, minZ: 4, maxZ: 6 }];
  const res = resolveCircleMovement(3, 5, 4.5, 5, 0.35, [], furniture);
  assert.ok(res.x <= 3.66, `Expected furniture to block at x <= 3.65, got x=${res.x}`);
});

test('computeDoorPath routes across rooms through connecting doors on L1', () => {
  const index = new HospitalIndex(hospitalData);
  const l1Walk = index.getFloorWalkData('L1');
  assert.ok(l1Walk, 'L1 walk data should exist');
  assert.ok(l1Walk.walls.length > 50, 'L1 should have solid wall segments');
  assert.ok(l1Walk.furniture.length > 5, 'L1 should have furniture collision boxes');

  const lobby = index.rooms.get('L1.main.lobby')!;
  const pharm = index.rooms.get('L1.pharmacy.dispensing')!;
  const pathPts = computeDoorPath(l1Walk, lobby.center.x, lobby.center.z, pharm.center.x, pharm.center.z);
  assert.ok(pathPts.length >= 2, `Expected at least 1 door waypoint + target, got ${pathPts.length}`);
});
