import { EventBus } from './Events';

export interface TourStop {
  title: string;
  floorMode: 'whole' | 'isolate';
  floorId: string | null;
  roomId: string | null;
}

const TOUR_STOPS: TourStop[] = [
  { title: '1/7 · Hospital Exterior (L1–L5 + NICU Wing)', floorMode: 'whole', floorId: null, roomId: null },
  { title: '2/7 · Main Lobby & Entrance (L1)', floorMode: 'isolate', floorId: 'L1', roomId: 'L1.main.lobby' },
  { title: '3/7 · Public Pharmacy & 120+ Medications (L1)', floorMode: 'isolate', floorId: 'L1', roomId: 'L1.pharmacy.dispensing' },
  { title: '4/7 · Intensive Care Unit (L1)', floorMode: 'isolate', floorId: 'L1', roomId: 'L1.icu.main' },
  { title: '5/7 · NICU 8-Bay Open Ward (L2)', floorMode: 'isolate', floorId: 'L2', roomId: 'L2.nicu.open-ward' },
  { title: '6/7 · Chemotherapy Infusion Bay (L1)', floorMode: 'isolate', floorId: 'L1', roomId: 'L1.chemo.bay' },
  { title: '7/7 · Typical Inpatient Ward (L4)', floorMode: 'isolate', floorId: 'L4', roomId: 'L4.inpatient.double-1' },
];

/**
 * Automated guided camera tour across the hospital's key departments.
 */
export class GuidedTour {
  private bus: EventBus;
  private active = false;
  private stepIdx = 0;
  private timer = 0;
  private readonly stepDuration = 4.2;

  constructor(bus: EventBus) {
    this.bus = bus;
  }

  isActive(): boolean {
    return this.active;
  }

  start(): void {
    this.active = true;
    this.stepIdx = 0;
    this.timer = 0;
    this.applyCurrentStep();
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.bus.emit('tour:step', { title: null, active: false });
  }

  next(): void {
    if (!this.active) return;
    this.stepIdx += 1;
    if (this.stepIdx >= TOUR_STOPS.length) {
      this.stop();
      this.bus.emit('floor:view', { viewMode: 'whole', floorId: null });
      return;
    }
    this.timer = 0;
    this.applyCurrentStep();
  }

  update(dt: number): void {
    if (!this.active) return;
    this.timer += dt;
    if (this.timer >= this.stepDuration) {
      this.next();
    }
  }

  private applyCurrentStep(): void {
    const stop = TOUR_STOPS[this.stepIdx];
    this.bus.emit('tour:step', { title: stop.title, active: true });
    if (stop.roomId) {
      this.bus.emit('search:flyto', { roomId: stop.roomId });
    } else {
      this.bus.emit('floor:view', { viewMode: stop.floorMode, floorId: stop.floorId });
      this.bus.emit('camera:preset', { preset: 'orbit' });
    }
  }
}
