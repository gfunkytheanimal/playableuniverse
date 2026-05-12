import * as THREE from 'three';

const VERT = `
  precision highp float;
  attribute float aSize;
  attribute float aTwinkle;
  uniform float uPixelRatio;
  uniform float uTime;
  varying float vTwinkle;
  varying float vIntensity;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = max(40.0, -mv.z);
    gl_PointSize = aSize * uPixelRatio * (480.0 / dist);
    vTwinkle = aTwinkle;
    vIntensity = 0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * (0.4 + aTwinkle * 1.3) + aTwinkle * 31.7));
  }
`;
const FRAG = `
  precision highp float;
  varying float vTwinkle;
  varying float vIntensity;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot(d, d);
    if (r2 > 0.25) discard;
    float glow = exp(-r2 * 28.0);
    vec3 warm = mix(vec3(0.7, 0.85, 1.0), vec3(1.0, 0.88, 0.7), vTwinkle);
    gl_FragColor = vec4(warm * vIntensity, glow * (0.6 + vIntensity * 0.4));
  }
`;

export class Starfield {
  constructor(renderer, scene, { count = 4200, innerRadius = 1400, outerRadius = 3200 } = {}) {
    this.renderer = renderer;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const twinkles = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = innerRadius + Math.random() * (outerRadius - innerRadius);
      positions[i * 3 + 0] = Math.sin(phi) * Math.cos(theta) * r;
      positions[i * 3 + 1] = Math.cos(phi) * r;
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
      sizes[i] = 0.8 + Math.random() * Math.random() * 2.6;
      twinkles[i] = Math.random();
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.geometry.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkles, 1));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), outerRadius * 1.1);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uPixelRatio: { value: renderer.getPixelRatio() },
        uTime: { value: 0 }
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = -1;
    scene.add(this.points);
  }

  update(time) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();
  }
}
