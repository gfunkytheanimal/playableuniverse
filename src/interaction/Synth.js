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
