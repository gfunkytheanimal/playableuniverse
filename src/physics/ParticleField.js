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
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
  void main() {
    float a = h(vUv * 1.31 + 0.11) * 6.2831853;
    float b = h(vUv * 2.17 + 0.27) * 2.0 - 1.0;
    float r = pow(h(vUv * 3.91 + 0.53), 0.3333) * 18.0;
    float s = sqrt(max(0.0, 1.0 - b * b));
    vec3 pos = vec3(cos(a) * s, b * 0.42, sin(a) * s) * r;
    gl_FragColor = vec4(pos, 0.0);
  }
`;

const INIT_VEL_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform float uSeed;
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
  void main() {
    float family = floor(h(vUv * 7.11) * 12.0);
    float ax = (h(vUv * 13.9) - 0.5) * 0.4;
    float ay = (h(vUv * 19.3) - 0.5) * 0.18;
    float az = (h(vUv * 23.7) - 0.5) * 0.4;
    gl_FragColor = vec4(ax, ay, az, family);
  }
`;

const VEL_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPos;
  uniform sampler2D uVel;
  uniform sampler2D uMemory;
  uniform float uDt;
  uniform float uTime;
  uniform float uMemoryHalfExtent;
  uniform float uSongEnergy;
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
      float strength = uForceMeta[i].w;
      vec3 d = sp - p;
      float r = length(d) + 0.6;
      vec3 dir = d / r;
      if (kind < 0.5) {
        // well: attraction with 1/r falloff, mild capture floor
        accel += dir * strength * 14.0 / (r * 0.5 + 1.5);
      } else if (kind < 1.5) {
        // vortex: tangential swirl + weak radial
        vec3 tang = normalize(cross(axis, dir) + 1e-4);
        accel += tang * strength * 9.0 / (r * 0.25 + 1.2);
        accel += dir * strength * 1.5 / (r + 4.0);
      } else if (kind < 2.5) {
        // shell: radial pulse outward, range-limited
        float falloff = exp(-r * 0.045);
        accel += -dir * strength * 36.0 * falloff;
      } else {
        // ribbon: pull toward an axis line through sp
        vec3 along = dot(d, axis) * axis;
        vec3 perp = d - along;
        float pr = length(perp) + 0.5;
        accel += perp / pr * strength * 6.0 / (pr * 0.3 + 1.0);
        accel += axis * strength * 1.2;
      }
    }

    // memory bias: top-down projection
    vec2 muv = (p.xz / uMemoryHalfExtent) * 0.5 + 0.5;
    if (muv.x > 0.0 && muv.x < 1.0 && muv.y > 0.0 && muv.y < 1.0) {
      vec4 mem = texture2D(uMemory, muv);
      vec3 gradient = vec3(
        texture2D(uMemory, muv + vec2(0.01, 0.0)).r - texture2D(uMemory, muv - vec2(0.01, 0.0)).r,
        0.0,
        texture2D(uMemory, muv + vec2(0.0, 0.01)).r - texture2D(uMemory, muv - vec2(0.0, 0.01)).r
      );
      accel += gradient * 18.0;
      accel.y += (mem.g - 0.05) * 1.2;
    }

    // mild self-organising drift toward family-aligned circulation
    float fa = (family / 12.0) * 6.2831853;
    accel += vec3(cos(fa + uTime * 0.05), 0.0, sin(fa + uTime * 0.05)) * 0.04 * (0.4 + uSongEnergy);

    // integrate
    v += accel * uDt;
    // damping
    v *= pow(0.985, uDt * 60.0);
    // soft confinement
    float radius = length(p);
    float bound = 260.0;
    if (radius > bound) v -= normalize(p) * (radius - bound) * 0.18;

    // velocity clamp
    float vmag = length(v);
    if (vmag > 60.0) v *= 60.0 / vmag;

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
    float age = pos.w + uDt;
    gl_FragColor = vec4(p, age);
  }
`;

export class ParticleField {
  constructor(renderer, { count = 65536, seed = 1 } = {}) {
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
      uniforms: { uSeed: { value: seed } }
    });
    this.initVelMat = new THREE.ShaderMaterial({
      vertexShader: FULL_QUAD_VERT,
      fragmentShader: INIT_VEL_FRAG,
      uniforms: { uSeed: { value: seed + 7 } }
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
        uDt: { value: 1 / 60 },
        uTime: { value: 0 },
        uMemoryHalfExtent: { value: MEMORY_HALF_EXTENT },
        uSongEnergy: { value: 0 },
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

  reset(seed = this.seed) {
    this.seed = seed;
    this.initPosMat.uniforms.uSeed.value = seed;
    this.initVelMat.uniforms.uSeed.value = seed + 7;

    this.quad.material = this.initPosMat;
    this.renderer.setRenderTarget(this.posA);
    this.renderer.render(this.scene, this.camera);

    this.quad.material = this.initVelMat;
    this.renderer.setRenderTarget(this.velA);
    this.renderer.render(this.scene, this.camera);

    this.renderer.setRenderTarget(null);
  }

  step(dt, forces, memory, songEnergy = 0, songTime = 0) {
    const count = forces.serialize(this.forcePos, this.forceMeta);

    this.quad.material = this.velMat;
    this.velMat.uniforms.uPos.value = this.posA.texture;
    this.velMat.uniforms.uVel.value = this.velA.texture;
    this.velMat.uniforms.uMemory.value = memory.texture;
    this.velMat.uniforms.uDt.value = dt;
    this.velMat.uniforms.uTime.value = songTime;
    this.velMat.uniforms.uSongEnergy.value = songEnergy;
    this.velMat.uniforms.uForceCount.value = count;
    this.velMat.uniforms.uForcePos.value = this.forcePos;
    this.velMat.uniforms.uForceMeta.value = this.forceMeta;
    this.renderer.setRenderTarget(this.velB);
    this.renderer.render(this.scene, this.camera);

    this.quad.material = this.posMat;
    this.posMat.uniforms.uPos.value = this.posA.texture;
    this.posMat.uniforms.uVel.value = this.velB.texture;
    this.posMat.uniforms.uDt.value = dt;
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
