const BANDS = [
  ['sub', 20, 60],
  ['bass', 60, 160],
  ['lowMid', 160, 400],
  ['mid', 400, 1200],
  ['highMid', 1200, 3500],
  ['high', 3500, 12000]
];

export const BAND_NAMES = BANDS.map(([n]) => n);

export class SpectralAnalyzer {
  constructor(input) {
    this.input = input;
    this.spectrum = new Uint8Array(1024);
    this.prevMag = new Float32Array(1024);
    this.diffs = new Float32Array(1024);
    this.flux = 0;
    this.bands = Object.fromEntries(BAND_NAMES.map((n) => [n, 0]));
    this.bandFlux = Object.fromEntries(BAND_NAMES.map((n) => [n, 0]));
    this.centroid = 0;
    this.rms = 0;
    this.noiseFloor = 0.02;
    this.harmonicity = 0;
  }

  binFor(hz) {
    const ana = this.input.analyserNode;
    if (!ana) return 0;
    const nyq = this.input.sampleRate * 0.5;
    return Math.max(1, Math.min(ana.frequencyBinCount - 1, Math.floor((hz / nyq) * ana.frequencyBinCount)));
  }

  update() {
    const ana = this.input.analyserNode;
    if (!ana) return;
    const N = ana.frequencyBinCount;
    if (this.spectrum.length !== N) {
      this.spectrum = new Uint8Array(N);
      this.prevMag = new Float32Array(N);
      this.diffs = new Float32Array(N);
    }
    ana.getByteFrequencyData(this.spectrum);

    let flux = 0;
    let weighted = 0;
    let total = 0;
    let energy = 0;
    let peak = 0;
    for (let i = 0; i < N; i++) {
      const mag = this.spectrum[i] / 255;
      const d = mag - this.prevMag[i];
      const pos = d > 0 ? d : 0;
      this.diffs[i] = pos;
      flux += pos;
      weighted += i * mag;
      total += mag;
      energy += mag * mag;
      if (mag > peak) peak = mag;
      this.prevMag[i] = mag;
    }
    this.flux = flux / N;
    this.centroid = total > 0 ? weighted / total / N : 0;
    this.rms = Math.sqrt(energy / N);
    this.harmonicity = peak > 0 ? Math.min(1, peak / (this.rms + 0.001) * 0.18) : 0;

    for (const [name, lo, hi] of BANDS) {
      const a = this.binFor(lo);
      const b = this.binFor(hi);
      let sum = 0;
      let flx = 0;
      for (let i = a; i < b; i++) {
        sum += this.spectrum[i] / 255;
        flx += this.diffs[i];
      }
      const w = Math.max(1, b - a);
      this.bands[name] = sum / w;
      this.bandFlux[name] = flx / w;
    }

    const target = this.rms;
    const rise = 0.0008;
    const fall = 0.06;
    this.noiseFloor += (target > this.noiseFloor ? rise : fall) * (target - this.noiseFloor);
  }
}
