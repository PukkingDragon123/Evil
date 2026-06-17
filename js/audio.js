/* audio.js — Web Audio beat engine + microphone analyser.
   Synthesizes a boom-bap beat (no audio files) and captures mic energy
   for the "beat / timing" score. Exposes RB.audio. */
(function (global) {
  const RB = (global.RB = global.RB || {});

  let ctx = null;
  let master = null;
  let noiseBuf = null;

  // ---- mic ----
  let micStream = null;
  let analyser = null;
  let timeData = null;

  // ---- beat state ----
  const beat = {
    playing: false,
    bpm: 88,
    bars: 8,
    beatsPerBar: 4,
    stepsPerBar: 16, // sixteenth-note grid
    startTime: 0, // ctx time when the beat began
    step: 0,
    nextStepTime: 0,
    timer: null,
    onEnd: null,
  };

  // ---- capture for scoring ----
  let onsets = [];
  let energySamples = [];
  let beatGrid = []; // times (sec, relative to startTime) of every 8th note
  let wasAbove = false;
  let lastOnset = -1;

  function init() {
    if (!ctx) {
      const AC = global.AudioContext || global.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);
      noiseBuf = buildNoise();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function buildNoise() {
    const len = ctx.sampleRate * 1.0;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ---------- drum / bass voices ----------
  function kick(t) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.0, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.35);
  }

  function snare(t) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1750;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(bp).connect(g).connect(master);
    src.start(t);
    src.stop(t + 0.2);

    // body
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(180, t);
    og.gain.setValueAtTime(0.4, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(og).connect(master);
    o.start(t);
    o.stop(t + 0.12);
  }

  function hat(t, open) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7200;
    const g = ctx.createGain();
    const dur = open ? 0.18 : 0.045;
    g.gain.setValueAtTime(open ? 0.32 : 0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(hp).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function bass(t, freq, dur) {
    const o = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(lp).connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function stab(t, freq) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.25);
  }

  // C minor-ish sub bass roots per bar, and a small stab motif.
  const BASS_NOTES = [55, 55, 49, 58]; // A1, A1, G1, A#1 — moody loop
  const STAB_NOTES = [220, 261, 233, 196];

  function scheduleStep(globalStep, t) {
    const s = globalStep % beat.stepsPerBar; // 0..15
    const bar = Math.floor(globalStep / beat.stepsPerBar);

    // hats on every 8th note, open hat right before the bar turns over
    if (s % 2 === 0) hat(t, s === 14);
    // kick: beat 1, the "and" of 2, and a pickup
    if (s === 0 || s === 6 || s === 10) kick(t);
    // snare backbeat on 2 and 4
    if (s === 4 || s === 12) snare(t);
    // sub bass on the downbeat and the 3
    if (s === 0) bass(t, BASS_NOTES[bar % BASS_NOTES.length], 0.45);
    if (s === 8) bass(t, BASS_NOTES[bar % BASS_NOTES.length] * 1.5, 0.25);
    // sparse stab for flavor
    if (s === 2 || s === 11) stab(t, STAB_NOTES[bar % STAB_NOTES.length]);

    // record the 8th-note grid for timing analysis
    if (s % 2 === 0) beatGrid.push(t - beat.startTime);
  }

  function scheduler() {
    const stepDur = 60 / beat.bpm / (beat.stepsPerBar / beat.beatsPerBar);
    const totalSteps = beat.bars * beat.stepsPerBar;
    while (beat.nextStepTime < ctx.currentTime + 0.12) {
      if (beat.step >= totalSteps) {
        beat.playing = false;
        if (beat.onEnd) beat.onEnd();
        return;
      }
      scheduleStep(beat.step, beat.nextStepTime);
      beat.nextStepTime += stepDur;
      beat.step++;
    }
    if (beat.playing) beat.timer = setTimeout(scheduler, 25);
  }

  function startBeat(opts) {
    init();
    opts = opts || {};
    beat.bpm = opts.bpm || beat.bpm;
    beat.bars = opts.bars || beat.bars;
    beat.onEnd = opts.onEnd || null;
    beat.playing = true;
    beat.step = 0;
    beat.startTime = ctx.currentTime + 0.08;
    beat.nextStepTime = beat.startTime;
    resetCapture();
    scheduler();
    return beat.startTime;
  }

  function stopBeat() {
    beat.playing = false;
    if (beat.timer) clearTimeout(beat.timer);
    beat.timer = null;
  }

  // ---------- microphone ----------
  async function initMic() {
    init();
    if (analyser && micStream && micStream.active) return true; // reuse across replays
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const src = ctx.createMediaStreamSource(micStream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      timeData = new Uint8Array(analyser.fftSize);
      src.connect(analyser); // analyser only — do NOT route mic to speakers
      return true;
    } catch (e) {
      console.warn('mic init failed', e);
      return false;
    }
  }

  function getLevel() {
    if (!analyser) return 0;
    analyser.getByteTimeDomainData(timeData);
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const v = (timeData[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / timeData.length); // RMS 0..~1
  }

  // Called each animation frame during a performance.
  function sample() {
    if (!beat.playing && energySamples.length === 0) return;
    const level = getLevel();
    const t = ctx.currentTime - beat.startTime;
    if (t < 0) return;
    energySamples.push({ t, level });

    const THRESH = 0.045;
    if (level > THRESH && !wasAbove) {
      if (t - lastOnset > 0.09) {
        onsets.push(t);
        lastOnset = t;
      }
      wasAbove = true;
    } else if (level < THRESH * 0.6) {
      wasAbove = false;
    }
  }

  function resetCapture() {
    onsets = [];
    energySamples = [];
    beatGrid = [];
    wasAbove = false;
    lastOnset = -1;
  }

  function elapsed() {
    if (!ctx) return 0;
    return Math.max(0, ctx.currentTime - beat.startTime);
  }
  function progress() {
    const total = (beat.bars * beat.beatsPerBar * 60) / beat.bpm;
    return total > 0 ? Math.min(1, elapsed() / total) : 0;
  }
  function currentBar() {
    const stepDur = 60 / beat.bpm / (beat.stepsPerBar / beat.beatsPerBar);
    return Math.floor(elapsed() / stepDur / beat.stepsPerBar);
  }
  function currentBeatPhase() {
    // 0..1 within the current quarter-note beat (for pulsing visuals)
    const beatDur = 60 / beat.bpm;
    return (elapsed() % beatDur) / beatDur;
  }

  RB.audio = {
    init,
    startBeat,
    stopBeat,
    initMic,
    getLevel,
    sample,
    resetCapture,
    elapsed,
    progress,
    currentBar,
    currentBeatPhase,
    get isPlaying() { return beat.playing; },
    get bpm() { return beat.bpm; },
    get bars() { return beat.bars; },
    get beatsPerBar() { return beat.beatsPerBar; },
    get onsets() { return onsets; },
    get energySamples() { return energySamples; },
    get beatGrid() { return beatGrid; },
    get hasMic() { return !!analyser; },
  };
})(window);
