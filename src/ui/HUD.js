export class HUD {
  constructor({ scaleEl, timeEl }, clock, camera) {
    this.scaleEl = scaleEl;
    this.timeEl = timeEl;
    this.clock = clock;
    this.camera = camera;
  }

  update() {
    if (this.scaleEl) this.scaleEl.textContent = this.camera.scaleLabel;
    if (this.timeEl) this.timeEl.textContent = fmt(this.clock.songTime);
  }
}

function fmt(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
