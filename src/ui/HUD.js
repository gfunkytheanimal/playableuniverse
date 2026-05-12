export class HUD {
  constructor({ scaleEl, timeEl, fpsEl }, clock, camera) {
    this.scaleEl = scaleEl;
    this.timeEl = timeEl;
    this.fpsEl = fpsEl;
    this.clock = clock;
    this.camera = camera;
    this.frameTimeAvg = 1 / 60;
    this.lastUpdate = performance.now();
  }

  tick(dt) {
    // Smoothed frame time so the FPS display doesn't jitter every frame.
    const alpha = 0.05;
    this.frameTimeAvg = this.frameTimeAvg * (1 - alpha) + dt * alpha;
  }

  update() {
    if (this.scaleEl) this.scaleEl.textContent = this.camera.scaleLabel;
    if (this.timeEl) this.timeEl.textContent = fmt(this.clock.songTime || this.clock.now);
    if (this.fpsEl) {
      const now = performance.now();
      if (now - this.lastUpdate > 250) {
        const fps = 1 / Math.max(this.frameTimeAvg, 1e-4);
        this.fpsEl.textContent = `${fps.toFixed(0)} fps`;
        this.lastUpdate = now;
      }
    }
  }
}

function fmt(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
