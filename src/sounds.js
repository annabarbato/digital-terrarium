export class SoundBoard {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.volume = 0.035;
  }

  bindUnlock(target = window) {
    const unlock = () => {
      this.ensureContext();
      this.enabled = true;
      target.removeEventListener("pointerdown", unlock);
      target.removeEventListener("keydown", unlock);
    };
    target.addEventListener("pointerdown", unlock);
    target.addEventListener("keydown", unlock);
  }

  ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  play(kind) {
    if (!this.enabled) {
      return;
    }

    if (kind === "birth") {
      this.tone(560, 0.06, "square");
      this.tone(720, 0.04, "square", 0.055);
    } else if (kind === "death") {
      this.tone(180, 0.12, "triangle");
    } else if (kind === "mutation") {
      this.tone(880, 0.08, "square");
      this.tone(1180, 0.06, "square", 0.075);
    } else if (kind === "extinction") {
      this.tone(110, 0.26, "sawtooth");
    }
  }

  tone(frequency, duration, wave = "square", delay = 0) {
    this.ensureContext();
    const start = this.ctx.currentTime + delay;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = wave;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(this.volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
}
