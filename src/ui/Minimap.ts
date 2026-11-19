import * as THREE from 'three';
import { EventBus } from '../core/Events';
import { HospitalIndex } from '../core/HospitalIndex';
import { onLangChange, t } from '../core/I18n';

/**
 * Interactive 2D canvas minimap: click any room to fly straight to it,
 * with a live "you are here" indicator.
 */
export class Minimap {
  private el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private titleEl: HTMLElement;
  private index: HospitalIndex;
  private bus: EventBus;
  private activeFloorId = 'L1';
  private activeRoomId: string | null = null;

  constructor(container: HTMLElement, index: HospitalIndex, bus: EventBus) {
    this.el = container;
    this.index = index;
    this.bus = bus;
    this.el.setAttribute('role', 'region');
    this.el.setAttribute('aria-label', 'Floor minimap');
    const floorTabs = this.index.floors
      .map(
        (f) =>
          `<button type="button" class="minimap-tab ${f.id === 'L1' ? 'active' : ''}" data-mm-floor="${f.id}">${f.id}</button>`,
      )
      .join('');

    this.el.innerHTML = `
      <div class="minimap-header">
        <span class="minimap-title" id="minimap-title">${t('minimapFloor')} L1</span>
        <span class="minimap-sub" id="minimap-sub">${t('minimapSub')}</span>
      </div>
      <div class="minimap-tabs" role="group" aria-label="Minimap floor selector">${floorTabs}</div>
      <canvas width="180" height="150" class="minimap-canvas" id="minimap-canvas" title="Click any room to fly there"></canvas>
    `;
    this.canvas = this.el.querySelector('#minimap-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.titleEl = this.el.querySelector('#minimap-title') as HTMLElement;

    for (const tab of this.el.querySelectorAll<HTMLButtonElement>('.minimap-tab')) {
      tab.addEventListener('click', () => {
        const fid = tab.dataset.mmFloor;
        if (fid) {
          this.bus.emit('floor:view', { viewMode: 'isolate', floorId: fid });
        }
      });
    }

    onLangChange(() => {
      this.titleEl.textContent = `${t('minimapFloor')} ${this.activeFloorId}`;
      const sub = this.el.querySelector('#minimap-sub');
      if (sub) sub.textContent = t('minimapSub');
    });

    this.canvas.addEventListener('click', (e) => this.handleClick(e));
  }

  private getTransform(): { pad: number; scale: number } {
    const maxW = this.activeFloorId === 'L2' ? 84 : 58;
    const maxD = 62;
    const pad = 8;
    const scale = Math.min((this.canvas.width - pad * 2) / maxW, (this.canvas.height - pad * 2) / maxD);
    return { pad, scale };
  }

  private handleClick(e: MouseEvent): void {
    const floor = this.index.floors.find((f) => f.id === this.activeFloorId) ?? this.index.floors[0];
    if (!floor) return;
    const rect = this.canvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * this.canvas.width;
    const cy = ((e.clientY - rect.top) / rect.height) * this.canvas.height;
    const { pad, scale } = this.getTransform();
    const wx = (cx - pad) / scale;
    const wz = (cy - pad) / scale;

    const hit = floor.rooms.find(
      (r) => wx >= r.bounds.x && wx <= r.bounds.x + r.bounds.w && wz >= r.bounds.z && wz <= r.bounds.z + r.bounds.d,
    );
    if (hit) {
      this.bus.emit('search:flyto', { roomId: hit.id });
    }
  }

  setContext(floorId: string | null, roomId: string | null): void {
    this.activeFloorId = floorId ?? 'L1';
    this.activeRoomId = roomId;
    this.titleEl.textContent = `${t('minimapFloor')} ${this.activeFloorId}`;
    for (const tab of this.el.querySelectorAll<HTMLButtonElement>('.minimap-tab')) {
      tab.classList.toggle('active', tab.dataset.mmFloor === this.activeFloorId);
    }
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
