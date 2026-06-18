// =============================================================================
// Koi Market & buyer offers.
//
// The market shows a few random koi (varied trait/rarity/price) that refresh on
// a timer — the main way to acquire fresh bloodlines. Buyers periodically visit
// wanting a particular variety or trait, paying a premium for a matching koi.
// Pure logic (RNG injected) so it can be unit tested.
// =============================================================================

import { CONFIG } from '../config.js';
import {
  describe, randomMarketGenome, subspeciesById, offerMatches,
  SUBSPECIES, PATTERNS, FINS,
} from './genetics.js';

let _uid = 1;
const uid = (p) => `${p}${(_uid++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

const rr = (rng, a, b) => a + (b - a) * rng();
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// --- Market listings --------------------------------------------------------
export function makeListing(rng = Math.random) {
  const genome = randomMarketGenome(rng);
  const desc = describe(genome);
  const price = Math.max(20, Math.round(desc.value * CONFIG.market.priceMult));
  return { id: uid('L'), genome, desc, price };
}

export function generateListings(rng = Math.random, n = CONFIG.market.size) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(makeListing(rng));
  return out;
}

// --- Buyer offers -----------------------------------------------------------
// Offers favour achievable, mid-rarity goals; rarer asks pay much more.
const OFFER_KINDS = [
  { type: 'subspecies', w: 3 },
  { type: 'stars', w: 3 },
  { type: 'pattern', w: 2 },
  { type: 'sumi', w: 1 },
  { type: 'fin', w: 1.4 },
  { type: 'metallic', w: 1 },
  { type: 'size', w: 1.2 },
];

function weightedKind(rng) {
  const total = OFFER_KINDS.reduce((a, k) => a + k.w, 0);
  let t = rng() * total;
  for (const k of OFFER_KINDS) if ((t -= k.w) <= 0) return k.type;
  return 'stars';
}

export function generateOffer(rng = Math.random, now = Date.now()) {
  const premium = rr(rng, CONFIG.offers.premiumMin, CONFIG.offers.premiumMax);
  const type = weightedKind(rng);
  let spec, label, base;

  if (type === 'subspecies') {
    // Favour mid-rarity, recognisable varieties.
    const pool = SUBSPECIES.filter((s) => s.id !== 'pond' && s.rarity <= 4.0);
    const sp = pick(rng, pool);
    spec = { type, id: sp.id };
    label = `Seeks a ${sp.name} (${sp.jp})`;
    base = sp.rarity * rr(rng, 55, 90);
  } else if (type === 'stars') {
    const min = pick(rng, [3, 3, 4, 4, 5]);
    spec = { type, min };
    label = `Seeks a ${min}★ or finer koi`;
    base = min * 48 * (min >= 5 ? 1.7 : 1);
  } else if (type === 'pattern') {
    const pat = pick(rng, ['Spotted', 'Netted', 'Dragon', 'Banded']);
    const rarity = (PATTERNS.find((p) => p.id === pat) || { rarity: 1.5 }).rarity;
    spec = { type, pattern: pat };
    label = `Seeks a ${pat}-patterned koi`;
    base = rarity * rr(rng, 60, 95);
  } else if (type === 'fin') {
    const fin = pick(rng, ['Long', 'Long', 'Veil']);
    spec = { type, fin };
    label = `Seeks ${fin === 'Veil' ? 'flowing Veil' : 'Long'} fins`;
    base = fin === 'Veil' ? rr(rng, 280, 360) : rr(rng, 130, 180);
  } else if (type === 'sumi') {
    spec = { type };
    label = 'Seeks a koi with sumi (black)';
    base = rr(rng, 90, 130);
  } else if (type === 'metallic') {
    spec = { type };
    label = 'Seeks a metallic koi';
    base = rr(rng, 170, 230);
  } else { // size
    const min = pick(rng, [0.68, 0.78, 0.86]);
    spec = { type, min };
    label = 'Seeks an especially large koi';
    base = min * 190;
  }

  const price = Math.max(30, Math.round(base * premium));
  return { id: uid('O'), ...spec, label, price, expiresAt: now + CONFIG.offers.expireMs };
}

// How many of the player's koi satisfy an offer.
export function countMatches(offer, fishList) {
  let n = 0;
  for (const f of fishList) if (offerMatches(offer, f.desc)) n++;
  return n;
}

// The least valuable matching koi (so fulfilling never gives away your best).
export function cheapestMatch(offer, fishList) {
  let best = null;
  for (const f of fishList) {
    if (!offerMatches(offer, f.desc)) continue;
    if (!best || f.desc.value < best.desc.value) best = f;
  }
  return best;
}
