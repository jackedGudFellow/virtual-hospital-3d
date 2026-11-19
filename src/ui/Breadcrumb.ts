import { EventBus } from '../core/Events';
import { onLangChange, t } from '../core/I18n';
import { AppMode } from '../core/StateStore';

/**
 * Clickable navigation breadcrumb: Hospital > Floor > Room.
 */
export class Breadcrumb {
  private el: HTMLElement;
  private bus: EventBus;
  private lastArgs: [AppMode, string | null, string | null] = ['EXTERIOR', null, null];

  constructor(container: HTMLElement, bus: EventBus) {
    this.el = container;
    this.bus = bus;
    this.el.setAttribute('role', 'navigation');
    this.el.setAttribute('aria-label', 'Location breadcrumb');
    onLangChange(() => this.update(...this.lastArgs));
    this.update('EXTERIOR', null, null);
  }

  update(mode: AppMode, floorId: string | null, roomName: string | null): void {
    this.lastArgs = [mode, floorId, roomName];
    const parts: { label: string; action: 'exterior' | 'floor' | 'none' }[] = [
      { label: t('hospital'), action: mode === 'EXTERIOR' ? 'none' : 'exterior' },
    ];

    if (floorId) {
      parts.push({
        label: floorId,
        action: mode === 'ROOM' ? 'floor' : 'none',
      });
    }

    if (roomName && (mode === 'ROOM' || mode === 'ITEM')) {
      parts.push({ label: roomName, action: 'none' });
    } else if (roomName && floorId) {
      parts.push({ label: roomName, action: 'none' });
    }

    this.el.innerHTML = parts
      .map((p, idx) => {
        const sep = idx > 0 ? '<span class="bc-sep">›</span>' : '';
        if (p.action === 'none') {
          return `${sep}<span class="bc-current">${p.label}</span>`;
        }
        return `${sep}<button type="button" class="bc-link" data-action="${p.action}">${p.label}</button>`;
      })
      .join('');

    for (const btn of this.el.querySelectorAll<HTMLButtonElement>('.bc-link')) {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'exterior') {
          this.bus.emit('floor:view', { viewMode: 'whole', floorId: null });
        } else if (action === 'floor' && floorId) {
          this.bus.emit('nav:up', {});
        }
      });
    }
  }
}
