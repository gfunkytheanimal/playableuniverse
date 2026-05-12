import * as THREE from 'three';

const VERT = `
  precision highp float;
  uniform sampler2D uPos;
  uniform sampler2D uVel;
  uniform sampler2D uMemory;
  uniform float uTexRes;
  uniform float uPointSize;
  uniform float uMemoryHalfExtent;
  uniform float uPixelRatio;
  uniform float uHueShift;
  uniform float uMemoryBlend;
  uniform float uPaletteMix;
  uniform vec2 uViewport;
  varying vec3 vColor;
  varying float vEnergy;
  varying float vMemory;
  vec3 familyColor(float f, float hueShift, float paletteMix) {
    float a = (f / 12.0) * 6.2831853 + hueShift;
    vec3 wheel = 0.5 + 0.5 * vec3(cos(a), cos(a + 2.094), cos(a + 4.189));
    vec3 mono = vec3(0.55 + 0.45 * cos(a + 1.57));
    return mix(wheel, mono, paletteMix);
  }
  void main() {
    float i = position.x;
    float u = mod(i, uTexRes) / uTexRes + 0.5 / uTexRes;
    float v = floor(i / uTexRes) / uTexRes + 0.5 / uTexRes;
    vec4 pos = texture2D(uPos, vec2(u, v));
    vec4 vel = texture2D(uVel, vec2(u, v));
    vec3 world = pos.xyz;
    float family = vel.w;
    vec2 muv = (world.xz / uMemoryHalfExtent) * 0.5 + 0.5;
    vec4 mem = vec4(0.0);
    if (muv.x > 0.0 && muv.x < 1.0 && muv.y > 0.0 && muv.y < 1.0) {
      mem = texture2D(uMemory, muv);
    }
    vec3 base = familyColor(family, uHueShift, uPaletteMix);
    vec3 tinted = mix(base, mem.rgb * 1.2, clamp(length(mem.rgb) * uMemoryBlend, 0.0, 0.85));
    vColor = tinted;
    vEnergy = clamp(length(vel.xyz) * 0.05, 0.0, 1.0);
    vMemory = clamp(length(mem.rgb), 0.0, 1.2);
    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = max(0.1, -mv.z);
    gl_PointSize = uPointSize * uPixelRatio * (160.0 / dist);
  }
`;

const FRAG = `
  precision highp float;
  varying vec3 vColor;
  varying float vEnergy;
  varying float vMemory;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot(d, d);
    if (r2 > 0.25) discard;
    float core = exp(-r2 * 22.0);
    float halo = exp(-r2 * 7.0) * 0.22;
    float glow = core + halo;
    vec3 base = vColor;
    vec3 hot = mix(base, vec3(1.0), vEnergy * 0.55);
    vec3 lit = hot * (0.55 + vMemory * 0.7) + base * vMemory * 0.28;
    // Slightly lower base alpha so dense clusters don't saturate to a white
    // blob and sparse regions retain visible texture.
    gl_FragColor = vec4(lit, glow * (0.38 + vEnergy * 0.5 + vMemory * 0.28));
  }
`;

export class ParticleRenderer {
  constructor(renderer, particles, memoryField) {
    this.renderer = renderer;
    this.particles = particles;
    this.memoryField = memoryField;

    const n = particles.count;
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) positions[i * 3] = i;

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setDrawRange(0, n);
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e6);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uPos: { value: particles.positionTexture },
        uVel: { value: particles.velocityTexture },
        uMemory: { value: memoryField.texture },
        uTexRes: { value: particles.texRes },
        uPointSize: { value: 2.4 },
        uMemoryHalfExtent: { value: memoryField.halfExtent },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uHueShift: { value: 0 },
        uMemoryBlend: { value: 0.6 },
        uPaletteMix: { value: 0 },
        uViewport: { value: new THREE.Vector2(1, 1) }
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  attachTo(scene) {
    scene.add(this.points);
  }

  update(params = {}) {
    this.material.uniforms.uPos.value = this.particles.positionTexture;
    this.material.uniforms.uVel.value = this.particles.velocityTexture;
    this.material.uniforms.uMemory.value = this.memoryField.texture;
    this.material.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();
    if (params.pointSize !== undefined) this.material.uniforms.uPointSize.value = params.pointSize;
    if (params.memoryBlend !== undefined) this.material.uniforms.uMemoryBlend.value = params.memoryBlend;
    if (params.hueShift !== undefined) this.material.uniforms.uHueShift.value = params.hueShift;
    if (params.paletteMix !== undefined) this.material.uniforms.uPaletteMix.value = params.paletteMix;
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    this.material.uniforms.uViewport.value.set(size.x, size.y);
  }

  render(scene, camera) {
    this.update();
    this.renderer.setRenderTarget(null);
    this.renderer.clear(true, true, false);
    this.renderer.render(scene, camera);
  }
}
