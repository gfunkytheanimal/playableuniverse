// Schedules random encounters: meteors, comets, ships, UFOs, asteroids,
// satellites. The director just decides WHEN — the EncounterObjects system
// owns spawning and rendering. This used to fire physics impulses directly,
// which had the side effect of nuking the particle field on a strong
// supernova. It now stays out of the way and lets the visible objects
// disturb the field themselves as they pass.

import { ENCOUNTER_TYPES } from './EncounterObjects.js';

// Per-type spawn weights so the mix feels right.
const WEIGHTS = {
  meteor:    5,
  comet:     3,
  ship:      2,
  ufo:       2,
  asteroid:  4,
  satellite: 2
};

export class EncounterDirector {
  constructor(bus, { objects } = {}) {
    this.bus = bus;
    this.objects = objects; // EncounterObjects instance
    this.timer = 4;
    this.minGap = 4;
    this.maxGap = 14;
    this.rate = 1.0;
    this.enabled = true;
    this.recent = [];
  }

  update(dt) {
    if (!this.enabled || !this.objects) return;
    this.timer -= dt * this.rate;
    if (this.timer <= 0) {
      this._spawnRandom();
      this.timer = (this.minGap + Math.random() * (this.maxGap - this.minGap)) / Math.max(0.2, this.rate);
    }
  }

  _spawnRandom() {
    // Weighted pick, avoiding three-in-a-row of the same type.
    const available = ENCOUNTER_TYPES.filter((t) => {
      const last = this.recent[this.recent.length - 1];
      const prev = this.recent[this.recent.length - 2];
      return !(last === t && prev === t);
    });
    let totalWeight = 0;
    for (const t of available) totalWeight += (WEIGHTS[t] ?? 1);
    let roll = Math.random() * totalWeight;
    let pick = available[0];
    for (const t of available) {
      roll -= (WEIGHTS[t] ?? 1);
      if (roll <= 0) { pick = t; break; }
    }
    this.recent.push(pick);
    if (this.recent.length > 4) this.recent.shift();
    this.objects.spawn(pick);
  }

  triggerNow() {
    if (this.objects) this._spawnRandom();
    this.timer = (this.minGap + Math.random() * (this.maxGap - this.minGap)) / Math.max(0.2, this.rate);
  }
}
