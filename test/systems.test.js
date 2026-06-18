// Tests for the new gameplay systems: market genome synthesis, breeding preview,
// buyer-offer matching, and the food/decoration catalogs.
// Run: node test/systems.test.js

import {
  describe, genomeForSubspecies, randomMarketGenome, rollMarketSubspecies,
  previewBreeding, offerMatches, makeGenome, SUBSPECIES,
} from '../src/game/genetics.js';
import { makeListing, generateListings, generateOffer, countMatches, cheapestMatch } from '../src/game/market.js';
import { FOODS, FOOD_BY_ID } from '../src/game/foods.js';
import { DECOR, DECOR_BY_ID } from '../src/game/decorations.js';

let passed = 0, failed = 0;
const ok = (c, m) => c ? passed++ : (failed++, console.error('  ✗ FAIL: ' + m));
function makeRng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

console.log('systems tests');

// --- market genome synthesis (mostly breeds true) ---------------------------
{
  const check = (id, threshold = 0.55) => {
    let hit = 0; const N = 60;
    for (let i = 0; i < N; i++) if (describe(genomeForSubspecies(id, Math.random)).subspecies.id === id) hit++;
    ok(hit / N >= threshold, `genomeForSubspecies('${id}') usually expresses as ${id} (${hit}/${N})`);
  };
  ['kohaku', 'tancho', 'ogon', 'platinum', 'asagi', 'karasu', 'kumonryu', 'butterfly', 'sanke', 'showa'].forEach((id) => check(id));
}

// --- market roll + listings -------------------------------------------------
{
  const rng = makeRng(3);
  const counts = {};
  for (let i = 0; i < 3000; i++) { const id = rollMarketSubspecies(rng); counts[id] = (counts[id] || 0) + 1; ok(SUBSPECIES.some((s) => s.id === id), 'rolled a real subspecies'); if (failed) break; }
  ok((counts.pond || 0) > (counts.butterfly || 0), 'common koi appear far more often than legendary');

  const listings = generateListings(makeRng(9), 3);
  ok(listings.length === 3, 'market generates the configured number of listings');
  ok(listings.every((l) => l.price > 0 && l.desc && l.genome), 'listings have price, desc and genome');
  ok(new Set(listings.map((l) => l.id)).size === 3, 'listing ids are unique');
  const single = makeListing(makeRng(2));
  ok(single.price >= Math.round(single.desc.value), 'market price carries a premium over base value');
}

// --- offers -----------------------------------------------------------------
{
  const o = generateOffer(makeRng(11), 1000);
  ok(o.type && o.price > 0 && typeof o.label === 'string', 'offer has a type, price and label');
  ok(o.expiresAt > 1000, 'offer has a future expiry');

  // matching
  const fishes = [
    { desc: describe(makeGenome({ fin: 0.95 })) },                     // Veil -> butterfly
    { desc: describe(makeGenome({ luster: 0.9, pattern: 0.0, baseHue: 0.13, baseSat: 0.6 })) }, // metallic
    { desc: describe(makeGenome({ size: 0.95 })) },                    // large
  ];
  ok(offerMatches({ type: 'fin', fin: 'Veil' }, fishes[0].desc), 'fin offer matches a veil-finned koi');
  ok(offerMatches({ type: 'metallic' }, fishes[1].desc), 'metallic offer matches a lustrous koi');
  ok(offerMatches({ type: 'size', min: 0.9 }, fishes[2].desc), 'size offer matches a large koi');
  ok(countMatches({ type: 'stars', min: 1 }, fishes) === 3, 'a ≥1★ request matches every koi');

  const list = [
    { desc: { value: 100, phenotype: {}, subspecies: { id: 'pond' }, stars: 2 } },
    { desc: { value: 40, phenotype: {}, subspecies: { id: 'pond' }, stars: 2 } },
    { desc: { value: 200, phenotype: {}, subspecies: { id: 'pond' }, stars: 2 } },
  ];
  const cm = cheapestMatch({ type: 'stars', min: 1 }, list);
  ok(cm && cm.desc.value === 40, 'cheapestMatch returns the least valuable matching koi');
}

// --- breeding preview -------------------------------------------------------
{
  const a = makeGenome({ baseLight: 0.92, baseSat: 0.05, patchHue: 0.0, patchSat: 0.9, pattern: 0.4 }); // kohaku-ish
  const b = makeGenome({ luster: 0.9, pattern: 0.0, baseHue: 0.13, baseSat: 0.6 }); // ogon-ish
  const pv = previewBreeding(a, b, { trials: 300, rng: makeRng(5) });
  const sumPct = pv.dist.reduce((s, d) => s + d.pct, 0);
  ok(Math.abs(sumPct - 1) < 1e-6, 'breeding-odds distribution sums to 1');
  ok(pv.dist.length >= 1 && pv.dist[0].pct >= pv.dist[pv.dist.length - 1].pct, 'odds are sorted descending');
  const histSum = pv.starHist.reduce((s, n) => s + n, 0);
  ok(histSum === pv.trials, 'star histogram covers every trial');
  ok(pv.bestStars >= 1 && pv.bestStars <= 5, 'best stars within range');
  ok(pv.mutationChance >= 0 && pv.mutationChance <= 1, 'mutation chance is a probability');
  ok(pv.avgStars > 0, 'average stars positive');
}

// --- catalogs ---------------------------------------------------------------
{
  ok(new Set(FOODS.map((f) => f.id)).size === FOODS.length, 'food ids unique');
  ok(FOODS.every((f) => f.price > 0 && f.buff && f.buff.kind), 'foods have price and a buff');
  ok(FOOD_BY_ID.premium && FOOD_BY_ID.premium.buff.kind === 'income', 'food lookup works');
  ok(new Set(DECOR.map((d) => d.id)).size === DECOR.length, 'decoration ids unique');
  ok(DECOR.every((d) => d.price > 0 && d.place), 'decorations have price and placement');
  ok(DECOR_BY_ID.torii && DECOR_BY_ID.torii.place === 'edge', 'decoration lookup works');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
