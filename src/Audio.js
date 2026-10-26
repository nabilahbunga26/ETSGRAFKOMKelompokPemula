const STORAGE_KEY = 'ncr_muted_v1';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.windGain = null;
    this.droneGain = null;
    this.noiseBuffer = null;
    this.muted = localStorage.getItem(STORAGE_KEY) === '1';
    this.ambientStarted = false;
    this.intensity = 0;
    this.beatClock = 0;
    this.ready = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    try {
      this.ctx = new Ctx();
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 22;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.22;
      compressor.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      this.master.connect(compressor);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.9;
      this.musicBus.connect(this.master);
      this.noiseBuffer = this._makeNoise(2.5);
      this.ready = true;
      return true;
    } catch (err) {
      console.warn('Audio unavailable', err);
      return false;
    }
  }

  _makeNoise(seconds) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = this.ctx.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.028 * white) / 1.028;
      data[i] = white * 0.55 + last * 2.2;
    }
    return buffer;
  }

  get t() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.t);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.7, this.t + 0.2);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  _voice(freq, { type = 'sine', when = 0, dur = 0.5, gain = 0.1, slide = 0, attack = 0.005, pan = 0 } = {}) {
    if (!this.ready || this.muted) return null;
    const t0 = this.t + when;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.linearRampToValueAtTime(gain, t0 + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (pan !== 0) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(panner);
      node = panner;
    }
    node.connect(amp);
    amp.connect(this.musicBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    return osc;
  }

  _noise({ when = 0, dur = 0.3, gain = 0.1, freq = 1000, q = 1, type = 'bandpass', slide = 0, pan = 0 } = {}) {
    if (!this.ready || this.muted) return;
    const t0 = this.t + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    if (slide) filter.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
    filter.Q.value = q;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.linearRampToValueAtTime(gain, t0 + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = filter;
    if (pan !== 0) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      filter.connect(panner);
      node = panner;
    }
    src.connect(filter);
    node.connect(amp);
    amp.connect(this.musicBus);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  _chime(freq, when = 0, gain = 0.09, dur = 1.6, pan = 0) {
    this._voice(freq, { type: 'sine', when, dur, gain, pan });
    this._voice(freq * 2.01, { type: 'sine', when: when + 0.004, dur: dur * 0.7, gain: gain * 0.32, pan });
    this._voice(freq * 3.98, { type: 'triangle', when, dur: dur * 0.35, gain: gain * 0.1, pan });
  }

  _taiko(when = 0, gain = 0.35) {
    this._voice(76, { type: 'sine', when, dur: 0.5, gain, slide: 38, attack: 0.002 });
    this._noise({ when, dur: 0.16, gain: gain * 0.5, freq: 120, type: 'lowpass' });
  }

  startAmbient() {
    if (!this.init() || this.ambientStarted) return;
    this.ambientStarted = true;
    const t = this.t;

    const wind = this.ctx.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 480;
    windFilter.Q.value = 0.55;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.0001;
    this.windGain.gain.linearRampToValueAtTime(0.07, t + 3);
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.09;
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);
    wind.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    wind.start(t);
    lfo.start(t);

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.0001;
    this.droneGain.gain.linearRampToValueAtTime(0.018, t + 4);
    const droneFilter = this.ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 240;
    [55, 82.4, 110].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i === 2 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      osc.detune.value = i === 1 ? 7 : -4;
      const g = this.ctx.createGain();
      g.gain.value = i === 2 ? 0.18 : 0.35;
      osc.connect(g);
      g.connect(droneFilter);
      osc.start(t);
    });
    droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.master);
  }

  setMood(mood) {
    if (!this.ready || !this.windGain) return;
    const t = this.t;
    const wind = { menu: 0.06, run: 0.09, boss: 0.045, victory: 0.03, defeat: 0.025 }[mood] ?? 0.06;
    this.windGain.gain.cancelScheduledValues(t);
    this.windGain.gain.linearRampToValueAtTime(wind, t + 1.4);
    this.intensity = mood === 'boss' ? 1 : mood === 'run' ? 0.25 : 0;
    this.beatClock = 0.35;
  }

  update(dt) {
    if (!this.ready || this.muted || this.intensity < 0.4) return;
    this.beatClock -= dt;
    if (this.beatClock <= 0) {
      this.beatClock = this.intensity > 0.8 ? 0.84 : 1.1;
      this._taiko(0, 0.22);
      if (Math.random() > 0.62) this._noise({ dur: 0.9, gain: 0.028, freq: 2800, q: 2, pan: 0.3 });
    }
  }

  ui() {
    if (!this.ready) return;
    this._voice(880, { type: 'triangle', dur: 0.07, gain: 0.04 });
    this._voice(1320, { type: 'sine', when: 0.035, dur: 0.12, gain: 0.03 });
  }

  gate(multiplier) {
    if (!this.ready) return;
    const base = multiplier ? 293.66 : 220;
    const notes = multiplier ? [1, 1.5, 2, 3] : [1, 1.25, 1.5, 2];
    notes.forEach((n, i) => this._chime(base * n, i * 0.055, 0.11, 1.8, i % 2 ? 0.25 : -0.25));
    this._noise({ dur: 0.8, gain: 0.05, freq: 2400, slide: 6200, q: 1.6 });
  }

  clash() {
    if (!this.ready) return;
    this._taiko(0, 0.4);
    this._noise({ dur: 0.34, gain: 0.16, freq: 900, q: 0.9, slide: 240 });
    this._voice(140, { type: 'sawtooth', dur: 0.35, gain: 0.08, slide: 42 });
    for (let i = 0; i < 3; i++) {
      this._noise({ when: 0.03 + i * 0.035, dur: 0.2, gain: 0.055, freq: 3600 + i * 800, q: 3 });
    }
  }

  slash() {
    if (!this.ready) return;
    this._noise({ dur: 0.18, gain: 0.12, freq: 5200, q: 1.2, slide: 900 });
    this._voice(740, { type: 'triangle', dur: 0.16, gain: 0.035, slide: 260 });
  }

  kunai() {
    if (!this.ready) return;
    this._noise({ dur: 0.22, gain: 0.075, freq: 1400, q: 2.2, slide: 4400 });
    this._voice(1040, { type: 'triangle', dur: 0.1, gain: 0.035, slide: 620 });
  }

  impact() {
    if (!this.ready) return;
    this._voice(90, { type: 'sine', dur: 0.4, gain: 0.25, slide: 38 });
    this._noise({ dur: 0.25, gain: 0.12, freq: 700, q: 0.7, slide: 160 });
  }

  coreHit() {
    if (!this.ready) return;
    this._chime(587.33, 0, 0.14, 2.4);
    this._chime(880, 0.04, 0.09, 2.1);
    this._noise({ dur: 0.5, gain: 0.14, freq: 2200, slide: 180, q: 0.8 });
    this._taiko(0, 0.3);
  }

  roar() {
    if (!this.ready) return;
    this._voice(86, { type: 'sawtooth', dur: 1.7, gain: 0.18, slide: 42, attack: 0.08 });
    this._voice(128, { type: 'square', dur: 1.5, gain: 0.06, slide: 58, attack: 0.12 });
    this._noise({ dur: 1.9, gain: 0.14, freq: 520, q: 0.6, slide: 120, type: 'lowpass' });
    this._taiko(0.05, 0.3);
  }

  thunder() {
    if (!this.ready) return;
    this._noise({ dur: 1.6, gain: 0.22, freq: 280, slide: 60, type: 'lowpass', q: 0.4 });
    this._voice(52, { type: 'sine', dur: 1.5, gain: 0.12, slide: 30 });
  }

  storm() {
    if (!this.ready) return;
    this._noise({ dur: 1.3, gain: 0.2, freq: 400, slide: 7200, q: 1.2 });
    this._noise({ when: 0.36, dur: 0.7, gain: 0.16, freq: 5400, slide: 900, q: 0.8 });
    [293.66, 440, 587.33, 880].forEach((f, i) => this._chime(f, 0.12 + i * 0.07, 0.08, 2.4, i % 2 ? -0.3 : 0.3));
    this._taiko(0.32, 0.4);
    this._taiko(0.39, 0.22);
  }

  stormReady() {
    if (!this.ready) return;
    this._chime(659.25, 0, 0.055, 1.2);
    this._chime(987.77, 0.08, 0.04, 1.3);
  }

  gateMissed() {
    if (!this.ready) return;
    this._voice(180, { type: 'triangle', dur: 0.25, gain: 0.06, slide: 120 });
  }

  bossPhase() {
    if (!this.ready) return;
    this._taiko(0, 0.35);
    this._taiko(0.16, 0.28);
    this._taiko(0.32, 0.4);
    this._voice(73, { type: 'sawtooth', dur: 1.2, gain: 0.08, slide: 46 });
  }

  victory() {
    if (!this.ready) return;
    const notes = [293.66, 349.23, 440, 587.33, 880];
    notes.forEach((f, i) => {
      this._chime(f, i * 0.16, 0.1, 2.8, i % 2 ? 0.25 : -0.15);
    });
    this._taiko(0.1, 0.32);
    this._taiko(0.66, 0.26);
    this._noise({ dur: 2.6, gain: 0.03, freq: 3200, q: 1.1 });
  }

  defeat() {
    if (!this.ready) return;
    [220, 174.61, 146.83, 110].forEach((f, i) => {
      this._voice(f, { type: 'triangle', when: i * 0.22, dur: 1.8, gain: 0.08, slide: f * 0.94 });
    });
    this._voice(55, { type: 'sine', when: 0.2, dur: 2.6, gain: 0.16, slide: 34 });
    this._noise({ dur: 2.4, gain: 0.06, freq: 460, q: 0.5, slide: 120, type: 'lowpass' });
  }

  start() {
    if (!this.init()) return;
    this.startAmbient();
    this._chime(146.83, 0, 0.08, 2.5);
    this._chime(220, 0.1, 0.07, 2.3);
    this._chime(293.66, 0.2, 0.06, 2.1);
    this._taiko(0.05, 0.25);
    this._taiko(0.42, 0.2);
  }
}
