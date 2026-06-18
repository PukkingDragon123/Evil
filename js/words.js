/* words.js — word banks, difficulty tiers, round building.
   A "round" is a timeline of BARS that scroll past the player. Most bars are
   FREE (freestyle); some carry a required word; the last bar is the PUNCHLINE
   you must rhyme with. Exposes RB.words. */
(function (global) {
  const RB = (global.RB = global.RB || {});

  // Themes mix real rap slang with random/funny words so freestyles get loose.
  const THEMES = {
    STREET: ['concrete', 'corner', 'hustle', 'block', 'sirens', 'pavement', 'rooftop', 'alley', 'graffiti', 'midnight', 'grind', 'curb'],
    DRIP:   ['designer', 'rolex', 'sauce', 'gucci', 'bling', 'swagger', 'fresh', 'chains', 'icy', 'custom', 'drip', 'fendi'],
    HOOD:   ['homie', 'squad', 'trap', 'plug', 'lowkey', 'gang', 'realone', 'dap', 'cookout', 'stoop', 'project', 'cousin'],
    FLEX:   ['goat', 'undefeated', 'legend', 'champion', 'trophy', 'elite', 'boss', 'mogul', 'kingpin', 'prime', 'crown', 'flex'],
    MONEY:  ['stacks', 'guap', 'cheddar', 'profit', 'bankroll', 'jackpot', 'invoice', 'currency', 'royalty', 'budget', 'rent', 'bag'],
    RANDOM: ['spaghetti', 'guacamole', 'pelican', 'wifi', 'microwave', 'avocado', 'llama', 'pickle', 'goblin', 'waffle', 'noodle', 'banana'],
    SLANG:  ['cap', 'sheesh', 'vibe', 'clout', 'bussin', 'goated', 'rizz', 'sus', 'mood', 'slaps', 'lowkey', 'gas'],
    SPACE:  ['gravity', 'comet', 'rocket', 'cosmos', 'asteroid', 'galaxy', 'lunar', 'stardust', 'meteor', 'orbit', 'alien', 'ufo'],
    KITCHEN:['simmer', 'pepper', 'sizzle', 'recipe', 'platter', 'flavor', 'butter', 'skillet', 'spice', 'gourmet', 'leftovers', 'ramen'],
  };

  const PUNCHLINES = [
    { word: 'fire',   rhymes: ['liar', 'higher', 'desire', 'wire', 'tire', 'flyer', 'buyer', 'entire', 'inspire', 'empire', 'choir'] },
    { word: 'flow',   rhymes: ['glow', 'pro', 'show', 'know', 'grow', 'below', 'tempo', 'solo', 'echo', 'dough', 'overflow'] },
    { word: 'crown',  rhymes: ['down', 'town', 'sound', 'ground', 'around', 'renown', 'profound', 'clown', 'frown', 'breakdown'] },
    { word: 'light',  rhymes: ['night', 'tight', 'fight', 'sight', 'bright', 'flight', 'height', 'ignite', 'spotlight', 'rewrite', 'dynamite'] },
    { word: 'beast',  rhymes: ['least', 'feast', 'east', 'released', 'increased', 'priest', 'masterpiece', 'unleashed', 'deceased'] },
    { word: 'time',   rhymes: ['rhyme', 'climb', 'prime', 'crime', 'sublime', 'lime', 'mime', 'dime', 'overtime', 'lifetime', 'paradigm'] },
    { word: 'game',   rhymes: ['flame', 'name', 'fame', 'aim', 'frame', 'claim', 'tame', 'acclaim', 'reclaim', 'inflame'] },
    { word: 'goat',   rhymes: ['boat', 'float', 'quote', 'wrote', 'coat', 'note', 'remote', 'throat', 'vote', 'devote', 'anecdote'] },
    { word: 'cheese', rhymes: ['keys', 'please', 'ease', 'freeze', 'breeze', 'squeeze', 'degrees', 'knees', 'seas', 'expertise', 'wheeze'] },
    { word: 'broke',  rhymes: ['woke', 'smoke', 'spoke', 'joke', 'choke', 'provoke', 'cloak', 'folk', 'soak', 'stroke'] },
    { word: 'drip',   rhymes: ['grip', 'flip', 'trip', 'whip', 'slip', 'tip', 'clip', 'equip', 'ship', 'lip', 'spaceship'] },
    { word: 'sauce',  rhymes: ['boss', 'toss', 'loss', 'across', 'floss', 'gloss', 'because', 'applause', 'cost', 'lost'] },
    { word: 'beef',   rhymes: ['chief', 'grief', 'belief', 'relief', 'brief', 'thief', 'leaf', 'reef', 'motif', 'mischief'] },
    { word: 'fly',    rhymes: ['high', 'sky', 'why', 'guy', 'rely', 'supply', 'july', 'butterfly', 'alibi', 'multiply', 'apply'] },
    { word: 'gold',   rhymes: ['bold', 'cold', 'hold', 'told', 'sold', 'fold', 'controlled', 'stronghold', 'behold', 'uncontrolled'] },
    { word: 'mind',   rhymes: ['grind', 'find', 'signed', 'designed', 'rewind', 'behind', 'aligned', 'mankind', 'defined', 'unwind'] },
  ];

  // Decorative ad-libs the UI can spray on screen.
  const ADLIBS = ['SKRRT', 'BRRR', 'YEAH', 'UH', 'AYE', 'SHEESH', "LET'S GO", 'WOO', 'GANG', 'OKAY', 'GRRA', 'YERR'];

  const DIFFICULTY = {
    easy:   { key: 'easy',   label: 'EASY',   bpm: 76,  bars: 4, req: 2, rhymeNeed: 1, lenient: 1.18, blurb: 'slow beat · 2 words' },
    normal: { key: 'normal', label: 'NORMAL', bpm: 90,  bars: 5, req: 3, rhymeNeed: 2, lenient: 1.0,  blurb: 'steady · 3 words' },
    hard:   { key: 'hard',   label: 'HARD',   bpm: 106, bars: 7, req: 5, rhymeNeed: 3, lenient: 0.85, blurb: 'fast · 5 words' },
  };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const pick = (arr, n) => shuffle(arr).slice(0, n);
  const one = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function buildBars(n, seeds, punchWord) {
    const bars = Array.from({ length: n }, (_, i) => ({ index: i, type: 'free', word: null }));
    bars[n - 1] = { index: n - 1, type: 'punch', word: punchWord };
    const slots = shuffle([...Array(n - 1).keys()]).slice(0, seeds.length).sort((a, b) => a - b);
    slots.forEach((slot, i) => { bars[slot] = { index: slot, type: 'seed', word: seeds[i] }; });
    return bars;
  }

  function makeRound(diffKey) {
    const diff = DIFFICULTY[diffKey] || DIFFICULTY.normal;
    const theme = one(Object.keys(THEMES));
    const reqCount = Math.min(diff.req, diff.bars - 1);
    const seeds = pick(THEMES[theme], reqCount);
    const punch = one(PUNCHLINES);
    return {
      mode: 'std', difficulty: diff.key, diff, theme,
      bars: buildBars(diff.bars, seeds, punch.word),
      seeds, punchWord: punch.word, rhymeFamily: punch.rhymes,
    };
  }

  function makeCustomRound(wordList, diffKey) {
    const diff = DIFFICULTY[diffKey] || DIFFICULTY.normal;
    const words = (wordList || []).map((w) => String(w).trim()).filter(Boolean);
    const punchWord = words[words.length - 1] || 'fire';
    const seeds = words.slice(0, -1);
    const bars = [{ index: 0, type: 'free', word: null }];
    seeds.forEach((w) => bars.push({ index: bars.length, type: 'seed', word: w }));
    bars.push({ index: bars.length, type: 'punch', word: punchWord });
    return {
      mode: 'custom', difficulty: diff.key, diff, theme: 'CUSTOM',
      bars, seeds, punchWord, rhymeFamily: [],
    };
  }

  RB.words = { makeRound, makeCustomRound, DIFFICULTY, THEMES, PUNCHLINES, ADLIBS };
})(window);
