/* audio.js — Web Audio sound for Shadow Boxer Ultimate. All synthesized,
   no files: punch whooshes + impacts, blocks, the round bell, a crowd-noise
   swell, a driving hype loop and the KO boom. Exposes SB.audio. */
(function (global) {
  const SB = (global.SB = global.SB || {});

  let ctx = null, master = null, noiseBuf = null;
  let enabled = true;

  // hype loop state
  const loop = { on: false, bpm: 132, step: 0, next: 0, timer: null, startTime: 0 };
  // crowd noise bed
  let crowdSrc = null, crowdGain = null;

  function init() {
    if (!ctx) {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      noiseBuf = buildNoise(1.0);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function setEnabled(v) { enabled = !!v; if (master) master.gain.value = enabled ? 0.9 : 0; }

  function buildNoise(sec) {
    const len = (ctx.sampleRate * sec) | 0;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  // ---------- one-shot voices ----------
  function tone(type, f0, f1, t, dur, peak, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || master);
    o.start(t); o.stop(t + dur + 0.02);
    return { o, g };
  }

  function noise(t, dur, peak, filterType, freq, q, dest) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; if (q) f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest || master);
    src.start(t); src.stop(t + dur + 0.02);
    return { src, g };
  }

  // ---------- boxing SFX ----------
  // a thrown punch: short airy whoosh
  function whoosh(power) {
    if (!init()) return;
    const t = now();
    noise(t, 0.16, 0.10 + 0.10 * (power || 0.5), 'bandpass', 900 + 600 * (power || 0.5), 0.8);
  }

  // a landed punch: whoosh + thuddy impact, heavier with power
  function impact(power) {
    if (!init()) return;
    const t = now();
    const p = Math.max(0.2, Math.min(1, power || 0.6));
    // body thud
    tone('sine', 180, 60, t, 0.18, 0.6 * p + 0.2);
    // slap / skin transient
    noise(t, 0.07, 0.25 * p + 0.1, 'bandpass', 2200, 0.9);
    // low punch
    tone('triangle', 120, 48, t, 0.12, 0.4 * p);
  }

  function block() {
    if (!init()) return;
    const t = now();
    noise(t, 0.09, 0.3, 'bandpass', 600, 1.2);   // leather slap
    tone('square', 150, 110, t, 0.08, 0.18);
  }

  function slip() {
    if (!init()) return;
    const t = now();
    noise(t, 0.22, 0.12, 'bandpass', 1400, 0.6); // air swish
  }

  function hurt() { // player takes a hit
    if (!init()) return;
    const t = now();
    tone('sine', 90, 40, t, 0.28, 0.7);
    noise(t, 0.12, 0.25, 'lowpass', 500, 0.7);
  }

  function bell() {
    if (!init()) return;
    const t = now();
    [880, 1320, 1760].forEach((f, i) => {
      const g = ctx.createGain();
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3 / (i + 1), t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + 1.5);
    });
  }

  function beep(hi) {
    if (!init()) return;
    tone('square', hi ? 880 : 440, hi ? 880 : 440, now(), 0.12, 0.2);
  }

  function ko() {
    if (!init()) return;
    const t = now();
    // big boom
    tone('sine', 200, 30, t, 0.9, 0.95);
    noise(t, 0.5, 0.5, 'lowpass', 800, 0.5);
    // riser
    tone('sawtooth', 200, 1200, t, 0.5, 0.2);
    bellAt(t + 0.25);
  }
  function bellAt(t) {
    [660, 990].forEach((f, i) => {
      const g = ctx.createGain(), o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25 / (i + 1), t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(g).connect(master); o.start(t); o.stop(t + 1.3);
    });
  }

  function fanfare(win) {
    if (!init()) return;
    const t = now();
    const notes = win ? [523, 659, 784, 1047] : [392, 330, 262];
    notes.forEach((f, i) => tone('triangle', f, f, t + i * 0.12, 0.3, 0.25));
  }

  // ---------- crowd bed ----------
  function startCrowd() {
    if (!init() || crowdSrc) return;
    crowdSrc = ctx.createBufferSource();
    crowdSrc.buffer = buildNoise(2.5);
    crowdSrc.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.4;
    crowdGain = ctx.createGain(); crowdGain.gain.value = 0.04;
    crowdSrc.connect(bp).connect(crowdGain).connect(master);
    crowdSrc.start();
  }
  function crowd(level) { // 0..1 hype
    if (crowdGain) crowdGain.gain.setTargetAtTime(0.03 + 0.09 * level, now(), 0.2);
  }
  function stopCrowd() {
    if (crowdSrc) { try { crowdSrc.stop(); } catch (e) {} crowdSrc.disconnect(); crowdSrc = null; crowdGain = null; }
  }

  // ---------- hype loop (driving beat during a fight) ----------
  function loopStep(globalStep, t) {
    const s = globalStep % 16;
    if (s % 2 === 0) noise(t, s % 4 === 2 ? 0.12 : 0.04, 0.10, 'highpass', 8000); // hats
    if (s === 0 || s === 6 || s === 8 || s === 10) tone('sine', 160, 50, t, 0.18, 0.55); // kick
    if (s === 4 || s === 12) { noise(t, 0.16, 0.4, 'bandpass', 1900, 0.7); tone('triangle', 190, 120, t, 0.1, 0.3); } // snare
    const bassNotes = [55, 55, 73, 49];
    if (s === 0 || s === 10) {
      const f = bassNotes[(globalStep / 16 | 0) % 4];
      tone('sawtooth', f, f, t, 0.35, 0.3);
    }
  }
  function loopSched() {
    if (!loop.on) return;
    const stepDur = 60 / loop.bpm / 4;
    while (loop.next < ctx.currentTime + 0.12) {
      loopStep(loop.step, loop.next);
      loop.next += stepDur; loop.step++;
    }
    loop.timer = setTimeout(loopSched, 25);
  }
  function startLoop(bpm) {
    if (!init() || loop.on) return;
    loop.bpm = bpm || 132; loop.on = true; loop.step = 0;
    loop.startTime = ctx.currentTime + 0.06; loop.next = loop.startTime;
    loopSched();
  }
  function stopLoop() { loop.on = false; if (loop.timer) clearTimeout(loop.timer); loop.timer = null; }

  SB.audio = {
    init, setEnabled,
    whoosh, impact, block, slip, hurt, bell, beep, ko, fanfare,
    startCrowd, crowd, stopCrowd,
    startLoop, stopLoop,
    get ready() { return !!ctx; },
  };
})(window);
