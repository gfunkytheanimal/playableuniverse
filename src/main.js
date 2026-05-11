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

const canvas = document.getElementById('stage');
canvas.style.width = '100%';
canvas.style.height = '100%';

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
audio.onSongStart = (duration, seed) => {
  clock.startSong(duration);
  particles.reset(seed);
  forces.list.length = 0;
  memory.clear();
  mapper.originPlaced = false;
  mapper.eventCount = 0;
  scaleCamera.setTargetZoom(0.42);
};

const analyzer = new SpectralAnalyzer(audio);
const onsets = new OnsetDetector(analyzer);
const sectioner = new Sectioner(analyzer);
onsets.attach(bus);
sectioner.attach(bus);

const piano = new Piano(bus, document.getElementById('piano'));
new DropZone(document.getElementById('drop-overlay'), (file) => audio.loadFile(file));

const hud = new HUD({
  scaleEl: document.getElementById('hud-scale'),
  timeEl: document.getElementById('hud-time')
}, clock, scaleCamera);

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
    forces.update(dt);
    memory.decay(dt);
    mapper.tick(dt);

    const songEnergy = analyzer.rms;
    particles.step(dt, forces, memory, songEnergy, clock.songTime);
    scaleCamera.update(dt, particles);

    renderer.update();
    post.beginScene();
    engine.renderer.clear(true, true, false);
    engine.renderer.render(engine.scene, engine.camera);
    post.finish();

    hud.update();
  }
});

loop.start();
