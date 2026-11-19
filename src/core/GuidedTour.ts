import { EventBus } from './Events';
import journeysJson from '../data/journeys.json';

export interface TourStop {
  title: string;
  floorMode: 'whole' | 'isolate';
  floorId: string | null;
  roomId: string | null;
}

export interface JourneySpec {
  id: string;
  name: string;
  stops: TourStop[];
}

const JOURNEYS = journeysJson as JourneySpec[];

/**
 * Data-driven guided tours and patient journeys with play, pause, next, and skip support.
 */
export class GuidedTour {
  private bus: EventBus;
  private active = false;
  private paused = false;
  private activeJourney: JourneySpec = JOURNEYS[0];
  private stepIdx = 0;
  private timer = 0;
  private readonly stepDuration = 4.5;

  constructor(bus: EventBus) {
    this.bus = bus;
    if (typeof window !== 'undefined') {
      window.addEventListener('vh3d:journey', this.onJourneyEvent as EventListener);
    }
  }

  private onJourneyEvent = (e: CustomEvent<{ action: 'start' | 'pause' | 'next' | 'stop'; journeyId?: string }>): void => {
    const { action, journeyId } = e.detail;
    if (action === 'start') this.start(journeyId);
    else if (action === 'pause') this.togglePause();
    else if (action === 'next') this.next();
    else if (action === 'stop') this.stop();
  };

  isActive(): boolean {
    return this.active;
  }

  start(journeyId = 'overview'): void {
    this.activeJourney = JOURNEYS.find((j) => j.id === journeyId) ?? JOURNEYS[0];
    this.active = true;
    this.paused = false;
    this.stepIdx = 0;
    this.timer = 0;
    this.applyCurrentStep();
  }

  togglePause(): void {
    if (!this.active) return;
    this.paused = !this.paused;
    const stop = this.activeJourney.stops[this.stepIdx];
    this.bus.emit('tour:step', {
      title: `${this.paused ? '⏸ ' : ''}${this.activeJourney.name}: ${stop.title}`,
      active: true,
    });
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.paused = false;
    this.bus.emit('tour:step', { title: null, active: false });
  }

  next(): void {
    if (!this.active) return;
    this.stepIdx += 1;
    if (this.stepIdx >= this.activeJourney.stops.length) {
      this.stop();
      this.bus.emit('floor:view', { viewMode: 'whole', floorId: null });
      return;
    }
    this.timer = 0;
    this.applyCurrentStep();
  }

  update(dt: number): void {
    if (!this.active || this.paused) return;
    this.timer += dt;
    if (this.timer >= this.stepDuration) {
      this.next();
    }
  }

  private applyCurrentStep(): void {
    const stop = this.activeJourney.stops[this.stepIdx];
    this.bus.emit('tour:step', { title: `${this.activeJourney.name}: ${stop.title}`, active: true });
    if (stop.roomId) {
      this.bus.emit('search:flyto', { roomId: stop.roomId });
    } else {
      this.bus.emit('floor:view', { viewMode: stop.floorMode, floorId: stop.floorId });
      this.bus.emit('camera:preset', { preset: 'orbit' });
    }
  }
}
