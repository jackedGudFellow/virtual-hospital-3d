import * as THREE from 'three';
import { EventBus } from '../core/Events';
import { HospitalIndex } from '../core/HospitalIndex';
import { RoomTypesMap } from '../core/HospitalTypes';
import { LangCode, t } from '../core/I18n';
import { StateStore } from '../core/StateStore';
import { DrugSpec } from '../rooms/PharmacyTypes';
import { Breadcrumb } from './Breadcrumb';
import { EquipmentEntry, InfoPanel } from './InfoPanel';
import { Minimap } from './Minimap';
import { PharmacyPanel } from './PharmacyPanel';
import { SearchBox } from './SearchBox';
import { TouchJoystick } from './TouchJoystick';

const QUICK_JUMPS = [
  { label: 'Lobby', roomId: 'L1.main.lobby' },
  { label: 'Pharmacy', roomId: 'L1.pharmacy.dispensing' },
  { label: 'ICU', roomId: 'L1.icu.main' },
  { label: 'Surgery', roomId: 'L1.surgery.or-1' },
  { label: 'Chemo', roomId: 'L1.chemo.bay' },
  { label: 'NICU', roomId: 'L2.nicu.open-ward' },
];

/**
 * Clean, de-cluttered HUD: Elevator Floor Rail, Quick-Jump chips, Settings popover,
 * collapsible Department Legend, interactive Minimap, InfoPanel, and PharmacyPanel.
 */
export class Hud {
  private root: HTMLElement;
  private store: StateStore;
  private bus: EventBus;
  private index: HospitalIndex;
  private roomTypes: RoomTypesMap;
  private equipmentMap: Record<string, EquipmentEntry>;
  private drugs: DrugSpec[];
  public pharmacyPanel!: PharmacyPanel;

  private debugEl!: HTMLElement;
  private fpsEl!: HTMLElement;
  private modeEl!: HTMLElement;
  private tooltipEl!: HTMLElement;
  private settingsMenu!: HTMLElement;
  private legendBody!: HTMLElement;
  private ceilBtn!: HTMLButtonElement;
  private topDownBtn!: HTMLButtonElement;
  private labelsBtn!: HTMLButtonElement;
  private floorBtns: HTMLButtonElement[] = [];
  private tourBanner!: HTMLElement;
  private tourTitleEl!: HTMLElement;

  private breadcrumb!: Breadcrumb;
  private infoPanel!: InfoPanel;
  private minimap!: Minimap;
  private touchJoystick!: TouchJoystick;

  private isTopDown = false;
  private labelsVisible = true;
  private isNight = false;
  private soundOn = false;
  private lowQuality = false;
  private highContrast = false;
  private lang: LangCode = 'en';

  constructor(
    root: HTMLElement,
    store: StateStore,
    bus: EventBus,
    index: HospitalIndex,
    roomTypes: RoomTypesMap,
    equipmentMap: Record<string, EquipmentEntry>,
    drugs: DrugSpec[],
    onJoystick: (x: number, y: number) => void,
  ) {
    this.root = root;
    this.store = store;
    this.bus = bus;
    this.index = index;
    this.roomTypes = roomTypes;
    this.equipmentMap = equipmentMap;
    this.drugs = drugs;
    this.render();
    this.initSubModules(onJoystick);
    this.bindEvents();
  }

  private render(): void {
    const legendItems = Object.values(this.index.data.departments)
      .map(
        (d) => `
        <div class="hud-legend-item" title="${d.name}">
          <span class="hud-legend-swatch" style="background:${d.floorColor}; border-color:${d.accentColor}"></span>
          <span>${d.name}</span>
        </div>`,
      )
      .join('');

    const floorButtons = [...this.index.floors]
      .reverse()
      .map(
        (f) =>
          `<button type="button" class="hud-btn floor-btn rail-btn" data-floor-mode="isolate" data-floor-id="${f.id}">${f.id}</button>`,
      )
      .join('');

    const quickBtns = QUICK_JUMPS.map(
      (q) => `<button type="button" class="quick-chip" data-jump-room="${q.roomId}">${q.label}</button>`,
    ).join('');

    const ceilOn = this.store.getState().ceilingsVisible;

    this.root.innerHTML = `
      <div class="hud-top-bar">
        <div class="hud-top-left">
          <div class="hud-brand hud-interactive">
            <span class="hud-brand-dot" aria-hidden="true"></span>
            <div>
              <div class="hud-brand-title">${t(this.lang, 'brandTitle')}</div>
              <div class="hud-breadcrumb-inline" id="hud-breadcrumb"></div>
            </div>
          </div>
          <div class="hud-search-row hud-interactive">
            <div id="hud-search"></div>
            <div class="quick-jump-strip" aria-label="Quick jump to department">${quickBtns}</div>
          </div>
        </div>

        <div class="hud-controls hud-interactive">
          <button type="button" class="hud-btn" id="btn-tour" aria-label="Start guided hospital tour">${t(this.lang, 'tour')}</button>
          <div class="settings-wrap">
            <button type="button" class="hud-btn" id="btn-settings" aria-label="Open view and accessibility settings">Settings ▾</button>
            <div class="settings-popover hidden" id="settings-popover">
              <button type="button" class="hud-btn ${ceilOn ? 'active' : ''}" id="btn-toggle-ceilings">Ceilings: ${ceilOn ? 'On' : 'Off'}</button>
              <button type="button" class="hud-btn" id="btn-toggle-topdown">View: 3D Orbit</button>
              <button type="button" class="hud-btn active" id="btn-toggle-labels">Labels: On</button>
              <button type="button" class="hud-btn" id="btn-daynight">${t(this.lang, 'day')}</button>
              <button type="button" class="hud-btn" id="btn-sound">${t(this.lang, 'soundOff')}</button>
              <button type="button" class="hud-btn" id="btn-quality">${t(this.lang, 'qualityHigh')}</button>
              <button type="button" class="hud-btn" id="btn-contrast">${t(this.lang, 'contrast')}</button>
              <button type="button" class="hud-btn" id="btn-lang">${t(this.lang, 'langBtn')}</button>
            </div>
          </div>
          <button type="button" class="hud-btn" id="btn-help" aria-label="How to explore help guide">?</button>
          <div class="hud-status-pill" id="hud-mode-pill">Mode: ${this.store.getState().mode}</div>
        </div>
      </div>

      <div class="elevator-rail hud-interactive" aria-label="Floor switcher">
        <button type="button" class="hud-btn floor-btn rail-btn active" data-floor-mode="whole">All</button>
        <button type="button" class="hud-btn floor-btn rail-btn" data-floor-mode="exploded">Split</button>
        <div class="rail-divider"></div>
        ${floorButtons}
      </div>

      <div class="info-panel hud-interactive hidden" id="hud-info-panel"></div>
      <div class="hud-interactive" id="hud-pharmacy-root"></div>

      <div class="pharmacy-modal hud-interactive hidden" id="hud-help-modal" role="dialog" aria-modal="true" aria-label="How to Explore">
        <div class="pharmacy-modal-card">
          <h3>How to Explore Virtual Hospital 3D</h3>
          <ul class="info-equip-list">
            <li><strong>Floor Rail (Left):</strong> Click <em>L1–L5</em> to isolate any floor, <em>Split</em> for exploded view, or <em>All</em> for exterior.</li>
            <li><strong>Quick Jump & Minimap:</strong> Use the top chips or click any room on the bottom-left minimap to fly straight there.</li>
            <li><strong>Inspect & Walk:</strong> Click a room for details; double-click or click <em>Enter Room</em> to orbit inside or toggle <em>Walk Mode (WASD)</em> to stroll through doors.</li>
            <li><strong>Pharmacy (L1):</strong> Jump to Pharmacy, click cabinets <em>A–L</em> or the Dispensing Window, and inspect 120 real medications.</li>
            <li><strong>Shortcuts:</strong> <em>Esc</em> (step back) · <em>~</em> (FPS stats).</li>
          </ul>
          <div class="pharmacy-modal-actions">
            <button type="button" class="hud-btn active" id="help-close-btn">Got it</button>
          </div>
          <div class="drug-disclaimer">Educational simulation only. Not medical advice.</div>
        </div>
      </div>

      <div class="hud-bottom-bar">
        <div class="hud-bottom-left">
          <div class="minimap-card hud-interactive" id="hud-minimap"></div>
        </div>
        <div class="hud-legend-wrap hud-interactive">
          <button type="button" class="hud-btn" id="btn-toggle-legend">Departments ▾</button>
          <div class="hud-legend hidden" id="hud-legend-body">
            <div class="hud-legend-grid">${legendItems}</div>
          </div>
        </div>
      </div>

      <div class="touch-joystick hud-interactive hidden" id="hud-joystick"></div>
      <div class="tour-banner hud-interactive hidden" id="tour-banner" role="status" aria-live="polite">
        <span id="tour-step-title">Guided Tour</span>
        <button type="button" class="hud-btn" id="tour-skip-btn" aria-label="Skip guided tour">Skip Tour</button>
      </div>
      <div class="hover-tooltip hidden" id="hover-tooltip"></div>

      <div class="debug-overlay hidden" id="debug-overlay" role="status" aria-live="polite">
        <div class="debug-overlay-title">DEBUG STATS</div>
        <div id="debug-fps">FPS: --</div>
      </div>
    `;

    this.debugEl = this.root.querySelector('#debug-overlay') as HTMLElement;
    this.fpsEl = this.root.querySelector('#debug-fps') as HTMLElement;
    this.modeEl = this.root.querySelector('#hud-mode-pill') as HTMLElement;
    this.tooltipEl = this.root.querySelector('#hover-tooltip') as HTMLElement;
    this.settingsMenu = this.root.querySelector('#settings-popover') as HTMLElement;
    this.legendBody = this.root.querySelector('#hud-legend-body') as HTMLElement;
    this.ceilBtn = this.root.querySelector('#btn-toggle-ceilings') as HTMLButtonElement;
    this.topDownBtn = this.root.querySelector('#btn-toggle-topdown') as HTMLButtonElement;
    this.labelsBtn = this.root.querySelector('#btn-toggle-labels') as HTMLButtonElement;
    this.floorBtns = Array.from(this.root.querySelectorAll('.floor-btn'));
    this.tourBanner = this.root.querySelector('#tour-banner') as HTMLElement;
    this.tourTitleEl = this.root.querySelector('#tour-step-title') as HTMLElement;
  }

  private initSubModules(onJoystick: (x: number, y: number) => void): void {
    this.breadcrumb = new Breadcrumb(this.root.querySelector('#hud-breadcrumb')!, this.bus);
    new SearchBox(this.root.querySelector('#hud-search')!, this.index, this.bus);
    this.infoPanel = new InfoPanel(
      this.root.querySelector('#hud-info-panel')!,
      this.bus,
      this.index.data.departments,
      this.roomTypes,
      this.equipmentMap,
    );
    this.minimap = new Minimap(this.root.querySelector('#hud-minimap')!, this.index, this.bus);
    this.touchJoystick = new TouchJoystick(this.root.querySelector('#hud-joystick')!, onJoystick);
    this.pharmacyPanel = new PharmacyPanel(this.root.querySelector('#hud-pharmacy-root')!, this.drugs, this.bus);
  }

  private bindEvents(): void {
    this.bus.on('engine:fps', ({ fps, frameTimeMs, drawCalls, triangles }) => {
      this.fpsEl.innerHTML = `FPS: ${fps} (${frameTimeMs} ms)<br>Calls: ${drawCalls}<br>Tris: ${triangles}`;
    });

    this.bus.on('debug:toggle', ({ visible }) => {
      this.debugEl.classList.toggle('hidden', !visible);
    });

    this.bus.on('room:hover', ({ roomId, x, y }) => {
      if (!roomId) {
        this.tooltipEl.classList.add('hidden');
        return;
      }
      const entry = this.index.rooms.get(roomId);
      if (!entry) return;
      this.tooltipEl.textContent = `${entry.floor.id} · ${entry.room.name}`;
      this.tooltipEl.style.left = `${x}px`;
      this.tooltipEl.style.top = `${y}px`;
      this.tooltipEl.classList.remove('hidden');
    });

    this.bus.on('item:hover', ({ equipmentType, x, y }) => {
      if (!equipmentType) {
        this.tooltipEl.classList.add('hidden');
        return;
      }
      const eq = this.equipmentMap[equipmentType];
      if (!eq) return;
      this.tooltipEl.textContent = eq.name;
      this.tooltipEl.style.left = `${x}px`;
      this.tooltipEl.style.top = `${y}px`;
      this.tooltipEl.classList.remove('hidden');
    });

    this.bus.on('item:select', ({ equipmentType }) => {
      this.infoPanel.setEquipment(equipmentType);
    });

    this.bus.on('state:changed', () => this.syncFromState());

    this.bus.on('floor:view', ({ viewMode, floorId }) => {
      for (const b of this.floorBtns) {
        const match =
          b.dataset.floorMode === viewMode && (viewMode !== 'isolate' || b.dataset.floorId === floorId);
        b.classList.toggle('active', match);
      }
    });

    for (const btn of this.floorBtns) {
      btn.addEventListener('click', () => {
        const viewMode = (btn.dataset.floorMode ?? 'whole') as 'whole' | 'exploded' | 'isolate';
        const floorId = btn.dataset.floorId ?? null;
        this.bus.emit('floor:view', { viewMode, floorId });
      });
    }

    for (const chip of this.root.querySelectorAll<HTMLButtonElement>('.quick-chip')) {
      chip.addEventListener('click', () => {
        const roomId = chip.dataset.jumpRoom;
        if (roomId) this.bus.emit('room:enter', { roomId });
      });
    }

    this.root.querySelector('#btn-settings')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.settingsMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
      if (!this.settingsMenu.contains(e.target as Node)) {
        this.settingsMenu.classList.add('hidden');
      }
    });

    this.root.querySelector('#btn-toggle-legend')?.addEventListener('click', () => {
      this.legendBody.classList.toggle('hidden');
    });

    this.ceilBtn.addEventListener('click', () => {
      this.store.set('ceilingsVisible', !this.store.getState().ceilingsVisible);
    });

    this.topDownBtn.addEventListener('click', () => {
      this.isTopDown = !this.isTopDown;
      this.topDownBtn.textContent = this.isTopDown ? 'View: 2D Top-Down' : 'View: 3D Orbit';
      this.topDownBtn.classList.toggle('active', this.isTopDown);
      this.bus.emit('camera:preset', { preset: this.isTopDown ? 'topdown' : 'orbit' });
    });

    this.labelsBtn.addEventListener('click', () => {
      this.labelsVisible = !this.labelsVisible;
      this.labelsBtn.textContent = `Labels: ${this.labelsVisible ? 'On' : 'Off'}`;
      this.labelsBtn.classList.toggle('active', this.labelsVisible);
      this.bus.emit('labels:toggle', { visible: this.labelsVisible });
    });

    this.root.querySelector('#btn-tour')?.addEventListener('click', () => {
      this.bus.emit('tour:start', {});
    });
    this.root.querySelector('#tour-skip-btn')?.addEventListener('click', () => {
      this.bus.emit('tour:stop', {});
    });

    this.bus.on('tour:step', ({ title, active }) => {
      this.tourBanner.classList.toggle('hidden', !active);
      if (title) this.tourTitleEl.textContent = title;
    });

    const dnBtn = this.root.querySelector('#btn-daynight') as HTMLButtonElement;
    dnBtn?.addEventListener('click', () => {
      this.isNight = !this.isNight;
      dnBtn.textContent = t(this.lang, this.isNight ? 'night' : 'day');
      dnBtn.classList.toggle('active', this.isNight);
      this.bus.emit('ui:daynight', { night: this.isNight });
    });

    const sndBtn = this.root.querySelector('#btn-sound') as HTMLButtonElement;
    sndBtn?.addEventListener('click', () => {
      this.soundOn = !this.soundOn;
      sndBtn.textContent = t(this.lang, this.soundOn ? 'soundOn' : 'soundOff');
      sndBtn.classList.toggle('active', this.soundOn);
      this.bus.emit('ui:sound', { enabled: this.soundOn });
    });

    const qualBtn = this.root.querySelector('#btn-quality') as HTMLButtonElement;
    qualBtn?.addEventListener('click', () => {
      this.lowQuality = !this.lowQuality;
      qualBtn.textContent = t(this.lang, this.lowQuality ? 'qualityLow' : 'qualityHigh');
      qualBtn.classList.toggle('active', this.lowQuality);
      this.bus.emit('ui:quality', { low: this.lowQuality });
    });

    const hcBtn = this.root.querySelector('#btn-contrast') as HTMLButtonElement;
    hcBtn?.addEventListener('click', () => {
      this.highContrast = !this.highContrast;
      hcBtn.classList.toggle('active', this.highContrast);
      document.getElementById('app')?.classList.toggle('high-contrast', this.highContrast);
    });

    const langBtn = this.root.querySelector('#btn-lang') as HTMLButtonElement;
    langBtn?.addEventListener('click', () => {
      this.lang = this.lang === 'en' ? 'ar' : 'en';
      document.documentElement.dir = this.lang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = this.lang;
      const titleEl = this.root.querySelector('.hud-brand-title');
      if (titleEl) titleEl.textContent = t(this.lang, 'brandTitle');
      langBtn.textContent = t(this.lang, 'langBtn');
    });

    const helpModal = this.root.querySelector('#hud-help-modal') as HTMLElement;
    this.root.querySelector('#btn-help')?.addEventListener('click', () => {
      helpModal.classList.remove('hidden');
    });
    this.root.querySelector('#help-close-btn')?.addEventListener('click', () => {
      helpModal.classList.add('hidden');
    });

    window.addEventListener('keydown', this.handleKeyDown);
  }

  private syncFromState(): void {
    const s = this.store.getState();
    this.modeEl.textContent = `Mode: ${s.mode}`;
    this.ceilBtn.textContent = `Ceilings: ${s.ceilingsVisible ? 'On' : 'Off'}`;
    this.ceilBtn.classList.toggle('active', s.ceilingsVisible);

    const indexedRoom = s.activeRoom ? this.index.rooms.get(s.activeRoom) ?? null : null;
    this.infoPanel.setRoom(indexedRoom, s.mode);
    this.breadcrumb.update(s.mode, s.activeFloor, indexedRoom?.room.name ?? null);
    this.minimap.setContext(s.activeFloor ?? indexedRoom?.floor.id ?? 'L1', s.activeRoom);
    this.pharmacyPanel.setVisible(s.mode === 'ROOM' && s.activeRoom === 'L1.pharmacy.dispensing');
    if (s.mode === 'ROOM') {
      this.tooltipEl.classList.add('hidden');
    }
  }

  setJoystickVisible(visible: boolean): void {
    this.touchJoystick.setVisible(visible);
  }

  updateMinimap(cameraPos: THREE.Vector3, yaw: number): void {
    this.minimap.update(cameraPos, yaw);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === '~' || e.key === '`' || e.code === 'Backquote') {
      this.store.toggleDebugOverlay();
    } else if (e.key === 'Escape') {
      this.bus.emit('nav:up', {});
    }
  };

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
  }
}
