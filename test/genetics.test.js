// Lightweight, dependency-free tests for the genetics engine.
// Run with:  node test/genetics.test.js   (or: npm test)

import {
  GENE_KEYS, makeGenome, randomCommonGenome, randomWildGenome,
  breed, offspringCount, phenotypeOf, classify, describe,
  qualityOf, starsOf, valueOf, incomeOf, SUBSPECIES,
} from '../src/game/genetics.js';

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('  ✗ FAIL: ' + msg); }
}

// A deterministic RNG so tests are reproducible.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

console.log('genetics engine tests');

// --- makeGenome -------------------------------------------------------------
{
  const g = makeGenome({ baseHue: 2, baseSat: -1, size: 0.3, bogus: 99 });
  ok(Object.keys(g).length === GENE_KEYS.length, 'genome has exactly the known genes');
  ok(g.baseHue === 1 && g.baseSat === 0, 'genes are clamped to [0,1]');
  ok(g.size === 0.3, 'provided gene preserved');
  ok(!('bogus' in g), 'unknown keys dropped');
  ok(GENE_KEYS.every((k) => typeof g[k] === 'number'), 'every gene present and numeric');
}

// --- random genomes ---------------------------------------------------------
{
  const rng = makeRng(1);
  for (let i = 0; i < 200; i++) {
    const g = i % 2 ? randomCommonGenome(rng) : randomWildGenome(rng);
    ok(GENE_KEYS.every((k) => g[k] >= 0 && g[k] <= 1), 'random genome stays in range');
    if (failed) break;
  }
}

// --- breeding produces valid genomes ---------------------------------------
{
  const rng = makeRng(7);
  let allValid = true;
  for (let i = 0; i < 500; i++) {
    const a = randomWildGenome(rng);
    const b = randomWildGenome(rng);
    const c = breed(a, b, rng);
    if (!GENE_KEYS.every((k) => c[k] >= 0 && c[k] <= 1)) { allValid = false; break; }
  }
  ok(allValid, 'breeding always yields a clamped, valid genome');

  const n = offspringCount(makeGenome({ fertility: 1 }), makeGenome({ fertility: 1 }), makeRng(3));
  ok(n >= 1 && n <= 3, 'offspring count within configured bounds');
}

// --- inheritance actually blends parents ------------------------------------
{
  // With mutation effectively off, a child size sits between the parents.
  const rng = () => 0.99; // never triggers mutation (rate < 0.99)
  const mom = makeGenome({ size: 0.2 });
  const dad = makeGenome({ size: 0.8 });
  const child = breed(mom, dad, rng);
  ok(child.size >= 0.2 && child.size <= 0.8, 'child trait blends between parents');
}

// --- phenotype expression ---------------------------------------------------
{
  const p = phenotypeOf(makeGenome({ baseHue: 0, baseSat: 1, baseLight: 1 }));
  ok(p.base.h === 0 && p.base.s <= 96 && p.base.l <= 94, 'HSL mapped into sane ranges');
  ok(typeof p.pattern === 'string' && typeof p.fin === 'string', 'pattern & fin are categories');
  ok(p.size > 0, 'size expressed as positive scale');
}

// --- subspecies classification ----------------------------------------------
{
  // Every subspecies id is unique.
  const ids = new Set(SUBSPECIES.map((s) => s.id));
  ok(ids.size === SUBSPECIES.length, 'subspecies ids are unique');

  // Anything classifies into *something* (the fallback guarantees it).
  const rng = makeRng(42);
  const hit = new Set();
  for (let i = 0; i < 4000; i++) {
    const sp = classify(phenotypeOf(randomWildGenome(rng)));
    ok(sp && sp.id, 'classify always returns a subspecies');
    hit.add(sp.id);
    if (failed) break;
  }
  // A healthy genome space should discover a good spread of varieties.
  ok(hit.size >= 6, `random breeding discovers variety (found ${hit.size} subspecies)`);

  // A hand-built Tancho should be recognised as such.
  const tancho = describe(makeGenome({
    baseLight: 0.95, baseSat: 0.05,         // white body
    patchHue: 0.0, patchSat: 0.9, patchLight: 0.5, // red patch
    pattern: 0.20,                          // Capped
    sumi: 0.0, luster: 0.2,
  }));
  ok(tancho.subspecies.id === 'tancho', `white + single red cap is a Tancho (got ${tancho.subspecies.id})`);

  // A metallic solid fish should read as an Ogon family member.
  const ogon = describe(makeGenome({ pattern: 0.0, luster: 0.95, baseHue: 0.13, baseSat: 0.6, baseLight: 0.6 }));
  ok(['ogon', 'platinum', 'yamabuki'].includes(ogon.subspecies.id),
    `metallic solid fish is an Ogon variety (got ${ogon.subspecies.id})`);
}

// --- scoring monotonicity ---------------------------------------------------
{
  const plain = phenotypeOf(makeGenome({ size: 0.1, luster: 0.0, vigor: 0.1, fertility: 0.1, pattern: 0, fin: 0 }));
  const great = phenotypeOf(makeGenome({ size: 0.9, luster: 0.9, vigor: 0.9, fertility: 0.9, pattern: 0.9, fin: 0.95 }));
  ok(qualityOf(great) > qualityOf(plain), 'better traits -> higher quality');

  const spLow = classify(plain), spHi = classify(great);
  ok(valueOf(great, spHi) > valueOf(plain, spLow), 'better fish is worth more');
  ok(incomeOf(great, spHi) > incomeOf(plain, spLow), 'better fish earns more');
  ok(starsOf(great, spHi) >= starsOf(plain, spLow), 'better fish has >= stars');
  ok(starsOf(plain, spLow) >= 1 && starsOf(great, spHi) <= 5, 'stars in 1..5');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
