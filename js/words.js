/* words.js — themed word banks + punchline rhyme families for Rap Battle.
   Exposes RB.words.makeRound() which builds the 4-block challenge. */
(function (global) {
  const RB = (global.RB = global.RB || {});

  // Seed words grouped by vibe. Blocks 1-3 pull from one theme so the
  // bars feel connected.
  const THEMES = {
    STREET: ['concrete', 'corner', 'hustle', 'shadow', 'sirens', 'pavement',
             'rooftop', 'alley', 'graffiti', 'midnight', 'block', 'grind'],
    MONEY:  ['stacks', 'diamonds', 'platinum', 'vault', 'profit', 'ballin',
             'invoice', 'currency', 'jackpot', 'royalty', 'bankroll', 'gold'],
    SPACE:  ['gravity', 'comet', 'nebula', 'orbit', 'rocket', 'cosmos',
             'asteroid', 'galaxy', 'lunar', 'stardust', 'voyage', 'meteor'],
    KITCHEN:['simmer', 'pepper', 'sizzle', 'recipe', 'platter', 'flavor',
             'butter', 'skillet', 'garnish', 'spice', 'gourmet', 'feast'],
    TECH:   ['circuit', 'pixel', 'upload', 'glitch', 'firewall', 'binary',
             'bandwidth', 'reboot', 'cyber', 'server', 'matrix', 'signal'],
    OCEAN:  ['current', 'riptide', 'coral', 'anchor', 'voyage', 'harbor',
             'tsunami', 'driftwood', 'shoreline', 'tidal', 'depths', 'sailor'],
    JUNGLE: ['canopy', 'panther', 'venom', 'thunder', 'rumble', 'predator',
             'wildfire', 'tribal', 'instinct', 'savage', 'roar', 'untamed'],
  };

  // Punchline words. Each carries a rhyme family so the scorer can reward
  // end-rhymes generously and hint the player toward landing words.
  const PUNCHLINES = [
    { word: 'fire',   rhymes: ['liar', 'higher', 'desire', 'wire', 'tire', 'flyer', 'buyer', 'entire', 'inspire', 'empire', 'choir'] },
    { word: 'flow',   rhymes: ['glow', 'pro', 'show', 'know', 'grow', 'below', 'tempo', 'solo', 'echo', 'plateau', 'overflow'] },
    { word: 'crown',  rhymes: ['down', 'town', 'sound', 'ground', 'around', 'renown', 'profound', 'clown', 'frown', 'breakdown'] },
    { word: 'light',  rhymes: ['night', 'tight', 'fight', 'sight', 'bright', 'flight', 'height', 'ignite', 'spotlight', 'rewrite', 'dynamite'] },
    { word: 'beast',  rhymes: ['least', 'feast', 'east', 'released', 'increased', 'priest', 'masterpiece', 'unleashed', 'deceased'] },
    { word: 'time',   rhymes: ['rhyme', 'climb', 'prime', 'crime', 'sublime', 'lime', 'mime', 'dime', 'overtime', 'lifetime', 'paradigm'] },
    { word: 'game',   rhymes: ['flame', 'name', 'fame', 'aim', 'frame', 'claim', 'tame', 'hall of fame', 'acclaim', 'untamed'] },
    { word: 'space',  rhymes: ['pace', 'race', 'face', 'grace', 'chase', 'base', 'erase', 'embrace', 'staircase', 'replace', 'briefcase'] },
    { word: 'gold',   rhymes: ['bold', 'cold', 'hold', 'told', 'sold', 'fold', 'bankroll', 'controlled', 'stronghold', 'behold'] },
    { word: 'mind',   rhymes: ['grind', 'find', 'signed', 'designed', 'rewind', 'behind', 'aligned', 'mankind', 'defined', 'unwind'] },
    { word: 'storm',  rhymes: ['form', 'warm', 'swarm', 'norm', 'transform', 'platform', 'reform', 'uniform', 'perform'] },
    { word: 'stage',  rhymes: ['rage', 'page', 'cage', 'wage', 'gauge', 'engage', 'outrage', 'rampage', 'center stage', 'turn the page'] },
  ];

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

  // Build one round: 3 seed blocks (2 words each) + 1 punchline block.
  function makeRound() {
    const themeNames = Object.keys(THEMES);
    const theme = one(themeNames);
    const seeds = pick(THEMES[theme], 6);
    const punch = one(PUNCHLINES);

    const blocks = [
      { label: 'BAR 1', type: 'seed', words: [seeds[0], seeds[1]] },
      { label: 'BAR 2', type: 'seed', words: [seeds[2], seeds[3]] },
      { label: 'BAR 3', type: 'seed', words: [seeds[4], seeds[5]] },
      { label: 'PUNCHLINE', type: 'punch', words: [punch.word] },
    ];

    return {
      theme,
      blocks,
      seeds,
      punchWord: punch.word,
      rhymeFamily: punch.rhymes,
    };
  }

  RB.words = { makeRound, THEMES, PUNCHLINES };
})(window);
