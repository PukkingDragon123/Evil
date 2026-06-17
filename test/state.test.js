// Tests for the game-state / economy layer. Run: node test/state.test.js
import { GameState, newGame, makeFish } from '../src/game/state.js';
import { CONFIG } from '../src/config.js';

let passed = 0, failed = 0;
const ok = (c, m) => c ? passed++ : (failed++, console.error('  ✗ FAIL: ' + m));

function makeRng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
// in-memory storage shim
function memStore() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

console.log('game state / economy tests');

// --- new game ----------------------------------------------------------------
{
  const s = newGame({ now: 1000, rng: makeRng(5) });
  ok(s.count === 4, 'new game seeds a starter pond');
  ok(s.lifetimeFish === 4, 'starter fish count toward lifetime score');
  ok(s.coins === CONFIG.startingCoins, 'starts with configured coins');
  ok(Object.keys(s.discovered).length >= 1, 'starter fish register subspecies');
}

// --- buying ------------------------------------------------------------------
{
  const s = newGame({ now: 0, rng: makeRng(11) });
  s.coins = 10000;
  const before = s.count, cost = s.basicFishCost('common');
  const r = s.buyFish('common', 0);
  ok(r.ok && s.count === before + 1, 'buying adds a fish');
  ok(s.coins === 10000 - cost, 'buying deducts the right cost');
  ok(s.basicFishCost('common') > cost, 'shop price rises after a purchase');

  // capacity guard
  const s2 = newGame({ now: 0, rng: makeRng(2) });
  s2.coins = 1e9;
  let guard = false;
  for (let i = 0; i < 500; i++) { const rr = s2.buyFish('common', 0); if (!rr.ok) { guard = (rr.msg.includes('full')); break; } }
  ok(guard, 'cannot exceed pond capacity');
}

// --- capacity upgrades -------------------------------------------------------
{
  const s = newGame({ now: 0, rng: makeRng(3) });
  s.coins = 1e6;
  const cap0 = s.capacity, c0 = s.capacityCost();
  ok(s.buyCapacity().ok, 'can buy capacity');
  ok(s.capacity === cap0 + CONFIG.capacityStep, 'capacity grows by the step');
  ok(s.capacityCost() > c0, 'capacity gets more expensive');
}

// --- breeding ----------------------------------------------------------------
{
  const s = newGame({ now: 0, rng: makeRng(9) });
  s.coins = 1e6;
  s.buyCapacity(); s.buyCapacity(); // make room
  const [a, b] = s.fish;
  s.toggleSelect(a.id); s.toggleSelect(b.id);
  ok(s.canBreed(0).ok, 'two ready selected parents can breed');
  const before = s.count, life = s.lifetimeFish;
  const r = s.breedSelected(0);
  ok(r.ok && r.babies.length >= 1, 'breeding produces offspring');
  ok(s.count === before + r.babies.length, 'offspring added to pond');
  ok(s.lifetimeFish === life + r.babies.length, 'offspring counted in lifetime score');
  ok(!s.canBreed(0).ok, 'parents go on cooldown after breeding');
  ok(s.canBreed(CONFIG.breedCooldownMs + 1).ok || s.isFull(), 'cooldown clears with time');

  // fertilizer clears cooldown
  s.coins = 1e6;
  s.buyFertilizer();
  ok(a.breedReadyAt === 0 && b.breedReadyAt === 0, 'fertilizer resets cooldowns');
}

// --- selection cap -----------------------------------------------------------
{
  const s = newGame({ now: 0, rng: makeRng(1) });
  const ids = s.fish.map((f) => f.id);
  s.toggleSelect(ids[0]); s.toggleSelect(ids[1]); s.toggleSelect(ids[2]);
  ok(s.selected.length === 2, 'selection is capped at two');
  ok(!s.selected.includes(ids[0]), 'oldest selection is dropped');
}

// --- release / sell ----------------------------------------------------------
{
  const s = newGame({ now: 0, rng: makeRng(7) });
  const c0 = s.coins, before = s.count, life = s.lifetimeFish;
  const r = s.release(s.fish[0].id);
  ok(r.ok && s.count === before - 1, 'release removes the fish');
  ok(s.coins > c0, 'release pays coins');
  ok(s.lifetimeFish === life, 'release does not reduce lifetime score');
}

// --- income & feeding --------------------------------------------------------
{
  const s = newGame({ now: 0, rng: makeRng(4) });
  s.lastSeen = 0;
  const rate = s.incomePerSec(0);
  ok(rate > 0, 'pond earns income');
  const gained = s.tick(1000); // 1 second
  ok(Math.abs(gained - rate) < 1e-6, 'tick grants ~one second of income');

  s.coins = 1e6;
  s.buyFood(2000);
  ok(s.incomePerSec(2000) > rate, 'feeding boosts income');
  ok(s.incomePerSec(2000 + CONFIG.feedBoostMs + 1) <= rate + 1e-9, 'feed boost expires');
}

// --- offline income ----------------------------------------------------------
{
  const s = newGame({ now: 0, rng: makeRng(6) });
  s.lastSeen = 0;
  const big = CONFIG.offlineCapMs * 10;
  const { gained, elapsed } = s.applyOffline(big);
  ok(elapsed === CONFIG.offlineCapMs, 'offline time is capped');
  ok(gained > 0, 'offline grants some income');
  ok(s.lastSeen === big, 'lastSeen advances after offline grant');
}

// --- save / load roundtrip ---------------------------------------------------
{
  const store = memStore();
  const s = newGame({ now: 5000, rng: makeRng(8) });
  s.coins = 777; s.buyCapacity?.();
  s.toggleSelect(s.fish[0].id);
  ok(s.save(store), 'state saves');
  const s2 = GameState.load({ storage: store, rng: makeRng(8) });
  ok(s2 && s2.count === s.count, 'loaded pond size matches');
  ok(s2.coins === s.coins, 'loaded coins match');
  ok(s2.capacity === s.capacity, 'loaded capacity matches');
  ok(s2.selected.length === s.selected.length, 'loaded selection matches');
  ok(JSON.stringify(s2.fish[0].genome) === JSON.stringify(s.fish[0].genome), 'genomes survive roundtrip');
  ok(s2.fish[0].desc.subspecies.id === s.fish[0].desc.subspecies.id, 'derived data rebuilt on load');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
