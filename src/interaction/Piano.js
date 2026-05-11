const KEY_MAP = {
  KeyA: { note: 0, label: 'A' },
  KeyS: { note: 2, label: 'S' },
  KeyD: { note: 4, label: 'D' },
  KeyF: { note: 5, label: 'F' },
  KeyG: { note: 7, label: 'G' },
  KeyH: { note: 9, label: 'H' },
  KeyJ: { note: 11, label: 'J' },
  KeyK: { note: 12, label: 'K' }
};
const ROOT_BAND_BY_NOTE = ['sub', 'sub', 'bass', 'bass', 'lowMid', 'lowMid', 'mid', 'mid', 'highMid', 'highMid', 'high', 'high', 'high'];

export class Piano {
  constructor(bus, root) {
    this.bus = bus;
    this.root = root;
    this.held = new Set();
    this.eventTime = 0;
    this._wireKeys();
    this._buildOnscreen();
  }

  _wireKeys() {
    window.addEventListener('keydown', (e) => {
      const k = KEY_MAP[e.code];
      if (!k || e.repeat) return;
      this.trigger(k.note, 0.85);
      this.held.add(e.code);
      const el = this.root?.querySelector(`[data-code="${e.code}"]`);
      if (el) el.classList.add('held');
    });
    window.addEventListener('keyup', (e) => {
      if (!KEY_MAP[e.code]) return;
      this.held.delete(e.code);
      const el = this.root?.querySelector(`[data-code="${e.code}"]`);
      if (el) el.classList.remove('held');
    });
  }

  _buildOnscreen() {
    if (!this.root) return;
    this.root.innerHTML = '';
    for (const [code, info] of Object.entries(KEY_MAP)) {
      const key = document.createElement('button');
      key.className = 'piano-key';
      key.dataset.code = code;
      key.textContent = info.label;
      key.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.trigger(info.note, 0.85);
        key.classList.add('held');
      });
      key.addEventListener('pointerup', () => key.classList.remove('held'));
      key.addEventListener('pointerleave', () => key.classList.remove('held'));
      this.root.appendChild(key);
    }
  }

  trigger(note, strength) {
    this.eventTime += 0.001;
    const band = ROOT_BAND_BY_NOTE[note] ?? 'mid';
    const angle = (note / 12) * Math.PI * 2;
    const radius = 28 + (note % 5) * 8;
    const position = [Math.cos(angle) * radius, (note - 6) * 1.4, Math.sin(angle) * radius];
    this.bus.emit('event', {
      type: 'impulse',
      kind: note < 4 ? 'well' : note < 8 ? 'vortex' : 'shell',
      band,
      time: this.eventTime,
      strength,
      position,
      pitch: note
    });
  }
}
