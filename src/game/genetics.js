// =============================================================================
// Genetics — the breeding brain of the game.
//
// A fish carries a GENOME: a bag of genes, each a float in [0,1]. The genome is
// expressed into a PHENOTYPE (visible colours, pattern, fins, size, lustre...).
// Breeding mixes two genomes with mutation. The phenotype is then classified
// into a named koi SUBSPECIES, and scored for quality / value / income.
//
// This module is pure logic (no DOM, no Three.js) so it can be unit tested.
// =============================================================================

import { CONFIG, QUALITY_WEIGHTS } from '../config.js';

// All genes, every fish has exactly these. Order is stable for save files.
export const GENE_KEYS = [
  'baseHue', 'baseSat', 'baseLight',   // body colour (HSL, 0..1 each)
  'patchHue', 'patchSat', 'patchLight',// patch colour (HSL)
  'pattern',                           // structural pattern (continuous -> category)
  'fin',                               // fin style (continuous -> category)
  'sumi',                              // amount of black "sumi" markings
  'size',                              // body size
  'luster',                            // metallic sheen
  'metabolism',                        // income & activity
  'fertility',                         // offspring count / breeding speed
  'vigor',                             // robustness / overall fitness
];

// Hue-type genes wrap around the colour wheel; treated circularly when mixing.
const HUE_GENES = new Set(['baseHue', 'patchHue']);

// --- Pattern & fin tables (threshold -> category, with a rarity multiplier) --
export const PATTERNS = [
  { id: 'Solid',   t: 0.00, rarity: 1.0 },
  { id: 'Capped',  t: 0.16, rarity: 1.6 },
  { id: 'Banded',  t: 0.32, rarity: 1.4 },
  { id: 'Spotted', t: 0.50, rarity: 1.8 },
  { id: 'Netted',  t: 0.70, rarity: 2.6 },
  { id: 'Dragon',  t: 0.86, rarity: 3.0 },
];
const PATTERN_RARITY_MAX = 3.0;

export const FINS = [
  { id: 'Standard', t: 0.00, rarity: 1.0 },
  { id: 'Fan',      t: 0.45, rarity: 1.3 },
  { id: 'Long',     t: 0.72, rarity: 2.0 },
  { id: 'Veil',     t: 0.90, rarity: 3.0 },
];
const FIN_RARITY_MAX = 3.0;

// =============================================================================
// Small math helpers
// =============================================================================
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a, b, t) => a + (b - a) * t;

// Box–Muller-ish gaussian noise from a uniform rng.
function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Circular mean of two values in [0,1] interpreted as angles (for hues).
function circMean(a, b) {
  const ang = (x) => x * Math.PI * 2;
  const x = Math.cos(ang(a)) + Math.cos(ang(b));
  const y = Math.sin(ang(a)) + Math.sin(ang(b));
  let m = Math.atan2(y, x) / (Math.PI * 2);
  if (m < 0) m += 1;
  return m;
}

function pickCategory(table, geneValue) {
  let chosen = table[0];
  for (const row of table) if (geneValue >= row.t) chosen = row;
  return chosen;
}

// =============================================================================
// Genome construction
// =============================================================================

// Normalise an arbitrary object into a complete, clamped genome.
export function makeGenome(partial = {}) {
  const g = {};
  for (const k of GENE_KEYS) {
    g[k] = clamp01(typeof partial[k] === 'number' ? partial[k] : 0.5);
  }
  return g;
}

// A plain, common pond fish: muted colours, simple pattern, modest stats.
export function randomCommonGenome(rng = Math.random) {
  return makeGenome({
    baseHue: rng() < 0.5 ? lerp(0.02, 0.12, rng()) : lerp(0.5, 0.62, rng()),
    baseSat: lerp(0.15, 0.55, rng()),
    baseLight: lerp(0.45, 0.85, rng()),
    patchHue: lerp(0.0, 0.08, rng()),
    patchSat: lerp(0.4, 0.8, rng()),
    patchLight: lerp(0.4, 0.6, rng()),
    pattern: rng() * 0.5,           // Solid / Capped / Banded
    fin: rng() * 0.5,              // Standard / Fan
    sumi: rng() * 0.35,
    size: lerp(0.25, 0.55, rng()),
    luster: rng() * 0.35,
    metabolism: lerp(0.3, 0.6, rng()),
    fertility: lerp(0.3, 0.65, rng()),
    vigor: lerp(0.3, 0.6, rng()),
  });
}

// A wilder, fully random genome — used for rare stock and the opening pond.
export function randomWildGenome(rng = Math.random) {
  const g = {};
  for (const k of GENE_KEYS) g[k] = rng();
  // Keep sizes from being uniformly huge.
  g.size = Math.pow(rng(), 1.5);
  return makeGenome(g);
}

// =============================================================================
// Breeding
// =============================================================================
export function breed(momGenome, dadGenome, rng = Math.random, cfg = CONFIG) {
  const child = {};
  for (const k of GENE_KEYS) {
    // Blend parents (circularly for hues), with a little random lean.
    const lean = 0.35 + rng() * 0.3; // 0.35..0.65 toward mom
    let v = HUE_GENES.has(k)
      ? circMean(momGenome[k], dadGenome[k])
      : momGenome[k] * lean + dadGenome[k] * (1 - lean);

    // Standard small mutation.
    if (rng() < cfg.mutationRate) v += gauss(rng) * cfg.mutationSigma;
    // Rare large "sport" mutation — how brand-new traits appear.
    if (rng() < cfg.bigMutationRate) v += gauss(rng) * cfg.bigMutationSigma;

    child[k] = HUE_GENES.has(k) ? ((v % 1) + 1) % 1 : clamp01(v);
  }
  return makeGenome(child);
}

// How many offspring a pairing yields (higher combined fertility -> more).
export function offspringCount(momGenome, dadGenome, rng = Math.random, cfg = CONFIG) {
  const fert = (momGenome.fertility + dadGenome.fertility) / 2;
  let n = cfg.minOffspring;
  const extra = cfg.maxOffspring - cfg.minOffspring;
  for (let i = 0; i < extra; i++) if (rng() < 0.35 + fert * 0.5) n++;
  return n;
}

// =============================================================================
// Phenotype — turning genes into something visible
// =============================================================================
function hsl(hGene, sGene, lGene) {
  return {
    h: Math.round(hGene * 360),
    s: Math.round(lerp(8, 96, sGene)),
    l: Math.round(lerp(8, 94, lGene)),
  };
}

export function phenotypeOf(genome, cfg = CONFIG) {
  const base = hsl(genome.baseHue, genome.baseSat, genome.baseLight);
  const patch = hsl(genome.patchHue, genome.patchSat, genome.patchLight);
  const pattern = pickCategory(PATTERNS, genome.pattern);
  const fin = pickCategory(FINS, genome.fin);
  const sumiLevel = genome.sumi;
  return {
    base,
    patch,
    accent: { h: (base.h + 8) % 360, s: 18, l: Math.round(lerp(4, 14, 1 - genome.vigor)) }, // near-black sumi
    pattern: pattern.id,
    patternRarity: (pattern.rarity - 1) / (PATTERN_RARITY_MAX - 1),
    fin: fin.id,
    finRarity: (fin.rarity - 1) / (FIN_RARITY_MAX - 1),
    hasSumi: sumiLevel > 0.5,
    sumiLevel,
    size: lerp(cfg.sizeMin, cfg.sizeMax, genome.size),
    sizeNorm: genome.size,
    luster: genome.luster,
    metabolism: genome.metabolism,
    fertility: genome.fertility,
    vigor: genome.vigor,
  };
}

// =============================================================================
// Subspecies classification
//
// Predicates are evaluated top-to-bottom; the FIRST match wins, so list the
// most specific / rarest varieties first. Each carries a real koi name, the
// Japanese reading, a flavour line, and a value multiplier (rarity).
// =============================================================================
export const SUBSPECIES = [
  {
    id: 'butterfly', name: 'Hire-naga', jp: '鰭長 (Butterfly)', rarity: 5.0,
    desc: 'Impossibly long, flowing veil fins that trail like silk ribbons.',
    match: (p) => p.fin === 'Veil',
  },
  {
    id: 'platinum', name: 'Platinum Ogon', jp: 'プラチナ', rarity: 3.6,
    desc: 'A single, flawless sheet of metallic white. Pure moonlight.',
    match: (p) => p.luster > 0.7 && p.pattern === 'Solid' && p.base.l > 80 && p.base.s < 22,
  },
  {
    id: 'kumonryu', name: 'Kumonryu', jp: '九紋竜', rarity: 4.2,
    desc: 'The "nine-tattooed dragon" — shifting sumi on a pale sky.',
    match: (p) => p.pattern === 'Dragon' && p.hasSumi && p.base.l > 55,
  },
  {
    id: 'tancho', name: 'Tancho', jp: '丹頂', rarity: 4.0,
    desc: 'One perfect crimson sun upon a snow-white body. The flag of Japan.',
    match: (p) => p.pattern === 'Capped' && isWhite(p.base) && isRed(p.patch) && !p.hasSumi,
  },
  {
    id: 'ogon', name: 'Ogon', jp: '黄金', rarity: 2.8,
    desc: 'Solid metallic gold that catches every ripple of light.',
    match: (p) => p.luster > 0.7 && p.pattern === 'Solid',
  },
  {
    id: 'asagi', name: 'Asagi', jp: '浅黄', rarity: 3.0,
    desc: 'A net of pale indigo scales — the oldest koi lineage of all.',
    match: (p) => p.pattern === 'Netted' && isBlue(p.base),
  },
  {
    id: 'karasu', name: 'Karasu', jp: '烏 (Crow)', rarity: 3.2,
    desc: 'Black as a moonless pond. Mysterious and prized.',
    match: (p) => p.base.l < 18 && p.pattern === 'Solid' && p.luster < 0.6,
  },
  {
    id: 'showa', name: 'Showa Sanshoku', jp: '昭和三色', rarity: 3.6,
    desc: 'Bold red and white striking across a body of deep black sumi.',
    match: (p) => p.hasSumi && p.base.l < 46 && isRed(p.patch) &&
      ['Spotted', 'Banded', 'Dragon'].includes(p.pattern),
  },
  {
    id: 'sanke', name: 'Taisho Sanke', jp: '大正三色', rarity: 3.2,
    desc: 'White, red and a scatter of crisp black flecks. Classic elegance.',
    match: (p) => isWhite(p.base) && isRed(p.patch) && p.hasSumi &&
      ['Spotted', 'Banded'].includes(p.pattern),
  },
  {
    id: 'goshiki', name: 'Goshiki', jp: '五色', rarity: 2.8,
    desc: 'The "five colour" koi — a shifting tapestry of netted hues.',
    match: (p) => p.pattern === 'Netted' && p.hasSumi,
  },
  {
    id: 'kohaku', name: 'Kohaku', jp: '紅白', rarity: 2.4,
    desc: 'Red on white — the koi every breeder begins and ends their life chasing.',
    match: (p) => isWhite(p.base) && isRed(p.patch) && !p.hasSumi &&
      ['Capped', 'Banded', 'Spotted'].includes(p.pattern),
  },
  {
    id: 'bekko', name: 'Bekko', jp: '別甲', rarity: 2.2,
    desc: 'Tortoise-shell sumi spots on a single clean ground colour.',
    match: (p) => p.hasSumi && p.pattern === 'Spotted' && !isRed(p.patch),
  },
  {
    id: 'yamabuki', name: 'Yamabuki Ogon', jp: '山吹黄金', rarity: 2.0,
    desc: 'Soft metallic butter-gold. Calm and luminous.',
    match: (p) => p.luster > 0.5 && p.base.h >= 38 && p.base.h <= 70,
  },
  // Common fallback — always matches.
  {
    id: 'pond', name: 'Pond Koi', jp: '錦鯉', rarity: 1.0,
    desc: 'A humble, healthy koi. Every great line started here.',
    match: () => true,
  },
];

function isWhite(c) { return c.l > 76 && c.s < 26; }
function isRed(c) { return (c.h <= 22 || c.h >= 338) && c.s > 45 && c.l > 28 && c.l < 72; }
function isBlue(c) { return c.h >= 195 && c.h <= 245 && c.l < 62; }

export function classify(phenotype) {
  for (const sp of SUBSPECIES) if (sp.match(phenotype)) return sp;
  return SUBSPECIES[SUBSPECIES.length - 1];
}

// =============================================================================
// Scoring — quality, stars, value, income
// =============================================================================
export function qualityOf(phenotype) {
  const w = QUALITY_WEIGHTS;
  const q =
    w.size * phenotype.sizeNorm +
    w.luster * phenotype.luster +
    w.patternRarity * phenotype.patternRarity +
    w.finRarity * phenotype.finRarity +
    w.vigor * phenotype.vigor +
    w.fertility * phenotype.fertility;
  return clamp01(q);
}

// 1..5 stars combining intrinsic quality and subspecies rarity.
export function starsOf(phenotype, subspecies) {
  const rarityNorm = clamp01((subspecies.rarity - 1) / 4); // 1..5 -> 0..1
  const combined = qualityOf(phenotype) * 0.62 + rarityNorm * 0.38;
  return Math.max(1, Math.min(5, Math.round(1 + combined * 4)));
}

// Coins gained from selling / releasing this fish.
export function valueOf(phenotype, subspecies) {
  const q = qualityOf(phenotype);
  const sizeFactor = 0.6 + phenotype.sizeNorm * 0.9;
  return Math.round((8 + q * 140) * subspecies.rarity * sizeFactor);
}

// Passive coins per second this fish contributes to the pond.
export function incomeOf(phenotype, subspecies, cfg = CONFIG) {
  const q = qualityOf(phenotype);
  return cfg.incomeBase * (0.5 + q) * subspecies.rarity * (0.7 + 0.6 * phenotype.metabolism);
}

// Convenience: everything derived from a genome in one call.
export function describe(genome, cfg = CONFIG) {
  const phenotype = phenotypeOf(genome, cfg);
  const subspecies = classify(phenotype);
  return {
    phenotype,
    subspecies,
    quality: qualityOf(phenotype),
    stars: starsOf(phenotype, subspecies),
    value: valueOf(phenotype, subspecies),
    income: incomeOf(phenotype, subspecies, cfg),
  };
}

// =============================================================================
// Subspecies lookup + genome synthesis (for the Koi Market)
// =============================================================================
export const SUBSPECIES_BY_ID = Object.fromEntries(SUBSPECIES.map((s) => [s.id, s]));
export function subspeciesById(id) { return SUBSPECIES_BY_ID[id] || SUBSPECIES[SUBSPECIES.length - 1]; }

const rr = (rng, a, b) => lerp(a, b, rng());
const redHue = (rng) => (rng() < 0.5 ? rr(rng, 0.0, 0.05) : rr(rng, 0.95, 0.995));

// Build a genome that (very probably) expresses as a given subspecies. Used to
// stock the market with recognisable, named koi at appropriate rarities.
export function genomeForSubspecies(id, rng = Math.random) {
  switch (id) {
    case 'kohaku': return makeGenome({
      baseSat: rr(rng, 0.02, 0.16), baseLight: rr(rng, 0.87, 0.96),
      patchHue: redHue(rng), patchSat: rr(rng, 0.6, 0.92), patchLight: rr(rng, 0.42, 0.6),
      pattern: rr(rng, 0.34, 0.66), sumi: rr(rng, 0, 0.35), fin: rr(rng, 0, 0.55),
      luster: rr(rng, 0, 0.3), size: rr(rng, 0.35, 0.85), vigor: rr(rng, 0.4, 0.8),
    });
    case 'tancho': return makeGenome({
      baseSat: rr(rng, 0.02, 0.15), baseLight: rr(rng, 0.88, 0.96),
      patchHue: redHue(rng), patchSat: rr(rng, 0.7, 0.95), patchLight: rr(rng, 0.45, 0.58),
      pattern: rr(rng, 0.18, 0.31), sumi: rr(rng, 0, 0.3), fin: rr(rng, 0, 0.5),
      luster: rr(rng, 0, 0.3), size: rr(rng, 0.4, 0.85), vigor: rr(rng, 0.5, 0.85),
    });
    case 'sanke': return makeGenome({
      baseSat: rr(rng, 0.03, 0.16), baseLight: rr(rng, 0.86, 0.95),
      patchHue: redHue(rng), patchSat: rr(rng, 0.6, 0.9), patchLight: rr(rng, 0.42, 0.6),
      pattern: rr(rng, 0.5, 0.69), sumi: rr(rng, 0.58, 0.82), fin: rr(rng, 0, 0.6),
      luster: rr(rng, 0, 0.3), size: rr(rng, 0.4, 0.9),
    });
    case 'showa': return makeGenome({
      baseHue: rr(rng, 0.0, 0.1), baseSat: rr(rng, 0.2, 0.6), baseLight: rr(rng, 0.15, 0.4),
      patchHue: redHue(rng), patchSat: rr(rng, 0.6, 0.9), patchLight: rr(rng, 0.42, 0.6),
      pattern: rr(rng, 0.5, 0.69), sumi: rr(rng, 0.62, 0.85), luster: rr(rng, 0, 0.25),
      size: rr(rng, 0.45, 0.95),
    });
    case 'ogon': return makeGenome({
      baseHue: rr(rng, 0.09, 0.16), baseSat: rr(rng, 0.45, 0.9), baseLight: rr(rng, 0.45, 0.68),
      pattern: rr(rng, 0, 0.14), luster: rr(rng, 0.76, 0.96), size: rr(rng, 0.4, 0.9),
    });
    case 'platinum': return makeGenome({
      baseSat: rr(rng, 0.02, 0.16), baseLight: rr(rng, 0.86, 0.95),
      pattern: rr(rng, 0, 0.14), luster: rr(rng, 0.8, 0.97), size: rr(rng, 0.45, 0.95),
    });
    case 'asagi': return makeGenome({
      baseHue: rr(rng, 0.55, 0.66), baseSat: rr(rng, 0.4, 0.8), baseLight: rr(rng, 0.3, 0.58),
      patchHue: redHue(rng), patchSat: rr(rng, 0.4, 0.7), patchLight: rr(rng, 0.4, 0.6),
      pattern: rr(rng, 0.72, 0.85), sumi: rr(rng, 0, 0.45), size: rr(rng, 0.4, 0.9),
    });
    case 'karasu': return makeGenome({
      baseHue: rr(rng, 0.6, 0.72), baseSat: rr(rng, 0.0, 0.3), baseLight: rr(rng, 0.02, 0.1),
      pattern: rr(rng, 0, 0.14), luster: rr(rng, 0, 0.45), size: rr(rng, 0.4, 0.9),
    });
    case 'kumonryu': return makeGenome({
      baseSat: rr(rng, 0.0, 0.18), baseLight: rr(rng, 0.6, 0.85),
      pattern: rr(rng, 0.87, 0.98), sumi: rr(rng, 0.62, 0.85), luster: rr(rng, 0, 0.3),
      size: rr(rng, 0.45, 0.95),
    });
    case 'goshiki': return makeGenome({
      baseHue: rr(rng, 0.0, 0.12), baseSat: rr(rng, 0.3, 0.7), baseLight: rr(rng, 0.3, 0.6),
      patchHue: redHue(rng), patchSat: rr(rng, 0.5, 0.85),
      pattern: rr(rng, 0.72, 0.85), sumi: rr(rng, 0.6, 0.82), size: rr(rng, 0.4, 0.9),
    });
    case 'bekko': return makeGenome({
      baseHue: rr(rng, 0.07, 0.16), baseSat: rr(rng, 0.1, 0.5), baseLight: rr(rng, 0.4, 0.8),
      patchSat: rr(rng, 0.0, 0.35), pattern: rr(rng, 0.5, 0.69), sumi: rr(rng, 0.6, 0.82),
      size: rr(rng, 0.4, 0.9),
    });
    case 'yamabuki': return makeGenome({
      baseHue: rr(rng, 0.11, 0.19), baseSat: rr(rng, 0.5, 0.9), baseLight: rr(rng, 0.5, 0.75),
      pattern: rr(rng, 0, 0.3), luster: rr(rng, 0.52, 0.68), size: rr(rng, 0.4, 0.9),
    });
    case 'butterfly': return makeGenome({
      baseHue: rng(), baseSat: rr(rng, 0.3, 0.9), baseLight: rr(rng, 0.4, 0.9),
      patchHue: redHue(rng), patchSat: rr(rng, 0.5, 0.9), pattern: rr(rng, 0.1, 0.7),
      fin: rr(rng, 0.91, 0.99), luster: rr(rng, 0.2, 0.7), size: rr(rng, 0.5, 1.0),
    });
    default: return randomCommonGenome(rng); // 'pond'
  }
}

// Pick a market koi, weighted so rare varieties show up rarely. Returns the id.
export function rollMarketSubspecies(rng = Math.random) {
  const weights = SUBSPECIES.map((s) => ({ id: s.id, w: 1 / Math.pow(s.rarity, 1.6) }));
  const total = weights.reduce((a, x) => a + x.w, 0);
  let t = rng() * total;
  for (const x of weights) { if ((t -= x.w) <= 0) return x.id; }
  return 'pond';
}

export function randomMarketGenome(rng = Math.random) {
  return genomeForSubspecies(rollMarketSubspecies(rng), rng);
}

// =============================================================================
// Breeding preview — simulate the chosen pair and report the odds.
// =============================================================================
export function previewBreeding(momGenome, dadGenome, { trials = 240, rng = Math.random, cfg = CONFIG } = {}) {
  const counts = {};
  const starHist = [0, 0, 0, 0, 0, 0]; // index 0 unused; 1..5
  let sumStars = 0, best = 0, novel = 0;
  const aId = classify(phenotypeOf(momGenome, cfg)).id;
  const bId = classify(phenotypeOf(dadGenome, cfg)).id;

  for (let i = 0; i < trials; i++) {
    const child = breed(momGenome, dadGenome, rng, cfg);
    const ph = phenotypeOf(child, cfg);
    const sp = classify(ph);
    const st = starsOf(ph, sp);
    counts[sp.id] = (counts[sp.id] || 0) + 1;
    starHist[st]++;
    sumStars += st;
    if (st > best) best = st;
    if (sp.id !== aId && sp.id !== bId) novel++;
  }

  const dist = Object.entries(counts).map(([id, n]) => {
    const sp = subspeciesById(id);
    return { id, name: sp.name, jp: sp.jp, rarity: sp.rarity, pct: n / trials };
  }).sort((x, y) => y.pct - x.pct);

  return { trials, dist, starHist, avgStars: sumStars / trials, bestStars: best, mutationChance: novel / trials };
}

// =============================================================================
// Buyer offers — does a koi satisfy a requested trait?
// =============================================================================
export function offerMatches(spec, desc) {
  const p = desc.phenotype;
  switch (spec.type) {
    case 'subspecies': return desc.subspecies.id === spec.id;
    case 'stars': return desc.stars >= spec.min;
    case 'fin': return p.fin === spec.fin;
    case 'pattern': return p.pattern === spec.pattern;
    case 'sumi': return p.hasSumi;
    case 'metallic': return p.luster >= 0.7;
    case 'size': return p.sizeNorm >= spec.min;
    default: return false;
  }
}
