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
  playNote(midiNote, velocity = 0.7, opts = {}) {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') ctx.resume();
    const waveform = opts.waveform ?? this.waveform;
    const release = opts.release ?? 1.1;
    const semitones = midiNote + 45; // A2 = 45 in MIDI
    const freq = 440 * Math.pow(2, (semitones - 69) / 12);
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = waveform;
    osc.frequency.value = freq;

    const partial = ctx.createOscillator();
    partial.type = 'sine';
    partial.frequency.value = freq * 2;

    const env = ctx.createGain();
    const attack = 0.012;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(velocity, t + attack);
    env.gain.exponentialRampToValueAtTime(0.001, t + attack + release);

    const partialGain = ctx.createGain();
    partialGain.gain.value = (opts.partial ?? 0.25) * velocity;

    osc.connect(env);
    partial.connect(partialGain).connect(env);
    env.connect(this.filter);

    osc.start(t);
    partial.start(t);
    osc.stop(t + attack + release + 0.05);
    partial.stop(t + attack + release + 0.05);
  }

  playSupernova(intensity = 1.0) {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    const dur = 1.6;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const env = Math.pow(1 - i / data.length, 2.6);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, t);
    lp.frequency.exponentialRampToValueAtTime(80, t + dur);
    lp.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.value = intensity * 0.45;
    src.connect(lp).connect(gain).connect(this.master);
    src.start(t);

    // Sub boom
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(72, t);
    sub.frequency.exponentialRampToValueAtTime(32, t + dur);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(intensity * 0.55, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    sub.connect(subGain).connect(this.master);
    sub.start(t);
    sub.stop(t + dur + 0.05);
  }

  playPulsarBeat(intensity = 0.7) {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.08);
    const env = ctx.createGain();
    env.gain.setValueAtTime(intensity * 0.32, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 4;
    osc.connect(bp).connect(env).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playCometSweep(intensity = 0.6) {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    const dur = 1.8;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(intensity * 0.18, t + 0.1);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4400, t);
    lp.frequency.exponentialRampToValueAtTime(600, t + dur);
    osc.connect(lp).connect(env).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  playWaveDrone(intensity = 0.5) {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    const dur = 2.4;
    const fA = 110;
    const fB = 116; // beat with A
    const oscA = ctx.createOscillator(); oscA.type = 'sine'; oscA.frequency.value = fA;
    const oscB = ctx.createOscillator(); oscB.type = 'sine'; oscB.frequency.value = fB;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(intensity * 0.35, t + 0.45);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    oscA.connect(env);
    oscB.connect(env);
    env.connect(this.master);
    oscA.start(t); oscB.start(t);
    oscA.stop(t + dur + 0.05); oscB.stop(t + dur + 0.05);
  }

  playCollisionCrack(intensity = 0.9) {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    const dur = 0.45;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 4);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 360;
    bp.Q.value = 1.4;
    const gain = ctx.createGain();
    gain.gain.value = intensity * 0.7;
    src.connect(bp).connect(gain).connect(this.master);
    src.start(t);
  }

  playDrum(velocity = 0.9) {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    const dur = 0.18;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const env = Math.pow(1 - i / data.length, 2.2);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'lowpass';
    bandpass.frequency.value = 1400;
    bandpass.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.value = velocity * 0.9;
    src.connect(bandpass).connect(gain).connect(this.master);
    src.start(t);
  }
}
