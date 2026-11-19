export type EventCallback<T = unknown> = (payload: T) => void;

export interface AppEvents {
  'state:changed': {
    key: string;
    value: unknown;
  };
  'engine:fps': {
    fps: number;
    frameTimeMs: number;
    drawCalls: number;
    triangles: number;
  };
  'debug:toggle': {
    visible: boolean;
  };
  'camera:preset': {
    preset: 'orbit' | 'topdown';
  };
  'labels:toggle': {
    visible: boolean;
  };
  'floor:view': {
    viewMode: 'whole' | 'exploded' | 'isolate';
    floorId: string | null;
  };
  'room:hover': {
    roomId: string | null;
    x: number;
    y: number;
  };
  'room:select': {
    roomId: string | null;
  };
  'room:enter': {
    roomId: string;
  };
  'item:select': {
    itemId: string | null;
    equipmentType: string | null;
  };
  'item:hover': {
    equipmentType: string | null;
    x: number;
    y: number;
  };
  'search:flyto': {
    roomId: string;
  };
  'nav:up': Record<string, never>;
  'pharmacy:cabinet': {
    cabinetId: string;
  };
  'pharmacy:drug': {
    drugId: string;
  };
  'pharmacy:dispenseOpen': Record<string, never>;
  'pharmacy:dispense': {
    drugId: string;
  };
  'pharmacy:search': {
    query: string;
  };
  'pharmacy:unlockControlled': Record<string, never>;
  'ui:daynight': { night: boolean };
  'ui:sound': { enabled: boolean };
  'ui:quality': { low: boolean };
  'tour:start': Record<string, never>;
  'tour:stop': Record<string, never>;
  'tour:step': { title: string | null; active: boolean };
  'camera:toggleWalk': Record<string, never>;
  'walk:goto': { x: number; y: number; z: number };
  'engine:qualityChanged': { low: boolean };
}

/**
 * Tiny typed event bus for decoupled communication between core, world, and UI modules.
 */
export class EventBus {
  private listeners = new Map<keyof AppEvents, Set<EventCallback<never>>>();

  on<K extends keyof AppEvents>(event: K, callback: EventCallback<AppEvents[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(callback as EventCallback<never>);
    return () => this.off(event, callback);
  }

  off<K extends keyof AppEvents>(event: K, callback: EventCallback<AppEvents[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback as EventCallback<never>);
    }
  }

  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      (cb as EventCallback<AppEvents[K]>)(payload);
    }
  }
}
