import * as THREE from 'three';

const MEM_RES = 256;
const STAMP_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;
const STAMP_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev;
  uniform vec2 uCenter;
  uniform float uRadius;
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uDecay;
  void main() {
    vec4 prev = texture2D(uPrev, vUv) * uDecay;
    float d = distance(vUv, uCenter);
    float k = exp(-pow(d / max(uRadius, 1e-3), 2.0)) * uIntensity;
    vec3 added = uColor * k;
    gl_FragColor = vec4(prev.rgb + added, max(prev.a, k));
  }
`;
const DECAY_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev;
  uniform float uDecay;
  void main() {
    gl_FragColor = texture2D(uPrev, vUv) * uDecay;
  }
`;

export const MEMORY_HALF_EXTENT = 220.0;

export class MemoryField {
  constructor(renderer) {
    this.renderer = renderer;
    this.halfExtent = MEMORY_HALF_EXTENT;

    const opts = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false
    };
    this.ping = new THREE.WebGLRenderTarget(MEM_RES, MEM_RES, opts);
    this.pong = new THREE.WebGLRenderTarget(MEM_RES, MEM_RES, opts);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.stampMat = new THREE.ShaderMaterial({
      vertexShader: STAMP_VERT,
      fragmentShader: STAMP_FRAG,
      uniforms: {
        uPrev: { value: null },
        uCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uRadius: { value: 0.06 },
        uColor: { value: new THREE.Color(1, 1, 1) },
        uIntensity: { value: 1 },
        uDecay: { value: 1 }
      }
    });
    this.decayMat = new THREE.ShaderMaterial({
      vertexShader: STAMP_VERT,
      fragmentShader: DECAY_FRAG,
      uniforms: { uPrev: { value: null }, uDecay: { value: 0.999 } }
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.stampMat);
    this.scene.add(this.quad);

    this.clear();
  }

  get texture() {
    return this.ping.texture;
  }

  clear() {
    const prevColor = new THREE.Color();
    const prevAlpha = this.renderer.getClearAlpha();
    this.renderer.getClearColor(prevColor);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setRenderTarget(this.ping);
    this.renderer.clear(true, false, false);
    this.renderer.setRenderTarget(this.pong);
    this.renderer.clear(true, false, false);
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(prevColor, prevAlpha);
  }

  decay(dt, decayPerFrame = 0.9985) {
    const decay = Math.pow(decayPerFrame, dt * 60);
    this.quad.material = this.decayMat;
    this.decayMat.uniforms.uPrev.value = this.ping.texture;
    this.decayMat.uniforms.uDecay.value = decay;
    this.renderer.setRenderTarget(this.pong);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    [this.ping, this.pong] = [this.pong, this.ping];
  }

  stamp({ position, radius = 0.08, color = [1, 1, 1], intensity = 1 }) {
    const u = (position[0] / this.halfExtent) * 0.5 + 0.5;
    const v = (position[2] / this.halfExtent) * 0.5 + 0.5;
    if (u < 0 || u > 1 || v < 0 || v > 1) return;
    this.quad.material = this.stampMat;
    this.stampMat.uniforms.uPrev.value = this.ping.texture;
    this.stampMat.uniforms.uCenter.value.set(u, v);
    this.stampMat.uniforms.uRadius.value = radius;
    this.stampMat.uniforms.uColor.value.setRGB(color[0], color[1], color[2]);
    this.stampMat.uniforms.uIntensity.value = intensity;
    this.stampMat.uniforms.uDecay.value = 1;
    this.renderer.setRenderTarget(this.pong);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    [this.ping, this.pong] = [this.pong, this.ping];
  }
}
