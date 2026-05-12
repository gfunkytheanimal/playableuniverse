import * as THREE from 'three';
import { MEMORY_HALF_EXTENT } from './MemoryField.js';

const SPLAT_VERT = `
  precision highp float;
  uniform sampler2D uPos;
  uniform float uTexRes;
  uniform float uHalfExtent;
  uniform float uSplatSize;
  void main() {
    float i = position.x;
    float u = mod(i, uTexRes) / uTexRes + 0.5 / uTexRes;
    float v = floor(i / uTexRes) / uTexRes + 0.5 / uTexRes;
    vec3 p = texture2D(uPos, vec2(u, v)).xyz;
    vec2 xz = p.xz / uHalfExtent;
    gl_Position = vec4(xz, 0.0, 1.0);
    gl_PointSize = uSplatSize;
  }
`;

const SPLAT_FRAG = `
  precision highp float;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot(d, d);
    if (r2 > 0.25) discard;
    float gauss = exp(-r2 * 14.0);
    // Each particle deposits a tiny gaussian into the density field. With
    // additive blending these stack into a self-density map without needing
    // n-body computation on the CPU.
    gl_FragColor = vec4(gauss * 0.025);
  }
`;

export class DensityField {
  constructor(renderer, particles, { resolution = 256, splatSize = 5 } = {}) {
    this.renderer = renderer;
    this.particles = particles;
    this.halfExtent = MEMORY_HALF_EXTENT;

    this.target = new THREE.WebGLRenderTarget(resolution, resolution, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false
    });

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const n = particles.count;
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) positions[i * 3] = i;
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e6);

    this.material = new THREE.ShaderMaterial({
      vertexShader: SPLAT_VERT,
      fragmentShader: SPLAT_FRAG,
      uniforms: {
        uPos: { value: null },
        uTexRes: { value: particles.texRes },
        uHalfExtent: { value: this.halfExtent },
        uSplatSize: { value: splatSize }
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  get texture() {
    return this.target.texture;
  }

  update() {
    this.material.uniforms.uPos.value = this.particles.positionTexture;
    const prevColor = new THREE.Color();
    const prevAlpha = this.renderer.getClearAlpha();
    this.renderer.getClearColor(prevColor);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setRenderTarget(this.target);
    this.renderer.clear(true, false, false);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(prevColor, prevAlpha);
  }
}
