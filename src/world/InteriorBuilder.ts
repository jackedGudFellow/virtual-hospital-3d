import * as THREE from 'three';
import { RoomSpec } from '../core/HospitalTypes';
import { Furniture } from './Furniture';

const signMatCache = new Map<string, THREE.MeshBasicMaterial>();

function getDoorSignMaterial(text: string): THREE.MeshBasicMaterial {
  const cached = signMatCache.get(text);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0f768a';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.slice(0, 22), 128, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  signMatCache.set(text, mat);
  return mat;
}

/**
 * Populates rooms with procedural equipment/furniture matching the isometric
 * drawings & Drawing A NICU plan, plus door signage and corridor wayfinding.
 */
export class InteriorBuilder {
  static populate(room: RoomSpec, roomGroup: THREE.Group): void {
    const { x, z, w, d } = room.bounds;
    const cx = x + w / 2;
    const cz = z + d / 2;
    let idx = 0;

    const place = (eqType: string, px: number, pz: number, rotY = 0): void => {
      const item = Furniture.create(eqType, room.id, idx++);
      item.position.set(px, 0, pz);
      item.rotation.y = rotY;
      roomGroup.add(item);
    };

    switch (room.type) {
      case 'ward-single':
      case 'bmt-ward':
        place('hospital-bed', cx - 0.5, cz, 0);
        place('bedside-cabinet', cx + 0.5, cz - 0.6, 0);
        place('patient-monitor', cx - 1.3, cz - 0.7, 0);
        place('headwall', cx - 0.5, z + 0.2, 0);
        place('sink', x + w - 0.7, z + d - 0.6, 0);
        place('toilet-fixture', x + w - 1.4, z + d - 0.6, 0);
        break;

      case 'ward-double':
        place('hospital-bed', x + w * 0.3, cz, 0);
        place('bedside-cabinet', x + w * 0.3 + 0.9, cz - 0.6, 0);
        place('patient-monitor', x + w * 0.3 - 0.9, cz - 0.7, 0);
        place('privacy-curtain', cx, cz, 0);
        place('hospital-bed', x + w * 0.72, cz, 0);
        place('bedside-cabinet', x + w * 0.72 + 0.9, cz - 0.6, 0);
        place('headwall', x + w * 0.5, z + 0.2, 0);
        place('sink', x + 0.7, z + d - 0.6, 0);
        place('toilet-fixture', x + 1.5, z + d - 0.6, 0);
        break;

      case 'bmt-isolation':
        // Drawing B isometric: anteroom glass partition, HEPA, bed, monitor, small balcony
        place('glass-partition', x + 2.2, cz, 0);
        place('sink', x + 0.9, z + d - 0.8, 0);
        place('hepa-unit', x + 0.8, z + 0.8, 0);
        place('hospital-bed', cx + 0.8, cz, 0);
        place('patient-monitor', cx - 0.1, cz - 0.7, 0);
        place('balcony-rail', x + w - 0.5, cz, 0);
        break;

      case 'isolation':
        place('hospital-bed', cx + 0.5, cz, 0);
        place('patient-monitor', cx - 0.4, cz - 0.7, 0);
        place('hepa-unit', x + 0.7, z + 0.7, 0);
        place('sink', x + 0.7, z + d - 0.7, 0);
        break;

      case 'ophthalmic':
        // Drawing B Clinic isometric: exam bed, desk, sink, privacy curtain
        place('exam-bed', cx - 1.4, cz, 0);
        place('privacy-curtain', cx, cz, 0);
        place('office-desk', cx + 1.8, cz - 0.5, -Math.PI / 2);
        place('sink', x + 0.7, z + 0.6, 0);
        break;

      case 'mri':
        place('mri-gantry', cx, cz - 0.4, 0);
        place('patient-monitor', cx + 1.8, cz + 0.5, 0);
        place('lead-glass-window', cx, z + d - 0.18, 0);
        break;

      case 'control-room':
        place('control-console', cx, z + 1.2, 0);
        place('lead-glass-window', cx, z + 0.18, 0);
        break;

      case 'chemo-bay': {
        // Drawing B Chemotherapy chair place: recliner + IV pole + side table
        const cols = 4;
        const rows = 2;
        for (let r = 0; r < rows; r += 1) {
          for (let c = 0; c < cols; c += 1) {
            const px = x + 2.5 + c * 3.2;
            const pz = z + 3.2 + r * 4.5;
            place('chemo-recliner', px, pz, 0);
            place('iv-pole', px + 0.8, pz - 0.3, 0);
            place('side-table', px - 0.75, pz, 0);
          }
        }
        place('nurse-workstation', cx, z + d - 1.5, 0);
        break;
      }

      case 'nicu-ward':
        // 8 numbered NICU bays in 2 columns of 4 (Drawing A)
        for (let col = 0; col < 2; col += 1) {
          for (let row = 0; row < 4; row += 1) {
            const px = x + 2.4 + row * 3.8;
            const pz = z + 2.2 + col * 3.6;
            place('incubator', px, pz, 0);
            place('ventilator', px + 0.85, pz, 0);
            place('patient-monitor', px - 0.75, pz, 0);
          }
        }
        break;

      case 'nicu-isolation':
        place('incubator', cx, cz, 0);
        place('ventilator', cx + 0.9, cz, 0);
        place('patient-monitor', cx - 0.8, cz, 0);
        break;

      case 'nicu-station':
        // Drawing A: 4 nursing workstations at the NICU central station
        place('nurse-workstation', x + 1.4, z + 1.3, 0);
        place('nurse-workstation', x + 4.8, z + 1.3, 0);
        place('nurse-workstation', x + 1.4, z + 2.8, Math.PI);
        place('nurse-workstation', x + 4.8, z + 2.8, Math.PI);
        break;

      case 'milk-prep':
        place('milk-fridge', x + 1.0, z + 1.0, 0);
        place('sink', cx + 0.8, z + 0.8, 0);
        break;

      case 'med-gas':
        place('medical-gas-manifold', cx, cz, 0);
        break;

      case 'or':
        place('operating-table', cx, cz, 0);
        place('surgical-lights', cx, cz, 0);
        place('anesthesia-machine', cx - 1.4, cz - 0.8, 0);
        place('patient-monitor', cx + 1.4, cz - 0.8, 0);
        break;

      case 'icu':
        for (let i = 0; i < 3; i += 1) {
          const px = x + 2.4 + i * 3.8;
          place('hospital-bed', px, cz - 0.6, 0);
          place('ventilator', px + 0.9, cz - 1.1, 0);
          place('patient-monitor', px - 0.85, cz - 1.1, 0);
          place('iv-pole', px + 0.9, cz + 0.2, 0);
        }
        place('nurse-workstation', cx, z + d - 1.6, 0);
        break;

      case 'pre-op':
      case 'post-op':
        place('hospital-bed', cx - 1.5, cz, 0);
        place('hospital-bed', cx + 1.5, cz, 0);
        place('patient-monitor', cx, cz - 0.8, 0);
        break;

      case 'sterilization':
        place('autoclave', cx - 1.2, cz, 0);
        place('utility-rack', cx + 1.3, cz, 0);
        break;

      case 'cytotoxic-prep':
        place('biosafety-cabinet', cx - 2.0, cz, 0);
        place('biosafety-cabinet', cx + 2.0, cz, 0);
        break;

      case 'lobby':
        place('reception-desk', cx - 2.5, z + 1.8, 0);
        place('waiting-chairs', cx + 2.5, cz, 0);
        break;

      case 'reception':
        place('reception-desk', cx, cz, 0);
        break;

      case 'waiting':
        place('waiting-chairs', cx - 1.5, cz - 1.0, 0);
        place('waiting-chairs', cx + 1.5, cz + 1.0, 0);
        break;

      case 'cafeteria':
        place('cafeteria-table', x + 2.4, z + 2.5, 0);
        place('cafeteria-table', x + w - 2.4, z + 2.5, 0);
        place('cafeteria-table', x + 2.4, z + d - 2.5, 0);
        place('cafeteria-table', x + w - 2.4, z + d - 2.5, 0);
        break;

      case 'kitchen':
        place('milk-fridge', x + 1.5, cz, 0);
        place('utility-rack', cx + 1.2, cz, 0);
        break;

      case 'nurse-station':
        place('nurse-workstation', cx - 2.5, cz, 0);
        place('nurse-workstation', cx + 2.5, cz, 0);
        break;

      case 'ar-activity':
        place('vr-station', cx - 2.0, cz, 0);
        place('vr-station', cx + 2.0, cz, 0);
        break;

      case 'hydrotherapy':
        place('hydro-pool', cx, cz, 0);
        break;

      case 'physio-room':
        place('physio-plinth', cx - 2.2, cz, 0);
        place('physio-plinth', cx + 2.2, cz, 0);
        break;

      case 'meeting':
      case 'classroom':
        place('conference-table', cx, cz, 0);
        break;

      case 'doctor-office':
      case 'staff-room':
      case 'tech-support':
      case 'psych-therapy':
        place('office-desk', cx, cz, 0);
        break;

      case 'changing':
        place('locker-bank', cx - 1.2, cz, 0);
        place('locker-bank', cx + 1.2, cz, 0);
        break;

      case 'scrub-up':
      case 'toilet':
        place('sink', cx - 0.8, cz, 0);
        place('sink', cx + 0.8, cz, 0);
        break;

      case 'nursery':
        place('incubator', cx - 1.2, cz, 0);
        place('incubator', cx + 1.2, cz, 0);
        place('nurse-workstation', cx, z + d - 1.5, 0);
        break;

      case 'services':
      case 'anesthesia':
        place('utility-rack', cx - 0.8, cz, 0);
        if (room.id.includes('dirty')) {
          place('sluice-sink', cx + 0.9, cz, 0);
        }
        break;

      case 'corridor':
        this.addWayfindingArrow(roomGroup, cx, cz, w >= d);
        break;

      default:
        break;
    }

    if (room.type !== 'corridor' && room.type !== 'courtyard' && room.doors?.length) {
      this.addDoorSign(room, roomGroup);
    }
  }

  private static addDoorSign(room: RoomSpec, roomGroup: THREE.Group): void {
    const door = room.doors![0];
    const { x, z, w, d } = room.bounds;
    const signGeo = new THREE.BoxGeometry(0.9, 0.24, 0.03);
    const sign = new THREE.Mesh(signGeo, getDoorSignMaterial(room.name));
    sign.userData.id = room.id;

    if (door.wall === 'N') {
      sign.position.set(x + door.offset + door.width / 2, 2.45, z - 0.04);
    } else if (door.wall === 'S') {
      sign.position.set(x + door.offset + door.width / 2, 2.45, z + d + 0.04);
    } else if (door.wall === 'W') {
      sign.rotation.y = Math.PI / 2;
      sign.position.set(x - 0.04, 2.45, z + door.offset + door.width / 2);
    } else {
      sign.rotation.y = Math.PI / 2;
      sign.position.set(x + w + 0.04, 2.45, z + door.offset + door.width / 2);
    }

    roomGroup.add(sign);
  }

  private static addWayfindingArrow(roomGroup: THREE.Group, cx: number, cz: number, horizontal: boolean): void {
    const arrow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x0f768a, transparent: true, opacity: 0.45 }),
    );
    arrow.rotation.x = -Math.PI / 2;
    if (!horizontal) arrow.rotation.z = Math.PI / 2;
    arrow.position.set(cx, 0.03, cz);
    roomGroup.add(arrow);
  }
}
