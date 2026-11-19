import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const hospital = JSON.parse(fs.readFileSync(path.join(root, 'src/data/hospital.json'), 'utf8'));
const roomTypes = JSON.parse(fs.readFileSync(path.join(root, 'src/data/roomTypes.json'), 'utf8'));
const drugs = JSON.parse(fs.readFileSync(path.join(root, 'src/data/drugs.json'), 'utf8'));

let failures = 0;
const assert = (cond, msg) => {
  if (!cond) {
    console.error('FAIL:', msg);
    failures += 1;
  }
};

// 1. Verify all floors and rooms (including templateFrom resolution)
const seenIds = new Set();
let totalRooms = 0;

for (const rawFloor of hospital.floors) {
  let rooms = rawFloor.rooms;
  if (rawFloor.templateFrom) {
    const src = hospital.floors.find((f) => f.id === rawFloor.templateFrom);
    assert(Boolean(src), `Missing templateFrom floor "${rawFloor.templateFrom}" for ${rawFloor.id}`);
    if (src) {
      rooms = src.rooms.map((r) => ({
        ...r,
        id: r.id.replace(`${src.id}.`, `${rawFloor.id}.`),
      }));
    }
  }

  for (const room of rooms) {
    totalRooms += 1;
    assert(typeof room.id === 'string' && room.id.length > 0, `Room missing id on ${rawFloor.id}`);
    assert(!seenIds.has(room.id), `Duplicate room id: ${room.id}`);
    seenIds.add(room.id);

    assert(Boolean(hospital.departments[room.department]), `Unknown department "${room.department}" in ${room.id}`);
    assert(Boolean(roomTypes[room.type]), `Unknown roomType "${room.type}" in ${room.id}`);
    assert(room.bounds.w > 0 && room.bounds.d > 0, `Invalid bounds on ${room.id}`);

    // Simulate doorEntry + walk-bounds check
    const padX = Math.min(0.45, room.bounds.w * 0.3);
    const padZ = Math.min(0.45, room.bounds.d * 0.3);
    assert(room.bounds.w - 2 * padX > 0 && room.bounds.d - 2 * padZ > 0, `Walk bounds collapsed on ${room.id}`);
  }
}

// 2. Verify Pharmacy drugs >= 120 across 12 cabinets A-L
assert(drugs.length >= 120, `Expected >= 120 drugs, found ${drugs.length}`);
const cabinets = new Set(drugs.map((d) => d.cabinet));
assert(cabinets.size >= 12, `Expected >= 12 cabinets, found ${cabinets.size}`);

for (const d of drugs) {
  for (const field of ['id', 'genericName', 'strength', 'form', 'drugClass', 'commonUses', 'storage', 'schedule', 'keyWarnings']) {
    assert(Boolean(d[field]), `Drug ${d.id} missing field ${field}`);
  }
}

// 3. Verify dist/ bundle size < 15 MB if built
const distDir = path.join(root, 'dist');
if (fs.existsSync(distDir)) {
  let totalBytes = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else totalBytes += fs.statSync(full).size;
    }
  };
  walk(distDir);
  const mb = totalBytes / (1024 * 1024);
  assert(mb < 15, `Build size ${mb.toFixed(2)} MB exceeds 15 MB limit`);
  console.log(`QA: dist/ size = ${mb.toFixed(2)} MB (< 15 MB)`);
}

console.log(`QA: Verified ${totalRooms} rooms across ${hospital.floors.length} floors and ${drugs.length} drugs across ${cabinets.size} cabinets.`);
if (failures > 0) {
  console.error(`QA FAILED with ${failures} error(s).`);
  process.exit(1);
}
console.log('QA PASSED.');
