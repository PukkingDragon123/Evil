// Tests for the game-state / economy layer (v2: market, offers, foods, decor).
// Run: node test/state.test.js
import { GameState, newGame } from '../src/game/state.js';
import { CONFIG } from '../src/config.js';

let passed = 0, failed = 0;
const ok = (c, m) => c ? passed++ : (failed++, console.error('  ✗ FAIL: ' + m));
function makeRng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function memStore() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

console.log('game state / economy tests');

// --- new game ----------------------------------------------------------------
{
  const s = newGame({ now: 1000, rng: makeRng(5) });
  ok(s.count === 3, 'new game seeds a small starter pond');
  ok(s.lifetimeFish === 3, 'starter fish count toward lifetime score');
  ok(s.coins === CONFIG.startingCoins, 'starts with configured coins');
  ok(s.market.listings.length === CONFIG.market.size, 'market is stocked at start');
}

// --- market ------------------------------------------------------------------
{
  const s = newGame({ now: 0, rng: makeRng(11) });
  s.coins = 1e6;
  const listing = s.market.listings[0];
  const before = s.count;
  const r = s.buyListing(listing.id, 0);
  ok(r.ok && s.count === before + 1, 'buying a listing adds the koi');
  ok(s.coins === 1e6 - listing.price, 'buying deducts the listing price');
  ok(!s.market.listings.find((l) => l.id === listing.id), 'listing is consumed once bought');
  ok(!s.buyListing(listing.id, 0).ok, 'cannot buy a consumed listing');

  // refresh timing
  ok(s.refreshMarket(1000) === false, 'market does not refresh before its timer');
  ok(s.refreshMarket(1000, true) === true, 'market can be force-refreshed');
  ok(s.market.listings.length === CONFIG.market.size, 'refresh restocks the market');

  // capacity guard
  const s2 = newGame({ now: 0, rng: makeRng(2) }); s2.coins = 1e9;
  let guard = false;
  for (let i = 0; i < 400; i++) { s2.refreshMarket(0, true); const rr = s2.buyListing(s2.market.listings[0].id, 0); if (!rr.ok && rr.msg.includes('full')) { guard = true; break; } }
  ok(guard, 'cannot exceed pond capacity from the market');
}

// --- offers ------------------------------------------------------------------
{
  const s = newGame({ now: 0, rng: makeRng(7) });
  s.nextOfferAt = 0;
  const t = s.tickOffers(1);
  ok(s.offers.length === 1 && t.added, 'a visitor offer appears when due');

  // hand-built offer everyone matches
  s.offers = [{ id: 'oX', type: 'stars', min: 1, label: 'any', price: 250, expiresAt: 1e15 }];
  ok(s.offerMatchCount(s.offers[0]) === s.count, 'match count sees all eligible koi');
  const c0 = s.coins, n0 = s.count;
  const fr = s.fulfillOffer('oX', 5);
  ok(fr.ok && s.coins === c0 + 250 && s.count === n0 - 1, 'fulfilling an offer pays the premium and takes the koi');
  ok(s.offers.length === 0, 'fulfilled offer is removed');

  // unmatched offer fails gracefully
  s.offers = [{ id: 'oY', type: 'subspecies', id: 'butterfly', label: 'x', price: 999, expiresAt: 1e15 }];
  const f2 = s.fulfillOffer('oY', 6);
  ok(!f2.ok, 'an offer with no matching koi cannot be fulfilled');

  // expiry
  s.offers = [{ id: 'oZ', type: 'stars', min: 1, label: 'x', price: 10, expiresAt: 100 }];
  s.nextOfferAt = 1e15;
  s.tickOffers(200);
  ok(s.offers.length === 0, 'expired offers are cleared');
}

// --- foods / buffs -----------------------------------------------------------
{
  const s = newGame({ now: 0, rng: makeRng(4) }); s.coins = 1e6;
  const baseIncome = s.incomePerSec(0);
  ok(s.buyFood('premium', 0).ok, 'can buy food');
  ok(s.incomePerSec(0) > baseIncome, 'income food boosts income');
  ok(s.incomePerSec(CONFIG ? 1e9 : 0) <= baseIncome + 1e-9, 'income boost expires');

  s.buyFood('wheatgerm', 0);
  ok(s.breedSpeedMult(0) === 0.5, 'wheat germ halves breeding rest');
  s.buyFood('sakelees', 0);
  ok(s.offerRateMult(0) === 0.5, 'sake lees makes visitors come more often');
  s.buyFood('spirulina', 0);
  ok(s.breedQuality(0) === 0.12, 'spirulina enriches the next brood');
  ok(s.activeBuffs(0).length >= 3, 'multiple buffs can be active at once');
}

// --- breeding + preview ------------------------------------------------------
{
  const s = newGame({ now: 0, rng: makeRng(9) }); s.coins = 1e6;
  s.buyCapacity(); s.buyCapacity();
  const [a, b] = s.fish;
  s.toggleSelect(a.id); s.toggleSelect(b.id);
  const pv = s.previewSelected();
  ok(pv && Math.abs(pv.dist.reduce((x, d) => x + d.pct, 0) - 1) < 1e-6, 'previewSelected returns valid odds');
  ok(s.canBreed(0).ok, 'two ready selected parents can breed');
  const life = s.lifetimeFish, before = s.count;
  const r = s.breedSelected(0);
  ok(r.ok && r.babies.length >= 1, 'breeding produces offspring');
  ok(s.count === before + r.babies.length && s.lifetimeFish === life + r.babies.length, 'offspring added & scored');
  ok(!s.canBreed(0).ok, 'parents rest after breeding');

  // wheat germ shortens the rest
  const s2 = newGame({ now: 0, rng: makeRng(1) }); s2.coins = 1e6; s2.buyCapacity();
  s2.buyFood('wheatgerm', 0);
  const [x, y] = s2.fish; s2.toggleSelect(x.id); s2.toggleSelect(y.id);
  s2.breedSelected(0);
  ok(x.breedReadyAt === CONFIG.breedCooldownMs * 0.5, 'breed cooldown is scaled by the buff');
}

// --- decorations -------------------------------------------------------------
{
  const s = newGame({ now: 0, rng: makeRng(6) }); s.coins = 1e6;
  const c0 = s.coins;
  const r = s.placeDecoration('lantern', 4, 5);
  ok(r.ok && s.decorations.length === 1, 'placing a decoration records it');
  ok(s.coins < c0, 'placing costs coins');
  ok(typeof r.rec.rot === 'number', 'placed decoration has a rotation');
  const c1 = s.coins;
  const rm = s.removeDecoration(r.rec.id);
  ok(rm.ok && s.decorations.length === 0, 'removing a decoration works');
  ok(s.coins > c1, 'removing refunds some coins');
  ok(!s.placeDecoration('nope', 0, 0).ok, 'unknown decoration is rejected');
}

// --- selection / release -----------------------------------------------------
{
  const s = newGame({ now: 0, rng: makeRng(1) });
  const ids = s.fish.map((f) => f.id);
  s.toggleSelect(ids[0]); s.toggleSelect(ids[1]); s.toggleSelect(ids[2]);
  ok(s.selected.length === 2 && !s.selected.includes(ids[0]), 'selection capped at two (oldest dropped)');

  const c0 = s.coins, n0 = s.count, life = s.lifetimeFish;
  const rr = s.release(ids[2]);
  ok(rr.ok && s.count === n0 - 1 && s.coins > c0, 'release removes the koi and pays coins');
  ok(s.lifetimeFish === life, 'release does not reduce lifetime score');
}

// --- save / load roundtrip ---------------------------------------------------
{
  const store = memStore();
  const s = newGame({ now: 5000, rng: makeRng(8) });
  s.coins = 777; s.buyCapacity();
  s.buyFood('ricebran', 5000);
  s.placeDecoration('torii', 2, -3, 5000);
  s.offers = [{ id: 'o1', type: 'stars', min: 3, label: 'x', price: 120, expiresAt: 1e15 }];
  s.toggleSelect(s.fish[0].id);
  ok(s.save(store), 'state saves');

  const s2 = GameState.load({ storage: store, rng: makeRng(8) });
  ok(s2 && s2.count === s.count, 'loaded pond size matches');
  ok(s2.coins === s.coins, 'loaded coins match');
  ok(s2.capacity === s.capacity, 'loaded capacity matches');
  ok(s2.market.listings.length === s.market.listings.length, 'market survives roundtrip');
  ok(s2.market.listings[0].desc, 'listing descriptions rebuilt on load');
  ok(s2.offers.length === 1 && s2.offers[0].price === 120, 'offers survive roundtrip');
  ok(JSON.stringify(s2.buffs) === JSON.stringify(s.buffs), 'buffs survive roundtrip');
  ok(s2.decorations.length === 1 && s2.decorations[0].type === 'torii', 'decorations survive roundtrip');
  ok(s2.fish[0].desc.subspecies.id === s.fish[0].desc.subspecies.id, 'derived fish data rebuilt on load');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
