// Periodically schedules "cosmic encounters" that emit events on the bus —
// supernovae, comet streaks, pulsars, gravitational waves. Each encounter is
// just a sequence of impulse events the existing EventMapper already knows
// how to handle, so the physics stay coherent.

const PALETTE = {
  supernova:   [1.6, 1.35, 0.85],
  cometWarm:   [1.5, 1.0,  0.55],
  cometCool:   [0.6, 1.05, 1.55],
  pulsar:      [1.2, 0.9,  1.55],
  wave:        [0.85, 1.4, 1.1],
  collision:   [1.55, 0.6, 0.45]
};

export class EncounterDirector {
  constructor(bus, { onFlash } = {}) {
    this.bus = bus;
    this.onFlash = onFlash;
    this.timer = 8;
    this.minGap = 7;
    this.maxGap = 22;
    this.rate = 1.0; // multiplier from UI (higher = more frequent)
    this.active = [];
    this.lastKinds = [];
    this.enabled = true;
  }

  update(dt, time) {
    if (!this.enabled) return;
    this.timer -= dt * this.rate;
    if (this.timer <= 0) {
      this._spawn(time);
      this.timer = (this.minGap + Math.random() * (this.maxGap - this.minGap)) / Math.max(0.2, this.rate);
    }
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      e.elapsed += dt;
      if (e.tick) e.tick(e, dt, time);
      if (e.elapsed >= e.duration) this.active.splice(i, 1);
    }
  }

  _pickKind() {
    const kinds = ['supernova', 'comet', 'pulsar', 'wave', 'collision'];
    // Avoid immediate repeat
    const filtered = kinds.filter((k) => k !== this.lastKinds[this.lastKinds.length - 1]);
    const k = filtered[Math.floor(Math.random() * filtered.length)];
    this.lastKinds.push(k);
    if (this.lastKinds.length > 3) this.lastKinds.shift();
    return k;
  }

  _randomPos(maxR = 240) {
    const phi = Math.random() * Math.PI * 2;
    const elev = (Math.random() - 0.5) * 1.2;
    const r = 80 + Math.random() * (maxR - 80);
    const c = Math.cos(elev);
    return [Math.cos(phi) * r * c, Math.sin(elev) * r * 0.55, Math.sin(phi) * r * c];
  }

  _spawn(time) {
    const kind = this._pickKind();
    if (kind === 'supernova') this._supernova(time);
    else if (kind === 'comet') this._comet(time);
    else if (kind === 'pulsar') this._pulsar(time);
    else if (kind === 'wave') this._gravitationalWave(time);
    else if (kind === 'collision') this._collision(time);
  }

  _emitImpulse(opts) {
    this.bus.emit('event', {
      type: 'impulse',
      band: opts.band ?? 'broadband',
      time: 0,
      ...opts
    });
  }

  _supernova(time) {
    const pos = this._randomPos(200);
    this._emitImpulse({
      kind: 'shell',
      position: pos,
      strength: 1.6,
      lifetime: 2.5,
      color: PALETTE.supernova,
      band: 'high'
    });
    // Companion well to suck back material after the blast
    this.active.push({
      elapsed: 0,
      duration: 3.0,
      tick: (e) => {
        if (e.elapsed > 1.4 && !e.didPull) {
          e.didPull = true;
          this._emitImpulse({
            kind: 'well',
            position: pos,
            strength: 0.55,
            lifetime: 4,
            color: PALETTE.supernova,
            band: 'sub'
          });
        }
      }
    });
    this.onFlash?.({ intensity: 1, position: pos, color: PALETTE.supernova });
  }

  _comet(time) {
    const start = this._randomPos(260);
    const end = this._randomPos(260).map((c, i) => -start[i] * 0.6 + c * 0.4);
    const warm = Math.random() < 0.5;
    const color = warm ? PALETTE.cometWarm : PALETTE.cometCool;
    const duration = 3.2 + Math.random() * 2.2;
    const segments = 10;
    this.active.push({
      elapsed: 0,
      duration,
      lastSeg: -1,
      tick: (e, dt, t) => {
        const seg = Math.floor((e.elapsed / e.duration) * segments);
        if (seg !== e.lastSeg && seg < segments) {
          e.lastSeg = seg;
          const p = seg / segments;
          const pos = [
            start[0] * (1 - p) + end[0] * p,
            start[1] * (1 - p) + end[1] * p,
            start[2] * (1 - p) + end[2] * p
          ];
          this._emitImpulse({
            kind: 'shell',
            position: pos,
            strength: 0.55,
            lifetime: 0.6,
            color,
            band: 'highMid'
          });
        }
      }
    });
    this.onFlash?.({ intensity: 0.5, position: start, color });
  }

  _pulsar(time) {
    const pos = this._randomPos(220);
    const beats = 5 + Math.floor(Math.random() * 4);
    const period = 0.4 + Math.random() * 0.25;
    const duration = beats * period + 0.4;
    this.active.push({
      elapsed: 0,
      duration,
      beat: 0,
      nextBeat: 0,
      tick: (e, dt, t) => {
        if (e.elapsed >= e.nextBeat && e.beat < beats) {
          e.beat += 1;
          e.nextBeat = e.beat * period;
          this._emitImpulse({
            kind: 'shell',
            position: pos,
            strength: 0.85,
            lifetime: 0.45,
            color: PALETTE.pulsar,
            band: 'mid'
          });
          this.onFlash?.({ intensity: 0.3, position: pos, color: PALETTE.pulsar });
        }
      }
    });
  }

  _gravitationalWave(time) {
    // A pair of impulses ringing the same point, plus a long-lived ribbon
    // suggesting a propagating distortion.
    const pos = this._randomPos(200);
    const axisPhi = Math.random() * Math.PI * 2;
    const axis = [Math.cos(axisPhi), 0.15, Math.sin(axisPhi)];
    this._emitImpulse({
      kind: 'ribbon',
      position: pos,
      axis,
      strength: 0.95,
      lifetime: 5,
      color: PALETTE.wave,
      band: 'lowMid'
    });
    this._emitImpulse({
      kind: 'vortex',
      position: pos,
      axis,
      strength: 0.7,
      lifetime: 4,
      color: PALETTE.wave,
      band: 'lowMid'
    });
    this.onFlash?.({ intensity: 0.4, position: pos, color: PALETTE.wave });
  }

  _collision(time) {
    // Two wells racing toward a meeting point that becomes a shell. Best
    // pre-cursor to a future structure.
    const a = this._randomPos(220);
    const b = a.map((c) => -c + (Math.random() - 0.5) * 60);
    const meet = a.map((c, i) => (c + b[i]) * 0.5);
    this._emitImpulse({ kind: 'well', position: a, strength: 0.7, lifetime: 1.6, color: PALETTE.collision, band: 'bass' });
    this._emitImpulse({ kind: 'well', position: b, strength: 0.7, lifetime: 1.6, color: PALETTE.collision, band: 'bass' });
    this.active.push({
      elapsed: 0,
      duration: 2.2,
      didShell: false,
      tick: (e) => {
        if (e.elapsed > 1.4 && !e.didShell) {
          e.didShell = true;
          this._emitImpulse({
            kind: 'shell',
            position: meet,
            strength: 1.4,
            lifetime: 2,
            color: PALETTE.collision,
            band: 'high'
          });
          this.onFlash?.({ intensity: 0.9, position: meet, color: PALETTE.collision });
        }
      }
    });
  }

  triggerNow() {
    this._spawn(0);
    this.timer = (this.minGap + Math.random() * (this.maxGap - this.minGap)) / Math.max(0.2, this.rate);
  }
}
