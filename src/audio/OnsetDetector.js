import { BAND_NAMES } from './SpectralAnalyzer.js';

const FRAME = 1 / 60;

export class OnsetDetector {
  constructor(analyzer) {
    this.analyzer = analyzer;
    this.bus = null;
    this.globalCool = 0;
    this.bandCool = Object.fromEntries(BAND_NAMES.map((n) => [n, 0]));
    this.sustainCool = Object.fromEntries(BAND_NAMES.map((n) => [n, 0]));
  }

  attach(bus) {
    this.bus = bus;
  }

  update(songTime) {
    if (!this.bus) return;
    const flux = this.analyzer.flux;
    const fluxAvg = this.analyzer.fluxAvg;
    // Adaptive threshold rides on the moving average of flux itself,
    // with a tiny absolute floor so we still fire on quiet intros.
    const broadThresh = Math.max(0.0035, fluxAvg * 1.55 + 0.002);

    if (this.globalCool > 0) this.globalCool -= FRAME;
    if (flux > broadThresh && this.globalCool <= 0) {
      this.bus.emit('event', {
        type: 'transient',
        band: 'broadband',
        time: songTime,
        strength: Math.min(1, (flux - fluxAvg) * 18 + 0.35),
        centroid: this.analyzer.centroid
      });
      this.globalCool = 0.08;
    }

    for (const name of BAND_NAMES) {
      if (this.bandCool[name] > 0) this.bandCool[name] -= FRAME;
      if (this.sustainCool[name] > 0) this.sustainCool[name] -= FRAME;
      const f = this.analyzer.bandFlux[name];
      const fAvg = this.analyzer.bandFluxAvg[name];
      const lvl = this.analyzer.bands[name];
      const lvlAvg = this.analyzer.bandLevelAvg[name];
      const t = Math.max(0.003, fAvg * 1.6 + 0.0015) * (name === 'sub' || name === 'bass' ? 0.85 : 1);
      if (f > t && lvl > 0.04 && this.bandCool[name] <= 0) {
        this.bus.emit('event', {
          type: 'band',
          band: name,
          time: songTime,
          strength: Math.min(1, (f - fAvg) * 22 + lvl * 0.5 + 0.25),
          level: lvl
        });
        this.bandCool[name] = name === 'sub' || name === 'bass' ? 0.18 : 0.1;
      }
      // Sustained loud band: emits a longer-lived gentle force while the
      // band sits well above its own running average.
      if (lvl > Math.max(0.08, lvlAvg * 1.25) && this.sustainCool[name] <= 0) {
        this.bus.emit('event', {
          type: 'sustain',
          band: name,
          time: songTime,
          strength: Math.min(1, lvl * 0.9),
          level: lvl
        });
        this.sustainCool[name] = 0.6;
      }
    }
  }
}
