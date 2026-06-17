/* engine.js — the fight. Spawns punch targets (offense) and block/slip cues
   (defense), reads movement from SB.vision to resolve them, runs combos,
   damage, rounds, the bot opponent's pressure and the KO. Reports state every
   frame and fires effect/round/end hooks so the UI can draw it. SB.engine. */
(function (global) {
  const SB = (global.SB = global.SB || {});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // seeded RNG so "Fight Friends" can replay an identical sequence
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // tuning constants
  const HIT = 0.15;          // motion needed to land a punch
  const STILL = 0.58;        // stillness needed to block
  const SLIP = 0.26;         // side motion needed to slip
  const TARGET_R = 0.135;    // target hit radius (normalised)

  let cfg = null, hooks = null, rng = Math.random;
  let raf = null, running = false, last = 0;
  let uid = 1;

  const S = {
    mode: 'fight', phase: 'intro', phaseUntil: 0,
    round: 1, rounds: 3, timeLeft: 0,
    player: { hp: 100, hpMax: 100, combo: 0, maxCombo: 0 },
    opp: { hp: 120, hpMax: 120, name: 'BOT', accent: '#ff4d2e' },
    cues: [], hype: 0, running: false,
  };
  let tally = null, nextSpawn = 0;

  function start(config, h) {
    cfg = config; hooks = h || {};
    rng = config.seed != null ? mulberry32(config.seed) : Math.random;
    uid = 1;
    S.mode = config.mode;
    S.rounds = config.rounds;
    S.round = 1;
    S.timeLeft = config.roundTime;
    S.player.hpMax = S.player.hp = config.player.hpMax;
    S.player.combo = 0; S.player.maxCombo = 0;
    S.opp.hpMax = S.opp.hp = config.opp.hpMax;
    S.opp.name = config.opp.name;
    S.opp.accent = config.opp.accent;
    S.cues = []; S.hype = 0;
    tally = { punch: 0, combo: 0, block: 0, slip: 0, win: 0, ko: 0, damage: 0, train: 0, taken: 0, perfect: 0 };
    S.phase = 'intro'; S.phaseUntil = performance.now() + 1600;
    S.running = running = true;
    last = performance.now();
    if (hooks.onRound) hooks.onRound(S.round, 'intro');
    loop();
  }

  function stop() {
    running = S.running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  // ---------- main loop ----------
  function loop() {
    if (!running) return;
    const now = performance.now();
    const dt = Math.min(80, now - last); last = now;

    if (S.phase === 'intro') {
      if (now >= S.phaseUntil) { S.phase = 'fight'; nextSpawn = now + 500; if (hooks.onRound) hooks.onRound(S.round, 'fight'); }
    } else if (S.phase === 'rest') {
      if (now >= S.phaseUntil) startRound(S.round + 1);
    } else if (S.phase === 'fight') {
      S.timeLeft = Math.max(0, S.timeLeft - dt / 1000);
      spawnTick(now);
      updateCues(now);
      if (S.timeLeft <= 0) endRound(now);
    }

    // decay hype toward a combo-driven baseline (rises late when someone's hurt)
    const lowHp = Math.min(S.player.hp / S.player.hpMax, S.opp.hp / S.opp.hpMax);
    const target = clamp(S.player.combo / 16 + (1 - lowHp) * 0.4, 0, 1);
    S.hype += (target - S.hype) * 0.05;
    if (SB.audio.ready && (S.mode !== 'training')) SB.audio.crowd(S.hype);

    if (hooks.onTick) hooks.onTick(S);
    raf = requestAnimationFrame(loop);
  }

  function startRound(n) {
    S.round = n;
    S.timeLeft = cfg.roundTime;
    S.phase = 'intro'; S.phaseUntil = performance.now() + 1600;
    SB.audio.bell();
    if (hooks.onRound) hooks.onRound(n, 'intro');
  }

  function endRound(now) {
    if (S.round >= S.rounds) return finish(false);
    S.phase = 'rest'; S.phaseUntil = now + 4000;
    S.cues.length = 0;
    SB.audio.bell();
    if (hooks.onRound) hooks.onRound(S.round, 'rest');
  }

  // ---------- spawning ----------
  function spawnTick(now) {
    if (now < nextSpawn) return;
    if (S.cues.length >= 3) { nextSpawn = now + 120; return; }
    const o = cfg.opp;
    const hasDefense = S.cues.some((c) => c.kind === 'defense');
    const wantDefense = !hasDefense && S.mode !== 'training' && rng() < o.defenseChance;
    if (wantDefense) spawnDefense(now); else spawnTarget(now);
    // tempo quickens as the round burns down
    const urgency = 1 - 0.35 * (1 - S.timeLeft / cfg.roundTime);
    nextSpawn = now + o.spawnInterval * urgency * (0.7 + rng() * 0.6);
  }

  const LANES = [
    { side: 'left',   x: 0.27, y: 0.42 },
    { side: 'right',  x: 0.73, y: 0.42 },
    { side: 'high',   x: 0.50, y: 0.26 },
    { side: 'body',   x: 0.50, y: 0.62 },
    { side: 'hookL',  x: 0.20, y: 0.55 },
    { side: 'hookR',  x: 0.80, y: 0.55 },
  ];

  function spawnTarget(now) {
    const lane = LANES[(rng() * LANES.length) | 0];
    let x = lane.x;
    if (cfg.player.style.mirror) x = 1 - x; // southpaw flips the floor
    const life = cfg.opp.targetLife * cfg.player.style.window;
    S.cues.push({
      id: uid++, kind: 'target', side: lane.side, x, y: lane.y,
      born: now, life, strikeAt: now + life, state: 'active',
    });
    if (hooks.onSpawn) hooks.onSpawn(S.cues[S.cues.length - 1]);
  }

  function spawnDefense(now) {
    const r = rng();
    let sub = r < 0.5 ? 'block' : (r < 0.75 ? 'slipL' : 'slipR');
    if (cfg.player.style.mirror && sub === 'slipL') sub = 'slipR';
    else if (cfg.player.style.mirror && sub === 'slipR') sub = 'slipL';
    const win = 1150 * cfg.player.style.defWindow / (0.8 + cfg.opp.aggression * 0.4);
    S.cues.push({
      id: uid++, kind: 'defense', sub,
      born: now, life: win, strikeAt: now + win, state: 'active',
      armed: false, guardOK: false,
    });
    SB.audio.whoosh(0.7);
    if (hooks.onSpawn) hooks.onSpawn(S.cues[S.cues.length - 1]);
  }

  // ---------- resolving ----------
  function updateCues(now) {
    for (const c of S.cues) {
      if (c.state !== 'active') continue;
      if (c.kind === 'target') updateTarget(c, now);
      else updateDefense(c, now);
    }
    // sweep resolved cues after a short linger
    for (let i = S.cues.length - 1; i >= 0; i--) {
      const c = S.cues[i];
      if (c.state !== 'active' && now - c.resolvedAt > 260) S.cues.splice(i, 1);
    }
  }

  function updateTarget(c, now) {
    const m = SB.vision.motionInRect(c.x - TARGET_R, c.y - TARGET_R, c.x + TARGET_R, c.y + TARGET_R);
    if (m > HIT) return land(c, now, clamp(m, 0.4, 1));
    if (now >= c.strikeAt) resolve(c, 'miss', now);
  }

  function land(c, now, power) {
    const st = cfg.player.style;
    const combo = ++S.player.combo;
    S.player.maxCombo = Math.max(S.player.maxCombo, combo);
    const comboMult = 1 + Math.min(combo, 20) * 0.05 * st.combo;
    const dmg = Math.round(6 * power * comboMult * st.power);
    S.opp.hp = Math.max(0, S.opp.hp - dmg);
    tally.punch++; tally.damage += dmg; tally.combo = S.player.maxCombo;
    SB.audio.impact(power);
    resolve(c, 'hit', now, { dmg, power, combo });
    if (S.opp.hp <= 0) finish(true);
  }

  function updateDefense(c, now) {
    if (c.sub === 'block') {
      if (SB.vision.stillness() >= STILL) c.guardOK = true; else c.guardOK = false;
    } else {
      const sL = SB.vision.motionInRect(0, 0.2, 0.42, 0.85);
      const sR = SB.vision.motionInRect(0.58, 0.2, 1, 0.85);
      const want = c.sub === 'slipL' ? sL : sR;
      if (want > SLIP) c.armed = true;
    }
    if (now < c.strikeAt) return;

    const st = cfg.player.style;
    let ok;
    if (c.sub === 'block') ok = SB.vision.stillness() >= STILL || c.guardOK;
    else ok = c.armed;

    if (ok) {
      if (c.sub === 'block') { tally.block++; SB.audio.block(); }
      else { tally.slip++; SB.audio.slip(); }
      tally.perfect++;
      // clean defense -> counter damage (huge for counter-punchers)
      const counter = Math.round(5 * st.counter);
      S.opp.hp = Math.max(0, S.opp.hp - counter);
      tally.damage += counter;
      resolve(c, 'defended', now, { counter });
      if (S.opp.hp <= 0) finish(true);
    } else {
      const dmg = Math.round(cfg.opp.dmg * st.guard);
      S.player.hp = Math.max(0, S.player.hp - dmg);
      S.player.combo = 0;
      tally.taken += dmg;
      SB.audio.hurt();
      resolve(c, 'beaten', now, { dmg });
      if (hooks.onFx) hooks.onFx({ type: 'shake' });
      if (S.player.hp <= 0) finish(false);
    }
  }

  function resolve(c, outcome, now, info) {
    c.state = outcome; c.resolvedAt = now; c.info = info || {};
    if (outcome === 'miss') S.player.combo = 0;
    if (hooks.onResolve) hooks.onResolve(c, outcome, info || {});
    if (hooks.onFx && outcome === 'hit') hooks.onFx({ type: 'spark', x: c.x, y: c.y, dmg: info.dmg, accent: cfg.player.glove });
  }

  // ---------- end ----------
  function finish(ko) {
    if (!running) return;
    running = S.running = false;
    if (raf) cancelAnimationFrame(raf);
    S.phase = 'over';

    let win;
    if (S.mode === 'training') win = false;
    else if (ko) win = S.opp.hp <= 0;          // KO: whoever's still standing
    else win = S.player.hp >= S.opp.hp;        // decision by remaining health

    if (S.mode !== 'training') {
      tally.win = win ? 1 : 0;
      tally.ko = (ko && win) ? 1 : 0;
    } else {
      tally.train = 1;
    }

    const summary = {
      mode: S.mode, win, ko: ko && win, koed: ko && !win,
      playerHp: S.player.hp, oppHp: S.opp.hp,
      maxCombo: S.player.maxCombo,
      damage: tally.damage, taken: tally.taken,
      punches: tally.punch, blocks: tally.block, slips: tally.slip,
      tally,
      score: Math.round(tally.damage + S.player.maxCombo * 6 + tally.block * 8 + tally.slip * 10 - tally.taken * 0.5),
    };

    if (ko) SB.audio.ko(); else SB.audio.fanfare(win);
    if (hooks.onEnd) hooks.onEnd(summary);
  }

  SB.engine = {
    start, stop,
    get state() { return S; },
    constants: { HIT, STILL, SLIP, TARGET_R },
  };
})(window);
