import * as THREE from 'three';
import { EventBus } from '../core/Events';
import { createDrugMesh } from '../rooms/PharmacyDrugMesh';
import { DrugSpec, PHARMACY_CABINETS } from '../rooms/PharmacyTypes';

/**
 * Pharmacy UI: Drug Search Bar, 3D Drug Inspect Panel (drag-to-rotate + Prev/Next),
 * Controlled-Drug Pharmacist Badge Unlock, and Dispense-a-Prescription mini-interaction.
 */
export class PharmacyPanel {
  private root: HTMLElement;
  private drugs: DrugSpec[];
  private bus: EventBus;

  private toolbarEl!: HTMLElement;
  private inspectEl!: HTMLElement;
  private modalEl!: HTMLElement;

  private activeDrug: DrugSpec | null = null;
  private previewRenderer: THREE.WebGLRenderer | null = null;
  private previewRaf: number | null = null;

  constructor(container: HTMLElement, drugs: DrugSpec[], bus: EventBus) {
    this.root = container;
    this.drugs = drugs;
    this.bus = bus;
    this.renderShell();
  }

  private renderShell(): void {
    this.root.innerHTML = `
      <div class="pharmacy-toolbar hidden" id="pharmacy-toolbar">
        <div class="pharmacy-toolbar-title">Pharmacy Inventory (120 Drugs)</div>
        <input
          type="search"
          class="search-input"
          id="pharmacy-drug-search"
          placeholder="Search drug (e.g. insulin, morphine)..."
          autocomplete="off"
        />
        <button type="button" class="hud-btn active" id="pharmacy-dispense-open">Dispense Rx</button>
      </div>
      <div class="pharmacy-inspect hidden" id="pharmacy-inspect"></div>
      <div class="pharmacy-modal hidden" id="pharmacy-modal"></div>
    `;

    this.toolbarEl = this.root.querySelector('#pharmacy-toolbar') as HTMLElement;
    this.inspectEl = this.root.querySelector('#pharmacy-inspect') as HTMLElement;
    this.modalEl = this.root.querySelector('#pharmacy-modal') as HTMLElement;

    const searchInput = this.root.querySelector('#pharmacy-drug-search') as HTMLInputElement;
    searchInput.addEventListener('input', () => {
      this.bus.emit('pharmacy:search', { query: searchInput.value });
    });

    this.root.querySelector('#pharmacy-dispense-open')?.addEventListener('click', () => {
      this.openDispenseModal();
    });
  }

  setVisible(visible: boolean): void {
    this.toolbarEl.classList.toggle('hidden', !visible);
    if (!visible) {
      this.closeInspect();
      this.closeModal();
    }
  }

  showDrug(drugId: string): void {
    const drug = this.drugs.find((d) => d.id === drugId);
    if (!drug) return;
    this.activeDrug = drug;

    const cabDrugs = this.drugs.filter((d) => d.cabinet === drug.cabinet);
    const idx = cabDrugs.findIndex((d) => d.id === drug.id);

    this.inspectEl.classList.remove('hidden');
    this.inspectEl.innerHTML = `
      <div class="info-panel-header">
        <span class="info-dept-badge" style="background:#d1fae5; color:#065f46; border-color:#059669">
          Cab ${drug.cabinet} · Shelf ${drug.shelf} · Slot ${drug.slot}
        </span>
        <button type="button" class="info-close-btn" id="drug-close-btn">✕</button>
      </div>
      <div class="drug-preview-wrap">
        <canvas width="240" height="130" id="drug-preview-canvas"></canvas>
        <div class="drug-preview-hint">Drag to rotate 3D package</div>
      </div>
      <h2 class="info-room-title">${drug.genericName}</h2>
      <div class="info-room-meta"><strong>${drug.strength}</strong> · ${drug.form} · Schedule: <strong>${drug.schedule}</strong></div>
      <div class="drug-fields">
        <div><strong>Brands:</strong> ${drug.brandExamples.join(', ')}</div>
        <div><strong>Class:</strong> ${drug.drugClass}</div>
        <div><strong>Common uses:</strong> ${drug.commonUses}</div>
        <div><strong>Storage:</strong> ${drug.storage}</div>
        <div class="drug-warning"><strong>Key warnings:</strong> ${drug.keyWarnings}</div>
      </div>
      <div class="drug-nav-row">
        <button type="button" class="hud-btn" id="drug-prev-btn">← Prev</button>
        <span>${idx + 1} / ${cabDrugs.length}</span>
        <button type="button" class="hud-btn" id="drug-next-btn">Next →</button>
      </div>
      <div class="drug-disclaimer">Educational simulation. Not medical advice.</div>
    `;

    this.inspectEl.querySelector('#drug-close-btn')?.addEventListener('click', () => this.closeInspect());
    this.inspectEl.querySelector('#drug-prev-btn')?.addEventListener('click', () => {
      const prev = cabDrugs[(idx - 1 + cabDrugs.length) % cabDrugs.length];
      if (prev) this.showDrug(prev.id);
    });
    this.inspectEl.querySelector('#drug-next-btn')?.addEventListener('click', () => {
      const next = cabDrugs[(idx + 1) % cabDrugs.length];
      if (next) this.showDrug(next.id);
    });

    this.mountDrugPreview(drug);
  }

  private mountDrugPreview(drug: DrugSpec): void {
    this.disposePreview();
    const canvas = this.inspectEl.querySelector('#drug-preview-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(240, 130, false);
    this.previewRenderer = renderer;

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(35, 240 / 130, 0.05, 10);
    cam.position.set(0, 0.12, 0.42);
    cam.lookAt(0, 0.07, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.4));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(1, 2, 2);
    scene.add(dir);

    const cabMeta = PHARMACY_CABINETS.find((c) => c.id === drug.cabinet);
    const mesh = createDrugMesh(drug, cabMeta?.color ?? '#0f768a');
    mesh.scale.setScalar(1.35);
    scene.add(mesh);

    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      mesh.rotation.y += (e.clientX - lastX) * 0.015;
      mesh.rotation.x += (e.clientY - lastY) * 0.015;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener('pointerup', () => {
      dragging = false;
    });

    const loop = (): void => {
      this.previewRaf = requestAnimationFrame(loop);
      if (!dragging) mesh.rotation.y += 0.012;
      renderer.render(scene, cam);
    };
    loop();
  }

  openControlledBadgePrompt(): void {
    this.modalEl.classList.remove('hidden');
    this.modalEl.innerHTML = `
      <div class="pharmacy-modal-card">
        <h3>Controlled Drugs Cabinet (K)</h3>
        <p>This cabinet stores Schedule II/Controlled medications and is locked.</p>
        <div class="pharmacy-modal-actions">
          <button type="button" class="hud-btn active" id="badge-unlock-btn">Tap Pharmacist Badge</button>
          <button type="button" class="hud-btn" id="modal-cancel-btn">Cancel</button>
        </div>
        <div class="drug-disclaimer">Educational simulation. Not medical advice.</div>
      </div>
    `;
    this.modalEl.querySelector('#badge-unlock-btn')?.addEventListener('click', () => {
      this.bus.emit('pharmacy:unlockControlled', {});
      this.closeModal();
    });
    this.modalEl.querySelector('#modal-cancel-btn')?.addEventListener('click', () => this.closeModal());
  }

  openDispenseModal(): void {
    const options = this.drugs
      .slice(0, 40)
      .map((d) => `<option value="${d.id}">${d.genericName} (${d.strength}) — ${d.form}</option>`)
      .join('');

    this.modalEl.classList.remove('hidden');
    this.modalEl.innerHTML = `
      <div class="pharmacy-modal-card">
        <h3>Dispense a Prescription (Simulation)</h3>
        <label class="dispense-label" for="dispense-drug-select">Select medication:</label>
        <select id="dispense-drug-select" class="search-input">${options}</select>
        <div class="pharmacy-modal-actions">
          <button type="button" class="hud-btn active" id="dispense-go-btn">Dispense to Window</button>
          <button type="button" class="hud-btn" id="modal-cancel-btn">Close</button>
        </div>
        <div id="dispense-rx-label" class="rx-label hidden"></div>
        <div class="drug-disclaimer">Educational simulation. Not medical advice.</div>
      </div>
    `;

    this.modalEl.querySelector('#dispense-go-btn')?.addEventListener('click', () => {
      const sel = (this.modalEl.querySelector('#dispense-drug-select') as HTMLSelectElement).value;
      const drug = this.drugs.find((d) => d.id === sel);
      if (!drug) return;
      this.bus.emit('pharmacy:dispense', { drugId: drug.id });
      const labelEl = this.modalEl.querySelector('#dispense-rx-label') as HTMLElement;
      labelEl.classList.remove('hidden');
      labelEl.innerHTML = `
        <div class="rx-header">PHARMACY PRESCRIPTION LABEL</div>
        <div><strong>Patient:</strong> Sample Patient</div>
        <div><strong>Medication:</strong> ${drug.genericName} ${drug.strength} (${drug.form})</div>
        <div><strong>Directions:</strong> As prescribed by physician</div>
        <div class="rx-note">Educational simulation only · Verify with licensed pharmacist</div>
      `;
    });

    this.modalEl.querySelector('#modal-cancel-btn')?.addEventListener('click', () => this.closeModal());
  }

  closeInspect(): void {
    this.activeDrug = null;
    this.inspectEl.classList.add('hidden');
    this.disposePreview();
  }

  closeModal(): void {
    this.modalEl.classList.add('hidden');
    this.modalEl.innerHTML = '';
  }

  private disposePreview(): void {
    if (this.previewRaf !== null) {
      cancelAnimationFrame(this.previewRaf);
      this.previewRaf = null;
    }
    this.previewRenderer?.dispose();
    this.previewRenderer = null;
  }

  getActiveDrug(): DrugSpec | null {
    return this.activeDrug;
  }
}
