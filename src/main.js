import { Engine } from './engine/Engine.js';
import { Loop } from './engine/Loop.js';
import { Clock } from './engine/Clock.js';
import { EventBus } from './audio/EventBus.js';
import { AudioInput } from './audio/AudioInput.js';
import { SpectralAnalyzer } from './audio/SpectralAnalyzer.js';
import { OnsetDetector } from './audio/OnsetDetector.js';
import { Sectioner } from './audio/Sectioner.js';
import { EventMapper } from './cosmology/EventMapper.js';
import { ForceSources } from './physics/ForceSources.js';
import { MemoryField } from './physics/MemoryField.js';
import { ParticleField } from './physics/ParticleField.js';
import { ParticleRenderer } from './rendering/ParticleRenderer.js';
import { PostStack } from './rendering/PostStack.js';
import { ScaleCamera } from './camera/ScaleCamera.js';
import { setupInput } from './camera/Input.js';
import { Piano } from './interaction/Piano.js';
import { DropZone } from './ui/DropZone.js';
import { HUD } from './ui/HUD.js';
import { AdvancedPanel } from './ui/AdvancedPanel.js';

const canvas = document.getElementById('stage');
canvas.style.width = '100%';
canvas.style.height = '100%';

const params = {
  forceGain: 1,
  damping: 0.993,
  swirlBias: 1,
  timeScale: 1,
  pointSize: 2.4,
  bloomStrength: 1.1,
  exposure: 1.1,
  memoryBlend: 0.6,
  audioReactivity: 1.2,
  memoryDecay: 0.9985,
  spawnRadius: 78,
  palette: 'spectral'
};

const PALETTES = {
  spectral: { hueShift: 0, paletteMix: 0 },
  cool:     { hueShift: 3.4, paletteMix: 0 },
  warm:     { hueShift: 0.7, paletteMix: 0 },
  mono:     { hueShift: 1.6, paletteMix: 1 }
};

const engine = new Engine(canvas);
const clock = new Clock();
const bus = new EventBus();

const forces = new ForceSources();
const memory = new MemoryField(engine.renderer);
const particles = new ParticleField(engine.renderer, { count: 65536 });
const renderer = new ParticleRenderer(engine.renderer, particles, memory);
renderer.attachTo(engine.scene);
const post = new PostStack(engine.renderer);
const scaleCamera = new ScaleCamera(engine.camera);

const mapper = new EventMapper({ forces, memory });
bus.on('event', (e) => mapper.handle(e, clock.songTime));

const audio = new AudioInput();
const dropZone = new DropZone({
  overlay: document.getElementById('drop-overlay'),
  button: document.getElementById('upload-button'),
  input: document.getElementById('file-input')
}, (file) => audio.loadFile(file));

audio.onSongStart = (duration, seed) => {
  clock.startSong(duration);
  particles.reset(seed, params.spawnRadius);
  forces.list.length = 0;
  memory.clear();
  mapper.originPlaced = false;
  mapper.eventCount = 0;
  scaleCamera.zoom = 0.18;
  scaleCamera.targetZoom = 0.42;
  dropZone.dismissOverlay();
};

const analyzer = new SpectralAnalyzer(audio);
const onsets = new OnsetDetector(analyzer);
const sectioner = new Sectioner(analyzer);
onsets.attach(bus);
sectioner.attach(bus);

const piano = new Piano(bus, document.getElementById('piano'), {
  onTrigger: () => dropZone.dismissOverlay()
});

const hud = new HUD({
  scaleEl: document.getElementById('hud-scale'),
  timeEl: document.getElementById('hud-time')
}, clock, scaleCamera);

new AdvancedPanel(document.getElementById('advanced-panel'), params);

setupInput(canvas, scaleCamera);
window.addEventListener('resize', () => {
  engine.resize();
  post.resize();
});

const loop = new Loop({
  step: (dt) => {
    const playing = audio.isPlaying();
    clock.advance(dt, playing);
    analyzer.update();
    onsets.update(clock.songTime);
    sectioner.update(clock.songTime);

    mapper.audioReactivity = params.audioReactivity;

    forces.update(dt);
    memory.decay(dt, params.memoryDecay);
    mapper.tick(dt);

    const songEnergy = analyzer.rms;
    particles.step(dt, forces, memory, songEnergy, clock.songTime, {
      forceGain: params.forceGain,
      damping: params.damping,
      swirlBias: params.swirlBias,
      timeScale: params.timeScale
    });
    scaleCamera.update(dt, particles);

    const palette = PALETTES[params.palette] ?? PALETTES.spectral;
    renderer.update({
      pointSize: params.pointSize,
      memoryBlend: params.memoryBlend,
      hueShift: palette.hueShift,
      paletteMix: palette.paletteMix
    });

    post.beginScene();
    engine.renderer.clear(true, true, false);
    engine.renderer.render(engine.scene, engine.camera);
    post.finish({ bloomStrength: params.bloomStrength, exposure: params.exposure });

    hud.update();
  }
});

loop.start();
