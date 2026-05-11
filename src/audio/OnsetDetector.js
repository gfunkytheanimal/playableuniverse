import { BAND_NAMES } from './SpectralAnalyzer.js';

const FRAME = 1 / 60;

export class OnsetDetector {
  constructor(analyzer) {
    this.analyzer = analyzer;
    this.bus = null;
    this.globalCool = 0;
    this.bandCool = Object.fromEntries(BAND_NAMES.map((n) => [n, 0]));
  }

  attach(bus) {
    this.bus = bus;
  }

  update(songTime) {
    if (!this.bus) return;
    const flux = this.analyzer.flux;
    const noise = this.analyzer.noiseFloor;
    const broadThresh = Math.max(0.013, noise * 1.6);

    if (this.globalCool > 0) this.globalCool -= FRAME;
    if (flux > broadThresh && this.globalCool <= 0) {
      this.bus.emit('event', {
        type: 'transient',
        band: 'broadband',
        time: songTime,
        strength: Math.min(1, flux / 0.06),
        centroid: this.analyzer.centroid
      });
      this.globalCool = 0.08;
    }

    for (const name of BAND_NAMES) {
      if (this.bandCool[name] > 0) this.bandCool[name] -= FRAME;
      const f = this.analyzer.bandFlux[name];
      const lvl = this.analyzer.bands[name];
      const t = broadThresh * (name === 'sub' || name === 'bass' ? 0.85 : 1.15);
      if (f > t && lvl > 0.06 && this.bandCool[name] <= 0) {
        this.bus.emit('event', {
          type: 'band',
          band: name,
          time: songTime,
          strength: Math.min(1, f / 0.09 + lvl * 0.6),
          level: lvl
        });
        this.bandCool[name] = name === 'sub' || name === 'bass' ? 0.18 : 0.1;
      }
    }
  }
}
