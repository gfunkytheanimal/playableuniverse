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
  uniform float uTime;
  uniform vec2 uViewport;
  varying vec3 vColor;
  varying float vEnergy;
  varying float vMemory;
  varying float vWarmth;
  varying float vClass;
  varying float vTwinkle;
  vec3 familyColor(float f, float hueShift, float paletteMix) {
    float a = (f / 12.0) * 6.2831853 + hueShift;
    vec3 wheel = 0.5 + 0.5 * vec3(cos(a), cos(a + 2.094), cos(a + 4.189));
    vec3 mono = vec3(0.55 + 0.45 * cos(a + 1.57));
    return mix(wheel, mono, paletteMix);
  }
  float hash11(float x) {
    return fract(sin(x * 12.9898) * 43758.5453);
  }
  // Five stellar temperatures, roughly matched to real spectral types. The
  // returned RGB is multiplied against the family colour so palette swaps
  // still work — these add temperature variety on top.
  vec3 stellarTemp(float t) {
    if (t < 0.18)      return vec3(1.55, 1.25, 0.65); // red giant
    else if (t < 0.40) return vec3(1.50, 1.05, 0.55); // orange (K)
    else if (t < 0.62) return vec3(1.40, 1.30, 0.95); // yellow (G, sol-like)
    else if (t < 0.86) return vec3(1.20, 1.30, 1.45); // white (A/F)
    else               return vec3(0.85, 1.15, 1.65); // blue (O/B)
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
    // Stellar class — stable per particle. Most are dust; a small fraction
    // are giants and supergiants that read as actual stars.
    float roll = hash11(i * 0.0173 + 7.31);
    float tempRoll = hash11(i * 0.0211 + 13.7);
    float twinkleSeed = hash11(i * 0.041 + 91.7);
    float classSize;
    float classWarmth;
    float classEmit;
    float twinkleAmt;
    if (roll < 0.004) {           // 0.4% supergiants
      classSize = 5.5;
      classWarmth = 0.85;
      classEmit = 1.8;
      twinkleAmt = 0.06;
      vClass = 3.0;
    } else if (roll < 0.024) {    // 2% giants
      classSize = 2.6;
      classWarmth = 0.55;
      classEmit = 1.25;
      twinkleAmt = 0.10;
      vClass = 2.0;
    } else if (roll < 0.12) {     // 9.6% main-sequence stars
      classSize = 1.4;
      classWarmth = 0.25;
      classEmit = 0.95;
      twinkleAmt = 0.16;
      vClass = 1.0;
    } else {                      // 88% dust
      classSize = 0.78 + hash11(i * 0.041) * 0.42;
      classWarmth = 0.0;
      classEmit = 0.6;
      twinkleAmt = 0.22;
      vClass = 0.0;
    }
    vec3 base = familyColor(family, uHueShift, uPaletteMix);
    // Mix family colour with stellar temperature — gives real colour variety
    // (blue O-stars, red giants, yellow sol-likes) on top of the palette.
    vec3 temp = stellarTemp(tempRoll);
    float tempMix = mix(0.35, 0.85, smoothstep(0.0, 3.0, vClass));
    vec3 stellar = mix(base, base * temp, tempMix);
    vec3 tinted = mix(stellar, mem.rgb * 1.2, clamp(length(mem.rgb) * uMemoryBlend, 0.0, 0.85));
    vColor = tinted * classEmit;
    vWarmth = classWarmth;
    vEnergy = clamp(length(vel.xyz) * 0.05, 0.0, 1.0);
    vMemory = clamp(length(mem.rgb), 0.0, 1.2);
    vTwinkle = 1.0 - twinkleAmt * (0.5 + 0.5 * sin(uTime * (0.7 + twinkleSeed * 4.5) + twinkleSeed * 31.7));
    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = max(0.1, -mv.z);
    gl_PointSize = uPointSize * uPixelRatio * (160.0 / dist) * classSize;
  }
`;

const FRAG = `
  precision highp float;
  varying vec3 vColor;
  varying float vEnergy;
  varying float vMemory;
  varying float vWarmth;
  varying float vClass;
  varying float vTwinkle;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot(d, d);
    if (r2 > 0.25) discard;
    // Brighter stars get a tighter core + a longer halo so they read as
    // luminous objects instead of just larger dots.
    float coreSharpness = mix(22.0, 38.0, smoothstep(0.0, 3.0, vClass));
    float haloScale = mix(0.22, 0.55, smoothstep(0.5, 3.0, vClass));
    float core = exp(-r2 * coreSharpness);
    float halo = exp(-r2 * 6.0) * haloScale;
    float glow = core + halo;
    vec3 base = vColor;
    vec3 hot = mix(base, vec3(1.0), vEnergy * 0.55 + vWarmth * 0.3);
    vec3 lit = hot * (0.55 + vMemory * 0.7) + base * vMemory * 0.28;
    float alphaBase = mix(0.38, 0.55, smoothstep(0.0, 3.0, vClass));
    gl_FragColor = vec4(lit * vTwinkle, glow * vTwinkle * (alphaBase + vEnergy * 0.5 + vMemory * 0.28));
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
        uTime: { value: 0 },
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
    if (params.time !== undefined) this.material.uniforms.uTime.value = params.time;
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
