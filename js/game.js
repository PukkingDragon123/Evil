/* game.js — state machine + UI wiring for Rap Battle.
   Flow: TITLE -> COUNTDOWN -> PERFORM -> RESULT -> (again). */
(function (global) {
  const RB = global.RB;
  const $ = (id) => document.getElementById(id);
  const norm = (w) => (w || '').toLowerCase().replace(/[^a-z']/g, '');

  const state = {
    round: null,
    micOK: false,
    speechOK: false,
    performing: false,
    rafId: null,
    transcript: '',
  };

  // ---------- screens ----------
  function show(screen) {
    ['title', 'play', 'result'].forEach((s) => {
      $('screen-' + s).classList.toggle('active', s === screen);
    });
  }

  // ---------- setup ----------
  function init() {
    state.speechOK = RB.speech.supported;
    const srNote = $('sr-status');
    srNote.textContent = state.speechOK
      ? '🎙️ Speech recognition ready (best in Chrome / Edge)'
      : '⌨️ No speech recognition here — you can type your bars instead';
    srNote.classList.toggle('warn', !state.speechOK);

    $('btn-start').addEventListener('click', begin);
    $('btn-stop').addEventListener('click', () => finish(false));
    $('btn-again').addEventListener('click', begin);
    $('btn-home').addEventListener('click', () => show('title'));

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && $('screen-title').classList.contains('active')) {
        e.preventDefault();
        begin();
      }
    });
  }

  async function begin() {
    // Audio + mic must be unlocked from a user gesture.
    RB.audio.init();
    const micStatus = $('mic-status');
    micStatus.textContent = 'Requesting microphone…';
    state.micOK = await RB.audio.initMic();
    micStatus.textContent = state.micOK
      ? '🎤 Mic live'
      : '🔇 Mic blocked — beat score disabled (lyrics still count)';
    micStatus.classList.toggle('warn', !state.micOK);

    state.round = RB.words.makeRound();
    renderRound(state.round);
    show('play');
    countdown(3);
  }

  // ---------- render the 4 blocks ----------
  function renderRound(round) {
    $('theme-label').textContent = 'THEME: ' + round.theme;
    const wrap = $('blocks');
    wrap.innerHTML = '';
    round.blocks.forEach((b, i) => {
      const el = document.createElement('div');
      el.className = 'block' + (b.type === 'punch' ? ' punch' : '');
      el.dataset.index = i;
      const words = b.words
        .map((w) => `<span class="word" data-word="${norm(w)}">${w}</span>`)
        .join('');
      el.innerHTML =
        `<div class="block-label">${b.label}</div>` +
        `<div class="block-words">${words}</div>` +
        (b.type === 'punch'
          ? `<div class="punch-hint">land a rhyme on this!</div>`
          : '');
      wrap.appendChild(el);
    });

    // typed fallback only when speech recognition is unavailable
    const fb = $('type-fallback');
    fb.classList.toggle('hidden', state.speechOK);
    if (!state.speechOK) fb.value = '';

    $('transcript').textContent = state.speechOK ? '…' : '';
    $('hint-rhymes').textContent =
      'try: ' + round.rhymeFamily.slice(0, 5).join(', ');
  }

  // ---------- countdown ----------
  function countdown(n) {
    const cd = $('countdown');
    cd.classList.remove('hidden');
    const tick = (k) => {
      if (k === 0) {
        cd.textContent = 'GO!';
        cd.dataset.go = '1';
        setTimeout(() => {
          cd.classList.add('hidden');
          cd.dataset.go = '';
          perform();
        }, 650);
        return;
      }
      cd.textContent = k;
      cd.dataset.go = '';
      // restart pop animation
      cd.style.animation = 'none';
      void cd.offsetWidth;
      cd.style.animation = '';
      setTimeout(() => tick(k - 1), 900);
    };
    tick(n);
  }

  // ---------- performance loop ----------
  function perform() {
    state.performing = true;
    state.transcript = '';
    $('btn-stop').classList.remove('hidden');

    if (state.speechOK) {
      RB.speech.start((full) => {
        state.transcript = full;
        updateTranscript(full);
      });
    } else {
      const fb = $('type-fallback');
      fb.classList.remove('hidden');
      fb.focus();
      fb.oninput = () => {
        state.transcript = fb.value;
        updateTranscript(fb.value);
      };
    }

    RB.audio.startBeat({ bpm: 88, bars: 8, onEnd: () => finish(true) });
    loop();
  }

  function loop() {
    if (!state.performing) return;
    RB.audio.sample();

    // mic meter
    const level = RB.audio.getLevel();
    $('mic-fill').style.width = Math.min(100, level * 280) + '%';

    // progress
    const p = RB.audio.progress();
    $('progress-fill').style.width = p * 100 + '%';

    // bar indicator + active block (2 bars per block)
    const bar = Math.min(RB.audio.bars - 1, RB.audio.currentBar());
    $('bar-indicator').textContent =
      'BAR ' + (bar + 1) + ' / ' + RB.audio.bars;
    const activeBlock = Math.min(3, Math.floor(bar / 2));
    document.querySelectorAll('.block').forEach((el) => {
      el.classList.toggle('active', +el.dataset.index === activeBlock);
    });

    // beat-synced visualizer (pulse on the downbeat + react to voice)
    const phase = RB.audio.currentBeatPhase();
    const pulse = (1 - phase) * 0.6 + level * 1.6;
    const bars = document.querySelectorAll('#beat-bars .eq');
    bars.forEach((b, i) => {
      const h = 18 + Math.abs(Math.sin(phase * Math.PI + i)) * 30 + level * 120;
      b.style.height = Math.min(100, h) + '%';
    });
    $('booth').style.setProperty('--pulse', pulse.toFixed(2));

    state.rafId = requestAnimationFrame(loop);
  }

  function updateTranscript(full) {
    $('transcript').textContent = full || '…';
    const said = (full || '').toLowerCase().split(/[^a-z']+/).filter(Boolean).map(norm);
    const set = new Set(said);
    const punch = norm(state.round.punchWord);
    document.querySelectorAll('.word').forEach((el) => {
      const w = el.dataset.word;
      // seeds light up on an exact hit; the punchline also lights on a rhyme
      let hit = set.has(w);
      if (!hit && w === punch) hit = said.some((s) => s !== punch && RB.score.rhymes(s, w));
      el.classList.toggle('hit', hit);
    });
  }

  // ---------- finish + score ----------
  function finish(natural) {
    if (!state.performing) return;
    state.performing = false;
    if (state.rafId) cancelAnimationFrame(state.rafId);
    RB.audio.stopBeat();
    if (state.speechOK) {
      state.transcript = RB.speech.stop() || state.transcript;
    }
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

    renderResult(result);
    show('result');
  }

  // ---------- result screen ----------
  function animateBar(fillId, valId, target) {
    const fill = $(fillId);
    const val = $(valId);
    fill.style.width = '0%';
    let cur = 0;
    const step = () => {
      cur += Math.max(1, (target - cur) * 0.12);
      if (cur >= target) cur = target;
      fill.style.width = cur + '%';
      val.textContent = Math.round(cur);
      if (cur < target) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function renderResult(r) {
    $('rank-emoji').textContent = r.rank.emoji;
    $('rank-name').textContent = r.rank.name;
    $('result-card').dataset.tier = r.rank.tier;
    $('quip').textContent = r.quip;

    animateBar('acc-fill', 'acc-val', r.accuracy);
    animateBar('beat-fill', 'beat-val', r.beat);
    animateBar('lyr-fill', 'lyr-val', r.lyrical);

    let cur = 0;
    const ov = $('overall-score');
    const stepOv = () => {
      cur += Math.max(1, (r.overall - cur) * 0.1);
      if (cur >= r.overall) cur = r.overall;
      ov.textContent = Math.round(cur);
      if (cur < r.overall) requestAnimationFrame(stepOv);
    };
    requestAnimationFrame(stepOv);

    // recap
    const d = r.details;
    const recap = [];
    recap.push(
      `🎯 Hit ${d.accuracy.seedHits}/${d.accuracy.seedTotal} target words` +
        (d.accuracy.punchSaid ? ' + the punchline' : '')
    );
    if (d.lyrical.rhymeWords && d.lyrical.rhymeWords.length) {
      recap.push('🪄 Rhymes landed: ' + d.lyrical.rhymeWords.slice(0, 6).join(', '));
    }
    if (!state.micOK) recap.push('🔇 Enable your mic next time for a real beat score');
    recap.push(`📝 ${r.wordCount} words spit`);
    $('recap').innerHTML = recap.map((x) => `<li>${x}</li>`).join('');
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
