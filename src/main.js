import * as THREE from 'three';
import { Engine } from './engine/Engine.js';
import { Loop } from './engine/Loop.js';
import { Clock } from './engine/Clock.js';
import { EventBus } from './audio/EventBus.js';
import { EventMapper } from './cosmology/EventMapper.js';
import { EncounterDirector } from './cosmology/EncounterDirector.js';
import { EncounterObjects } from './cosmology/EncounterObjects.js';
import { ForceSources } from './physics/ForceSources.js';
import { MemoryField } from './physics/MemoryField.js';
import { ParticleField } from './physics/ParticleField.js';
import { DensityField } from './physics/DensityField.js';
import { ParticleRenderer } from './rendering/ParticleRenderer.js';
import { PostStack } from './rendering/PostStack.js';
import { Starfield } from './rendering/Starfield.js';
import { ScaleCamera } from './camera/ScaleCamera.js';
import { setupInput } from './camera/Input.js';
import { Piano } from './interaction/Piano.js';
import { Synth } from './interaction/Synth.js';
import { HUD } from './ui/HUD.js';
import { AdvancedPanel } from './ui/AdvancedPanel.js';
import { StructureLoader } from './scene/StructureLoader.js';

const canvas = document.getElementById('stage');
canvas.style.width = '100%';
canvas.style.height = '100%';

const params = {
  forceGain: 0.85,
  damping: 0.996,
  swirlBias: 1.4,
  timeScale: 1,
  expansion: 1.0,
  cluster: 1.0,
  planeAttraction: 0.45,
  planeThickness: 50,
  originStrength: 0.28,
  pointSize: 1.7,
  bloomStrength: 0.85,
  exposure: 1.0,
  memoryBlend: 0.55,
  memoryDecay: 0.9998,
  spawnRadius: 200,
  palette: 'spectral',
  filmGrain: 0.08,
  vignette: 0.45,
  trailStrength: 0.4,
  encounterRate: 0.5,
  encounterSounds: 'off',
  synthVolume: 0.32,
  synthWaveform: 'triangle',
  synthCutoff: 4400
};

const PRESETS = {
  nebula:  { expansion: 1.6, cluster: 0.45, swirlBias: 0.6, forceGain: 0.55, planeAttraction: 0.05, planeThickness: 160, damping: 0.997 },
  galaxy:  { expansion: 0.7, cluster: 1.7,  swirlBias: 2.4, forceGain: 0.95, planeAttraction: 0.8,  planeThickness: 28,  damping: 0.996 },
  cluster: { expansion: 0.25,cluster: 2.2,  swirlBias: 0.5, forceGain: 0.7,  planeAttraction: 0.15, planeThickness: 80,  damping: 0.998 },
  void:    { expansion: 2.1, cluster: 0.15, swirlBias: 0.4, forceGain: 0.35, planeAttraction: 0.0,  planeThickness: 200, damping: 0.994 },
  disk:    { expansion: 0.55,cluster: 1.4,  swirlBias: 1.8, forceGain: 0.8,  planeAttraction: 1.1,  planeThickness: 18,  damping: 0.997 },
  chaos:   { expansion: 1.4, cluster: 0.9,  swirlBias: 2.6, forceGain: 1.2,  planeAttraction: 0.0,  planeThickness: 200, damping: 0.992 }
};

const PALETTES = {
  spectral: { hueShift: 0,    paletteMix: 0 },
  cool:     { hueShift: 3.4,  paletteMix: 0 },
  warm:     { hueShift: 0.7,  paletteMix: 0 },
  mono:     { hueShift: 1.6,  paletteMix: 1 },
  plasma:   { hueShift: 5.2,  paletteMix: 0 },
  aurora:   { hueShift: 2.3,  paletteMix: 0 }
};

const engine = new Engine(canvas);
const clock = new Clock();
const bus = new EventBus();

const forces = new ForceSources();
const memory = new MemoryField(engine.renderer);
const particles = new ParticleField(engine.renderer, { count: 262144 });
const density = new DensityField(engine.renderer, particles);
const renderer = new ParticleRenderer(engine.renderer, particles, memory);
renderer.attachTo(engine.scene);
const post = new PostStack(engine.renderer);
const scaleCamera = new ScaleCamera(engine.camera);
const structures = new StructureLoader(engine.scene);
const starfield = new Starfield(engine.renderer, engine.scene);

// Camera focus = weighted centroid of active force sources (where the player
// is currently doing work). Falls back to origin when nothing is happening.
const focusVec = new THREE.Vector3();
scaleCamera.setFocusProvider(() => {
  let cx = 0, cy = 0, cz = 0, sum = 0;
  for (const s of forces.list) {
    const w = (s.currentStrength ?? s.strength) + 0.05;
    cx += s.position[0] * w;
    cy += s.position[1] * w;
    cz += s.position[2] * w;
    sum += w;
  }
  if (sum <= 0) return focusVec.set(0, 0, 0);
  return focusVec.set(cx / sum, cy / sum, cz / sum).multiplyScalar(0.55);
});

const mapper = new EventMapper({ forces, memory });
bus.on('event', (e) => mapper.handle(e, clock.now));

// Brief visual impact pulse driven by piano hits.
let impactPulse = 0;
let sustainHeld = false;

const synth = new Synth();
synth.setVolume(params.synthVolume);
synth.setWaveform(params.synthWaveform);
synth.setCutoff(params.synthCutoff);

const encounterObjects = new EncounterObjects(engine.scene, bus, { synth });
encounterObjects.setRenderer(engine.renderer);
const encounters = new EncounterDirector(bus, { objects: encounterObjects });

let firstInteraction = true;
const dropOverlay = document.getElementById('drop-overlay');
function dismissOverlay() {
  if (!firstInteraction) return;
  firstInteraction = false;
  dropOverlay?.classList.add('dismissed');
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') sustainHeld = true;
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') sustainHeld = false;
});

const piano = new Piano(bus, document.getElementById('piano'), {
  synth,
  sustainCheck: () => sustainHeld,
  onTrigger: (info, strength) => {
    dismissOverlay();
    impactPulse = Math.min(1.2, impactPulse + (strength ?? 0.9) * 0.45 + (info?.drum ? 0.4 : 0));
  }
});

// Structure loader: click button or drag .glb onto the page.
const structureInput = document.getElementById('structure-input');
document.getElementById('structure-button')?.addEventListener('click', () => structureInput?.click());
structureInput?.addEventListener('change', () => {
  const file = structureInput.files?.[0];
  if (!file) return;
  dismissOverlay();
  structures.loadFile(file).catch((err) => console.warn('Structure load failed:', err));
});
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (dropOverlay) dropOverlay.dataset.state = 'hover';
});
window.addEventListener('dragleave', () => {
  if (dropOverlay) dropOverlay.dataset.state = 'idle';
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  if (dropOverlay) dropOverlay.dataset.state = 'idle';
  const file = [...(e.dataTransfer?.files ?? [])].find((f) => /\.(glb|gltf)$/i.test(f.name));
  if (!file) return;
  dismissOverlay();
  structures.loadFile(file).catch((err) => console.warn('Structure load failed:', err));
});

const hud = new HUD({
  scaleEl: document.getElementById('hud-scale'),
  timeEl: document.getElementById('hud-time'),
  fpsEl: document.getElementById('hud-fps')
}, clock, scaleCamera);

const advanced = new AdvancedPanel(document.getElementById('advanced-panel'), params, {
  onParam: (key, value) => {
    if (key === 'synthVolume') synth.setVolume(value);
    else if (key === 'synthWaveform') synth.setWaveform(value);
    else if (key === 'synthCutoff') synth.setCutoff(value);
  },
  onAction: (action) => {
    if (action === 'reset') {
      const seed = Math.floor(Math.random() * 1e6);
      particles.reset(seed, params.spawnRadius);
      forces.list.length = 0;
      memory.clear();
      encounterObjects.clear();
      post.clearAccumulation();
      mapper.originPlaced = false;
      mapper.eventCount = 0;
      impactPulse = 0;
    } else if (action === 'clearMemory') {
      memory.clear();
    } else if (action === 'clearStructures') {
      structures.clear();
    } else if (action === 'clearEncounters') {
      encounterObjects.clear();
    } else if (action === 'recenter') {
      scaleCamera.recenter();
    } else if (action === 'encounter') {
      encounters.triggerNow();
    } else if (action.startsWith('preset:')) {
      const key = action.slice(7);
      const preset = PRESETS[key];
      if (preset) Object.assign(params, preset);
    }
  }
});

document.getElementById('reset-button')?.addEventListener('click', () => {
  const seed = Math.floor(Math.random() * 1e6);
  particles.reset(seed, params.spawnRadius);
  forces.list.length = 0;
  memory.clear();
  encounterObjects.clear();
  post.clearAccumulation();
  mapper.originPlaced = false;
  mapper.eventCount = 0;
  impactPulse = 0;
});
document.getElementById('recenter-button')?.addEventListener('click', () => {
  scaleCamera.recenter();
});

setupInput(canvas, scaleCamera);
window.addEventListener('resize', () => {
  engine.resize();
  post.resize();
});

// Double-click in space drops a force at the world position under the cursor.
// Direct sculpting: click in voids to attract material, near clusters to
// disturb them. Shift+dblclick spawns an outward shock instead.
const clickRaycaster = new THREE.Raycaster();
const clickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const clickHit = new THREE.Vector3();
const clickNdc = new THREE.Vector2();
canvas.addEventListener('dblclick', (e) => {
  const rect = canvas.getBoundingClientRect();
  clickNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  clickNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  clickRaycaster.setFromCamera(clickNdc, engine.camera);
  if (!clickRaycaster.ray.intersectPlane(clickPlane, clickHit)) return;
  const burst = e.shiftKey;
  const pos = [clickHit.x, clickHit.y, clickHit.z];
  bus.emit('event', {
    type: 'impulse',
    kind: burst ? 'shell' : 'well',
    band: burst ? 'high' : 'mid',
    strength: burst ? 1.3 : 1.0,
    lifetime: burst ? 1.8 : 4.5,
    position: pos,
    axis: [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5],
    color: burst ? [1.4, 1.2, 0.8] : [0.85, 1.1, 1.5]
  });
  impactPulse = Math.min(1.3, impactPulse + 0.45);
  dismissOverlay();
});

const loop = new Loop({
  step: (dt) => {
    clock.advance(dt, false);
    mapper.originStrength = params.originStrength;

    forces.update(dt);
    memory.decay(dt, params.memoryDecay);
    mapper.tick(dt);
    encounters.rate = params.encounterRate;
    encounterObjects.soundEnabled = params.encounterSounds === 'on';
    encounters.update(dt);
    encounterObjects.update(dt, clock.now);

    density.update(params.planeThickness);

    particles.step(dt, forces, memory, density, 0, clock.now, {
      forceGain: params.forceGain,
      damping: params.damping,
      swirlBias: params.swirlBias,
      timeScale: params.timeScale,
      expansion: params.expansion,
      cluster: params.cluster,
      planeAttraction: params.planeAttraction,
      planeThickness: params.planeThickness
    });
    scaleCamera.update(dt, particles);
    starfield.update(clock.now);

    impactPulse *= Math.pow(0.06, dt); // decay impact flash quickly
    const palette = PALETTES[params.palette] ?? PALETTES.spectral;
    renderer.update({
      pointSize: params.pointSize * (1 + impactPulse * 0.35),
      memoryBlend: params.memoryBlend,
      hueShift: palette.hueShift,
      paletteMix: palette.paletteMix,
      time: clock.now
    });

    post.beginScene(params.trailStrength);
    // depth needs to be cleared each frame even when we fade colour, so
    // starfield depth-test still works.
    engine.renderer.clear(false, true, false);
    engine.renderer.render(engine.scene, engine.camera);
    post.finish({
      bloomStrength: params.bloomStrength * (1 + impactPulse * 0.4),
      exposure: params.exposure * (1 + impactPulse * 0.12),
      grain: params.filmGrain,
      vignette: params.vignette,
      time: clock.now
    });

    hud.tick(dt);
    hud.update();
  }
});

loop.start();
