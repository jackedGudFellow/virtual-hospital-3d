import { EventBus } from '../core/Events';
import { HospitalIndex } from '../core/HospitalIndex';
import { RoomTypesMap } from '../core/HospitalTypes';
import { onLangChange, t } from '../core/I18n';
import { DrugSpec } from '../rooms/PharmacyTypes';
import { EquipmentEntry } from './InfoPanel';

/**
 * Unified search box finding Rooms, Medications (Pharmacy), and Medical Equipment.
 */
export class SearchBox {
  private el: HTMLElement;
  private index: HospitalIndex;
  private bus: EventBus;
  private roomTypes: RoomTypesMap;
  private equipmentMap: Record<string, EquipmentEntry>;
  private drugs: DrugSpec[];
  private input!: HTMLInputElement;
  private resultsEl!: HTMLElement;

  constructor(
    container: HTMLElement,
    index: HospitalIndex,
    bus: EventBus,
    roomTypes: RoomTypesMap = {},
    equipmentMap: Record<string, EquipmentEntry> = {},
    drugs: DrugSpec[] = [],
  ) {
    this.el = container;
    this.index = index;
    this.bus = bus;
    this.roomTypes = roomTypes;
    this.equipmentMap = equipmentMap;
    this.drugs = drugs;
    this.render();
  }

  private render(): void {
    this.el.innerHTML = `
      <div class="search-box-wrap">
        <input
          type="search"
          class="search-input"
          id="hospital-search-input"
          placeholder="${t('searchPlaceholder')}"
          aria-label="Search rooms, drugs, and equipment"
          autocomplete="off"
        />
        <div class="search-results hidden" id="hospital-search-results" role="listbox"></div>
      </div>
    `;

    this.input = this.el.querySelector('#hospital-search-input') as HTMLInputElement;
    this.resultsEl = this.el.querySelector('#hospital-search-results') as HTMLElement;

    this.input.addEventListener('input', () => this.updateResults());
    this.input.addEventListener('focus', () => this.updateResults());
    onLangChange(() => {
      this.input.placeholder = t('searchPlaceholder');
    });
    document.addEventListener('click', (e) => {
      if (!this.el.contains(e.target as Node)) {
        this.resultsEl.classList.add('hidden');
      }
    });
  }

  private findRoomForEquipment(eqName: string): string | null {
    const q = eqName.toLowerCase();
    for (const entry of this.index.rooms.values()) {
      const rt = this.roomTypes[entry.room.type];
      if (!rt) continue;
      if (rt.equipment.some((e) => e.toLowerCase().includes(q) || q.includes(e.toLowerCase().split(' ')[0]))) {
        return entry.room.id;
      }
    }
    return null;
  }

  private updateResults(): void {
    const query = this.input.value.trim();
    const q = query.toLowerCase();
    if (!q) {
      this.resultsEl.classList.add('hidden');
      this.resultsEl.innerHTML = '';
      return;
    }

    const roomMatches = this.index.search(q, 5);
    const drugMatches = this.drugs
      .filter((d) => `${d.genericName} ${d.brandExamples.join(' ')} ${d.drugClass}`.toLowerCase().includes(q))
      .slice(0, 4);
    const equipMatches = Object.entries(this.equipmentMap)
      .filter(([, eq]) => `${eq.name} ${eq.category}`.toLowerCase().includes(q))
      .slice(0, 3);

    if (roomMatches.length === 0 && drugMatches.length === 0 && equipMatches.length === 0) {
      this.resultsEl.classList.add('hidden');
      this.resultsEl.innerHTML = '';
      return;
    }

    let html = '';

    if (roomMatches.length > 0) {
      html += `<div class="search-group-label">Rooms</div>`;
      html += roomMatches
        .map(
          (m) => `
          <button type="button" class="search-result-item" data-kind="room" data-room-id="${m.room.id}">
            <span class="search-result-floor">${m.floor.id}</span>
            <span class="search-result-name">${m.room.name}</span>
          </button>`,
        )
        .join('');
    }

    if (drugMatches.length > 0) {
      html += `<div class="search-group-label">Medications (L1 Pharmacy)</div>`;
      html += drugMatches
        .map(
          (d) => `
          <button type="button" class="search-result-item" data-kind="drug" data-drug-id="${d.id}" data-drug-name="${d.genericName}">
            <span class="search-result-floor" style="background:#d1fae5;color:#065f46">Cab ${d.cabinet}</span>
            <span class="search-result-name">${d.genericName} (${d.strength})</span>
          </button>`,
        )
        .join('');
    }

    if (equipMatches.length > 0) {
      html += `<div class="search-group-label">Equipment</div>`;
      html += equipMatches
        .map(([, eq]) => {
          const rid = this.findRoomForEquipment(eq.name) ?? 'L1.icu.main';
          return `
          <button type="button" class="search-result-item" data-kind="equip" data-room-id="${rid}">
            <span class="search-result-floor" style="background:#ede9fe;color:#5b21b6">Equip</span>
            <span class="search-result-name">${eq.name}</span>
          </button>`;
        })
        .join('');
    }

    this.resultsEl.classList.remove('hidden');
    this.resultsEl.innerHTML = html;

    for (const btn of this.resultsEl.querySelectorAll<HTMLButtonElement>('.search-result-item')) {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.kind;
        this.resultsEl.classList.add('hidden');
        this.input.blur();

        if (kind === 'drug') {
          const drugId = btn.dataset.drugId;
          const drugName = btn.dataset.drugName ?? '';
          this.bus.emit('room:enter', { roomId: 'L1.pharmacy.dispensing' });
          if (drugId) {
            this.bus.emit('pharmacy:search', { query: drugName });
            this.bus.emit('pharmacy:drug', { drugId });
          }
          return;
        }

        const roomId = btn.dataset.roomId;
        if (roomId) {
          this.bus.emit('search:flyto', { roomId });
        }
      });
    }
  }
}
