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
    this.bus.emit('state:changed', { key, value });
  }

  toggleDebugOverlay(): boolean {
    const next = !this.state.debugOverlayVisible;
    this.set('debugOverlayVisible', next);
    this.bus.emit('debug:toggle', { visible: next });
    return next;
  }
}
