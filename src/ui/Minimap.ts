import * as THREE from 'three';
import { HospitalIndex } from '../core/HospitalIndex';

/**
 * 2D canvas minimap showing the active floor plan and a live "you are here" indicator.
 */
export class Minimap {
  private el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private titleEl: HTMLElement;
  private index: HospitalIndex;
  private activeFloorId = 'L1';
  private activeRoomId: string | null = null;

  constructor(container: HTMLElement, index: HospitalIndex) {
    this.el = container;
    this.index = index;
    this.el.innerHTML = `
      <div class="minimap-header">
        <span class="minimap-title" id="minimap-title">Floor L1</span>
        <span class="minimap-sub">You are here ●</span>
      </div>
      <canvas width="180" height="150" class="minimap-canvas" id="minimap-canvas"></canvas>
    `;
    this.canvas = this.el.querySelector('#minimap-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.titleEl = this.el.querySelector('#minimap-title') as HTMLElement;
  }

  setContext(floorId: string | null, roomId: string | null): void {
    this.activeFloorId = floorId ?? 'L1';
    this.activeRoomId = roomId;
    this.titleEl.textContent = `Floor ${this.activeFloorId}`;
  }

  update(cameraPos: THREE.Vector3, yaw: number): void {
    const floor = this.index.floors.find((f) => f.id === this.activeFloorId) ?? this.index.floors[0];
    if (!floor) return;

    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    const [ox, oz] = this.index.data.building.originOffset;
    const maxW = this.activeFloorId === 'L2' ? 84 : 58;
    const maxD = 62;
    const pad = 8;
    const scale = Math.min((cw - pad * 2) / maxW, (ch - pad * 2) / maxD);

    for (const room of floor.rooms) {
      const dept = this.index.data.departments[room.department];
      const rx = pad + room.bounds.x * scale;
      const rz = pad + room.bounds.z * scale;
      const rw = room.bounds.w * scale;
      const rd = room.bounds.d * scale;

      ctx.fillStyle = dept?.floorColor ?? '#e2e8f0';
      ctx.fillRect(rx, rz, rw, rd);

      const isSelected = room.id === this.activeRoomId;
      ctx.strokeStyle = isSelected ? '#0f768a' : 'rgba(16,42,67,0.22)';
      ctx.lineWidth = isSelected ? 2 : 0.75;
      ctx.strokeRect(rx, rz, rw, rd);
    }

    // Draw "you are here" camera position & facing direction
    const localX = cameraPos.x - ox;
    const localZ = cameraPos.z - oz;
    const px = THREE.MathUtils.clamp(pad + localX * scale, 4, cw - 4);
    const pz = THREE.MathUtils.clamp(pad + localZ * scale, 4, ch - 4);

    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-yaw);
    ctx.fillStyle = 'rgba(15, 118, 138, 0.25)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-7, -14);
    ctx.lineTo(7, -14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#0f768a';
    ctx.beginPath();
    ctx.arc(px, pz, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
