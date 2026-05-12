export class Synth {
  constructor() {
    this.context = null;
    this.master = null;
    this.filter = null;
    this.volume = 0.32;
    this.waveform = 'triangle';
    this.cutoff = 4400;
  }

  attachContext(context) {
    if (this.context && this.context !== context) return;
    this.context = context;
    this._buildChain();
  }

  ensureContext() {
    if (this.context) return this.context;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.context = new Ctx({ latencyHint: 'interactive' });
    this._buildChain();
    return this.context;
  }

  _buildChain() {
    if (this.master) return;
    this.master = this.context.createGain();
    this.master.gain.value = this.volume;
    this.filter = this.context.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = this.cutoff;
    this.filter.Q.value = 0.6;
    this.filter.connect(this.master).connect(this.context.destination);
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.context.currentTime, 0.02);
  }

  setWaveform(w) {
    this.waveform = w;
  }

  setCutoff(hz) {
    this.cutoff = hz;
    if (this.filter) this.filter.frequency.setTargetAtTime(hz, this.context.currentTime, 0.02);
  }

  // midiNote 0 maps to A2, scaled so the keyboard sweeps roughly two octaves.
  playNote(midiNote, velocity = 0.7) {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') ctx.resume();
    const semitones = midiNote + 45; // A2 = 45 in MIDI
    const freq = 440 * Math.pow(2, (semitones - 69) / 12);
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = this.waveform;
    osc.frequency.value = freq;

    // Slight detuned partial for harmonic body
    const partial = ctx.createOscillator();
    partial.type = 'sine';
    partial.frequency.value = freq * 2;

    const env = ctx.createGain();
    const attack = 0.012;
    const release = 1.1;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(velocity, t + attack);
    env.gain.exponentialRampToValueAtTime(0.001, t + attack + release);

    const partialGain = ctx.createGain();
    partialGain.gain.value = 0.25 * velocity;

    osc.connect(env);
    partial.connect(partialGain).connect(env);
    env.connect(this.filter);

    osc.start(t);
    partial.start(t);
    osc.stop(t + attack + release + 0.05);
    partial.stop(t + attack + release + 0.05);
  }
}
