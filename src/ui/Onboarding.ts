const STORAGE_KEY = 'vh3d.onboardingDone';

const STEPS = [
  {
    title: '1/3 · Orbit, Zoom & Floors',
    body: 'Drag to rotate the 5-story hospital, scroll to zoom, or use the left Floor Rail (L1–L5) to isolate any floor.',
  },
  {
    title: '2/3 · Click or Enter Any Room',
    body: 'Click a room to see its details, then click Enter Room (or double-click / long-press on touch) to inspect inside or walk through doors.',
  },
  {
    title: '3/3 · Unified Search & Pharmacy',
    body: 'Use the Search box to find rooms, medical equipment, or any of the 120 real medications in the L1 Pharmacy.',
  },
];

/**
 * Three dismissible onboarding coach marks shown once on first visit.
 */
export class Onboarding {
  private el: HTMLElement;
  private step = 0;

  constructor(container: HTMLElement) {
    this.el = container;
    if (this.shouldSkip()) {
      this.el.classList.add('hidden');
      return;
    }
    this.render();
  }

  private shouldSkip(): boolean {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('test') === '1') {
      return true;
    }
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  private markDone(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Ignore storage errors
    }
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
  }

  private render(): void {
    const s = STEPS[this.step];
    const isLast = this.step === STEPS.length - 1;
    this.el.classList.remove('hidden');
    this.el.innerHTML = `
      <div class="onboarding-card" role="dialog" aria-label="Quick start guide">
        <div class="onboarding-title">${s.title}</div>
        <p class="onboarding-body">${s.body}</p>
        <div class="onboarding-actions">
          <button type="button" class="hud-btn" id="onboard-skip">Skip</button>
          <button type="button" class="hud-btn active" id="onboard-next">${isLast ? 'Start Exploring' : 'Next →'}</button>
        </div>
      </div>
    `;

    this.el.querySelector('#onboard-skip')?.addEventListener('click', () => this.markDone());
    this.el.querySelector('#onboard-next')?.addEventListener('click', () => {
      if (isLast) {
        this.markDone();
      } else {
        this.step += 1;
        this.render();
      }
    });
  }
}
