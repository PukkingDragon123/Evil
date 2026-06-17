/* score.js — the "AI judge". Turns a transcript + mic timing into three
   scores: ACCURACY (did you hit the words), BEAT (were you on rhythm),
   LYRICAL (rhyme, vocabulary, density). Exposes RB.score. */
(function (global) {
  const RB = (global.RB = global.RB || {});

  // ---- helpers ----
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const norm = (w) => (w || '').toLowerCase().replace(/[^a-z']/g, '');

  function words(text) {
    return (text || '')
      .toLowerCase()
      .split(/[^a-z']+/)
      .filter((w) => w.length > 0);
  }

  // Map a word to a canonical "rhyme sound" key. A pure-spelling heuristic
  // can't be perfect without a pronunciation dictionary, so we match the most
  // important rhyme families explicitly (handling silent letters like the
  // "gh" in higher) and fall back to the final vowel-cluster + coda.
  const VOWEL_GROUPS = [
    [/(ight|ite|yte|yght)$/, 'IT'],            // light / ignite / kite
    [/(igher|ire|iar|yer|yre|oir|uyer)$/, 'IR'], // fire / higher / liar / buyer
    [/(tion|sion|cean|shun)$/, 'SHN'],         // nation / mission
    [/(ound|owned)$/, 'OWND'],                 // sound / ground / profound
    [/(own|oun)$/, 'OWN'],                      // crown / down / renown
    [/(ay|ey|eigh|ai)$/, 'AY'],                // play / weigh / display
    [/(old|olled|owled|oled)$/, 'OLD'],        // gold / bold / controlled
    [/(ime|yme|imb)$/, 'IM'],                  // time / rhyme / climb
    [/(east|iest|eased|eece|iece|east)$/, 'EST'], // beast / released / piece
    [/(ame|aim|aym)$/, 'AYM'],                 // game / flame / claim
    [/(ace|ase|aice)$/, 'ACE'],                // space / race / chase
    [/(orm|warm|ourm)$/, 'ORM'],               // storm / form / transform
    [/(age|aige)$/, 'AGE'],                    // stage / rage / engage
    [/(ind|ined|igned)$/, 'IND'],              // mind / grind / designed
    [/(ow|oe|oh)$/, 'OH'],                     // flow / glow / show
    [/[^aeiouy]o$/, 'OH'],                     // go / pro / solo
    [/(ee|ea|ie)$/, 'EE'],                     // free / sea / believe-ie
    [/[^aeiouy]y$/, 'EE'],                     // city / happy / fly? -> EE
  ];

  function rhymeKey(w) {
    w = norm(w).replace(/'/g, '');
    if (w.length < 2) return w.toUpperCase();
    for (const [re, key] of VOWEL_GROUPS) if (re.test(w)) return key;
    // fallback: collapse doubles, take the last vowel cluster to the end
    const c = w.replace(/(.)\1+/g, '$1');
    const m = c.match(/[aeiouy]+[^aeiouy]*$/);
    return (m ? m[0] : c.slice(-2)).toUpperCase();
  }

  function rhymes(a, b) {
    a = norm(a); b = norm(b);
    if (!a || !b || a === b) return false;
    return rhymeKey(a) === rhymeKey(b);
  }

  // ---------- ACCURACY: how many target words landed ----------
  function scoreAccuracy(round, said) {
    const set = new Set(said.map(norm));
    let seedHits = 0;
    round.seeds.forEach((s) => { if (set.has(norm(s))) seedHits++; });
    const seedFrac = round.seeds.length ? seedHits / round.seeds.length : 0;

    const punchSaid = set.has(norm(round.punchWord));
    const score = Math.round(70 * seedFrac + (punchSaid ? 30 : 0));
    return {
      score: clamp(score, 0, 100),
      seedHits,
      seedTotal: round.seeds.length,
      punchSaid,
    };
  }

  // ---------- LYRICAL: rhyme, vocab, density ----------
  function scoreLyrical(round, said) {
    const total = said.length;
    if (total === 0) {
      return { score: 0, rhymeHits: 0, uniqueRatio: 0, density: 0, rhymeWords: [] };
    }

    // rhymes that land on the punchline word or its family
    const family = new Set(round.rhymeFamily.map(norm));
    const rhymeWords = [];
    const seen = new Set();
    said.forEach((w) => {
      const n = norm(w);
      if (!n || seen.has(n) || n === norm(round.punchWord)) return;
      if (family.has(n) || rhymes(n, round.punchWord)) {
        rhymeWords.push(n);
        seen.add(n);
      }
    });
    const rhymeHits = rhymeWords.length;

    // internal rhyme density — pairs of distinct words that rhyme
    const uniq = [...new Set(said.map(norm))].filter(Boolean);
    let internalPairs = 0;
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i + 1; j < uniq.length; j++) {
        if (rhymes(uniq[i], uniq[j])) { internalPairs++; break; }
      }
    }

    const uniqueRatio = uniq.length / total; // vocabulary richness
    const density = clamp(total / 28, 0, 1); // ~28 words fills 8 bars

    const rhymeScore = clamp(rhymeHits / 3, 0, 1) * 45; // landing the punch
    const internalScore = clamp(internalPairs / 6, 0, 1) * 20;
    const vocabScore = clamp((uniqueRatio - 0.45) / 0.4, 0, 1) * 15;
    const flowScore = density * 20;

    return {
      score: clamp(Math.round(rhymeScore + internalScore + vocabScore + flowScore), 0, 100),
      rhymeHits,
      rhymeWords,
      internalPairs,
      uniqueRatio,
      density,
    };
  }

  // ---------- BEAT: coverage + timing tightness + consistency ----------
  function scoreBeat(audioData) {
    const { onsets, energySamples, beatGrid, bpm } = audioData;
    if (!energySamples || energySamples.length === 0) {
      return { score: 0, coverage: 0, tightness: 0, consistency: 0 };
    }

    // coverage: fraction of the time you were actually spitting
    const speaking = energySamples.filter((s) => s.level > 0.05).length;
    const coverage = clamp(speaking / energySamples.length, 0, 1);

    // timing: how close onsets sit to the 8th-note grid
    const grid = beatGrid && beatGrid.length ? beatGrid : [];
    const beatDur = 60 / (bpm || 88);
    const eighth = beatDur / 2;
    let tight = 0;
    if (onsets.length && grid.length) {
      let acc = 0;
      onsets.forEach((t) => {
        let best = Infinity;
        for (let i = 0; i < grid.length; i++) {
          const d = Math.abs(grid[i] - t);
          if (d < best) best = d;
          if (grid[i] > t + eighth) break;
        }
        acc += 1 - clamp(best / (eighth / 2), 0, 1);
      });
      tight = acc / onsets.length;
    }

    // consistency: steadiness of the gaps between onsets
    let consistency = 0;
    if (onsets.length >= 4) {
      const gaps = [];
      for (let i = 1; i < onsets.length; i++) gaps.push(onsets[i] - onsets[i - 1]);
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const variance = gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
      consistency = clamp(1 - cv, 0, 1);
    }

    const score = Math.round(coverage * 45 + tight * 35 + consistency * 20);
    return { score: clamp(score, 0, 100), coverage, tightness: tight, consistency };
  }

  // ---------- rank + crowd quip ----------
  function rankFor(overall) {
    if (overall >= 90) return { name: 'LEGENDARY', emoji: '👑', tier: 'legend' };
    if (overall >= 78) return { name: 'FIRE MC', emoji: '🔥', tier: 'fire' };
    if (overall >= 62) return { name: 'SOLID SPITTER', emoji: '🎤', tier: 'good' };
    if (overall >= 45) return { name: 'UP & COMER', emoji: '⚡', tier: 'ok' };
    if (overall >= 25) return { name: 'ROOKIE', emoji: '🌱', tier: 'rookie' };
    return { name: 'STAGE FRIGHT', emoji: '😬', tier: 'low' };
  }

  function quipFor(overall, parts) {
    const lines = {
      legend: ['The crowd lost their minds. Hall of fame bar! 👑', 'Mic drop. Nobody is following that.'],
      fire: ['Crowd is on their feet — that was heat! 🔥', 'You set the booth on fire with that one.'],
      good: ['Solid set! The crowd is bobbing their heads.', 'Clean bars — you held the stage.'],
      ok: ['Not bad! Tighten the rhymes and you got next.', "There's potential — keep grinding."],
      rookie: ['Rough around the edges, but you stepped up.', 'Everybody starts somewhere. Run it back!'],
      low: ['The beat ran away with that one... try again! 😅', 'Shake off the nerves and grab the mic again.'],
    };
    const tier = rankFor(overall).tier;
    const pool = lines[tier];
    let q = pool[Math.floor(Math.random() * pool.length)];
    if (parts && parts.lyrical && parts.lyrical.rhymeHits >= 2) {
      q += ` (${parts.lyrical.rhymeHits} punchline rhymes landed!)`;
    }
    return q;
  }

  function evaluate(input) {
    const { round, transcript, audioData } = input;
    const said = words(transcript);

    const accuracy = scoreAccuracy(round, said);
    const lyrical = scoreLyrical(round, said);
    const beat = scoreBeat(audioData || {});

    const overall = Math.round(
      0.3 * accuracy.score + 0.3 * beat.score + 0.4 * lyrical.score
    );
    const rank = rankFor(overall);

    return {
      accuracy: accuracy.score,
      beat: beat.score,
      lyrical: lyrical.score,
      overall,
      rank,
      quip: quipFor(overall, { accuracy, lyrical, beat }),
      details: { accuracy, lyrical, beat },
      wordCount: said.length,
    };
  }

  RB.score = { evaluate, rhymes, rhymeKey };
})(window);
