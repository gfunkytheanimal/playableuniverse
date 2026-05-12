export const KINDS = {
  well: 0,
  vortex: 1,
  shell: 2,
  ribbon: 3
};

export const MAX_SOURCES = 24;

export class ForceSources {
  constructor() {
    this.list = [];
  }

  inject({ kind = 'well', position, strength = 1, radius = 24, lifetime = 4, axis = [0, 1, 0], color = [1, 1, 1] }) {
    if (this.list.length >= MAX_SOURCES) {
      let weakest = 0;
      for (let i = 1; i < this.list.length; i++) {
        if (this.list[i].strength < this.list[weakest].strength) weakest = i;
      }
      this.list.splice(weakest, 1);
    }
    this.list.push({
      kind: KINDS[kind] ?? 0,
      position: position.slice(),
      strength,
      radius,
      age: 0,
      lifetime,
      axis: axis.slice(),
      color: color.slice()
    });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      s.age += dt;
      const life = Math.max(0, 1 - s.age / s.lifetime);
      s.currentStrength = s.strength * life;
      if (s.age >= s.lifetime) this.list.splice(i, 1);
    }
  }

  serialize(posOut, metaOut) {
    const n = Math.min(this.list.length, MAX_SOURCES);
    for (let i = 0; i < MAX_SOURCES; i++) {
      const o = i * 4;
      if (i < n) {
        const s = this.list[i];
        posOut[o + 0] = s.position[0];
        posOut[o + 1] = s.position[1];
        posOut[o + 2] = s.position[2];
        posOut[o + 3] = s.kind;
        metaOut[o + 0] = s.axis[0];
        metaOut[o + 1] = s.axis[1];
        metaOut[o + 2] = s.axis[2];
        metaOut[o + 3] = s.currentStrength;
      } else {
        posOut[o + 0] = 0;
        posOut[o + 1] = 0;
        posOut[o + 2] = 0;
        posOut[o + 3] = -1;
        metaOut[o + 0] = 0;
        metaOut[o + 1] = 1;
        metaOut[o + 2] = 0;
        metaOut[o + 3] = 0;
      }
    }
    return n;
  }
}
