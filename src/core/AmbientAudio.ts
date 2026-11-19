/**
 * Optional procedural Web Audio API ambient hospital soundscape (off by default).
 */
export class AmbientAudio {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private enabled = false;

  toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on) {
      this.start();
    } else if (this.gain && this.ctx) {
      this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    }
  }

  private start(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i += 1) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 260;

      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;

      noise.connect(filter);
      filter.connect(this.gain);
      this.gain.connect(this.ctx.destination);
      noise.start();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (this.gain) {
      this.gain.gain.setTargetAtTime(0.06, this.ctx.currentTime, 0.35);
    }
  }
}
