import { EventBus } from '../core/Events';
import { IndexedRoom } from '../core/HospitalIndex';
import { DepartmentSpec, RoomTypesMap } from '../core/HospitalTypes';
import { AppMode } from '../core/StateStore';

export interface EquipmentEntry {
  name: string;
  category: string;
  description: string;
}

/**
 * Displays selected room details (name, department, area, purpose, equipment)
 * or a mini info card when a piece of equipment is clicked inside a room.
 */
export class InfoPanel {
  private el: HTMLElement;
  private bus: EventBus;
  private departments: Record<string, DepartmentSpec>;
  private roomTypes: RoomTypesMap;
  private equipmentMap: Record<string, EquipmentEntry>;
  private currentRoom: IndexedRoom | null = null;
  private currentMode: AppMode = 'EXTERIOR';
  private selectedEquipKey: string | null = null;

  constructor(
    container: HTMLElement,
    bus: EventBus,
    departments: Record<string, DepartmentSpec>,
    roomTypes: RoomTypesMap,
    equipmentMap: Record<string, EquipmentEntry> = {},
  ) {
    this.el = container;
    this.bus = bus;
    this.departments = departments;
    this.roomTypes = roomTypes;
    this.equipmentMap = equipmentMap;
    this.render();
  }

  setRoom(indexed: IndexedRoom | null, mode: AppMode): void {
    this.currentRoom = indexed;
    this.currentMode = mode;
    if (mode !== 'ITEM') {
      this.selectedEquipKey = null;
    }
    this.render();
  }

  setEquipment(eqKey: string | null): void {
    this.selectedEquipKey = eqKey;
    this.render();
  }

  private render(): void {
    if (this.selectedEquipKey && this.equipmentMap[this.selectedEquipKey]) {
      const eq = this.equipmentMap[this.selectedEquipKey];
      this.el.classList.remove('hidden');
      this.el.innerHTML = `
        <div class="info-panel-header">
          <span class="info-dept-badge" style="background:#f0fdfa; color:#0f768a; border-color:#0f768a">
            ${eq.category}
          </span>
          <button type="button" class="info-close-btn" id="info-eq-close">← Room</button>
        </div>
        <h2 class="info-room-title">${eq.name}</h2>
        <p class="info-room-desc">${eq.description}</p>
        <div class="info-walk-hint">Click another object or press Esc to return</div>
      `;
      this.el.querySelector('#info-eq-close')?.addEventListener('click', () => {
        this.bus.emit('item:select', { itemId: null, equipmentType: null });
      });
      return;
    }

    if (!this.currentRoom) {
      this.el.classList.add('hidden');
      this.el.innerHTML = '';
      return;
    }

    const { room, floor, areaM2 } = this.currentRoom;
    const dept = this.departments[room.department];
    const typeInfo = this.roomTypes[room.type];
    const equipList = (typeInfo?.equipment ?? [])
      .map((item) => `<li>${item}</li>`)
      .join('');

    const isInside = this.currentMode === 'ROOM';

    this.el.classList.remove('hidden');
    this.el.innerHTML = `
      <div class="info-panel-header">
        <span class="info-dept-badge" style="background:${dept?.floorColor ?? '#eef'}; color:${dept?.accentColor ?? '#0f768a'}; border-color:${dept?.accentColor ?? '#0f768a'}">
          ${floor.id} · ${dept?.name ?? room.department}
        </span>
        <button type="button" class="info-close-btn" id="info-back-btn" title="Back (Esc)">← Back</button>
      </div>
      <h2 class="info-room-title">${room.name}</h2>
      <div class="info-room-meta">Area: <strong>${areaM2} m²</strong> · Type: ${typeInfo?.name ?? room.type}</div>
      <p class="info-room-desc">${typeInfo?.description ?? 'Hospital clinical and support space.'}</p>
      ${
        equipList
          ? `<div class="info-equip-section">
              <div class="info-equip-title">Key Equipment</div>
              <ul class="info-equip-list">${equipList}</ul>
            </div>`
          : ''
      }
      <div class="info-actions">
        ${
          isInside
            ? `<button type="button" class="hud-btn active info-enter-btn" id="info-walk-toggle">Toggle Walk Mode (WASD)</button>
               <div class="info-walk-hint">Orbit/Zoom freely or toggle Walk Mode to stroll across the floor · Esc to exit</div>`
            : `<button type="button" class="hud-btn active info-enter-btn" id="info-enter-btn">Enter Room</button>`
        }
      </div>
    `;

    this.el.querySelector('#info-back-btn')?.addEventListener('click', () => {
      this.bus.emit('nav:up', {});
    });

    this.el.querySelector('#info-enter-btn')?.addEventListener('click', () => {
      if (this.currentRoom) {
        this.bus.emit('room:enter', { roomId: this.currentRoom.room.id });
      }
    });

    this.el.querySelector('#info-walk-toggle')?.addEventListener('click', () => {
      this.bus.emit('camera:toggleWalk', {});
    });
  }
}
