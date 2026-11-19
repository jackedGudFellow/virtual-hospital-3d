import * as THREE from 'three';
import { RoomSpec } from '../core/HospitalTypes';
import { createDrugMesh } from './PharmacyDrugMesh';
import { CabinetMeta, DrugSpec, PHARMACY_CABINETS } from './PharmacyTypes';

export interface CabinetRuntime {
  meta: CabinetMeta;
  group: THREE.Group;
  doorPivot: THREE.Group;
  isOpen: boolean;
  targetAngle: number;
  facePos: THREE.Vector3;
  lookAt: THREE.Vector3;
}

const matCab = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.6 });
const matShelf = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 });
const matCounter = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
const matTeal = new THREE.MeshStandardMaterial({ color: 0x0f768a, roughness: 0.4 });
const matDark = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
const matGlass = new THREE.MeshPhysicalMaterial({
  color: 0xbae6fd,
  transparent: true,
  opacity: 0.38,
  roughness: 0.1,
});
const matRedLock = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4 });

function makePlaque(text: string, bg: string): THREE.MeshBasicMaterial {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.slice(0, 22), 128, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex });
}

/**
 * Builds the signature L1 Pharmacy (Dispensing + Storage Room) with 12 cabinets,
 * 120+ real labeled drugs, dispensing window, workstations, fridge, and narcotics safe.
 */
export class PharmacyBuilder {
  public readonly cabinets = new Map<string, CabinetRuntime>();
  public readonly drugMeshes = new Map<string, THREE.Group>();
  public controlledUnlocked = false;

  private dispensePkg: THREE.Mesh | null = null;
  private dispenseAnim: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
  private windowPos = new THREE.Vector3();

  buildDispensing(room: RoomSpec, roomGroup: THREE.Group, drugs: DrugSpec[], originOffset: number[]): void {
    const { x, z } = room.bounds;
    const [ox, oz] = originOffset;

    // 1. Public frontage: privacy line, queue ticket machine, sanitizer, counseling nook
    const privacyLine = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 6.0),
      new THREE.MeshBasicMaterial({ color: 0x0f768a }),
    );
    privacyLine.rotation.x = -Math.PI / 2;
    privacyLine.position.set(x + 1.5, 0.03, z + 8.5);
    roomGroup.add(privacyLine);

    const ticketKiosk = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.35, 0.4), matTeal);
    ticketKiosk.position.set(x + 0.8, 0.675, z + 12.2);
    roomGroup.add(ticketKiosk);

    const sanitizer = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.15, 10), matCounter);
    sanitizer.position.set(x + 0.8, 0.575, z + 10.8);
    roomGroup.add(sanitizer);

    const nookDesk = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 0.8), matCounter);
    nookDesk.position.set(x + 1.0, 0.375, z + 2.5);
    roomGroup.add(nookDesk);

    // 2. Dispensing Counter & Glass Window with pass-through slot
    const counterBase = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.05, 5.4), matTeal);
    counterBase.position.set(x + 2.6, 0.525, z + 8.5);
    const windowGlass = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.15, 5.2), matGlass);
    windowGlass.position.set(x + 2.6, 1.75, z + 8.5);
    const displaySign = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.32, 1.6),
      makePlaque('NOW SERVING: 042', '#0f172a'),
    );
    displaySign.position.set(x + 2.6, 2.55, z + 8.5);

    [counterBase, windowGlass, displaySign].forEach((m) => {
      m.userData.pharmacyAction = 'dispense';
      m.userData.id = room.id;
      roomGroup.add(m);
    });

    this.windowPos.set(x + 2.6, 1.12, z + 8.5);

    // Animated prescription bag mesh
    this.dispensePkg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.14), matTeal);
    this.dispensePkg.visible = false;
    roomGroup.add(this.dispensePkg);

    // 3. Behind-the-window 2 Pharmacist Workstations + Bagging Station
    for (const wz of [z + 7.2, z + 9.8]) {
      const desk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.75, 1.6), matCounter);
      desk.position.set(x + 3.6, 0.375, wz);
      const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.56), matDark);
      monitor.position.set(x + 3.5, 0.98, wz);
      const printer = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.24), matDark);
      printer.position.set(x + 3.6, 0.84, wz + 0.5);
      roomGroup.add(desk, monitor, printer);
    }

    // 4. Place 12 Cabinets (A-L)
    const placements: Array<{ x: number; z: number; rotY: number }> = [
      // East wall A-F
      { x: x + 8.3, z: z + 1.5, rotY: -Math.PI / 2 },
      { x: x + 8.3, z: z + 3.4, rotY: -Math.PI / 2 },
      { x: x + 8.3, z: z + 5.3, rotY: -Math.PI / 2 },
      { x: x + 8.3, z: z + 7.2, rotY: -Math.PI / 2 },
      { x: x + 8.3, z: z + 9.1, rotY: -Math.PI / 2 },
      { x: x + 8.3, z: z + 11.0, rotY: -Math.PI / 2 },
      // North wall G-H
      { x: x + 4.0, z: z + 0.65, rotY: 0 },
      { x: x + 6.0, z: z + 0.65, rotY: 0 },
      // South wall I (IV) & J (Fridge)
      { x: x + 4.0, z: z + 13.35, rotY: Math.PI },
      { x: x + 6.0, z: z + 13.35, rotY: Math.PI },
      // Central island K (Controlled, locked) & L (Pediatric)
      { x: x + 5.6, z: z + 4.8, rotY: -Math.PI / 2 },
      { x: x + 5.6, z: z + 7.2, rotY: -Math.PI / 2 },
    ];

    PHARMACY_CABINETS.forEach((meta, i) => {
      const p = placements[i];
      const cabDrugs = drugs.filter((d) => d.cabinet === meta.id);
      this.buildCabinet(meta, cabDrugs, p.x, p.z, p.rotY, roomGroup, room.id, ox, oz);
    });
  }

  private buildCabinet(
    meta: CabinetMeta,
    cabDrugs: DrugSpec[],
    px: number,
    pz: number,
    rotY: number,
    roomGroup: THREE.Group,
    roomId: string,
    ox: number,
    oz: number,
  ): void {
    const g = new THREE.Group();
    g.position.set(px, 0, pz);
    g.rotation.y = rotY;

    const cabW = 1.5;
    const cabH = 2.15;
    const cabD = 0.55;

    // Back & sides
    const back = new THREE.Mesh(new THREE.BoxGeometry(cabW, cabH, 0.04), matCab);
    back.position.set(0, cabH / 2, -cabD / 2 + 0.02);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.04, cabH, cabD), matCab);
    left.position.set(-cabW / 2 + 0.02, cabH / 2, 0);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.04, cabH, cabD), matCab);
    right.position.set(cabW / 2 - 0.02, cabH / 2, 0);
    const top = new THREE.Mesh(new THREE.BoxGeometry(cabW, 0.05, cabD), matCab);
    top.position.set(0, cabH - 0.025, 0);
    g.add(back, left, right, top);

    // Header plaque
    const header = new THREE.Mesh(
      new THREE.BoxGeometry(cabW - 0.04, 0.24, 0.06),
      makePlaque(`${meta.id} · ${meta.title}`, meta.color),
    );
    header.position.set(0, cabH + 0.14, cabD / 2 - 0.03);
    g.add(header);

    // 2 Shelves (y = 0.75 and y = 1.38)
    const shelfYs = [0.75, 1.38];
    for (const sy of shelfYs) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(cabW - 0.08, 0.04, cabD - 0.06), matShelf);
      shelf.position.set(0, sy, 0);
      g.add(shelf);
    }

    // Populate drugs on shelves (5 slots per shelf)
    for (const drug of cabDrugs) {
      const sy = drug.shelf === 2 ? shelfYs[1] + 0.02 : shelfYs[0] + 0.02;
      const sx = -0.52 + (drug.slot - 1) * 0.26;
      const drugMesh = createDrugMesh(drug, meta.color);
      drugMesh.position.set(sx, sy, 0.04);
      g.add(drugMesh);
      this.drugMeshes.set(drug.id, drugMesh);
    }

    // Hinged front door
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-cabW / 2 + 0.03, 0, cabD / 2);

    const doorMat = meta.isFridge ? matGlass : meta.isControlled ? matRedLock : matGlass;
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(cabW - 0.06, cabH - 0.1, 0.03), doorMat);
    doorMesh.position.set((cabW - 0.06) / 2, cabH / 2, 0);
    doorPivot.add(doorMesh);

    if (meta.isFridge) {
      const thermo = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.16, 0.04),
        makePlaque('TEMP: 4.2 °C', '#0284c7'),
      );
      thermo.position.set(cabW / 2, cabH - 0.25, 0.03);
      doorPivot.add(thermo);
    }

    if (meta.isControlled) {
      const lockBadge = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.18, 0.04),
        makePlaque('LOCKED · BADGE', '#7f1d1d'),
      );
      lockBadge.position.set(cabW / 2, cabH / 2, 0.03);
      doorPivot.add(lockBadge);
    }

    g.add(doorPivot);

    g.traverse((obj) => {
      obj.userData.cabinetId = meta.id;
      obj.userData.id = roomId;
    });

    roomGroup.add(g);

    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    const worldCenter = new THREE.Vector3(ox + px, 1.45, oz + pz);
    const facePos = worldCenter.clone().addScaledVector(forward, 1.85);
    const lookAt = worldCenter.clone().setY(1.2);

    this.cabinets.set(meta.id, {
      meta,
      group: g,
      doorPivot,
      isOpen: false,
      targetAngle: 0,
      facePos,
      lookAt,
    });
  }

  buildStorage(room: RoomSpec, roomGroup: THREE.Group): void {
    const { x, z, w, d } = room.bounds;

    // Access-badge sign on North door
    const badgeSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.2, 0.04),
      makePlaque('STAFF BADGE ONLY', '#b91c1c'),
    );
    badgeSign.position.set(x + 6.7, 1.9, z + 0.12);
    roomGroup.add(badgeSign);

    // Instanced bulk cartons on floor-to-ceiling shelving (high performance!)
    const rackPositions = [x + 2.2, x + 5.0, x + 8.0];
    const cartonGeo = new THREE.BoxGeometry(0.45, 0.32, 0.38);
    const cartonMat = new THREE.MeshStandardMaterial({ color: 0xd6b88d, roughness: 0.75 });
    const inst = new THREE.InstancedMesh(cartonGeo, cartonMat, rackPositions.length * 12);
    const dummy = new THREE.Object3D();
    let idx = 0;

    for (const rx of rackPositions) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.4, 5.2), matShelf);
      frame.position.set(rx, 1.2, z + 4.4);
      roomGroup.add(frame);

      for (let level = 0; level < 3; level += 1) {
        for (let slot = 0; slot < 4; slot += 1) {
          dummy.position.set(rx, 0.45 + level * 0.75, z + 2.5 + slot * 1.2);
          dummy.updateMatrix();
          inst.setMatrixAt(idx++, dummy.matrix);
        }
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    roomGroup.add(inst);

    // Cold room / vaccine fridge, narcotics safe, hazardous bin, receiving table
    const coldRoom = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.3, 2.0), matGlass);
    coldRoom.position.set(x + w - 1.5, 1.15, z + 1.5);
    const safe = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.8), matRedLock);
    safe.position.set(x + w - 1.0, 0.65, z + 4.2);
    const hazBin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.6), new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
    hazBin.position.set(x + w - 1.2, 0.45, z + d - 1.2);
    const recvTable = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1.1), matCounter);
    recvTable.position.set(x + 2.5, 0.4, z + d - 1.0);

    // Pass-through hatch to Cytotoxic Drug Preparation on South wall
    const hatch = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.8, 0.25),
      makePlaque('CYTOTOXIC HATCH', '#7c3aed'),
    );
    hatch.position.set(x + 6.7, 1.2, z + d - 0.1);

    roomGroup.add(coldRoom, safe, hazBin, recvTable, hatch);
  }

  toggleCabinet(id: string): boolean {
    const cab = this.cabinets.get(id);
    if (!cab) return false;
    if (cab.meta.isControlled && !this.controlledUnlocked) {
      return false;
    }
    cab.isOpen = !cab.isOpen;
    cab.targetAngle = cab.isOpen ? -Math.PI * 0.55 : 0;
    return true;
  }

  unlockControlled(): void {
    this.controlledUnlocked = true;
    const cab = this.cabinets.get('K');
    if (cab) {
      cab.isOpen = true;
      cab.targetAngle = -Math.PI * 0.55;
    }
  }

  highlightDrugs(matchingIds: Set<string>): void {
    for (const [id, mesh] of this.drugMeshes) {
      const match = matchingIds.has(id);
      mesh.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
          obj.material.emissive.setHex(match ? 0x10b981 : 0x000000);
          obj.material.emissiveIntensity = match ? 0.65 : 0;
        }
      });
    }
  }

  triggerDispenseAnimation(drugId: string): void {
    if (!this.dispensePkg) return;
    const drug = this.drugMeshes.get(drugId);
    const start = new THREE.Vector3();
    if (drug) {
      drug.getWorldPosition(start);
      // Convert to floor-local coordinates if needed; use cabinet position fallback
    }
    const cab = Array.from(this.cabinets.values()).find((c) => c.group.children.some((ch) => ch === drug));
    const from = cab ? cab.group.position.clone().setY(1.2) : this.windowPos.clone().add(new THREE.Vector3(3, 0, 0));
    this.dispensePkg.position.copy(from);
    this.dispensePkg.visible = true;
    this.dispenseAnim = { from, to: this.windowPos.clone(), t: 0 };
  }

  update(dt: number): void {
    const lerp = Math.min(1, dt * 7);
    for (const cab of this.cabinets.values()) {
      cab.doorPivot.rotation.y += (cab.targetAngle - cab.doorPivot.rotation.y) * lerp;
    }

    if (this.dispenseAnim && this.dispensePkg) {
      this.dispenseAnim.t = Math.min(1, this.dispenseAnim.t + dt * 1.1);
      this.dispensePkg.position.lerpVectors(this.dispenseAnim.from, this.dispenseAnim.to, this.dispenseAnim.t);
      if (this.dispenseAnim.t >= 1) {
        this.dispenseAnim = null;
      }
    }
  }
}
