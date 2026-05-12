const LOWER_ROW = [
  { code: 'KeyA', note: 0,  band: 'sub',     kind: 'well',   waveform: 'triangle', label: 'A' },
  { code: 'KeyS', note: 2,  band: 'bass',    kind: 'well',   waveform: 'triangle', label: 'S' },
  { code: 'KeyD', note: 4,  band: 'bass',    kind: 'vortex', waveform: 'triangle', label: 'D' },
  { code: 'KeyF', note: 5,  band: 'lowMid',  kind: 'vortex', waveform: 'sine',     label: 'F' },
  { code: 'KeyG', note: 7,  band: 'lowMid',  kind: 'ribbon', waveform: 'sine',     label: 'G' },
  { code: 'KeyH', note: 9,  band: 'mid',     kind: 'ribbon', waveform: 'triangle', label: 'H' },
  { code: 'KeyJ', note: 11, band: 'mid',     kind: 'vortex', waveform: 'triangle', label: 'J' },
  { code: 'KeyK', note: 12, band: 'mid',     kind: 'well',   waveform: 'triangle', label: 'K' }
];

const UPPER_ROW = [
  { code: 'KeyQ', note: 14, band: 'highMid', kind: 'shell',  waveform: 'sawtooth', label: 'Q' },
  { code: 'KeyW', note: 16, band: 'highMid', kind: 'shell',  waveform: 'sawtooth', label: 'W' },
  { code: 'KeyE', note: 18, band: 'high',    kind: 'shell',  waveform: 'sawtooth', label: 'E' },
  { code: 'KeyR', note: 19, band: 'high',    kind: 'shell',  waveform: 'square',   label: 'R' },
  { code: 'KeyT', note: 21, band: 'high',    kind: 'ribbon', waveform: 'square',   label: 'T' },
  { code: 'KeyY', note: 23, band: 'high',    kind: 'vortex', waveform: 'square',   label: 'Y' },
  { code: 'KeyU', note: 24, band: 'high',    kind: 'shell',  waveform: 'sawtooth', label: 'U' },
  { code: 'KeyI', note: 26, band: 'high',    kind: 'shell',  waveform: 'sawtooth', label: 'I' }
];

const DRUM_KEY = { code: 'Space', band: 'broadband', kind: 'shell', drum: true, label: 'SPACE' };

const ALL_KEYS = [...LOWER_ROW, ...UPPER_ROW, DRUM_KEY];
const BY_CODE = Object.fromEntries(ALL_KEYS.map((k) => [k.code, k]));

export class Piano {
  constructor(bus, root, { onTrigger, synth, sustainCheck } = {}) {
    this.bus = bus;
    this.root = root;
    this.onTrigger = onTrigger;
    this.synth = synth;
    this.sustainCheck = sustainCheck ?? (() => false);
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
    const sustain = this.sustainCheck();
    if (info.drum) {
      if (this.synth) this.synth.playDrum(strength);
      // Drum spawns a wide outward shock from a varying random position
      const phi = this.eventTime * 7.3 % (Math.PI * 2);
      const r = 60 + (this.eventTime * 19) % 80;
      const position = [Math.cos(phi) * r, (Math.sin(phi * 1.7) - 0.5) * 28, Math.sin(phi) * r];
      this.bus.emit('event', {
        type: 'impulse',
        kind: 'shell',
        band: 'broadband',
        time: this.eventTime,
        strength: 1,
        position,
        axis: [Math.cos(phi), 0, Math.sin(phi)],
        lifetime: sustain ? 3.6 : 1.2
      });
      if (this.onTrigger) this.onTrigger(info, strength);
      return;
    }
    const angle = (info.note / 12) * Math.PI * 2;
    const radius = 60 + (info.note % 5) * 18;
    const position = [
      Math.cos(angle) * radius,
      ((info.note % 12) - 6) * 1.8,
      Math.sin(angle) * radius
    ];
    if (this.synth) this.synth.playNote(info.note, strength, {
      waveform: info.waveform,
      release: sustain ? 3.0 : 1.1
    });
    // Isotropic axis — different per note, no Y bias
    const axisT = info.note * 0.41;
    const axis = [Math.sin(axisT * 1.3), Math.cos(axisT * 0.9), Math.cos(axisT * 1.7)];
    const baseLife = info.kind === 'well' ? 3 : info.kind === 'vortex' ? 2.5 : info.kind === 'ribbon' ? 3.2 : 1;
    this.bus.emit('event', {
      type: 'impulse',
      kind: info.kind,
      band: info.band,
      time: this.eventTime,
      strength,
      position,
      axis,
      pitch: info.note,
      lifetime: sustain ? baseLife * 3.5 : baseLife
    });
    if (this.onTrigger) this.onTrigger(info, strength);
  }
}
