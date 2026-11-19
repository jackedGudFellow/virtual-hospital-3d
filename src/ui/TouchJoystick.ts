/**
 * Virtual touch joystick shown in first-person ROOM mode for mobile/touch walking.
 */
export class TouchJoystick {
  private el: HTMLElement;
  private knob: HTMLElement;
  private onChange: (x: number, y: number) => void;
  private activePointerId: number | null = null;
  private center = { x: 0, y: 0 };
  private maxRadius = 36;

  constructor(container: HTMLElement, onChange: (x: number, y: number) => void) {
    this.el = container;
    this.onChange = onChange;
    this.el.classList.add('hidden');
    this.el.innerHTML = `
      <div class="joystick-base" id="joystick-base">
        <div class="joystick-knob" id="joystick-knob"></div>
      </div>
    `;
    this.knob = this.el.querySelector('#joystick-knob') as HTMLElement;
    const base = this.el.querySelector('#joystick-base') as HTMLElement;

    base.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.activePointerId = e.pointerId;
      base.setPointerCapture(e.pointerId);
      const rect = base.getBoundingClientRect();
      this.center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      this.updateKnob(e.clientX, e.clientY);
    });

    base.addEventListener('pointermove', (e) => {
      if (this.activePointerId !== e.pointerId) return;
      this.updateKnob(e.clientX, e.clientY);
    });

    const reset = (e: PointerEvent): void => {
      if (this.activePointerId !== e.pointerId) return;
      this.activePointerId = null;
      this.knob.style.transform = 'translate(0px, 0px)';
      this.onChange(0, 0);
    };

    base.addEventListener('pointerup', reset);
    base.addEventListener('pointercancel', reset);
  }

  setVisible(visible: boolean): void {
    this.el.classList.toggle('hidden', !visible);
    if (!visible) {
      this.knob.style.transform = 'translate(0px, 0px)';
      this.onChange(0, 0);
    }
  }

  private updateKnob(clientX: number, clientY: number): void {
    let dx = clientX - this.center.x;
    let dy = clientY - this.center.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this.maxRadius) {
      dx = (dx / dist) * this.maxRadius;
      dy = (dy / dist) * this.maxRadius;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.onChange(dx / this.maxRadius, -dy / this.maxRadius);
  }
}
