const BAND_COLORS = {
  sub: [0.42, 0.12, 0.85],
  bass: [0.85, 0.18, 0.42],
  lowMid: [0.95, 0.55, 0.18],
  mid: [0.32, 0.92, 0.62],
  highMid: [0.42, 0.85, 0.95],
  high: [0.95, 0.95, 1.0],
  broadband: [0.85, 0.85, 0.95]
};

export class EventMapper {
  constructor({ forces, memory }) {
    this.forces = forces;
    this.memory = memory;
    this.originPlaced = false;
    this.lastSectionOrigin = [0, 0, 0];
    this.eventCount = 0;
    this.songEnergy = 0;
  }

  handle(event, songTime) {
    this.eventCount += 1;
    this.songEnergy = Math.min(1, this.songEnergy * 0.99 + event.strength * 0.05);

    if (!this.originPlaced) {
      this._placeOrigin(event);
      this.originPlaced = true;
    }

    const color = BAND_COLORS[event.band] ?? BAND_COLORS.broadband;
    const radial = this._radialPlacement(songTime, event);
    const position = radial.position;

    if (event.type === 'transient') {
      this.forces.inject({
        kind: 'shell',
        position,
        strength: 0.4 + event.strength * 0.8,
        lifetime: 1.4,
        radius: 30,
        color
      });
    } else if (event.type === 'band') {
      const kind = bandKind(event.band);
      this.forces.inject({
        kind,
        position,
        axis: radial.axis,
        strength: 0.35 + event.strength * 1.1,
        lifetime: kind === 'well' ? 6 : kind === 'vortex' ? 5 : kind === 'ribbon' ? 7 : 2.2,
        radius: kind === 'well' ? 40 : 28,
        color
      });
    } else if (event.type === 'section') {
      this.lastSectionOrigin = position;
      this.forces.inject({
        kind: 'vortex',
        position,
        axis: [Math.sin(songTime * 0.1), 0.8, Math.cos(songTime * 0.1)],
        strength: 1.2 + event.strength * 1.2,
        lifetime: 9,
        radius: 80,
        color
      });
    } else if (event.type === 'impulse') {
      const kind = event.kind ?? 'shell';
      const lifetime = event.lifetime ?? (kind === 'well' ? 5 : kind === 'vortex' ? 4 : 1.6);
      this.forces.inject({
        kind,
        position: event.position ?? position,
        axis: event.axis ?? [Math.cos((event.pitch ?? 0) * 0.5), 0.7, Math.sin((event.pitch ?? 0) * 0.5)],
        strength: 1.1 + (event.strength ?? 0.5) * 1.6,
        lifetime,
        radius: 36,
        color: event.color ?? color
      });
      this.memory.stamp({
        position: event.position ?? position,
        radius: 0.05 + (event.strength ?? 0.5) * 0.05,
        intensity: 0.4 + (event.strength ?? 0.5) * 0.5,
        color: event.color ?? color
      });
      return;
    }

    this.memory.stamp({
      position,
      radius: 0.04 + event.strength * 0.06,
      intensity: 0.25 + event.strength * 0.45,
      color
    });
  }

  _placeOrigin(event) {
    const color = BAND_COLORS[event.band] ?? BAND_COLORS.broadband;
    // Seed singularity: short-lived and balanced by tangential swirl in the well shader
    this.forces.inject({
      kind: 'well',
      position: [0, 0, 0],
      axis: [0, 1, 0],
      strength: 0.7,
      lifetime: 9,
      radius: 60,
      color
    });
    // Companion vortex so the seed grows as a rotating disk, not a pile
    this.forces.inject({
      kind: 'vortex',
      position: [0, 0, 0],
      axis: [0, 1, 0],
      strength: 0.9,
      lifetime: 14,
      radius: 80,
      color
    });
    this.memory.stamp({ position: [0, 0, 0], radius: 0.12, intensity: 1.2, color });
  }

  _radialPlacement(songTime, event) {
    const phi = (songTime * 0.31 + this.eventCount * 0.618) * Math.PI * 2;
    const elev = Math.sin(songTime * 0.07 + this.eventCount * 0.19) * 0.6;
    const bandRadius = {
      sub: 14,
      bass: 26,
      lowMid: 48,
      mid: 72,
      highMid: 110,
      high: 150,
      broadband: 90
    }[event.band] ?? 70;
    const r = bandRadius + event.strength * 26;
    const c = Math.cos(elev);
    const position = [
      Math.cos(phi) * r * c,
      Math.sin(elev) * r * 0.55,
      Math.sin(phi) * r * c
    ];
    const axis = [Math.sin(phi * 1.7), 0.7, Math.cos(phi * 1.3)];
    return { position, axis };
  }

  tick(dt) {
    this.songEnergy *= Math.pow(0.985, dt * 60);
  }
}

function bandKind(band) {
  if (band === 'sub' || band === 'bass') return 'well';
  if (band === 'lowMid') return 'ribbon';
  if (band === 'mid') return 'vortex';
  if (band === 'highMid') return 'ribbon';
  if (band === 'high') return 'shell';
  return 'shell';
}
