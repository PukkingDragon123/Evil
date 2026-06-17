/* game.js — screens + UI wiring for Shadow Boxer Ultimate.
   HOME -> SHOP / QUESTS / MATCHMAKING / FRIENDS -> FIGHT -> RESULT.
   Owns the fight HUD, renders the engine's cues as DOM, runs the store +
   cosmetics, and handles the camera/keyboard control surface. */
(function (global) {
  const SB = global.SB;
  const $ = (id) => document.getElementById(id);
  const SCREENS = ['home', 'shop', 'quests', 'matchmaking', 'friends', 'fight', 'result', 'friendsresult'];

  const DIFFS = {
    rookie: { label: 'ROOKIE', targetLife: 1500, spawnInterval: 1150, defenseChance: 0.16, oppDmg: 8,  oppHp: 95,  aggression: 0.30 },
    pro:    { label: 'PRO',    targetLife: 1150, spawnInterval: 900,  defenseChance: 0.28, oppDmg: 11, oppHp: 125, aggression: 0.55 },
    champ:  { label: 'CHAMP',  targetLife: 850,  spawnInterval: 720,  defenseChance: 0.38, oppDmg: 15, oppHp: 155, aggression: 0.85 },
  };

  const G = {
    difficulty: 'pro',
    shopCat: 'styles',
    pendingOpp: null,
    pendingMode: 'fight',
    friends: { p1: 'PLAYER 1', p2: 'PLAYER 2', seed: 0, turn: 1, s1: 0, s2: 0 },
    cueEls: new Map(),
    lastSpin: 0,
  };

  function show(screen) {
    SCREENS.forEach((s) => $('screen-' + s).classList.toggle('active', s === screen));
  }

  // ===================== boot =====================
  function init() {
    SB.store.load();
    SB.vision.init($('cam'));
    applyEquipped();
    refreshSpin();
    refreshBelt();
    bindHome();
    bindShop();
    bindQuests();
    bindMatchmaking();
    bindFriends();
    bindFight();
    show('home');
  }

  function applyEquipped() {
    const arena = SB.data.arena(SB.store.equipped('arenas'));
    document.documentElement.style.setProperty('--accent', arena.accent);
    document.body.style.background = arena.bg;
    SB.vision.setGlove(SB.data.glove(SB.store.equipped('gloves')));
    SB.audio.setEnabled(SB.store.settings().sound);
    SB.vision.setSensitivity(SB.store.settings().sensitivity);
  }

  function refreshSpin() {
    const v = SB.store.getSpin();
    document.querySelectorAll('.spin-amount').forEach((e) => (e.textContent = v));
  }
  function refreshBelt() {
    const wins = SB.store.stats().wins;
    const r = SB.data.rankFor(wins), nx = SB.data.nextRank(wins);
    $('belt-emoji').textContent = r.belt;
    $('belt-name').textContent = r.name;
    $('rank-next').textContent = nx ? `${nx.wins - wins} win${nx.wins - wins > 1 ? 's' : ''} to ${nx.name}` : 'MAXED OUT 🌟';
    const qc = SB.quests.claimableCount();
    $('quest-badge').textContent = qc ? qc : '';
    $('quest-badge').classList.toggle('hidden', !qc);
  }

  async function ensureAudio() { SB.audio.init(); }

  // ===================== HOME =====================
  function bindHome() {
    document.querySelectorAll('#screen-home .diff-btn').forEach((b) =>
      b.addEventListener('click', () => {
        G.difficulty = b.dataset.diff;
        document.querySelectorAll('#screen-home .diff-btn').forEach((x) => x.classList.toggle('sel', x === b));
      }));
    $('btn-train').addEventListener('click', async () => { await ensureAudio(); startTraining(); });
    $('btn-quick').addEventListener('click', async () => { await ensureAudio(); openMatchmaking(); });
    $('btn-friends').addEventListener('click', async () => { await ensureAudio(); show('friends'); });
    $('btn-shop').addEventListener('click', () => { renderShop(); show('shop'); });
    $('btn-quests').addEventListener('click', () => { renderQuests(); show('quests'); });

    // settings
    const st = SB.store.settings();
    $('set-name').value = SB.store.name();
    $('set-sens').value = st.sensitivity;
    $('set-sound').checked = st.sound;
    $('set-name').addEventListener('change', (e) => { SB.store.setName(e.target.value); e.target.value = SB.store.name(); });
    $('set-sens').addEventListener('input', (e) => { SB.store.setSetting('sensitivity', +e.target.value); SB.vision.setSensitivity(+e.target.value); });
    $('set-sound').addEventListener('change', (e) => { SB.store.setSetting('sound', e.target.checked); SB.audio.setEnabled(e.target.checked); });
    $('btn-reset').addEventListener('click', () => {
      if (confirm('Reset all SPIN, gear and progress?')) { SB.store.reset(); applyEquipped(); refreshSpin(); refreshBelt(); $('set-name').value = SB.store.name(); }
    });
  }

  // ===================== SHOP =====================
  function bindShop() {
    $('shop-back').addEventListener('click', () => { refreshBelt(); show('home'); });
    document.querySelectorAll('.shop-tab').forEach((t) =>
      t.addEventListener('click', () => { G.shopCat = t.dataset.cat; renderShop(); }));
  }

  function renderShop() {
    refreshSpin();
    document.querySelectorAll('.shop-tab').forEach((t) => t.classList.toggle('sel', t.dataset.cat === G.shopCat));
    const cat = G.shopCat;
    const list = SB.data.catalog[cat];
    const grid = $('shop-grid');
    grid.innerHTML = list.map((item) => {
      const owned = SB.store.isOwned(cat, item.id);
      const equipped = SB.store.equipped(cat) === item.id;
      const swatch = swatchFor(cat, item);
      const meta = metaFor(cat, item);
      const btn = equipped
        ? `<button class="card-btn equipped" disabled>✓ EQUIPPED</button>`
        : owned
          ? `<button class="card-btn equip" data-act="equip" data-id="${item.id}">EQUIP</button>`
          : `<button class="card-btn buy" data-act="buy" data-id="${item.id}" data-cost="${item.cost}">🪙 ${item.cost}</button>`;
      return `<div class="shop-card ${equipped ? 'is-equipped' : ''}">
          ${swatch}
          <div class="card-name">${item.name}</div>
          <div class="card-meta">${meta}</div>
          ${btn}
        </div>`;
    }).join('');
    grid.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => shopAction(b)));
  }

  function swatchFor(cat, item) {
    if (cat === 'gloves') return `<div class="sw glove" style="background:radial-gradient(circle at 35% 30%, ${item.a}, ${item.b});box-shadow:0 0 18px ${item.glow}"></div>`;
    if (cat === 'kofx') return `<div class="sw kofx" style="--c:${item.color}"><span>${item.kind === 'flash' ? '⚡' : item.kind === 'stars' ? '✨' : item.kind === 'lightning' ? '🌩️' : item.kind === 'inferno' ? '🔥' : item.kind === 'confetti' ? '🎉' : '👾'}</span></div>`;
    if (cat === 'arenas') return `<div class="sw arena" style="background:${item.bg};border-color:${item.accent}"></div>`;
    return `<div class="sw style" style="border-color:var(--accent)"><span>${item.emoji}</span></div>`;
  }
  function metaFor(cat, item) {
    if (cat === 'styles') return item.blurb;
    if (cat === 'gloves') return 'Glove filter + hit sparks';
    if (cat === 'kofx') return 'Finisher when you KO';
    if (cat === 'arenas') return 'Backdrop + UI accent';
    return '';
  }

  function shopAction(btn) {
    const cat = G.shopCat, id = btn.dataset.id;
    if (btn.dataset.act === 'buy') {
      const cost = +btn.dataset.cost;
      if (!SB.store.buy(cat, id, cost)) { flash($('shop-grid'), 'NOT ENOUGH SPIN'); SB.audio.beep(false); return; }
      SB.store.equip(cat, id);
      SB.audio.bell();
    } else {
      SB.store.equip(cat, id);
      SB.audio.beep(true);
    }
    applyEquipped();
    refreshSpin();
    renderShop();
  }

  // ===================== QUESTS =====================
  function bindQuests() {
    $('quests-back').addEventListener('click', () => { refreshBelt(); show('home'); });
  }
  function renderQuests() {
    refreshSpin();
    const list = SB.quests.list();
    $('quest-list').innerHTML = list.map((q) => `
      <div class="quest-card ${q.done ? 'done' : ''} ${q.claimable ? 'claimable' : ''}">
        <div class="q-top">
          <span class="q-name">${q.name} ${q.daily ? '<i class="q-daily">DAILY</i>' : ''}</span>
          <span class="q-reward">🪙 ${q.reward}</span>
        </div>
        <div class="q-desc">${q.desc}</div>
        <div class="q-bar"><div class="q-fill" style="width:${q.pct}%"></div></div>
        <div class="q-foot">
          <span class="q-prog">${q.progress} / ${q.goal}</span>
          ${q.claimable
            ? `<button class="card-btn buy" data-claim="${q.id}">CLAIM</button>`
            : q.claimed ? `<span class="q-claimed">✓ CLAIMED</span>` : `<span class="q-pending">in progress</span>`}
        </div>
      </div>`).join('');
    $('quest-list').querySelectorAll('[data-claim]').forEach((b) =>
      b.addEventListener('click', () => {
        const got = SB.quests.claim(b.dataset.claim);
        if (got) { SB.audio.bell(); refreshSpin(); renderQuests(); refreshBelt(); }
      }));
  }

  // ===================== MATCHMAKING =====================
  function bindMatchmaking() {
    $('mm-cancel').addEventListener('click', () => { clearTimeout(G.mmTimer); show('home'); });
    $('mm-fight').addEventListener('click', () => goFight('fight'));
  }
  function openMatchmaking() {
    show('matchmaking');
    $('mm-card').classList.add('hidden');
    $('mm-fight').classList.add('hidden');
    $('mm-spinner').classList.remove('hidden');
    const lines = ['Searching the gym…', 'Matching by belt rank…', 'Found challengers…', 'Locking in opponent…'];
    let i = 0;
    $('mm-status').textContent = lines[0];
    $('mm-ping').textContent = 'ping ' + (28 + (Math.random() * 40 | 0)) + 'ms';
    const tick = () => {
      i++;
      if (i < lines.length) { $('mm-status').textContent = lines[i]; $('mm-ping').textContent = 'ping ' + (24 + (Math.random() * 50 | 0)) + 'ms'; G.mmTimer = setTimeout(tick, 650); }
      else revealOpponent();
    };
    G.mmTimer = setTimeout(tick, 700);
  }
  function revealOpponent() {
    const bot = SB.data.BOTS[(Math.random() * SB.data.BOTS.length) | 0];
    const style = SB.data.style(bot.style);
    G.pendingOpp = bot;
    $('mm-spinner').classList.add('hidden');
    $('mm-status').textContent = 'OPPONENT FOUND';
    $('mm-tag').textContent = bot.tag;
    $('mm-tag').style.color = bot.accent;
    $('mm-style').textContent = `${style.emoji} ${style.name}`;
    $('mm-taunt').textContent = '“' + bot.taunt + '”';
    $('mm-mmr').textContent = 'MMR ' + (900 + (Math.random() * 1600 | 0));
    $('mm-card').classList.remove('hidden');
    $('mm-fight').classList.remove('hidden');
    SB.audio.bell();
  }

  // ===================== FRIENDS =====================
  function bindFriends() {
    $('fr-back').addEventListener('click', () => show('home'));
    $('fr-go').addEventListener('click', async () => {
      await ensureAudio();
      G.friends.p1 = ($('fr-p1').value || 'PLAYER 1').toUpperCase().slice(0, 14);
      G.friends.p2 = ($('fr-p2').value || 'PLAYER 2').toUpperCase().slice(0, 14);
      G.friends.seed = (Math.random() * 1e9) | 0; // same sequence for both
      G.friends.turn = 1; G.friends.s1 = 0; G.friends.s2 = 0;
      goFight('friends');
    });
  }

  // ===================== FIGHT SETUP =====================
  function diff() { return DIFFS[G.difficulty]; }

  function buildConfig(mode) {
    const d = diff();
    const style = SB.data.style(SB.store.equipped('styles'));
    const glove = SB.data.glove(SB.store.equipped('gloves'));
    // clone the style mods so we never mutate the shared catalog object
    const player = { hpMax: 100, style: { ...style.mods, mirror: !!style.mirror }, name: SB.store.name() };

    let opp, rounds = 3, roundTime = 40, seed = (Math.random() * 1e9) | 0;
    if (mode === 'training') {
      opp = { name: 'HEAVY BAG', accent: 'var(--accent)', hpMax: 999999, dmg: 0, aggression: 0, defenseChance: 0, targetLife: d.targetLife, spawnInterval: d.spawnInterval * 0.78, style: 'orthodox' };
      rounds = 1; roundTime = 60;
    } else if (mode === 'friends') {
      opp = { name: 'SPARRING DROID', accent: '#7af0ff', hpMax: 150, dmg: 11, aggression: 0.55, defenseChance: 0.28, targetLife: DIFFS.pro.targetLife, spawnInterval: DIFFS.pro.spawnInterval, style: 'orthodox' };
      rounds = 2; roundTime = 35; seed = G.friends.seed;
    } else { // quick fight vs bot
      const bot = G.pendingOpp || SB.data.BOTS[0];
      opp = { name: bot.tag, accent: bot.accent, hpMax: d.oppHp, dmg: d.oppDmg, aggression: d.aggression, defenseChance: d.defenseChance, targetLife: d.targetLife, spawnInterval: d.spawnInterval, style: bot.style };
    }
    return { mode, rounds, roundTime, seed, player, glove, opp };
  }

  function startTraining() { goFight('training'); }

  async function goFight(mode) {
    G.pendingMode = mode;
    G.config = buildConfig(mode);
    applyEquipped();
    show('fight');
    resetFightUI(G.config);
    // start camera (or fall back). show prefight overlay either way.
    $('pf-go').disabled = true;
    $('pf-sub').textContent = 'Starting camera…';
    const cam = await SB.vision.start();
    setupPrefight(cam, mode);
    $('pf-go').disabled = false;
  }

  function setupPrefight(cam, mode) {
    const o = G.config.opp;
    let title = mode === 'training' ? 'TRAINING' : mode === 'friends' ? (G.friends.turn === 1 ? G.friends.p1 : G.friends.p2) + ' — STEP UP' : 'TITLE FIGHT';
    $('pf-title').textContent = title;
    $('pf-vs').textContent = mode === 'training' ? 'Free training — rack up combos & damage'
      : mode === 'friends' ? 'Same opponent, same sequence — top score wins'
      : `vs ${o.name}`;
    $('controls').classList.toggle('hidden', cam);
    if (cam) {
      $('pf-sub').innerHTML = '🎥 <b>Step back</b> so your upper body fills the frame.';
      $('pf-tip').innerHTML = '👊 Punch the <b>targets</b> · 🛡️ <b>HOLD STILL & cover</b> to BLOCK · ↔️ <b>lean</b> to SLIP';
    } else {
      $('pf-sub').innerHTML = '⌨️ No camera — use the on-screen buttons or keys.';
      $('pf-tip').innerHTML = '<b>A</b>/<b>L</b> = left/right · <b>Space</b> = guard (block) · <b>←</b>/<b>→</b> = slip';
    }
  }

  function resetFightUI(cfg) {
    $('p-name').textContent = cfg.player.name;
    $('o-name').textContent = cfg.opp.name;
    $('o-name').style.color = cfg.opp.accent === 'var(--accent)' ? '' : cfg.opp.accent;
    $('p-hp').style.width = '100%';
    $('o-hp').style.width = '100%';
    $('o-hp').style.background = cfg.opp.accent;
    $('round-num').textContent = `R1/${cfg.rounds}`;
    $('round-time').textContent = cfg.roundTime | 0;
    $('combo').classList.remove('show');
    $('hype-fill').style.width = '0%';
    $('cues').innerHTML = ''; G.cueEls.clear();
    $('float-layer').innerHTML = '';
    $('ko-overlay').classList.add('hidden');
    $('ko-fx').innerHTML = '';
    $('prefight').classList.remove('hidden');
    $('round-banner').classList.remove('show');
  }

  function bindFight() {
    $('pf-go').addEventListener('click', () => { $('prefight').classList.add('hidden'); countdownThen(beginBout); });
    $('btn-quit').addEventListener('click', quitFight);
    // manual control surface (used when no camera)
    document.querySelectorAll('#controls [data-act]').forEach((b) => {
      const press = (on) => doControl(b.dataset.act, on);
      b.addEventListener('mousedown', () => press(true));
      b.addEventListener('mouseup', () => press(false));
      b.addEventListener('mouseleave', () => press(false));
      b.addEventListener('touchstart', (e) => { e.preventDefault(); press(true); }, { passive: false });
      b.addEventListener('touchend', (e) => { e.preventDefault(); press(false); }, { passive: false });
    });
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
  }

  function doControl(act, on) {
    if (act === 'guard') { SB.vision.setGuard(on); return; }
    if (!on) return;
    if (act === 'left' || act === 'slipL') SB.vision.punch('left', 1);
    if (act === 'right' || act === 'slipR') SB.vision.punch('right', 1);
  }
  function onKey(e) {
    if (!$('screen-fight').classList.contains('active')) return;
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'a') SB.vision.punch('left', 1);
    else if (k === 'l' || k === 'd') SB.vision.punch('right', 1);
    else if (k === ' ') { e.preventDefault(); SB.vision.setGuard(true); }
    else if (k === 'arrowleft') SB.vision.punch('left', 1);
    else if (k === 'arrowright') SB.vision.punch('right', 1);
  }
  function onKeyUp(e) {
    if (e.key === ' ') SB.vision.setGuard(false);
  }

  function countdownThen(fn) {
    const el = $('count');
    el.classList.remove('hidden');
    const seq = ['3', '2', '1', 'FIGHT!'];
    let i = 0;
    const tick = () => {
      el.textContent = seq[i];
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
      SB.audio.beep(i === seq.length - 1);
      i++;
      if (i < seq.length) setTimeout(tick, 750);
      else setTimeout(() => { el.classList.add('hidden'); fn(); }, 600);
    };
    tick();
  }

  function beginBout() {
    SB.audio.startCrowd();
    if (G.pendingMode !== 'training') SB.audio.startLoop(138);
    SB.audio.bell();
    SB.engine.start(G.config, {
      onTick: renderTick,
      onSpawn: addCue,
      onResolve: resolveCue,
      onFx: doFx,
      onRound: showRoundBanner,
      onEnd: onBoutEnd,
    });
  }

  function quitFight() {
    SB.engine.stop();
    SB.audio.stopLoop(); SB.audio.stopCrowd();
    SB.vision.stop();
    show('home'); refreshSpin(); refreshBelt();
  }

  // ===================== FIGHT RENDERING =====================
  function renderTick(S) {
    $('p-hp').style.width = (S.player.hp / S.player.hpMax * 100) + '%';
    $('o-hp').style.width = (S.opp.hp / S.opp.hpMax * 100) + '%';
    $('round-num').textContent = `R${S.round}/${S.rounds}`;
    $('round-time').textContent = Math.ceil(S.timeLeft);
    $('hype-fill').style.width = (S.hype * 100) + '%';
    const c = $('combo');
    if (S.player.combo >= 3) { c.textContent = S.player.combo + '× COMBO'; c.classList.add('show'); }
    else c.classList.remove('show');
    $('p-hp').classList.toggle('low', S.player.hp / S.player.hpMax < 0.25);
    syncCues(S);
  }

  function addCue(cue) {
    const el = document.createElement('div');
    el.className = 'cue ' + cue.kind + (cue.kind === 'defense' ? ' d-' + cue.sub : ' t-' + cue.side);
    el.dataset.id = cue.id;
    if (cue.kind === 'target') {
      el.style.left = (cue.x * 100) + '%';
      el.style.top = (cue.y * 100) + '%';
      el.innerHTML = `<div class="ring"></div><div class="bullseye">${sideLabel(cue.side)}</div>`;
    } else {
      el.innerHTML = defenseMarkup(cue.sub);
    }
    $('cues').appendChild(el);
    G.cueEls.set(cue.id, el);
  }

  function defenseMarkup(sub) {
    if (sub === 'block') return `<div class="def block"><div class="def-ring"></div><div class="def-label">🛡️ BLOCK<small>hold still &amp; cover</small></div></div>`;
    const dir = sub === 'slipL' ? '← SLIP LEFT' : 'SLIP RIGHT →';
    return `<div class="def slip ${sub}"><div class="def-ring"></div><div class="def-label">${dir}<small>lean away</small></div></div>`;
  }

  function sideLabel(side) {
    return ({ left: 'JAB', right: 'CROSS', high: 'HIGH', body: 'BODY', hookL: 'HOOK', hookR: 'HOOK' })[side] || 'HIT';
  }

  function syncCues(S) {
    const now = performance.now();
    const alive = new Set();
    for (const cue of S.cues) {
      alive.add(cue.id);
      let el = G.cueEls.get(cue.id);
      if (!el) { addCue(cue); el = G.cueEls.get(cue.id); }
      const p = Math.min(1, (now - cue.born) / cue.life);
      if (cue.state === 'active') {
        if (cue.kind === 'target') {
          const ring = el.querySelector('.ring');
          if (ring) ring.style.transform = `scale(${1 + (1 - p) * 1.5})`;
          el.style.opacity = (0.35 + 0.65 * Math.min(1, p * 1.6));
        } else {
          el.classList.toggle('armed', cue.armed || cue.guardOK);
          const ring = el.querySelector('.def-ring');
          if (ring) ring.style.transform = `scale(${0.6 + (1 - p) * 0.9})`;
        }
      }
    }
    // drop elements whose cue is gone
    for (const [id, el] of G.cueEls) {
      if (!alive.has(id)) { el.remove(); G.cueEls.delete(id); }
    }
  }

  function resolveCue(cue, outcome) {
    const el = G.cueEls.get(cue.id);
    if (!el) return;
    el.classList.add('resolved', 'out-' + outcome);
  }

  function doFx(fx) {
    if (fx.type === 'shake') {
      const f = $('screen-fight');
      f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
      $('hit-flash').classList.remove('on'); void $('hit-flash').offsetWidth; $('hit-flash').classList.add('on');
    } else if (fx.type === 'spark') {
      const g = SB.data.glove(SB.store.equipped('gloves'));
      const s = document.createElement('div');
      s.className = 'float-dmg';
      s.style.left = (fx.x * 100) + '%';
      s.style.top = (fx.y * 100) + '%';
      s.style.color = g.glow;
      s.textContent = '-' + fx.dmg;
      $('float-layer').appendChild(s);
      setTimeout(() => s.remove(), 850);
    }
  }

  function showRoundBanner(round, phase) {
    const b = $('round-banner');
    if (phase === 'intro') b.textContent = 'ROUND ' + round;
    else if (phase === 'rest') b.textContent = 'REST';
    else { b.classList.remove('show'); return; }
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }

  // ===================== BOUT END =====================
  function onBoutEnd(summary) {
    SB.audio.stopLoop();
    if (G.pendingMode === 'friends') return endFriendsBout(summary);

    // rewards
    let earned = 0;
    if (G.pendingMode === 'training') {
      earned = Math.round(summary.damage * 0.05 + summary.maxCombo * 4 + 15);
    } else {
      earned = Math.round(summary.damage * 0.06 + summary.maxCombo * 4 + summary.blocks * 5 + summary.slips * 6 + (summary.win ? 90 : 25) + (summary.ko ? 60 : 0));
    }
    SB.store.addSpin(earned);
    // stats
    SB.store.bump('fights', 1);
    SB.store.bump('punches', summary.punches);
    SB.store.bump('damage', summary.damage);
    SB.store.best('bestCombo', summary.maxCombo);
    if (G.pendingMode !== 'training') {
      if (summary.win) SB.store.bump('wins', 1); else SB.store.bump('losses', 1);
      if (summary.ko) SB.store.bump('kos', 1);
    }
    SB.quests.report(summary.tally);

    const ko = summary.ko || summary.koed;
    if (ko) playKO(summary.ko, () => showResult(summary, earned));
    else showResult(summary, earned);
  }

  function playKO(playerWon, done) {
    const ov = $('ko-overlay'), fx = $('ko-fx');
    ov.classList.remove('hidden');
    const word = playerWon ? 'K.O.!' : 'DOWN!';
    const kind = SB.data.kofx(SB.store.equipped('kofx'));
    ov.querySelector('#ko-word').textContent = word;
    ov.dataset.kind = kind.kind;
    ov.style.setProperty('--ko-color', kind.color);
    fx.innerHTML = '';
    const n = kind.kind === 'confetti' ? 40 : kind.kind === 'stars' ? 24 : 18;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.className = 'ko-particle k-' + kind.kind;
      p.style.left = (10 + Math.random() * 80) + '%';
      p.style.top = (20 + Math.random() * 50) + '%';
      p.style.setProperty('--dx', (Math.random() * 2 - 1).toFixed(2));
      p.style.setProperty('--dy', (Math.random() * 2 - 1).toFixed(2));
      p.style.animationDelay = (Math.random() * 0.25) + 's';
      fx.appendChild(p);
    }
    setTimeout(done, 1900);
  }

  function showResult(summary, earned) {
    SB.audio.stopCrowd();
    SB.vision.stop();
    const win = summary.win;
    $('res-emoji').textContent = summary.ko ? '🥊' : win ? '🏆' : summary.mode === 'training' ? '🎯' : '🧤';
    $('res-title').textContent = summary.mode === 'training' ? 'TRAINING DONE'
      : summary.ko ? 'KNOCKOUT WIN' : win ? 'VICTORY' : summary.koed ? 'KNOCKED OUT' : 'DEFEAT';
    $('res-title').dataset.win = win ? '1' : '0';
    $('res-sub').textContent = summary.mode === 'training'
      ? 'Good work on the bag.'
      : win ? 'And still… the champ!' : 'Back to the gym — run it again.';
    animateNum($('res-score'), summary.score);
    animateNum($('res-spin'), earned, '🪙 +');
    $('res-recap').innerHTML = [
      `👊 ${summary.punches} punches landed`,
      `🔥 best combo ${summary.maxCombo}×`,
      `🛡️ ${summary.blocks} blocks · 💨 ${summary.slips} slips`,
      `💢 ${summary.damage} damage dealt · took ${summary.taken}`,
    ].map((x) => `<li>${x}</li>`).join('');

    // quest nudges
    const claimable = SB.quests.claimableCount();
    $('res-quests').textContent = claimable ? `✅ ${claimable} quest${claimable > 1 ? 's' : ''} ready to claim!` : '';
    $('res-quests').classList.toggle('hidden', !claimable);

    $('btn-again').textContent = summary.mode === 'training' ? '🎯 TRAIN AGAIN' : '🔁 REMATCH';
    refreshSpin(); refreshBelt();
    show('result');
  }

  function endFriendsBout(summary) {
    SB.audio.stopCrowd();
    SB.vision.stop();
    SB.quests.report(summary.tally); // still counts toward dailies
    if (G.friends.turn === 1) {
      G.friends.s1 = summary.score;
      G.friends.turn = 2;
      // hand off to player 2
      goFight('friends');
    } else {
      G.friends.s2 = summary.score;
      showFriendsResult();
    }
  }

  function showFriendsResult() {
    refreshSpin();
    const { p1, p2, s1, s2 } = G.friends;
    $('fres-p1name').textContent = p1; $('fres-p1score').textContent = s1;
    $('fres-p2name').textContent = p2; $('fres-p2score').textContent = s2;
    const card = $('fres-card');
    card.classList.remove('p1', 'p2', 'tie');
    let t;
    if (s1 > s2) { t = `👑 ${p1} WINS`; card.classList.add('p1'); }
    else if (s2 > s1) { t = `👑 ${p2} WINS`; card.classList.add('p2'); }
    else { t = '🤝 DEAD HEAT'; card.classList.add('tie'); }
    $('fres-title').textContent = t;
    SB.audio.fanfare(true);
    show('friendsresult');
  }

  // ===================== misc =====================
  function bindResultButtons() {
    $('btn-again').addEventListener('click', () => {
      if (G.pendingMode === 'training') startTraining();
      else if (G.pendingMode === 'fight') openMatchmaking();
      else show('home');
    });
    $('btn-result-home').addEventListener('click', () => { show('home'); refreshSpin(); refreshBelt(); });
    $('btn-fr-rematch').addEventListener('click', () => { G.friends.turn = 1; G.friends.seed = (Math.random() * 1e9) | 0; goFight('friends'); });
    $('btn-fr-home').addEventListener('click', () => show('home'));
  }

  function animateNum(el, target, prefix) {
    let cur = 0;
    const step = () => {
      cur += Math.max(1, (target - cur) * 0.14);
      if (cur >= target) cur = target;
      el.textContent = (prefix || '') + Math.round(cur);
      if (cur < target) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function flash(el, msg) {
    const f = document.createElement('div');
    f.className = 'toast'; f.textContent = msg;
    el.appendChild(f);
    setTimeout(() => f.remove(), 1400);
  }

  document.addEventListener('DOMContentLoaded', () => { init(); bindResultButtons(); });
})(window);
