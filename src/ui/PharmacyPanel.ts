import * as THREE from 'three';
import { EventBus } from '../core/Events';
import { onLangChange, t } from '../core/I18n';
import scenariosJson from '../data/pharmacyScenarios.json';
import { createDrugMesh } from '../rooms/PharmacyDrugMesh';
import { DrugSpec, getSimulatedStock, PHARMACY_CABINETS } from '../rooms/PharmacyTypes';

interface DispenseScenario {
  id: string;
  patient: string;
  prescribedDrugId: string;
  prescribedText: string;
  candidateDrugIds: string[];
  trapNote: string;
  batchStatus: 'valid' | 'expired';
}

const SCENARIOS = scenariosJson as DispenseScenario[];

/**
 * Pharmacy UI: Drug Search & Filter Bar, 3D Drug Inspect Panel (stock/expiry/scheduleByCountry),
 * Compare Modal, Fridge Alert, Controlled-Drug Access Log, Dispense Rx, and LASA/Expiry Rx Check.
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
  private fridgeOutOfRange = false;
  private controlledLogs: string[] = [];

  constructor(container: HTMLElement, drugs: DrugSpec[], bus: EventBus) {
    this.root = container;
    this.drugs = drugs;
    this.bus = bus;
    this.renderShell();
    onLangChange(() => {
      this.refreshToolbarLabels();
      if (this.activeDrug) this.showDrug(this.activeDrug.id);
    });
  }

  private refreshToolbarLabels(): void {
    const title = this.root.querySelector('.pharmacy-toolbar-title');
    if (title) title.textContent = t('pharmacyTitle');
    const search = this.root.querySelector('#pharmacy-drug-search') as HTMLInputElement | null;
    if (search) search.placeholder = t('pharmacySearch');
    const disp = this.root.querySelector('#pharmacy-dispense-open');
    if (disp) disp.textContent = t('dispenseRx');
    const check = this.root.querySelector('#pharmacy-rxcheck-open');
    if (check) check.textContent = t('verifyRx');
    const cmp = this.root.querySelector('#pharmacy-compare-open');
    if (cmp) cmp.textContent = t('compareDrugs');
    const fridge = this.root.querySelector('#pharmacy-fridge-btn');
    if (fridge) fridge.textContent = t(this.fridgeOutOfRange ? 'fridgeAlert' : 'fridgeNormal');
  }

  private renderShell(): void {
    const cabBtns = PHARMACY_CABINETS.map(
      (c) =>
        `<button type="button" class="cab-pill" data-cab="${c.id}" title="${c.title}" style="border-color:${c.color}">${c.id}</button>`,
    ).join('');

    this.root.innerHTML = `
      <div class="pharmacy-toolbar hidden" id="pharmacy-toolbar" role="region" aria-label="Pharmacy inventory controls">
        <div class="pharmacy-toolbar-row" style="flex-wrap:wrap">
          <div class="pharmacy-toolbar-title">${t('pharmacyTitle')}</div>
          <input
            type="search"
            class="search-input"
            id="pharmacy-drug-search"
            placeholder="${t('pharmacySearch')}"
            aria-label="${t('pharmacySearch')}"
            autocomplete="off"
          />
          <button type="button" class="hud-btn active" id="pharmacy-dispense-open">${t('dispenseRx')}</button>
          <button type="button" class="hud-btn" id="pharmacy-rxcheck-open">${t('verifyRx')}</button>
          <button type="button" class="hud-btn" id="pharmacy-compare-open">${t('compareDrugs')}</button>
          <button type="button" class="hud-btn" id="pharmacy-fridge-btn">${t('fridgeNormal')}</button>
        </div>
        <div class="pharmacy-cab-strip" role="toolbar" aria-label="Pharmacy filters and cabinets">
          <button type="button" class="hud-btn pharm-filter" data-filter="">All</button>
          <button type="button" class="hud-btn pharm-filter" data-filter="insulin">Refrigerated</button>
          <button type="button" class="hud-btn pharm-filter" data-filter="controlled">Controlled</button>
          <button type="button" class="hud-btn pharm-filter" data-filter="antibiotic">Antibiotics</button>
          ${cabBtns}
        </div>
      </div>
      <div class="pharmacy-inspect hidden" id="pharmacy-inspect" role="region" aria-label="Medication inspector"></div>
      <div class="pharmacy-modal hidden" id="pharmacy-modal" role="dialog" aria-modal="true" aria-label="Pharmacy dialog"></div>
    `;

    this.toolbarEl = this.root.querySelector('#pharmacy-toolbar') as HTMLElement;
    this.inspectEl = this.root.querySelector('#pharmacy-inspect') as HTMLElement;
    this.modalEl = this.root.querySelector('#pharmacy-modal') as HTMLElement;

    const searchInput = this.root.querySelector('#pharmacy-drug-search') as HTMLInputElement;
    searchInput.addEventListener('input', () => {
      this.bus.emit('pharmacy:search', { query: searchInput.value });
    });

    this.root.querySelector('#pharmacy-dispense-open')?.addEventListener('click', () => this.openDispenseModal());
    this.root.querySelector('#pharmacy-rxcheck-open')?.addEventListener('click', () => this.openRxCheckModal(0, 0));
    this.root.querySelector('#pharmacy-compare-open')?.addEventListener('click', () => this.openCompareModal());

    const fridgeBtn = this.root.querySelector('#pharmacy-fridge-btn') as HTMLButtonElement | null;
    fridgeBtn?.addEventListener('click', () => {
      this.fridgeOutOfRange = !this.fridgeOutOfRange;
      fridgeBtn.textContent = t(this.fridgeOutOfRange ? 'fridgeAlert' : 'fridgeNormal');
      fridgeBtn.style.borderColor = this.fridgeOutOfRange ? '#dc2626' : '';
      fridgeBtn.style.color = this.fridgeOutOfRange ? '#b91c1c' : '';
    });

    for (const fBtn of this.root.querySelectorAll<HTMLButtonElement>('.pharm-filter')) {
      fBtn.addEventListener('click', () => {
        const q = fBtn.dataset.filter ?? '';
        searchInput.value = q;
        this.bus.emit('pharmacy:search', { query: q });
      });
    }

    const cabButtons = Array.from(this.root.querySelectorAll<HTMLButtonElement>('.cab-pill'));
    cabButtons.forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        const cabId = btn.dataset.cab;
        if (cabId) this.bus.emit('pharmacy:cabinet', { cabinetId: cabId });
      });
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const delta = e.key === 'ArrowRight' ? 1 : -1;
          cabButtons[(idx + delta + cabButtons.length) % cabButtons.length]?.focus();
        }
      });
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
    const stock = getSimulatedStock(drug);
    const countrySched = drug.scheduleByCountry
      ? Object.entries(drug.scheduleByCountry)
          .map(([c, s]) => `${c}: ${s}`)
          .join(' · ')
      : '';

    this.inspectEl.classList.remove('hidden');
    this.inspectEl.innerHTML = `
      <div class="info-panel-header">
        <span class="info-dept-badge" style="background:#d1fae5; color:#0f172a; border-color:#059669">
          <bdi>Cab ${drug.cabinet} · Shelf ${drug.shelf} · Slot ${drug.slot}</bdi>
        </span>
        <button type="button" class="info-close-btn" id="drug-close-btn" aria-label="${t('close')}">✕</button>
      </div>
      <div class="drug-preview-wrap">
        <canvas width="240" height="130" id="drug-preview-canvas" aria-label="3D package preview"></canvas>
        <div class="drug-preview-hint">${t('dragRotate')}</div>
      </div>
      <h2 class="info-room-title"><bdi dir="auto">${drug.genericName}</bdi></h2>
      <div class="info-room-meta"><strong><bdi>${drug.strength}</bdi></strong> · ${drug.form} · ${t('schedule')}: <strong>${drug.schedule}</strong></div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; font-size:11px;">
        <span class="info-dept-badge" style="background:#f1f5f9; color:#0f172a; border-color:#94a3b8">Qty: ${stock.quantity} · ${stock.batchNumber} · Exp ${stock.expiryDate}</span>
        ${stock.isLowStock ? `<span class="info-dept-badge" style="background:#fef3c7; color:#78350f; border-color:#d97706">${t('lowStock')}</span>` : ''}
        ${stock.isNearExpiry ? `<span class="info-dept-badge" style="background:#fee2e2; color:#7f1d1d; border-color:#dc2626">${t('nearExpiry')}</span>` : ''}
      </div>
      <div class="drug-fields">
        <div><strong>${t('brands')}:</strong> <bdi dir="auto">${drug.brandExamples.join(', ')}</bdi></div>
        <div><strong>${t('drugClass')}:</strong> ${drug.drugClass}</div>
        ${countrySched ? `<div><strong>Regulatory:</strong> <bdi>${countrySched}</bdi></div>` : ''}
        <div><strong>${t('commonUses')}:</strong> ${drug.commonUses}</div>
        <div><strong>${t('storage')}:</strong> ${drug.storage}</div>
        <div class="drug-warning"><strong>${t('keyWarnings')}:</strong> ${drug.keyWarnings}</div>
      </div>
      <div class="drug-nav-row">
        <button type="button" class="hud-btn" id="drug-prev-btn">${t('prev')}</button>
        <span><bdi>${idx + 1} / ${cabDrugs.length}</bdi></span>
        <button type="button" class="hud-btn" id="drug-next-btn">${t('next')}</button>
      </div>
      <div class="drug-disclaimer">${t('disclaimer')}</div>
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
    const mesh = createDrugMesh(drug, cabMeta?.color ?? '#0c6273');
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
    const logHtml = this.controlledLogs.length
      ? `<div style="font-size:11px; margin-bottom:8px; color:#334e68"><strong>${t('controlledLog')}:</strong><br/>${this.controlledLogs.slice(-3).join('<br/>')}</div>`
      : '';
    this.modalEl.classList.remove('hidden');
    this.modalEl.innerHTML = `
      <div class="pharmacy-modal-card">
        <h3>${t('controlledTitle')}</h3>
        <p>${t('controlledDesc')}</p>
        ${logHtml}
        <div class="pharmacy-modal-actions">
          <button type="button" class="hud-btn active" id="badge-unlock-btn">${t('tapBadge')}</button>
          <button type="button" class="hud-btn" id="modal-cancel-btn">${t('cancel')}</button>
        </div>
        <div class="drug-disclaimer">${t('disclaimer')}</div>
      </div>
    `;
    this.modalEl.querySelector('#badge-unlock-btn')?.addEventListener('click', () => {
      this.controlledLogs.push(`${new Date().toLocaleTimeString()} · Pharmacist Badge Verified (Cab K)`);
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
        <h3>${t('dispenseTitle')}</h3>
        <label class="dispense-label" for="dispense-drug-select">${t('selectMed')}</label>
        <select id="dispense-drug-select" class="search-input">${options}</select>
        <div class="pharmacy-modal-actions">
          <button type="button" class="hud-btn active" id="dispense-go-btn">${t('dispenseBtn')}</button>
          <button type="button" class="hud-btn" id="modal-cancel-btn">${t('close')}</button>
        </div>
        <div id="dispense-rx-label" class="rx-label hidden"></div>
        <div class="drug-disclaimer">${t('disclaimer')}</div>
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
        <div class="rx-header">${t('rxHeader')}</div>
        <div><strong>${t('rxPatient')}:</strong> Sample Patient</div>
        <div><strong>${t('rxMedication')}:</strong> ${drug.genericName} ${drug.strength} (${drug.form})</div>
        <div><strong>${t('rxDirections')}:</strong> ${t('rxDirectionsVal')}</div>
        <div class="rx-note">${t('rxNote')}</div>
      `;
    });

    this.modalEl.querySelector('#modal-cancel-btn')?.addEventListener('click', () => this.closeModal());
  }

  openRxCheckModal(idx: number, score: number): void {
    const scn = SCENARIOS[idx % SCENARIOS.length];
    const candidates = scn.candidateDrugIds
      .map((id) => this.drugs.find((d) => d.id === id))
      .filter((d): d is DrugSpec => Boolean(d));

    this.modalEl.classList.remove('hidden');
    this.modalEl.innerHTML = `
      <div class="pharmacy-modal-card">
        <h3>${t('verifyRx')} · ${t('quizScore')}: ${score}/${idx}</h3>
        <div class="rx-label" style="margin-bottom:10px">
          <div class="rx-header">SAMPLE PRESCRIPTION</div>
          <div><strong>Patient:</strong> ${scn.patient}</div>
          <div><strong>Order:</strong> ${scn.prescribedText}</div>
          <div><strong>Batch Check:</strong> ${scn.batchStatus === 'expired' ? 'EXP 2025-04 (EXPIRED!)' : 'EXP 2028-06 (Valid)'}</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">
          ${candidates
            .map(
              (d) =>
                `<button type="button" class="hud-btn rx-check-opt" data-choice="${d.id}">${d.genericName} — ${d.strength} (${d.form})</button>`,
            )
            .join('')}
          <button type="button" class="hud-btn rx-check-opt" data-choice="quarantine">Quarantine / Reject Expired Stock</button>
        </div>
        <div id="rx-check-feedback" style="font-size:12px; min-height:22px; margin-bottom:8px;"></div>
        <div class="pharmacy-modal-actions">
          <button type="button" class="hud-btn active" id="rx-check-next">${t('quizNext')}</button>
          <button type="button" class="hud-btn" id="modal-cancel-btn">${t('close')}</button>
        </div>
        <div class="drug-disclaimer">${t('disclaimer')}</div>
      </div>
    `;

    let answered = false;
    let nextScore = score;
    const fb = this.modalEl.querySelector('#rx-check-feedback') as HTMLElement;
    const expected = scn.batchStatus === 'expired' ? 'quarantine' : scn.prescribedDrugId;

    for (const btn of this.modalEl.querySelectorAll<HTMLButtonElement>('.rx-check-opt')) {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const ok = btn.dataset.choice === expected;
        if (ok) nextScore += 1;
        fb.style.color = ok ? '#059669' : '#dc2626';
        fb.innerHTML = ok ? `✓ Correct! ${scn.trapNote}` : `✕ Incorrect. ${scn.trapNote}`;
      });
    }

    this.modalEl.querySelector('#rx-check-next')?.addEventListener('click', () => {
      this.openRxCheckModal(idx + 1, nextScore);
    });
    this.modalEl.querySelector('#modal-cancel-btn')?.addEventListener('click', () => this.closeModal());
  }

  openCompareModal(): void {
    const opts = this.drugs
      .map((d) => `<option value="${d.id}">${d.genericName} (${d.strength})</option>`)
      .join('');

    this.modalEl.classList.remove('hidden');
    this.modalEl.innerHTML = `
      <div class="pharmacy-modal-card" style="width:440px">
        <h3>${t('compareDrugs')}</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
          <select id="cmp-drug-a" class="search-input" aria-label="First medication">${opts}</select>
          <select id="cmp-drug-b" class="search-input" aria-label="Second medication">${opts}</select>
        </div>
        <div id="cmp-table" style="font-size:12px; line-height:1.5; margin-bottom:10px;"></div>
        <div class="pharmacy-modal-actions">
          <button type="button" class="hud-btn" id="modal-cancel-btn">${t('close')}</button>
        </div>
        <div class="drug-disclaimer">${t('disclaimer')}</div>
      </div>
    `;

    const selA = this.modalEl.querySelector('#cmp-drug-a') as HTMLSelectElement;
    const selB = this.modalEl.querySelector('#cmp-drug-b') as HTMLSelectElement;
    if (this.drugs.length > 1) selB.selectedIndex = 1;
    const tbl = this.modalEl.querySelector('#cmp-table') as HTMLElement;

    const renderTable = (): void => {
      const a = this.drugs.find((d) => d.id === selA.value);
      const b = this.drugs.find((d) => d.id === selB.value);
      if (!a || !b) return;
      const fmtSched = (d: DrugSpec): string =>
        d.scheduleByCountry
          ? `${d.schedule} (${Object.entries(d.scheduleByCountry).map(([k, v]) => `${k}: ${v}`).join(', ')})`
          : d.schedule;
      tbl.innerHTML = `
        <table style="width:100%; border-collapse:collapse;">
          <tr><th style="text-align:left; padding:4px">Field</th><th style="text-align:left; padding:4px">${a.genericName}</th><th style="text-align:left; padding:4px">${b.genericName}</th></tr>
          <tr><td style="padding:4px"><strong>Class</strong></td><td style="padding:4px">${a.drugClass}</td><td style="padding:4px">${b.drugClass}</td></tr>
          <tr><td style="padding:4px"><strong>Form</strong></td><td style="padding:4px">${a.form}</td><td style="padding:4px">${b.form}</td></tr>
          <tr><td style="padding:4px"><strong>Storage</strong></td><td style="padding:4px">${a.storage}</td><td style="padding:4px">${b.storage}</td></tr>
          <tr><td style="padding:4px"><strong>Schedule</strong></td><td style="padding:4px">${fmtSched(a)}</td><td style="padding:4px">${fmtSched(b)}</td></tr>
        </table>
      `;
    };

    selA.addEventListener('change', renderTable);
    selB.addEventListener('change', renderTable);
    renderTable();
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
