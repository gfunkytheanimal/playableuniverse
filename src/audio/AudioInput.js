export class AudioInput {
  constructor() {
    this.context = null;
    this.audioEl = null;
    this.source = null;
    this.analyser = null;
    this.gain = null;
    this.fingerprintSeed = 0;
    this.onSongStart = null;
  }

  ensureContext() {
    if (this.context) return this.context;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.context = new Ctx({ latencyHint: 'interactive' });
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.62;
    this.gain = this.context.createGain();
    this.gain.gain.value = 1;
    this.analyser.connect(this.gain).connect(this.context.destination);
    return this.context;
  }

  async loadFile(file) {
    this.ensureContext();
    if (this.audioEl) {
      this.audioEl.pause();
      try { this.source?.disconnect(); } catch (_) {}
    }
    const url = URL.createObjectURL(file);
    this.audioEl = new Audio(url);
    this.audioEl.crossOrigin = 'anonymous';
    this.audioEl.preload = 'auto';
    this.fingerprintSeed = seedFromName(file.name) ^ Math.floor(file.size);
    this.source = this.context.createMediaElementSource(this.audioEl);
    this.source.connect(this.analyser);
    await this.context.resume();
    await this.audioEl.play();
    if (this.onSongStart) this.onSongStart(this.audioEl.duration || 0, this.fingerprintSeed);
  }

  isPlaying() {
    return !!this.audioEl && !this.audioEl.paused && !this.audioEl.ended;
  }

  get analyserNode() {
    return this.analyser;
  }

  get sampleRate() {
    return this.context?.sampleRate ?? 48000;
  }
}

function seedFromName(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}
