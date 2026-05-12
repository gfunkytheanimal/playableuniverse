// Debug overlay — toggle with backtick (`).
// Reports everything I need to debug the app blind, since I can't see your
// browser: WebGL extensions, renderer name, FPS / frame ms, draw call
// counts, particle/force/encounter counts, camera state, viewport size.

import * as THREE from 'three';

export class DebugOverlay {
  constructor(root, { engine, particles, forces, encounterObjects, scaleCamera, post, density, memory }) {
    this.root = root;
    this.engine = engine;
    this.particles = particles;
    this.forces = forces;
    this.encounterObjects = encounterObjects;
    this.scaleCamera = scaleCamera;
    this.post = post;
    this.density = density;
    this.memory = memory;

    this.visible = false;
    this.frameMs = 16.667;
    this.lastUpdate = 0;
    this.size = new THREE.Vector2();

    const gl = engine.renderer.getContext();
    this.extColorBufferFloat = !!gl.getExtension('EXT_color_buffer_float');
    this.extTexFloatLinear = !!gl.getExtension('OES_texture_float_linear');
    this.glVersion = gl.getParameter(gl.VERSION);

    let renderer = '';
    let vendor = '';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '';
      vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || '';
    }
    this.rendererInfo = renderer || gl.getParameter(gl.RENDERER) || 'unknown';
    this.vendorInfo = vendor || gl.getParameter(gl.VENDOR) || 'unknown';

    this.shaderProgramsTotal = engine.renderer.info?.programs?.length ?? 0;

    if (this.root) this.root.style.display = 'none';
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote' || e.key === '`') {
        this.toggle();
      }
    });
  }

  toggle() {
    this.visible = !this.visible;
    if (this.root) this.root.style.display = this.visible ? 'block' : 'none';
  }

  tick(dt) {
    const alpha = 0.06;
    this.frameMs = this.frameMs * (1 - alpha) + dt * 1000 * alpha;
  }

  update() {
    if (!this.visible || !this.root) return;
    const now = performance.now();
    if (now - this.lastUpdate < 200) return;
    this.lastUpdate = now;

    const info = this.engine.renderer.info;
    this.engine.renderer.getSize(this.size);
    const pos = this.engine.camera.position;
    const sceneRT = this.post?.scene;
    const sceneW = sceneRT?.width ?? 0;
    const sceneH = sceneRT?.height ?? 0;
    const memTex = this.memory?.texture;
    const denTex = this.density?.texture;

    const fps = 1000 / Math.max(this.frameMs, 0.01);
    const lines = [
      '[debug — ` to hide]',
      '',
      `GL: ${this.glVersion}`,
      `Renderer: ${truncate(this.rendererInfo, 60)}`,
      `Vendor: ${truncate(this.vendorInfo, 60)}`,
      `EXT_color_buffer_float: ${this.extColorBufferFloat ? 'yes' : 'NO (sim may break)'}`,
      `OES_texture_float_linear: ${this.extTexFloatLinear ? 'yes' : 'NO (sim may alias)'}`,
      `Shader programs: ${info.programs?.length ?? '-'}`,
      '',
      `FPS: ${fps.toFixed(1)}  (${this.frameMs.toFixed(2)} ms/frame)`,
      `Draw calls: ${info.render.calls}`,
      `Points rendered: ${info.render.points}`,
      `Triangles: ${info.render.triangles}`,
      `Geometries (live): ${info.memory.geometries}`,
      `Textures (live): ${info.memory.textures}`,
      '',
      `Particles: ${this.particles.count} (${this.particles.texRes}² RT)`,
      `Active forces: ${this.forces.list.length}`,
      `Active encounters: ${this.encounterObjects?.objects?.length ?? 0}`,
      '',
      `Camera zoom: ${this.scaleCamera.zoom.toFixed(3)} (${this.scaleCamera.scaleLabel})`,
      `Camera pos: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`,
      `Camera focus: ${this.scaleCamera.smoothedFocus.x.toFixed(1)}, ${this.scaleCamera.smoothedFocus.y.toFixed(1)}, ${this.scaleCamera.smoothedFocus.z.toFixed(1)}`,
      `Viewport: ${this.size.x.toFixed(0)} × ${this.size.y.toFixed(0)}`,
      `Scene RT: ${sceneW} × ${sceneH}`,
      `Memory tex: ${memTex ? '✓' : '✗'}   Density tex: ${denTex ? '✓' : '✗'}`
    ];
    this.root.textContent = lines.join('\n');
  }
}

function truncate(s, max) {
  if (!s) return '';
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
