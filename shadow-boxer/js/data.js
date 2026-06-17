/* data.js — static content for Shadow Boxer Ultimate:
   boxing STYLES (gameplay modifiers), cosmetic GLOVES / KO effects / ARENAS,
   the QUEST board, belt RANKS and the bot roster for matchmaking.
   Everything cosmetic is unlocked with SPIN. Exposes SB.data. */
(function (global) {
  const SB = (global.SB = global.SB || {});

  // ---- Boxing styles: bought with spin, one equipped at a time. ----
  // mods tune the fight feel. window = how long a target stays hittable
  // (×base), power = damage dealt ×, defWindow = how long you get to defend,
  // counter = bonus damage after a clean block/slip, guard = incoming dmg ×.
  const STYLES = [
    { id: 'orthodox', name: 'Orthodox',        emoji: '🥊', cost: 0,
      blurb: 'The classic stance. Balanced everything — a clean place to learn.',
      mods: { window: 1.0, power: 1.0, defWindow: 1.0, counter: 1.0, guard: 1.0, combo: 1.0 } },
    { id: 'swarmer', name: 'Swarmer',          emoji: '🐝', cost: 350,
      blurb: 'In your face, nonstop pressure. Combos build faster, defense is tighter.',
      mods: { window: 0.92, power: 0.95, defWindow: 0.85, counter: 1.0, guard: 1.05, combo: 1.35 } },
    { id: 'outboxer', name: 'Out-Boxer',       emoji: '📏', cost: 350,
      blurb: 'Long range, all patience. Targets linger so you can pick your shots.',
      mods: { window: 1.3, power: 1.0, defWindow: 1.25, counter: 1.05, guard: 0.95, combo: 0.95 } },
    { id: 'slugger', name: 'Slugger',          emoji: '💥', cost: 600,
      blurb: 'One-punch power. Huge damage, but your guard leaks — keep it tight.',
      mods: { window: 1.0, power: 1.45, defWindow: 0.9, counter: 1.1, guard: 1.25, combo: 0.9 } },
    { id: 'counter', name: 'Counter-Puncher',  emoji: '🎯', cost: 600,
      blurb: 'Make them miss, make them pay. Clean slips/blocks unleash big counters.',
      mods: { window: 1.0, power: 0.95, defWindow: 1.1, counter: 1.9, guard: 0.85, combo: 1.05 } },
    { id: 'southpaw', name: 'Southpaw Phenom', emoji: '🌀', cost: 800,
      blurb: 'Everything mirrored, awkward as hell for opponents. Fast and slippery.',
      mods: { window: 1.05, power: 1.1, defWindow: 1.05, counter: 1.2, guard: 0.9, combo: 1.15 },
      mirror: true },
  ];

  // ---- Glove filters (cosmetic): colours the on-screen gloves + hit sparks. ----
  // a/b drive a canvas gradient; glow is the bloom colour.
  const GLOVES = [
    { id: 'classic',  name: 'Classic Red',   cost: 0,    a: '#ff4d2e', b: '#a4160a', glow: '#ff7a4d' },
    { id: 'midnight', name: 'Midnight Blue', cost: 150,  a: '#3a7bff', b: '#10245f', glow: '#6fb0ff' },
    { id: 'venom',    name: 'Venom Green',   cost: 200,  a: '#9dff3a', b: '#1f7a16', glow: '#caff7a' },
    { id: 'gold',     name: 'Champion Gold', cost: 450,  a: '#ffd23a', b: '#b8860b', glow: '#fff0a8' },
    { id: 'neon',     name: 'Neon Pink',     cost: 450,  a: '#ff3ea5', b: '#7a1054', glow: '#ff9ad4' },
    { id: 'galaxy',   name: 'Galaxy',        cost: 700,  a: '#b06bff', b: '#221a5e', glow: '#e0c2ff', shimmer: true },
    { id: 'inferno',  name: 'Inferno',       cost: 800,  a: '#ff7a00', b: '#8a0f0f', glow: '#ffd27a', shimmer: true },
    { id: 'frost',    name: 'Frostbite',     cost: 800,  a: '#7af0ff', b: '#0d4f6e', glow: '#d2fbff', shimmer: true },
  ];

  // ---- KO ("kill") effects: the finisher splash when you drop an opponent. ----
  const KOFX = [
    { id: 'flash',     name: 'White Flash',   cost: 0,    kind: 'flash',     color: '#ffffff' },
    { id: 'stars',     name: 'Star Burst',    cost: 200,  kind: 'stars',     color: '#ffd23a' },
    { id: 'lightning', name: 'Lightning',     cost: 400,  kind: 'lightning', color: '#9fdcff' },
    { id: 'inferno',   name: 'Inferno KO',    cost: 500,  kind: 'inferno',   color: '#ff7a2e' },
    { id: 'confetti',  name: 'Confetti Drop', cost: 500,  kind: 'confetti',  color: '#ff3ea5' },
    { id: 'glitch',    name: 'Glitch Out',    cost: 750,  kind: 'glitch',    color: '#3affd2' },
  ];

  // ---- Arenas (cosmetic backdrop + UI accent): "and more". ----
  const ARENAS = [
    { id: 'gym',     name: 'The Gym',        cost: 0,    accent: '#ff4d2e', bg: 'radial-gradient(120% 90% at 50% -10%, #2a1c1c, #0b0b0e 60%)' },
    { id: 'vegas',   name: 'Vegas Lights',   cost: 300,  accent: '#ffd23a', bg: 'radial-gradient(120% 90% at 50% -10%, #2a2410, #0c0a06 60%)' },
    { id: 'rooftop', name: 'Neon Rooftop',   cost: 400,  accent: '#3affd2', bg: 'radial-gradient(120% 90% at 50% -10%, #102628, #06090b 60%)' },
    { id: 'arena',   name: 'Title Arena',    cost: 600,  accent: '#b06bff', bg: 'radial-gradient(120% 90% at 50% -10%, #1d1633, #07060d 60%)' },
  ];

  // ---- Belt ranks: prestige earned from total wins. ----
  const RANKS = [
    { wins: 0,  name: 'Amateur',     belt: '🥋' },
    { wins: 3,  name: 'Prospect',    belt: '🎽' },
    { wins: 8,  name: 'Contender',   belt: '🥊' },
    { wins: 15, name: 'Ranked #1',   belt: '🏅' },
    { wins: 25, name: 'Champion',    belt: '🏆' },
    { wins: 40, name: 'Undisputed',  belt: '👑' },
    { wins: 60, name: 'Hall of Fame',belt: '🌟' },
  ];

  function rankFor(wins) {
    let r = RANKS[0];
    for (const x of RANKS) if (wins >= x.wins) r = x;
    return r;
  }
  function nextRank(wins) {
    return RANKS.find((x) => x.wins > wins) || null;
  }

  // ---- Bot roster for "Quick Fight" matchmaking. ----
  const BOTS = [
    { tag: 'IronMike88',    style: 'slugger',  accent: '#ff4d2e', taunt: 'Everybody got a plan til I land one.' },
    { tag: 'GhostJab',      style: 'outboxer', accent: '#7af0ff', taunt: 'You can\'t hit what you can\'t catch.' },
    { tag: 'BeeStingKid',   style: 'swarmer',  accent: '#9dff3a', taunt: 'I don\'t stop. I don\'t blink.' },
    { tag: 'CounterClock',  style: 'counter',  accent: '#b06bff', taunt: 'Throw it. I dare you.' },
    { tag: 'SouthpawSaint', style: 'southpaw', accent: '#ff3ea5', taunt: 'Wrong-handed, right every time.' },
    { tag: 'DociShadow',    style: 'orthodox', accent: '#ffd23a', taunt: 'Textbook. And you\'re the lesson.' },
    { tag: 'CrazyHorse_TH', style: 'swarmer',  accent: '#ff7a2e', taunt: 'Muay style pressure, baby.' },
    { tag: 'GloveStorm',    style: 'slugger',  accent: '#3a7bff', taunt: 'Storm\'s rolling in.' },
  ];

  // ---- Quest board. metric maps to engine events; daily ones reset each day. ----
  const QUESTS = [
    { id: 'jabs',     name: 'Hands Up',      desc: 'Land 40 punches',            metric: 'punch',  goal: 40,  reward: 60,  daily: true },
    { id: 'combo',    name: 'Combo Artist',  desc: 'Hit a 12× combo',            metric: 'combo',  goal: 12,  reward: 80,  daily: true },
    { id: 'block',    name: 'Brick Wall',    desc: 'Make 8 clean blocks',        metric: 'block',  goal: 8,   reward: 70,  daily: true },
    { id: 'slip',     name: 'Smoke',         desc: 'Slip 6 incoming shots',      metric: 'slip',   goal: 6,   reward: 70,  daily: true },
    { id: 'win',      name: 'Get the W',     desc: 'Win a fight',                metric: 'win',    goal: 1,   reward: 120, daily: true },
    { id: 'ko',       name: 'Lights Out',    desc: 'Win a fight by KO',          metric: 'ko',     goal: 1,   reward: 150, daily: false },
    { id: 'damage',   name: 'Heavy Hands',   desc: 'Deal 1500 total damage',     metric: 'damage', goal: 1500,reward: 100, daily: false },
    { id: 'train',    name: 'Roadwork',      desc: 'Finish 3 training rounds',   metric: 'train',  goal: 3,   reward: 90,  daily: false },
  ];

  const byId = (list, id) => list.find((x) => x.id === id) || list[0];

  SB.data = {
    STYLES, GLOVES, KOFX, ARENAS, RANKS, BOTS, QUESTS,
    byId,
    style:  (id) => byId(STYLES, id),
    glove:  (id) => byId(GLOVES, id),
    kofx:   (id) => byId(KOFX, id),
    arena:  (id) => byId(ARENAS, id),
    rankFor, nextRank,
    // category -> list, used by the shop + store defaults
    catalog: { styles: STYLES, gloves: GLOVES, kofx: KOFX, arenas: ARENAS },
  };
})(window);
