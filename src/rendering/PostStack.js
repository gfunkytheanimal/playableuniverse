import * as THREE from 'three';

const VERT = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const TONEMAP_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uScene;
  uniform sampler2D uBloom;
  uniform float uBloomStrength;
  uniform float uExposure;
  vec3 aces(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }
  void main() {
    vec3 hdr = texture2D(uScene, vUv).rgb + texture2D(uBloom, vUv).rgb * uBloomStrength;
    vec3 mapped = aces(hdr * uExposure);
    gl_FragColor = vec4(mapped, 1.0);
  }
`;
const BLUR_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uSrc;
  uniform vec2 uTexel;
  uniform vec2 uDir;
  void main() {
    vec3 sum = vec3(0.0);
    sum += texture2D(uSrc, vUv).rgb * 0.227027;
    sum += texture2D(uSrc, vUv + uDir * uTexel * 1.3846).rgb * 0.316216;
    sum += texture2D(uSrc, vUv - uDir * uTexel * 1.3846).rgb * 0.316216;
    sum += texture2D(uSrc, vUv + uDir * uTexel * 3.2307).rgb * 0.070270;
    sum += texture2D(uSrc, vUv - uDir * uTexel * 3.2307).rgb * 0.070270;
    gl_FragColor = vec4(sum, 1.0);
  }
`;
const HIGHPASS_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uSrc;
  uniform float uThreshold;
  void main() {
    vec3 c = texture2D(uSrc, vUv).rgb;
    float l = max(c.r, max(c.g, c.b));
    float k = max(0.0, l - uThreshold) / max(l, 1e-3);
    gl_FragColor = vec4(c * k, 1.0);
  }
`;

export class PostStack {
  constructor(renderer) {
    this.renderer = renderer;
    const size = new THREE.Vector2();
    renderer.getSize(size);
    const w = Math.max(1, Math.floor(size.x));
    const h = Math.max(1, Math.floor(size.y));
    const opts = { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };

    this.scene = new THREE.WebGLRenderTarget(w, h, opts);
    this.highpass = new THREE.WebGLRenderTarget(w / 2, h / 2, opts);
    this.blurA = new THREE.WebGLRenderTarget(w / 4, h / 4, opts);
    this.blurB = new THREE.WebGLRenderTarget(w / 4, h / 4, opts);

    this.fsScene = new THREE.Scene();
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.fsScene.add(this.quad);

    this.highMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: HIGHPASS_FRAG,
      uniforms: { uSrc: { value: null }, uThreshold: { value: 0.5 } }
    });
    this.blurMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: BLUR_FRAG,
      uniforms: { uSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uDir: { value: new THREE.Vector2(1, 0) } }
    });
    this.toneMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: TONEMAP_FRAG,
      uniforms: {
        uScene: { value: null },
        uBloom: { value: null },
        uBloomStrength: { value: 1.0 },
        uExposure: { value: 1.05 }
      }
    });

    this.size = new THREE.Vector2(w, h);
  }

  resize() {
    const s = new THREE.Vector2();
    this.renderer.getSize(s);
    if (s.x === this.size.x && s.y === this.size.y) return;
    this.size.copy(s);
    this.scene.setSize(s.x, s.y);
    this.highpass.setSize(s.x / 2, s.y / 2);
    this.blurA.setSize(s.x / 4, s.y / 4);
    this.blurB.setSize(s.x / 4, s.y / 4);
  }

  beginScene() {
    this.resize();
    this.renderer.setRenderTarget(this.scene);
    this.renderer.clear(true, false, false);
  }

  finish() {
    this.quad.material = this.highMat;
    this.highMat.uniforms.uSrc.value = this.scene.texture;
    this.renderer.setRenderTarget(this.highpass);
    this.renderer.render(this.fsScene, this.fsCam);

    this.quad.material = this.blurMat;
    this.blurMat.uniforms.uTexel.value.set(1 / this.blurA.width, 1 / this.blurA.height);

    this.blurMat.uniforms.uSrc.value = this.highpass.texture;
    this.blurMat.uniforms.uDir.value.set(1, 0);
    this.renderer.setRenderTarget(this.blurA);
    this.renderer.render(this.fsScene, this.fsCam);

    this.blurMat.uniforms.uSrc.value = this.blurA.texture;
    this.blurMat.uniforms.uDir.value.set(0, 1);
    this.renderer.setRenderTarget(this.blurB);
    this.renderer.render(this.fsScene, this.fsCam);

    this.quad.material = this.toneMat;
    this.toneMat.uniforms.uScene.value = this.scene.texture;
    this.toneMat.uniforms.uBloom.value = this.blurB.texture;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.fsScene, this.fsCam);
  }
}
