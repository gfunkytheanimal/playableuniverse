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
    this.audioReactivity = 1;
    this.originStrength = 0.45;
  }

  handle(event, songTime) {
    this.eventCount += 1;
    if (event.type !== 'impulse') {
      event = { ...event, strength: Math.min(1, (event.strength ?? 0.5) * this.audioReactivity) };
    }
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
        strength: 0.35 + event.strength * 0.7,
        lifetime: 0.9,
        radius: 36,
        color
      });
    } else if (event.type === 'band') {
      const kind = bandKind(event.band);
      this.forces.inject({
        kind,
        position,
        axis: radial.axis,
        strength: 0.3 + event.strength * 0.9,
        lifetime: kind === 'well' ? 3.5 : kind === 'vortex' ? 3 : kind === 'ribbon' ? 4.2 : 1.4,
        radius: kind === 'well' ? 44 : 30,
        color
      });
    } else if (event.type === 'sustain') {
      const kind = bandKind(event.band);
      this.forces.inject({
        kind,
        position,
        axis: radial.axis,
        strength: 0.18 + event.strength * 0.42,
        lifetime: kind === 'shell' ? 0.8 : 1.8,
        radius: kind === 'well' ? 36 : 26,
        color
      });
    } else if (event.type === 'section') {
      this.lastSectionOrigin = position;
      const axisAng = Math.cos(songTime * 0.1 + this.eventCount * 0.11) * 1.2;
      this.forces.inject({
        kind: 'vortex',
        position,
        axis: [Math.sin(songTime * 0.1) * Math.sin(axisAng), Math.cos(axisAng), Math.cos(songTime * 0.1) * Math.sin(axisAng)],
        strength: 0.7 + event.strength * 0.8,
        lifetime: 6,
        radius: 90,
        color
      });
    } else if (event.type === 'impulse') {
      const kind = event.kind ?? 'shell';
      const lifetime = event.lifetime ?? (kind === 'well' ? 3 : kind === 'vortex' ? 2.5 : 1);
      const pitch = event.pitch ?? 0;
      this.forces.inject({
        kind,
        position: event.position ?? position,
        axis: event.axis ?? [Math.cos(pitch * 0.5), Math.sin(pitch * 0.13), Math.sin(pitch * 0.5)],
        strength: 0.55 + (event.strength ?? 0.5) * 0.9,
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
    // A faint seed only — the origin should not dominate the cosmology.
    // Most of the structure comes from the audio events that follow.
    this.forces.inject({
      kind: 'vortex',
      position: [0, 0, 0],
      axis: [0, 1, 0],
      strength: this.originStrength,
      lifetime: 6,
      radius: 60,
      color
    });
    this.memory.stamp({ position: [0, 0, 0], radius: 0.05, intensity: 0.4, color });
  }

  _radialPlacement(songTime, event) {
    // Spread events across a much wider volume so the universe forms multiple
    // distinct centres rather than piling around the origin.
    const phi = (songTime * 0.27 + this.eventCount * 1.61803398) * Math.PI * 2;
    const elev = Math.sin(songTime * 0.05 + this.eventCount * 0.27) * 0.85;
    const bandRadius = {
      sub: 60,
      bass: 80,
      lowMid: 110,
      mid: 140,
      highMid: 170,
      high: 200,
      broadband: 130
    }[event.band] ?? 130;
    const r = bandRadius + event.strength * 50 + (this.eventCount % 7) * 8;
    const c = Math.cos(elev);
    const position = [
      Math.cos(phi) * r * c,
      Math.sin(elev) * r * 0.6,
      Math.sin(phi) * r * c
    ];
    // Isotropic axis — no Y-bias. Previous (sin, 0.7, cos) constantly pushed
    // ribbons upward, producing the "trail upward" you saw.
    const axisPhi = phi * 1.7;
    const axisTheta = Math.cos(elev * 2.3 + this.eventCount * 0.11) * 1.2;
    const ax = Math.sin(axisTheta);
    const axis = [
      Math.cos(axisPhi) * ax,
      Math.cos(axisTheta),
      Math.sin(axisPhi) * ax
    ];
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
