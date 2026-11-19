import { EventBus } from '../core/Events';
import { HospitalIndex } from '../core/HospitalIndex';
import { onLangChange, t } from '../core/I18n';

/**
 * Search box for finding any room or department across all floors and flying to it.
 */
export class SearchBox {
  private el: HTMLElement;
  private index: HospitalIndex;
  private bus: EventBus;
  private input!: HTMLInputElement;
  private resultsEl!: HTMLElement;

  constructor(container: HTMLElement, index: HospitalIndex, bus: EventBus) {
    this.el = container;
    this.index = index;
    this.bus = bus;
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
          aria-label="Search hospital rooms"
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

  private updateResults(): void {
    const query = this.input.value;
    const matches = this.index.search(query, 8);
    if (!query.trim() || matches.length === 0) {
      this.resultsEl.classList.add('hidden');
      this.resultsEl.innerHTML = '';
      return;
    }

    this.resultsEl.classList.remove('hidden');
    this.resultsEl.innerHTML = matches
      .map(
        (m) => `
        <button type="button" class="search-result-item" data-room-id="${m.room.id}">
          <span class="search-result-floor">${m.floor.id}</span>
          <span class="search-result-name">${m.room.name}</span>
        </button>`,
      )
      .join('');

    for (const btn of this.resultsEl.querySelectorAll<HTMLButtonElement>('.search-result-item')) {
      btn.addEventListener('click', () => {
        const roomId = btn.dataset.roomId;
        if (roomId) {
          this.resultsEl.classList.add('hidden');
          this.input.blur();
          this.bus.emit('search:flyto', { roomId });
        }
      });
    }
  }
}
