// Visible "encounter" objects — meteors, comets, ships, UFOs, asteroids,
// satellites — that fly *through* the universe. They're rendered as their
// own bright billboards, separate from the particle field, and emit small
// local impulses on the bus as they pass so the field reacts to them.

import * as THREE from 'three';

const MAX_OBJECTS = 24;
const FRAGMENT_TYPES = ['meteor', 'comet', 'ship', 'ufo', 'asteroid', 'satellite'];

// Per-type configuration. speed is world-units/sec. lifetime is seconds.
// emitInterval throttles how often an object disturbs the particle field.
const TYPES = {
  meteor: {
    speed: 240, lifetime: 3.0, scale: 16, hue: 0.08,
    color: [1.65, 1.15, 0.55], emitKind: 'shell', emitStrength: 0.25,
    emitInterval: 0.06, glow: 1.6, sound: 'meteor'
  },
  comet: {
    speed: 85, lifetime: 11.0, scale: 24, hue: 0.55,
    color: [0.75, 1.45, 1.6], emitKind: 'ribbon', emitStrength: 0.32,
    emitInterval: 0.18, glow: 1.4, sound: 'comet'
  },
  ship: {
    speed: 55, lifetime: 16.0, scale: 11, hue: 0.32,
    color: [0.7, 1.55, 0.9], emitKind: 'shell', emitStrength: 0.18,
    emitInterval: 0.24, glow: 1.2, sound: 'ship'
  },
  ufo: {
    speed: 40, lifetime: 14.0, scale: 18, hue: 0.78,
    color: [1.45, 0.7, 1.55], emitKind: 'vortex', emitStrength: 0.26,
    emitInterval: 0.18, glow: 1.45, sound: 'ufo', wobble: true
  },
  asteroid: {
    speed: 28, lifetime: 22.0, scale: 22, hue: 0.05,
    color: [1.1, 0.85, 0.65], emitKind: 'well', emitStrength: 0.18,
    emitInterval: 0.32, glow: 0.85, sound: 'asteroid'
  },
  satellite: {
    speed: 75, lifetime: 12.0, scale: 8, hue: 0.42,
    color: [1.55, 1.6, 1.3], emitKind: 'shell', emitStrength: 0.12,
    emitInterval: 0.1, glow: 1.3, sound: 'satellite', orbital: true
  }
};

const VERT = `
  precision highp float;
  attribute float aType;
  attribute float aAge;
  attribute float aScale;
  attribute float aGlow;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  uniform float uTime;
  varying float vType;
  varying float vAge;
  varying float vGlow;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = max(0.1, -mv.z);
    gl_PointSize = aScale * uPixelRatio * (220.0 / dist);
    vType = aType;
    vAge = aAge;
    vGlow = aGlow;
    vColor = aColor;
  }
`;
const FRAG = `
  precision highp float;
  varying float vType;
  varying float vAge;
  varying float vGlow;
  varying vec3 vColor;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r2 = dot(uv, uv);
    if (r2 > 0.25) discard;
    float core = exp(-r2 * 60.0);
    float halo = exp(-r2 * 8.0) * 0.42;
    float lens = exp(-abs(uv.y) * 60.0) * smoothstep(0.5, 0.05, abs(uv.x)) * 0.18;
    float alpha = core + halo + lens;
    vec3 col = vColor * vGlow;
    // Type-specific touches:
    if (vType < 0.5) {
      // METEOR: warm streak, extra horizontal blur
      float streak = exp(-abs(uv.y) * 28.0) * smoothstep(0.5, 0.05, abs(uv.x)) * 0.55;
      alpha += streak;
      col = mix(col, vec3(1.6, 1.2, 0.7), 0.3);
    } else if (vType < 1.5) {
      // COMET: cool nucleus + tail-fade
      float tail = exp(-uv.x * 8.0) * smoothstep(0.5, 0.1, abs(uv.y)) * 0.35;
      alpha += max(0.0, tail);
      col = mix(col, vec3(0.7, 1.4, 1.7), 0.4);
    } else if (vType < 2.5) {
      // SHIP: triangle silhouette + running lights
      float tri = step(uv.y * 2.4 - uv.x * 1.2, 0.42) * step(-uv.y * 2.4 - uv.x * 1.2, 0.42) * step(uv.x, 0.42);
      alpha += tri * 0.55;
      float light = step(fract(vAge * 1.6), 0.5) * 0.4;
      col = mix(col, vec3(0.7, 1.7, 0.85), 0.35) + vec3(light * 0.3, light * 0.4, light * 0.6);
    } else if (vType < 3.5) {
      // UFO: horizontal ellipse with rotating multi-colour rim
      float ellipse = exp(-(uv.y * uv.y * 80.0 + uv.x * uv.x * 7.0));
      float rim = smoothstep(0.32, 0.20, length(uv * vec2(1.0, 3.2)));
      alpha = max(alpha, ellipse * 0.9 + rim * 0.6);
      float pulse = 0.5 + 0.5 * sin(vAge * 9.0 + uv.x * 14.0);
      col = mix(vec3(1.5, 0.7, 1.6), vec3(0.6, 1.5, 1.4), pulse);
    } else if (vType < 4.5) {
      // ASTEROID: pebbly low-glow body
      float noise = hash(uv * 32.0);
      alpha = core * 0.95 + halo * 0.4;
      col = mix(vec3(0.9, 0.78, 0.6), vec3(0.55, 0.45, 0.35), noise);
    } else {
      // SATELLITE: tiny core + periodic radio pulse
      float blink = step(0.85, fract(vAge * 2.7));
      alpha += blink * 0.5;
      col = mix(col, vec3(1.8, 1.7, 1.4), 0.4);
    }
    // Fade in/out at object lifetime ends (caller writes aAge as 0..1).
    float life = smoothstep(0.0, 0.12, vAge) * smoothstep(1.0, 0.78, vAge);
    gl_FragColor = vec4(col, alpha * life * 0.95);
  }
`;

export class EncounterObjects {
  constructor(scene, bus, { synth } = {}) {
    this.scene = scene;
    this.bus = bus;
    this.synth = synth;
    this.objects = [];

    const positions = new Float32Array(MAX_OBJECTS * 3);
    const types = new Float32Array(MAX_OBJECTS);
    const ages = new Float32Array(MAX_OBJECTS);
    const scales = new Float32Array(MAX_OBJECTS);
    const glows = new Float32Array(MAX_OBJECTS);
    const colors = new Float32Array(MAX_OBJECTS * 3);

    this.attrPos = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
    this.attrType = new THREE.BufferAttribute(types, 1).setUsage(THREE.DynamicDrawUsage);
    this.attrAge = new THREE.BufferAttribute(ages, 1).setUsage(THREE.DynamicDrawUsage);
    this.attrScale = new THREE.BufferAttribute(scales, 1).setUsage(THREE.DynamicDrawUsage);
    this.attrGlow = new THREE.BufferAttribute(glows, 1).setUsage(THREE.DynamicDrawUsage);
    this.attrColor = new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', this.attrPos);
    this.geometry.setAttribute('aType', this.attrType);
    this.geometry.setAttribute('aAge', this.attrAge);
    this.geometry.setAttribute('aScale', this.attrScale);
    this.geometry.setAttribute('aGlow', this.attrGlow);
    this.geometry.setAttribute('aColor', this.attrColor);
    this.geometry.setDrawRange(0, 0);
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e6);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uPixelRatio: { value: 1 },
        uTime: { value: 0 }
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    scene.add(this.points);
  }

  setRenderer(renderer) {
    this.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  }

  spawn(type) {
    const cfg = TYPES[type] ?? TYPES.meteor;
    if (this.objects.length >= MAX_OBJECTS) {
      // remove the oldest
      this.objects.shift();
    }
    // Spawn just inside the soft boundary, aim through (or near) the origin
    // with a perpendicular offset so it doesn't smash dead-centre every time.
    const phi = Math.random() * Math.PI * 2;
    const ele = (Math.random() - 0.5) * 0.9;
    const startR = 360 + Math.random() * 60;
    const start = new THREE.Vector3(
      Math.cos(phi) * Math.cos(ele) * startR,
      Math.sin(ele) * startR * 0.6,
      Math.sin(phi) * Math.cos(ele) * startR
    );
    const targetOffset = new THREE.Vector3(
      (Math.random() - 0.5) * 220,
      (Math.random() - 0.5) * 80,
      (Math.random() - 0.5) * 220
    );
    const dir = targetOffset.clone().sub(start).normalize();
    const obj = {
      type,
      cfg,
      pos: start,
      vel: dir.multiplyScalar(cfg.speed * (0.85 + Math.random() * 0.3)),
      age: 0,
      lifetime: cfg.lifetime * (0.8 + Math.random() * 0.4),
      lastEmit: 0,
      wobblePhase: Math.random() * Math.PI * 2,
      orbitPhase: Math.random() * Math.PI * 2
    };
    this.objects.push(obj);

    if (this.synth && typeof this.synth.playEncounter === 'function') {
      this.synth.playEncounter(type);
    }
  }

  update(dt, time) {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const o = this.objects[i];
      o.age += dt;

      // Path style
      if (o.cfg.wobble) {
        // UFO: lateral wobble perpendicular to velocity
        o.wobblePhase += dt * 1.8;
        const perp = new THREE.Vector3(-o.vel.z, 0, o.vel.x).normalize();
        const wobble = Math.sin(o.wobblePhase) * 0.6;
        o.pos.addScaledVector(perp, wobble * dt * o.cfg.speed * 0.4);
      }
      if (o.cfg.orbital) {
        // Satellite: gently curves toward an orbital arc
        const radial = o.pos.clone().normalize();
        const tangent = new THREE.Vector3(-radial.z, 0, radial.x);
        o.vel.addScaledVector(tangent, dt * o.cfg.speed * 0.06);
        o.vel.addScaledVector(radial, -dt * o.cfg.speed * 0.02);
      }
      o.pos.addScaledVector(o.vel, dt);

      // Periodic local disturbance so the particle field can feel them.
      if (o.age - o.lastEmit > o.cfg.emitInterval) {
        o.lastEmit = o.age;
        this.bus.emit('event', {
          type: 'impulse',
          kind: o.cfg.emitKind,
          band: 'broadband',
          strength: o.cfg.emitStrength,
          lifetime: 0.5,
          position: [o.pos.x, o.pos.y, o.pos.z],
          axis: [o.vel.x, o.vel.y, o.vel.z],
          color: o.cfg.color
        });
      }

      // Despawn if life over or it flew way out of the visible volume.
      const r = o.pos.length();
      if (o.age >= o.lifetime || r > 520) {
        this.objects.splice(i, 1);
      }
    }

    this._writeBuffers();
    if (this.material.uniforms.uTime) this.material.uniforms.uTime.value = time;
  }

  _writeBuffers() {
    const positions = this.attrPos.array;
    const types = this.attrType.array;
    const ages = this.attrAge.array;
    const scales = this.attrScale.array;
    const glows = this.attrGlow.array;
    const colors = this.attrColor.array;
    for (let i = 0; i < this.objects.length; i++) {
      const o = this.objects[i];
      positions[i * 3 + 0] = o.pos.x;
      positions[i * 3 + 1] = o.pos.y;
      positions[i * 3 + 2] = o.pos.z;
      types[i] = FRAGMENT_TYPES.indexOf(o.type);
      // normalize age to [0..1] for fade-in/out in the shader
      ages[i] = Math.min(1, o.age / o.lifetime);
      scales[i] = o.cfg.scale;
      glows[i] = o.cfg.glow;
      colors[i * 3 + 0] = o.cfg.color[0];
      colors[i * 3 + 1] = o.cfg.color[1];
      colors[i * 3 + 2] = o.cfg.color[2];
    }
    this.attrPos.needsUpdate = true;
    this.attrType.needsUpdate = true;
    this.attrAge.needsUpdate = true;
    this.attrScale.needsUpdate = true;
    this.attrGlow.needsUpdate = true;
    this.attrColor.needsUpdate = true;
    this.geometry.setDrawRange(0, this.objects.length);
  }

  clear() {
    this.objects.length = 0;
    this.geometry.setDrawRange(0, 0);
  }
}

export const ENCOUNTER_TYPES = Object.keys(TYPES);
