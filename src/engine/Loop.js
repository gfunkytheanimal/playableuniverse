export class Loop {
  constructor({ step }) {
    this.step = step;
    this.last = 0;
    this.running = false;
    this.tick = this.tick.bind(this);
  }

  start() {
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
  }

  tick(now) {
    if (!this.running) return;
    const dt = Math.min(1 / 24, (now - this.last) / 1000);
    this.last = now;
    try {
      this.step(dt);
    } catch (err) {
      console.error('Loop step error:', err);
      this.running = false;
      return;
    }
    requestAnimationFrame(this.tick);
  }
}
