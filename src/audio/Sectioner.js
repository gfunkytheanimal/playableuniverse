import { BAND_NAMES } from './SpectralAnalyzer.js';

export class Sectioner {
  constructor(analyzer) {
    this.analyzer = analyzer;
    this.bus = null;
    this.window = [];
    this.maxSamples = 360;
    this.lastChange = -10;
    this.minGap = 7;
  }

  attach(bus) {
    this.bus = bus;
  }

  update(songTime) {
    if (!this.bus) return;
    const sample = {};
    for (const n of BAND_NAMES) sample[n] = this.analyzer.bands[n];
    this.window.push(sample);
    if (this.window.length > this.maxSamples) this.window.shift();

    if (this.window.length < 180 || songTime - this.lastChange < this.minGap) return;

    const half = this.window.length >> 1;
    const a = avg(this.window.slice(0, half));
    const b = avg(this.window.slice(half));
    const d = cosineDistance(a, b);
    if (d > 0.18) {
      this.bus.emit('event', {
        type: 'section',
        band: 'broadband',
        time: songTime,
        strength: Math.min(1, d * 3)
      });
      this.lastChange = songTime;
    }
  }
}

function avg(samples) {
  const out = {};
  for (const n of BAND_NAMES) out[n] = 0;
  for (const s of samples) for (const n of BAND_NAMES) out[n] += s[n];
  for (const n of BAND_NAMES) out[n] /= samples.length;
  return out;
}

function cosineDistance(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const k of BAND_NAMES) {
    dot += a[k] * b[k];
    na += a[k] * a[k];
    nb += b[k] * b[k];
  }
  const denom = Math.sqrt(na * nb);
  if (denom <= 0) return 0;
  return 1 - dot / denom;
}
