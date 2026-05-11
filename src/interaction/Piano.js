const LOWER_ROW = [
  { code: 'KeyA', note: 0,  band: 'sub',     kind: 'well',   label: 'A' },
  { code: 'KeyS', note: 2,  band: 'bass',    kind: 'well',   label: 'S' },
  { code: 'KeyD', note: 4,  band: 'bass',    kind: 'vortex', label: 'D' },
  { code: 'KeyF', note: 5,  band: 'lowMid',  kind: 'vortex', label: 'F' },
  { code: 'KeyG', note: 7,  band: 'lowMid',  kind: 'ribbon', label: 'G' },
  { code: 'KeyH', note: 9,  band: 'mid',     kind: 'ribbon', label: 'H' },
  { code: 'KeyJ', note: 11, band: 'mid',     kind: 'vortex', label: 'J' },
  { code: 'KeyK', note: 12, band: 'mid',     kind: 'well',   label: 'K' }
];

const UPPER_ROW = [
  { code: 'KeyQ', note: 14, band: 'highMid', kind: 'shell',  label: 'Q' },
  { code: 'KeyW', note: 16, band: 'highMid', kind: 'shell',  label: 'W' },
  { code: 'KeyE', note: 18, band: 'high',    kind: 'shell',  label: 'E' },
  { code: 'KeyR', note: 19, band: 'high',    kind: 'shell',  label: 'R' },
  { code: 'KeyT', note: 21, band: 'high',    kind: 'ribbon', label: 'T' },
  { code: 'KeyY', note: 23, band: 'high',    kind: 'vortex', label: 'Y' },
  { code: 'KeyU', note: 24, band: 'high',    kind: 'shell',  label: 'U' },
  { code: 'KeyI', note: 26, band: 'high',    kind: 'shell',  label: 'I' }
];

const ALL_KEYS = [...LOWER_ROW, ...UPPER_ROW];
const BY_CODE = Object.fromEntries(ALL_KEYS.map((k) => [k.code, k]));

export class Piano {
  constructor(bus, root, { onTrigger } = {}) {
    this.bus = bus;
    this.root = root;
    this.onTrigger = onTrigger;
    this.held = new Set();
    this.eventTime = 0;
    this._wireKeys();
    this._buildOnscreen();
  }

  _wireKeys() {
    window.addEventListener('keydown', (e) => {
      const k = BY_CODE[e.code];
      if (!k || e.repeat) return;
      this.trigger(k, 0.9);
      this.held.add(e.code);
      const el = this.root?.querySelector(`[data-code="${e.code}"]`);
      if (el) el.classList.add('held');
    });
    window.addEventListener('keyup', (e) => {
      if (!BY_CODE[e.code]) return;
      this.held.delete(e.code);
      const el = this.root?.querySelector(`[data-code="${e.code}"]`);
      if (el) el.classList.remove('held');
    });
  }

  _buildOnscreen() {
    if (!this.root) return;
    this.root.innerHTML = '';
    const upperRow = document.createElement('div');
    upperRow.className = 'piano-row';
    for (const info of UPPER_ROW) upperRow.appendChild(this._buildKey(info, true));
    this.root.appendChild(upperRow);
    const lowerRow = document.createElement('div');
    lowerRow.className = 'piano-row';
    for (const info of LOWER_ROW) lowerRow.appendChild(this._buildKey(info, false));
    this.root.appendChild(lowerRow);
  }

  _buildKey(info, upper) {
    const key = document.createElement('button');
    key.className = 'piano-key' + (upper ? ' upper' : '');
    key.dataset.code = info.code;
    key.textContent = info.label;
    key.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.trigger(info, 0.9);
      key.classList.add('held');
    });
    const release = () => key.classList.remove('held');
    key.addEventListener('pointerup', release);
    key.addEventListener('pointerleave', release);
    return key;
  }

  trigger(info, strength) {
    this.eventTime += 0.001;
    const angle = (info.note / 12) * Math.PI * 2;
    const radius = 30 + (info.note % 5) * 8;
    const position = [
      Math.cos(angle) * radius,
      ((info.note % 12) - 6) * 1.4,
      Math.sin(angle) * radius
    ];
    this.bus.emit('event', {
      type: 'impulse',
      kind: info.kind,
      band: info.band,
      time: this.eventTime,
      strength,
      position,
      axis: [Math.sin(angle * 1.3), 0.7, Math.cos(angle * 1.7)],
      pitch: info.note
    });
    if (this.onTrigger) this.onTrigger(info);
  }
}
