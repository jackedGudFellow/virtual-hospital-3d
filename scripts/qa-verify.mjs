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

function resolveFloors() {
  return hospital.floors.map((rawFloor) => {
    if (!rawFloor.templateFrom) return rawFloor;
    const src = hospital.floors.find((f) => f.id === rawFloor.templateFrom);
    assert(Boolean(src), `Missing templateFrom floor "${rawFloor.templateFrom}" for ${rawFloor.id}`);
    if (!src) return rawFloor;
    const prefixFrom = `${src.id}.`;
    const prefixTo = `${rawFloor.id}.`;
    return {
      ...rawFloor,
      footprint: src.footprint.map((r) => ({ ...r })),
      rooms: src.rooms.map((r) => ({
        ...r,
        id: r.id.startsWith(prefixFrom) ? `${prefixTo}${r.id.slice(prefixFrom.length)}` : `${rawFloor.id}.${r.id}`,
        doors: (r.doors ?? []).map((d) => ({
          ...d,
          targetRoom:
            d.targetRoom && d.targetRoom.startsWith(prefixFrom)
              ? `${prefixTo}${d.targetRoom.slice(prefixFrom.length)}`
              : d.targetRoom,
        })),
      })),
    };
  });
}

function roomsOverlap(a, b) {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oz = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z);
  return ox > 0.01 && oz > 0.01;
}

function doorWorldSegment(room, door) {
  const { x, z, w, d } = room.bounds;
  if (door.wall === 'N') return { axis: 'X', line: z, start: x + door.offset, end: x + door.offset + door.width };
  if (door.wall === 'S') return { axis: 'X', line: z + d, start: x + door.offset, end: x + door.offset + door.width };
  if (door.wall === 'W') return { axis: 'Z', line: x, start: z + door.offset, end: z + door.offset + door.width };
  return { axis: 'Z', line: x + w, start: z + door.offset, end: z + door.offset + door.width };
}

function touchesDoorSegment(room, seg) {
  const { x, z, w, d } = room.bounds;
  const eps = 0.05;
  if (seg.axis === 'X') {
    const onLine = Math.abs(z - seg.line) < eps || Math.abs(z + d - seg.line) < eps;
    return onLine && Math.min(x + w, seg.end) - Math.max(x, seg.start) > 0.05;
  }
  const onLine = Math.abs(x - seg.line) < eps || Math.abs(x + w - seg.line) < eps;
  return onLine && Math.min(z + d, seg.end) - Math.max(z, seg.start) > 0.05;
}

// 1. Validate floors, rooms, overlaps, door targets, and build connectivity graph
const floors = resolveFloors();
const seenIds = new Set();
const adjacency = new Map();
const allRooms = new Map();

const addEdge = (a, b) => {
  if (!adjacency.has(a)) adjacency.set(a, new Set());
  if (!adjacency.has(b)) adjacency.set(b, new Set());
  adjacency.get(a).add(b);
  adjacency.get(b).add(a);
};

for (const floor of floors) {
  const floorRoomMap = new Map(floor.rooms.map((r) => [r.id, r]));

  for (let i = 0; i < floor.rooms.length; i += 1) {
    const room = floor.rooms[i];
    allRooms.set(room.id, { floorId: floor.id, room });

    assert(typeof room.id === 'string' && room.id.length > 0, `Room missing id on ${floor.id}`);
    assert(!seenIds.has(room.id), `Duplicate room id: ${room.id}`);
    seenIds.add(room.id);

    assert(Boolean(hospital.departments[room.department]), `Unknown department "${room.department}" in ${room.id}`);
    assert(Boolean(roomTypes[room.type]), `Unknown roomType "${room.type}" in ${room.id}`);
    assert(room.bounds.w > 0 && room.bounds.d > 0, `Invalid bounds on ${room.id}`);

    // Pairwise overlap check
    for (let j = i + 1; j < floor.rooms.length; j += 1) {
      const other = floor.rooms[j];
      assert(
        !roomsOverlap(room.bounds, other.bounds),
        `Room overlap on ${floor.id}: ${room.id} overlaps ${other.id}`,
      );
    }

    // Door target validity + graph edges
    for (const door of room.doors ?? []) {
      const seg = doorWorldSegment(room, door);
      if (door.targetRoom) {
        const target = floorRoomMap.get(door.targetRoom);
        assert(Boolean(target), `Invalid door.targetRoom "${door.targetRoom}" in ${room.id}`);
        if (target) {
          assert(
            touchesDoorSegment(target, seg),
            `Door in ${room.id} targets ${door.targetRoom}, but they do not touch along that door`,
          );
        }
      }
      for (const other of floor.rooms) {
        if (other.id === room.id) continue;
        if (touchesDoorSegment(other, seg)) {
          addEdge(room.id, other.id);
        }
      }
    }
  }
}

// Connect vertical lift/stair cores across floors
const liftCores = Array.from(allRooms.values()).filter((e) => e.room.id.endsWith('.circulation.core-north'));
for (let i = 0; i < liftCores.length - 1; i += 1) {
  addEdge(liftCores[i].room.id, liftCores[i + 1].room.id);
}

// BFS reachability from L1.main.lobby
const visited = new Set();
const queue = ['L1.main.lobby'];
visited.add('L1.main.lobby');
while (queue.length > 0) {
  const cur = queue.shift();
  for (const nxt of adjacency.get(cur) ?? []) {
    if (!visited.has(nxt)) {
      visited.add(nxt);
      queue.push(nxt);
    }
  }
}

for (const [id, entry] of allRooms) {
  if (entry.room.type === 'courtyard') continue;
  assert(visited.has(id), `Room unreachable from L1.main.lobby via doors/lifts: ${id}`);
}

// 2. Verify Pharmacy drugs >= 120 across 12 cabinets + id/form sanity
assert(drugs.length >= 120, `Expected >= 120 drugs, found ${drugs.length}`);
const cabinets = new Set(drugs.map((d) => d.cabinet));
assert(cabinets.size >= 12, `Expected >= 12 cabinets, found ${cabinets.size}`);

const drugIds = new Set();
for (const d of drugs) {
  assert(!drugIds.has(d.id), `Duplicate drug id: ${d.id}`);
  drugIds.add(d.id);
  for (const field of ['id', 'genericName', 'strength', 'form', 'drugClass', 'commonUses', 'storage', 'schedule', 'keyWarnings']) {
    assert(Boolean(d[field]), `Drug ${d.id} missing field ${field}`);
  }
  if (d.id.endsWith('-tab')) assert(d.form === 'Tablet', `Drug ${d.id} ends with -tab but form is "${d.form}"`);
  if (d.id.endsWith('-cap')) assert(d.form === 'Capsule', `Drug ${d.id} ends with -cap but form is "${d.form}"`);
  if (d.id.endsWith('-inh')) assert(d.form === 'Inhaler', `Drug ${d.id} ends with -inh but form is "${d.form}"`);
  if (d.id.endsWith('-iv')) assert(d.form === 'IV Bag', `Drug ${d.id} ends with -iv but form is "${d.form}"`);
  if (d.id.endsWith('-pen')) assert(d.form === 'Pen', `Drug ${d.id} ends with -pen but form is "${d.form}"`);
  if (d.scheduleByCountry) {
    for (const [country, sched] of Object.entries(d.scheduleByCountry)) {
      assert(typeof sched === 'string' && sched.length > 0, `Invalid scheduleByCountry.${country} on ${d.id}`);
    }
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

if (failures > 0) {
  console.error(`QA FAILED with ${failures} error(s).`);
  process.exit(1);
}
console.log(
  `QA: Verified ${allRooms.size} rooms across ${floors.length} floors (0 overlaps, all reachable) and ${drugs.length} drugs across ${cabinets.size} cabinets.`,
);
console.log('QA PASSED.');
