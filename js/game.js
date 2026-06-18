/* game.js — state machine + UI for Rap Battle.
   Screens: HOME -> (CUSTOM) -> READY -> PLAY -> RESULT / VERSUS. */
(function (global) {
  const RB = global.RB;
  const $ = (id) => document.getElementById(id);
  const norm = (w) => (w || '').toLowerCase().replace(/[^a-z']/g, '');
  const SCREENS = ['home', 'custom', 'ready', 'play', 'result', 'versus'];

  const state = {
    mode: 'solo',
    difficulty: 'normal',
    round: null,
    micReady: false,
    micOK: false,
    speechOK: false,
    performing: false,
    rafId: null,
    transcript: '',
    onFinish: null,
    customWords: [],
    lane: { stride: 160, blockW: 140, center: 0, count: 0 },
    vs: { p1: 0, p2: 0, r1: null, r2: null, turn: 1 },
    lastResult: null,
    saved: false,
    vsSaved: false,
  };

  function show(screen) {
    SCREENS.forEach((s) => $('screen-' + s).classList.toggle('active', s === screen));
  }

  // ---------- setup ----------
  function init() {
    state.speechOK = RB.speech.supported;
    $('sr-status').textContent = state.speechOK
      ? '🎙️ live lyrics on (Chrome / Edge) — or type your bars'
      : '⌨️ no speech engine here — type your bars, beat still scores';

    // difficulty selector
    document.querySelectorAll('.diff-btn').forEach((b) =>
      b.addEventListener('click', () => {
        state.difficulty = b.dataset.diff;
        document.querySelectorAll('.diff-btn').forEach((x) =>
          x.classList.toggle('sel', x === b));
      })
    );

    // mode selector
    document.querySelectorAll('.mode-btn').forEach((b) =>
      b.addEventListener('click', async () => {
        await ensureAudio();
        const m = b.dataset.mode;
        if (m === 'solo') runSolo();
        else if (m === '1v1') runVs();
        else show('custom');
      })
    );

    // custom screen
    $('custom-input').addEventListener('input', renderCustomPreview);
    $('btn-custom-back').addEventListener('click', () => show('home'));
    $('btn-custom-go').addEventListener('click', async () => {
      const w = parseCustom();
      if (w.length < 2) { $('custom-error').textContent = 'Type at least 2 words (the last one is the punchline).'; return; }
      $('custom-error').textContent = '';
      await ensureAudio();
      runCustom(w);
    });

    $('btn-stop').addEventListener('click', () => finish());
    $('btn-home').addEventListener('click', () => show('home'));
    $('btn-vs-home').addEventListener('click', () => show('home'));
    $('btn-rematch').addEventListener('click', () => runVs());
    $('btn-again').addEventListener('click', () => {
      if (state.mode === 'custom') show('custom');
      else runSolo();
    });

    // leaderboard
    $('btn-board').addEventListener('click', () => { renderBoard(); show('board'); });
    $('btn-view-board').addEventListener('click', () => { renderBoard(); show('board'); });
    $('btn-board-home').addEventListener('click', () => show('home'));
    $('btn-board-clear').addEventListener('click', () => {
      if (confirm('Clear the whole leaderboard?')) { RB.leaderboard.clear(); renderBoard(); }
    });
    $('btn-save-score').addEventListener('click', saveResult);
    $('btn-vs-save').addEventListener('click', saveVersus);

    window.addEventListener('resize', () => { if ($('screen-play').classList.contains('active')) measureLane(); });
  }

  async function ensureAudio() {
    RB.audio.init();
    if (!state.micReady) {
      state.micOK = await RB.audio.initMic();
      state.micReady = true;
    }
  }

  // ---------- mode entry points ----------
  function runSolo() {
    state.mode = 'solo';
    const r = RB.words.makeRound(state.difficulty);
    state.onFinish = (res) => showResult(res);
    ready('🎤 SOLO CYPHER', 'Tap GO, then spit when the bars hit the line.', () => startRound(r, 'YOUR VERSE'));
  }

  function runCustom(words) {
    state.mode = 'custom';
    state.customWords = words;
    const r = RB.words.makeCustomRound(words, state.difficulty);
    state.onFinish = (res) => showResult(res);
    ready('🤝 PASS THE MIC', "Challenge set! Hand the device to your friend — don't let them peek.", () => startRound(r, "FRIEND'S VERSE"));
  }

  function runVs() {
    state.mode = '1v1';
    state.vs = { p1: 0, p2: 0, r1: null, r2: null, turn: 1 };
    vsTurn();
  }

  function vsTurn() {
    const who = state.vs.turn;
    const r = RB.words.makeRound(state.difficulty);
    state.onFinish = (res) => {
      if (who === 1) {
        state.vs.p1 = res.overall; state.vs.r1 = res; state.vs.turn = 2;
        ready('PLAYER 2 — YOU\'RE UP', 'Player 1 dropped a ' + res.overall + '. Pass the mic and beat it!', () => vsTurn());
      } else {
        state.vs.p2 = res.overall; state.vs.r2 = res; showVersus();
      }
    };
    ready('PLAYER ' + who, who === 1 ? 'First on the mic. Tap GO when you\'re ready.' : 'Final verse — take the crown.', () => startRound(r, 'PLAYER ' + who));
  }

  // ---------- ready gate ----------
  function ready(title, sub, go) {
    $('ready-title').textContent = title;
    $('ready-sub').textContent = sub;
    $('btn-go').onclick = async () => { await ensureAudio(); go(); };
    show('ready');
  }

  // ---------- custom preview ----------
  function parseCustom() {
    return $('custom-input').value.split(/[\s,]+/).map((w) => w.trim()).filter(Boolean);
  }
  function renderCustomPreview() {
    const w = parseCustom();
    const wrap = $('custom-preview');
    wrap.innerHTML = w.map((word, i) => {
      const last = i === w.length - 1 && w.length > 1;
      return `<span class="cchip${last ? ' punch' : ''}">${word}${last ? ' ⭐' : ''}</span>`;
    }).join('') || '<span class="muted">your words appear here…</span>';
  }

  // ---------- start a performance ----------
  function startRound(round, label) {
    state.round = round;
    show('play');
    renderRound(round, label);
    countdown(3);
  }

  function renderRound(round, label) {
    $('performer').textContent = label;
    $('diff-chip').textContent = round.diff.label;
    $('mic-status').textContent = state.micOK ? '🎤 live' : '🔇 no mic';
    $('mic-status').classList.toggle('warn', !state.micOK);
    $('bar-indicator').textContent = 'BAR 1 / ' + round.bars.length;

    // moving lane
    const lane = $('lane');
    lane.style.transition = 'none';
    lane.innerHTML = round.bars.map((b) => {
      const cls = 'lane-block ' + b.type;
      const word = b.type === 'free' ? 'FREESTYLE' : b.word;
      const tag = b.type === 'punch' ? 'PUNCHLINE' : 'BAR ' + (b.index + 1);
      const hint = b.type === 'punch' ? '<div class="lb-hint">rhyme this ⭐</div>'
                 : b.type === 'free' ? '<div class="lb-hint">just flow 🎤</div>' : '';
      return `<div class="${cls}" data-index="${b.index}" data-word="${norm(b.word)}" data-type="${b.type}">
                <div class="lb-tag">${tag}</div><div class="lb-word">${word}</div>${hint}</div>`;
    }).join('');

    // checklist
    const chk = round.seeds.map((w) => `<span class="chk" data-word="${norm(w)}">${w}</span>`).join('') +
      `<span class="chk punch" data-word="${norm(round.punchWord)}" data-punch="1">${round.punchWord} ⭐</span>`;
    $('checklist').innerHTML = chk;

    const fb = $('type-fallback');
    fb.classList.toggle('hidden', state.speechOK);
    if (!state.speechOK) { fb.value = ''; }
    $('transcript').textContent = state.speechOK ? '…' : '';

    measureLane();
  }

  function measureLane() {
    const lane = $('lane');
    const blocks = [...lane.children];
    if (!blocks.length) return;
    state.lane.count = blocks.length;
    state.lane.blockW = blocks[0].offsetWidth;
    state.lane.stride = blocks.length > 1 ? blocks[1].offsetLeft - blocks[0].offsetLeft : state.lane.blockW;
    state.lane.center = $('lane-wrap').clientWidth / 2;
    positionLane(0);
  }
  function positionLane(f) {
    const { stride, blockW, center } = state.lane;
    const x = f * stride + blockW / 2;
    $('lane').style.transform = 'translateX(' + (center - x) + 'px)';
  }

  // ---------- countdown ----------
  function countdown(n) {
    const cd = $('countdown');
    cd.classList.remove('hidden');
    const tick = (k) => {
      if (k === 0) {
        cd.textContent = 'GO!'; cd.dataset.go = '1';
        setTimeout(() => { cd.classList.add('hidden'); cd.dataset.go = ''; perform(); }, 650);
        return;
      }
      cd.textContent = k; cd.dataset.go = '';
      cd.style.animation = 'none'; void cd.offsetWidth; cd.style.animation = '';
      setTimeout(() => tick(k - 1), 850);
    };
    tick(n);
  }

  // ---------- perform ----------
  function perform() {
    state.performing = true;
    state.transcript = '';
    $('btn-stop').classList.remove('hidden');
    $('lane').style.transition = 'transform .12s linear';

    if (state.speechOK) {
      RB.speech.start((full) => { state.transcript = full; updateLive(full); });
    } else {
      const fb = $('type-fallback');
      fb.classList.remove('hidden');
      fb.focus();
      fb.oninput = () => { state.transcript = fb.value; updateLive(fb.value); };
    }

    const count = state.round.bars.length;
    RB.audio.startBeat({ bpm: state.round.diff.bpm, bars: count * 2, onEnd: () => finish() });
    loop();
  }

  function laneBarDur() {
    return 2 * (RB.audio.beatsPerBar * 60 / RB.audio.bpm);
  }

  function loop() {
    if (!state.performing) return;
    RB.audio.sample();
    const level = RB.audio.getLevel();
    $('mic-fill').style.width = Math.min(100, level * 280) + '%';
    $('progress-fill').style.width = RB.audio.progress() * 100 + '%';

    const f = RB.audio.elapsed() / laneBarDur();
    positionLane(f);
    const active = Math.max(0, Math.min(state.lane.count - 1, Math.round(f)));
    $('bar-indicator').textContent = 'BAR ' + (active + 1) + ' / ' + state.lane.count;
    [...$('lane').children].forEach((el, i) => {
      el.classList.toggle('active', i === active);
      el.classList.toggle('past', i < active);
    });

    const phase = RB.audio.currentBeatPhase();
    document.querySelectorAll('#beat-bars .eq').forEach((b, i) => {
      const h = 18 + Math.abs(Math.sin(phase * Math.PI + i)) * 30 + level * 120;
      b.style.height = Math.min(100, h) + '%';
    });
    $('booth').style.setProperty('--pulse', ((1 - phase) * 0.5 + level * 1.6).toFixed(2));

    state.rafId = requestAnimationFrame(loop);
  }

  function updateLive(full) {
    $('transcript').textContent = full || '…';
    const said = (full || '').toLowerCase().split(/[^a-z']+/).filter(Boolean).map(norm);
    const set = new Set(said);
    const punch = norm(state.round.punchWord);
    const isHit = (w, isPunch) => set.has(w) || (isPunch && said.some((s) => s !== w && RB.score.rhymes(s, w)));

    document.querySelectorAll('.chk').forEach((c) =>
      c.classList.toggle('done', isHit(c.dataset.word, c.dataset.punch === '1')));
    document.querySelectorAll('.lane-block').forEach((el) => {
      if (el.dataset.type === 'free') return;
      el.classList.toggle('got', isHit(el.dataset.word, el.dataset.type === 'punch'));
    });
  }

  // ---------- finish ----------
  function finish() {
    if (!state.performing) return;
    state.performing = false;
    if (state.rafId) cancelAnimationFrame(state.rafId);
    RB.audio.stopBeat();
    if (state.speechOK) state.transcript = RB.speech.stop() || state.transcript;
    $('btn-stop').classList.add('hidden');
    $('type-fallback').classList.add('hidden');

    const result = RB.score.evaluate({
      round: state.round,
      transcript: state.transcript,
      audioData: {
        onsets: RB.audio.onsets,
        energySamples: RB.audio.energySamples,
        beatGrid: RB.audio.beatGrid,
        bpm: RB.audio.bpm,
      },
    });
    if (state.onFinish) state.onFinish(result);
  }

  // ---------- result ----------
  function animateNum(el, target, fmt) {
    let cur = 0;
    const step = () => {
      cur += Math.max(1, (target - cur) * 0.12);
      if (cur >= target) cur = target;
      el.textContent = fmt ? fmt(Math.round(cur)) : Math.round(cur);
      if (cur < target) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function animateBar(fillId, valId, target) {
    const fill = $(fillId);
    fill.style.width = '0%';
    let cur = 0;
    const step = () => {
      cur += Math.max(1, (target - cur) * 0.12);
      if (cur >= target) cur = target;
      fill.style.width = cur + '%';
      $(valId).textContent = Math.round(cur);
      if (cur < target) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function showResult(r) {
    state.lastResult = r;
    state.saved = false;
    $('tag-input').value = RB.leaderboard.lastTag();
    $('save-msg').textContent = '';
    $('btn-save-score').disabled = false;
    $('rank-emoji').textContent = r.rank.emoji;
    $('rank-name').textContent = r.rank.name;
    $('result-card').dataset.tier = r.rank.tier;
    $('quip').textContent = r.quip;
    animateBar('acc-fill', 'acc-val', r.accuracy);
    animateBar('beat-fill', 'beat-val', r.beat);
    animateBar('lyr-fill', 'lyr-val', r.lyrical);
    animateNum($('overall-score'), r.overall);

    const d = r.details;
    const recap = [`🎯 Hit ${d.accuracy.seedHits}/${d.accuracy.seedTotal} target words` + (d.accuracy.punchSaid ? ' + the punchline' : '')];
    if (d.lyrical.rhymeWords && d.lyrical.rhymeWords.length)
      recap.push('🪄 Rhymes landed: ' + d.lyrical.rhymeWords.slice(0, 6).join(', '));
    if (!state.micOK) recap.push('🔇 Allow your mic for a real beat score');
    recap.push(`📝 ${r.wordCount} words · ${state.round.diff.label} mode`);
    $('recap').innerHTML = recap.map((x) => `<li>${x}</li>`).join('');

    $('btn-again').textContent = state.mode === 'custom' ? '✏️ NEW CHALLENGE' : '🔁 RUN IT BACK';
    show('result');
  }

  // ---------- leaderboard ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const medal = (i) => ['🥇', '🥈', '🥉'][i] || (i + 1) + '.';
  const modeBadge = (m) => ({ solo: 'SOLO', '1v1': '1V1', custom: 'CUSTOM' }[m] || m.toUpperCase());

  function renderBoard() {
    const list = RB.leaderboard.top(10);
    $('board-list').innerHTML = list.map((e, i) => `
      <li class="board-row${i < 3 ? ' top' : ''}">
        <span class="br-rank">${medal(i)}</span>
        <span class="br-name">${escapeHtml(e.name)}</span>
        <span class="br-tags"><i class="bt d-${e.difficulty}">${String(e.difficulty).toUpperCase()}</i><i class="bt">${modeBadge(e.mode)}</i></span>
        <span class="br-score">${e.score}</span>
      </li>`).join('');
    $('board-empty').classList.toggle('hidden', list.length > 0);
  }

  function saveResult() {
    if (state.saved || !state.lastResult) return;
    if (!RB.leaderboard.available()) { $('save-msg').textContent = '⚠️ Saving off (private browsing).'; return; }
    const name = ($('tag-input').value || '').trim() || 'MC';
    RB.leaderboard.setTag(name);
    const rank = RB.leaderboard.add({ name, score: state.lastResult.overall, mode: state.mode, difficulty: state.round.difficulty });
    state.saved = true;
    $('btn-save-score').disabled = true;
    $('save-msg').textContent = `🔥 Saved — #${rank} on the block!`;
  }

  function saveVersus() {
    if (state.vsSaved) return;
    if (!RB.leaderboard.available()) { $('vs-save-msg').textContent = '⚠️ Saving off (private browsing).'; return; }
    const n1 = ($('vs-p1-name-input').value || '').trim() || 'Player 1';
    const n2 = ($('vs-p2-name-input').value || '').trim() || 'Player 2';
    RB.leaderboard.add({ name: n1, score: state.vs.p1, mode: '1v1', difficulty: state.difficulty });
    RB.leaderboard.add({ name: n2, score: state.vs.p2, mode: '1v1', difficulty: state.difficulty });
    state.vsSaved = true;
    $('btn-vs-save').disabled = true;
    $('vs-save-msg').textContent = '🔥 Both scores saved to the board!';
  }

  // ---------- versus ----------
  function showVersus() {
    state.vsSaved = false;
    $('btn-vs-save').disabled = false;
    $('vs-save-msg').textContent = '';
    const { p1, p2, r1, r2 } = state.vs;
    animateNum($('vs-p1-score'), p1);
    animateNum($('vs-p2-score'), p2);
    $('vs-p1-rank').textContent = r1 ? r1.rank.emoji + ' ' + r1.rank.name : '';
    $('vs-p2-rank').textContent = r2 ? r2.rank.emoji + ' ' + r2.rank.name : '';
    const card = $('versus-card');
    card.classList.remove('p1win', 'p2win', 'tie');
    let txt;
    if (p1 > p2) { txt = '👑 PLAYER 1 TAKES THE CROWN'; card.classList.add('p1win'); }
    else if (p2 > p1) { txt = '👑 PLAYER 2 TAKES THE CROWN'; card.classList.add('p2win'); }
    else { txt = '🤝 DEAD HEAT — RUN IT BACK'; card.classList.add('tie'); }
    $('vs-winner').textContent = txt;
    show('versus');
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
