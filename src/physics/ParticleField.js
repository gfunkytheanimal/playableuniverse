import * as THREE from 'three';
import { MAX_SOURCES } from './ForceSources.js';
import { MEMORY_HALF_EXTENT } from './MemoryField.js';

const FULL_QUAD_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const INIT_POS_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform float uSeed;
  uniform float uSpawnRadius;
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
  void main() {
    float a = h(vUv * 1.31 + 0.11) * 6.2831853;
    float b = h(vUv * 2.17 + 0.27) * 2.0 - 1.0;
    // Wider flatter disk so the field reads as a cosmic web from any zoom
    float r = (0.4 + pow(h(vUv * 3.91 + 0.53), 0.5)) * uSpawnRadius;
    float s = sqrt(max(0.0, 1.0 - b * b));
    vec3 pos = vec3(cos(a) * s, b * 0.18, sin(a) * s) * r;
    gl_FragColor = vec4(pos, 0.0);
  }
`;

const INIT_VEL_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform float uSeed;
  uniform sampler2D uPos;
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
  void main() {
    float family = floor(h(vUv * 7.11) * 12.0);
    vec3 p = texture2D(uPos, vUv).xyz;
    // Mix tangential (ordered orbital) + isotropic random so the field starts
    // turbulent rather than synchronised. Synchronised orbits made the cloud
    // look like a single moving blob; turbulence reads as a real volume.
    vec3 tang = normalize(cross(vec3(0.0, 1.0, 0.0), p) + 1e-4);
    vec3 rnd = normalize(vec3(
      h(vUv * 5.7)  - 0.5,
      h(vUv * 13.3) - 0.5,
      h(vUv * 23.9) - 0.5
    ) + 1e-4);
    float speed = 1.6 + h(vUv * 9.1) * 2.4;
    gl_FragColor = vec4(mix(rnd, tang, 0.5) * speed, family);
  }
`;

const VEL_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPos;
  uniform sampler2D uVel;
  uniform sampler2D uMemory;
  uniform sampler2D uDensity;
  uniform float uDt;
  uniform float uTime;
  uniform float uMemoryHalfExtent;
  uniform float uSongEnergy;
  uniform float uForceGain;
  uniform float uDamping;
  uniform float uSwirlBias;
  uniform float uExpansion;
  uniform float uCluster;
  uniform float uPlaneAttraction;
  uniform float uPlaneThickness;
  uniform int uForceCount;
  uniform vec4 uForcePos[${MAX_SOURCES}];
  uniform vec4 uForceMeta[${MAX_SOURCES}];

  void main() {
    vec4 pos = texture2D(uPos, vUv);
    vec4 vel = texture2D(uVel, vUv);
    vec3 p = pos.xyz;
    vec3 v = vel.xyz;
    float family = vel.w;
    float age = pos.w;

    vec3 accel = vec3(0.0);
    for (int i = 0; i < ${MAX_SOURCES}; i++) {
      if (i >= uForceCount) break;
      vec3 sp = uForcePos[i].xyz;
      float kind = uForcePos[i].w;
      if (kind < -0.5) continue;
      vec3 axis = normalize(uForceMeta[i].xyz + vec3(0.0, 1e-4, 0.0));
      float strength = uForceMeta[i].w * uForceGain;
      vec3 d = sp - p;
      float r = length(d) + 0.6;
      vec3 dir = d / r;
      // shared core repulsion to stop point-collapse
      float coreRepel = exp(-r * 0.25) * 8.0;
      accel += -dir * coreRepel;
      if (kind < 0.5) {
        // well: bounded attraction + strong tangential swirl so things orbit, not collapse
        float pull = strength * 7.0 / (r * 0.35 + 4.0);
        accel += dir * pull;
        vec3 tang = normalize(cross(axis, dir) + 1e-4);
        accel += tang * strength * (8.0 + uSwirlBias * 6.0) / (r * 0.2 + 3.0);
      } else if (kind < 1.5) {
        // vortex: dominant tangential, weak radial
        vec3 tang = normalize(cross(axis, dir) + 1e-4);
        accel += tang * strength * (12.0 + uSwirlBias * 8.0) / (r * 0.25 + 1.2);
        accel += dir * strength * 0.6 / (r + 4.0);
      } else if (kind < 2.5) {
        // shell: outward pulse. Halved from 48 -> 24 because a single
        // strong shell could otherwise eject more energy than damping
        // and confinement combined could retrieve.
        float falloff = exp(-r * 0.045);
        accel += -dir * strength * 24.0 * falloff;
      } else {
        // ribbon: pull toward an axis line through sp + flow along axis
        vec3 along = dot(d, axis) * axis;
        vec3 perp = d - along;
        float pr = length(perp) + 0.5;
        accel += perp / pr * strength * 8.0 / (pr * 0.3 + 1.0);
        accel += axis * strength * 2.4;
      }
    }

    // memory bias: top-down projection.
    // Particles flow ALONG memory ridges (curl of gradient) instead of falling
    // straight up the gradient. Stops the runaway "everything piles where the
    // most events happened" loop and produces filament-like flow.
    vec2 muv = (p.xz / uMemoryHalfExtent) * 0.5 + 0.5;
    if (muv.x > 0.02 && muv.x < 0.98 && muv.y > 0.02 && muv.y < 0.98) {
      vec4 mem = texture2D(uMemory, muv);
      float gx = texture2D(uMemory, muv + vec2(0.012, 0.0)).r - texture2D(uMemory, muv - vec2(0.012, 0.0)).r;
      float gz = texture2D(uMemory, muv + vec2(0.0, 0.012)).r - texture2D(uMemory, muv - vec2(0.0, 0.012)).r;
      vec3 curl = vec3(-gz, 0.0, gx);
      accel += curl * 28.0;
      // Bounded pull toward peaks (drops off where gradient is steep — keeps
      // particles from impaling themselves on a single hot pixel).
      vec3 grad = vec3(gx, 0.0, gz);
      float gMag = length(grad) + 0.02;
      accel += grad * (mem.r * 4.0) / (1.0 + gMag * 12.0);
    }

    // mild self-organising drift toward family-aligned circulation
    float fa = (family / 12.0) * 6.2831853;
    accel += vec3(cos(fa + uTime * 0.05), 0.0, sin(fa + uTime * 0.05)) * 0.04 * (0.4 + uSongEnergy);

    // Cosmological expansion: gentle radial outward drift, amplified by audio
    // energy so loud passages literally inflate the field. The expansion
    // weakens with distance so particles distribute into a soft nebula
    // instead of piling against the confinement wall.
    float pr = length(p) + 1.0;
    float expansionFalloff = exp(-pr / 240.0);
    accel += (p / pr) * uExpansion * (0.6 + uSongEnergy * 4.5) * expansionFalloff;

    // Galactic-plane attraction: weak pull toward y=0 plus a damping term on
    // vy when the particle is far from the plane. Without this, 2D density
    // clustering produces vertical pillars because nothing constrains y.
    // The attraction softens near the plane so the field forms a fluffy
    // disc rather than crashing onto a sheet.
    float planeDist = abs(p.y);
    float planeFactor = planeDist / (uPlaneThickness + 1.0);
    accel.y -= p.y * uPlaneAttraction * (0.18 + planeFactor * 0.55);
    if (planeDist > uPlaneThickness * 1.4) {
      v.y *= pow(0.97, uDt * 60.0);
    }

    // Self-gravity via density field: sample the 2D self-density map and pull
    // particles up the gradient. This is what lets the field self-organise
    // into clumps (stars, planets, galaxies) without an n-body computation.
    // Strength is bounded by local density so empty space doesn't accelerate
    // and dense cores don't crash to a point (the closer you are to the
    // gradient direction, the harder the inward pull resists at small radii).
    vec2 duv = (p.xz / uMemoryHalfExtent) * 0.5 + 0.5;
    if (uCluster > 0.001 && duv.x > 0.03 && duv.x < 0.97 && duv.y > 0.03 && duv.y < 0.97) {
      float d0 = texture2D(uDensity, duv).r;
      float dxp = texture2D(uDensity, duv + vec2(0.012, 0.0)).r;
      float dxn = texture2D(uDensity, duv - vec2(0.012, 0.0)).r;
      float dzp = texture2D(uDensity, duv + vec2(0.0, 0.012)).r;
      float dzn = texture2D(uDensity, duv - vec2(0.0, 0.012)).r;
      vec3 grad = vec3(dxp - dxn, 0.0, dzp - dzn);
      float gMag = length(grad) + 0.001;
      // Pull toward higher density, with a tanh-style saturation so cores
      // hold together but don't accelerate to infinity. Local density d0
      // scales the strength so deep voids don't drift forever.
      float pull = uCluster * (d0 / (d0 + 0.06)) * 32.0;
      accel += (grad / gMag) * pull * tanh(gMag * 90.0);
    }

    // accel clamp to prevent blow-ups when near a force center
    float amag = length(accel);
    if (amag > 220.0) accel *= 220.0 / amag;

    // integrate
    v += accel * uDt;
    // damping (gentler so orbits persist) — user-tunable
    v *= pow(clamp(uDamping, 0.85, 0.9999), uDt * 60.0);
    // soft confinement — gentle bounce up to a threshold, then much
    // stronger pullback once particles get far enough out that a stray
    // supernova could otherwise lose them.
    float radius = length(p);
    float bound = 360.0;
    if (radius > bound) {
      float excess = radius - bound;
      v -= normalize(p) * (excess * 0.08 + max(0.0, excess - 60.0) * 0.5);
    }

    // velocity clamp
    float vmag = length(v);
    if (vmag > 80.0) v *= 80.0 / vmag;

    gl_FragColor = vec4(v, family);
  }
`;

const POS_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPos;
  uniform sampler2D uVel;
  uniform float uDt;
  void main() {
    vec4 pos = texture2D(uPos, vUv);
    vec4 vel = texture2D(uVel, vUv);
    vec3 p = pos.xyz + vel.xyz * uDt;
    // Hard radial clamp — anything past the absolute boundary gets snapped
    // back. A strong shell (supernova, collision) can otherwise eject
    // particles far enough that the soft confinement can't recover them and
    // the universe slowly drains to infinity.
    float r = length(p);
    if (r > 520.0) p = normalize(p) * 520.0;
    float age = pos.w + uDt;
    gl_FragColor = vec4(p, age);
  }
`;

export class ParticleField {
  constructor(renderer, { count = 262144, seed = 1 } = {}) {
    this.renderer = renderer;
    const res = Math.ceil(Math.sqrt(count));
    this.texRes = res;
    this.count = res * res;
    this.seed = seed;

    const rtOpts = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false
    };
    this.posA = new THREE.WebGLRenderTarget(res, res, rtOpts);
    this.posB = new THREE.WebGLRenderTarget(res, res, rtOpts);
    this.velA = new THREE.WebGLRenderTarget(res, res, rtOpts);
    this.velB = new THREE.WebGLRenderTarget(res, res, rtOpts);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.scene.add(this.quad);

    this.initPosMat = new THREE.ShaderMaterial({
      vertexShader: FULL_QUAD_VERT,
      fragmentShader: INIT_POS_FRAG,
      uniforms: { uSeed: { value: seed }, uSpawnRadius: { value: 78 } }
    });
    this.initVelMat = new THREE.ShaderMaterial({
      vertexShader: FULL_QUAD_VERT,
      fragmentShader: INIT_VEL_FRAG,
      uniforms: { uSeed: { value: seed + 7 }, uPos: { value: null } }
    });

    this.forcePos = new Float32Array(MAX_SOURCES * 4);
    this.forceMeta = new Float32Array(MAX_SOURCES * 4);

    this.velMat = new THREE.ShaderMaterial({
      vertexShader: FULL_QUAD_VERT,
      fragmentShader: VEL_FRAG,
      uniforms: {
        uPos: { value: null },
        uVel: { value: null },
        uMemory: { value: null },
        uDensity: { value: null },
        uDt: { value: 1 / 60 },
        uTime: { value: 0 },
        uMemoryHalfExtent: { value: MEMORY_HALF_EXTENT },
        uSongEnergy: { value: 0 },
        uForceGain: { value: 1 },
        uDamping: { value: 0.997 },
        uSwirlBias: { value: 1 },
        uExpansion: { value: 0.4 },
        uCluster: { value: 0.8 },
        uPlaneAttraction: { value: 0.35 },
        uPlaneThickness: { value: 60 },
        uForceCount: { value: 0 },
        uForcePos: { value: this.forcePos },
        uForceMeta: { value: this.forceMeta }
      }
    });
    this.posMat = new THREE.ShaderMaterial({
      vertexShader: FULL_QUAD_VERT,
      fragmentShader: POS_FRAG,
      uniforms: {
        uPos: { value: null },
        uVel: { value: null },
        uDt: { value: 1 / 60 }
      }
    });

    this.reset(seed);
  }

  reset(seed = this.seed, spawnRadius = 78) {
    this.seed = seed;
    this.initPosMat.uniforms.uSeed.value = seed;
    this.initPosMat.uniforms.uSpawnRadius.value = spawnRadius;
    this.initVelMat.uniforms.uSeed.value = seed + 7;

    this.quad.material = this.initPosMat;
    this.renderer.setRenderTarget(this.posA);
    this.renderer.render(this.scene, this.camera);

    this.initVelMat.uniforms.uPos.value = this.posA.texture;
    this.quad.material = this.initVelMat;
    this.renderer.setRenderTarget(this.velA);
    this.renderer.render(this.scene, this.camera);

    this.renderer.setRenderTarget(null);
  }

  step(dt, forces, memory, density, songEnergy = 0, songTime = 0, opts = {}) {
    const count = forces.serialize(this.forcePos, this.forceMeta);
    const scaledDt = dt * (opts.timeScale ?? 1);

    this.quad.material = this.velMat;
    this.velMat.uniforms.uPos.value = this.posA.texture;
    this.velMat.uniforms.uVel.value = this.velA.texture;
    this.velMat.uniforms.uMemory.value = memory.texture;
    this.velMat.uniforms.uDensity.value = density?.texture ?? null;
    this.velMat.uniforms.uDt.value = scaledDt;
    this.velMat.uniforms.uTime.value = songTime;
    this.velMat.uniforms.uSongEnergy.value = songEnergy;
    this.velMat.uniforms.uForceGain.value = opts.forceGain ?? 1;
    this.velMat.uniforms.uDamping.value = opts.damping ?? 0.997;
    this.velMat.uniforms.uSwirlBias.value = opts.swirlBias ?? 1;
    this.velMat.uniforms.uExpansion.value = opts.expansion ?? 0.4;
    this.velMat.uniforms.uCluster.value = density ? (opts.cluster ?? 0.8) : 0;
    this.velMat.uniforms.uPlaneAttraction.value = opts.planeAttraction ?? 0.35;
    this.velMat.uniforms.uPlaneThickness.value = opts.planeThickness ?? 60;
    this.velMat.uniforms.uForceCount.value = count;
    this.velMat.uniforms.uForcePos.value = this.forcePos;
    this.velMat.uniforms.uForceMeta.value = this.forceMeta;
    this.renderer.setRenderTarget(this.velB);
    this.renderer.render(this.scene, this.camera);

    this.quad.material = this.posMat;
    this.posMat.uniforms.uPos.value = this.posA.texture;
    this.posMat.uniforms.uVel.value = this.velB.texture;
    this.posMat.uniforms.uDt.value = scaledDt;
    this.renderer.setRenderTarget(this.posB);
    this.renderer.render(this.scene, this.camera);

    this.renderer.setRenderTarget(null);

    [this.posA, this.posB] = [this.posB, this.posA];
    [this.velA, this.velB] = [this.velB, this.velA];
  }

  get positionTexture() {
    return this.posA.texture;
  }

  get velocityTexture() {
    return this.velA.texture;
  }
}
