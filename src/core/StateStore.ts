import { EventBus } from './Events';

export type AppMode = 'EXTERIOR' | 'FLOOR' | 'ROOM' | 'ITEM';

export interface AppState {
  mode: AppMode;
  activeFloor: string | null;
  activeRoom: string | null;
  selectedItem: string | null;
  ceilingsVisible: boolean;
  debugOverlayVisible: boolean;
}

/**
 * Centralized application state store.
 */
export class StateStore {
  private state: AppState;
  private bus: EventBus;

  constructor(bus: EventBus, initial?: Partial<AppState>) {
    this.bus = bus;
    this.state = {
      mode: 'EXTERIOR',
      activeFloor: null,
      activeRoom: null,
      selectedItem: null,
      ceilingsVisible: true,
      debugOverlayVisible: false,
      ...initial,
    };
  }

  getState(): Readonly<AppState> {
    return this.state;
  }

  set<K extends keyof AppState>(key: K, value: AppState[K]): void {
    if (this.state[key] === value) return;
    this.state[key] = value;
    this.syncToHash();
    this.bus.emit('state:changed', { key, value });
  }

  private syncToHash(): void {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    if (this.state.activeFloor) params.set('floor', this.state.activeFloor);
    if (this.state.activeRoom) params.set('room', this.state.activeRoom);
    if (this.state.mode !== 'EXTERIOR') params.set('mode', this.state.mode);
    const hash = params.toString() ? `#${params.toString()}` : '';
    try {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    } catch {
      // Ignore history API restrictions
    }
  }

  static parseHashState(): { floor: string | null; room: string | null; mode: AppMode | null } {
    if (typeof window === 'undefined' || !window.location.hash) {
      return { floor: null, room: null, mode: null };
    }
    const params = new URLSearchParams(window.location.hash.slice(1));
    const floor = params.get('floor');
    const room = params.get('room');
    const mode = params.get('mode') as AppMode | null;
    return { floor, room, mode };
  }

  toggleDebugOverlay(): boolean {
    const next = !this.state.debugOverlayVisible;
    this.set('debugOverlayVisible', next);
    this.bus.emit('debug:toggle', { visible: next });
    return next;
  }
}
