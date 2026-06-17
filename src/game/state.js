// =============================================================================
// Game state & economy.
//
// Holds the pond population, coins, capacity and progression. Exposes player
// actions (buy / breed / sell / release / feed / fertilize) that each return a
// small result object the UI turns into toasts. Pure logic — the clock and RNG
// are injectable so it can be unit tested; persistence is optional.
// =============================================================================

import { CONFIG } from '../config.js';
import {
  describe, breed, offspringCount,
  randomCommonGenome, randomWildGenome, makeGenome,
} from './genetics.js';

let _id = 1;
function nextId() { return _id++; }

// Build a live fish record from a genome. `desc` caches everything derived from
// the (immutable) genome so we never recompute genetics on the hot path.
export function makeFish(genome, now) {
  return {
    id: nextId(),
    genome,
    desc: describe(genome),
    bornAt: now,
    breedReadyAt: 0, // ready immediately
  };
}

export class GameState {
  constructor({ now = Date.now(), rng = Math.random } = {}) {
    this.rng = rng;
    this.version = 1;
    this.coins = CONFIG.startingCoins;
    this.capacity = CONFIG.startingCapacity;
    this.lifetimeFish = 0;          // headline score: total fish ever created
    this.bought = 0;                // shop fish purchased (drives shop price)
    this.capUpgrades = 0;
    this.discovered = {};           // subspecies id -> true
    this.fish = [];
    this.selected = [];             // up to two fish ids, for breeding
    this.feedUntil = 0;
    this.lastSeen = now;
    this.best = { stars: 0, value: 0 };
  }

  // --- queries -------------------------------------------------------------
  get count() { return this.fish.length; }
  get room() { return this.capacity - this.fish.length; }
  isFull() { return this.room <= 0; }
  getFish(id) { return this.fish.find((f) => f.id === id); }
  isSelected(id) { return this.selected.includes(id); }

  feedActive(now) { return now < this.feedUntil; }

  incomePerSec(now = Date.now()) {
    let sum = 0;
    for (const f of this.fish) sum += f.desc.income;
    return sum * (this.feedActive(now) ? CONFIG.feedBoostMult : 1);
  }

  basicFishCost(kind = 'common') {
    const base = kind === 'wild' ? CONFIG.basicFishBaseCost * 3 : CONFIG.basicFishBaseCost;
    return Math.round(base * Math.pow(CONFIG.basicFishCostGrowth, this.bought));
  }

  capacityCost() {
    if (this.capacity >= CONFIG.maxCapacity) return Infinity;
    return Math.round(CONFIG.capacityBaseCost * Math.pow(CONFIG.capacityCostGrowth, this.capUpgrades));
  }

  // --- internal helpers ----------------------------------------------------
  _spawn(genome, now) {
    const fish = makeFish(genome, now);
    this.fish.push(fish);
    this.lifetimeFish++;
    return fish;
  }

  _record(fish) {
    const newlyDiscovered = !this.discovered[fish.desc.subspecies.id];
    this.discovered[fish.desc.subspecies.id] = true;
    if (fish.desc.stars > this.best.stars) this.best.stars = fish.desc.stars;
    if (fish.desc.value > this.best.value) this.best.value = fish.desc.value;
    return newlyDiscovered;
  }

  // --- actions -------------------------------------------------------------
  buyFish(kind = 'common', now = Date.now()) {
    if (this.isFull()) return { ok: false, msg: 'The pond is full. Release a koi first.' };
    const cost = this.basicFishCost(kind);
    if (this.coins < cost) return { ok: false, msg: 'Not enough coins.' };
    this.coins -= cost;
    this.bought++;
    const genome = kind === 'wild' ? randomWildGenome(this.rng) : randomCommonGenome(this.rng);
    const fish = this._spawn(genome, now);
    const discovered = this._record(fish);
    return { ok: true, fish, discovered, msg: `Bought a ${fish.desc.subspecies.name}.` };
  }

  buyCapacity() {
    const cost = this.capacityCost();
    if (!isFinite(cost)) return { ok: false, msg: 'Pond is already at maximum size.' };
    if (this.coins < cost) return { ok: false, msg: 'Not enough coins.' };
    this.coins -= cost;
    this.capUpgrades++;
    this.capacity = Math.min(CONFIG.maxCapacity, this.capacity + CONFIG.capacityStep);
    return { ok: true, msg: `Pond enlarged — capacity is now ${this.capacity}.` };
  }

  buyFertilizer() {
    if (this.coins < CONFIG.fertilizerCost) return { ok: false, msg: 'Not enough coins.' };
    this.coins -= CONFIG.fertilizerCost;
    for (const f of this.fish) f.breedReadyAt = 0;
    return { ok: true, msg: 'Fertilizer added — all koi are ready to breed!' };
  }

  buyFood(now = Date.now()) {
    if (this.coins < CONFIG.feedCost) return { ok: false, msg: 'Not enough coins.' };
    this.coins -= CONFIG.feedCost;
    this.feedUntil = Math.max(this.feedUntil, now) + CONFIG.feedBoostMs;
    return { ok: true, msg: `Fed the pond — income doubled for a while!` };
  }

  toggleSelect(id) {
    const i = this.selected.indexOf(id);
    if (i >= 0) { this.selected.splice(i, 1); return { ok: true, selected: false }; }
    if (this.selected.length >= 2) this.selected.shift(); // keep most recent two
    this.selected.push(id);
    return { ok: true, selected: true };
  }
  clearSelection() { this.selected = []; }

  canBreed(now = Date.now()) {
    if (this.selected.length !== 2) return { ok: false, msg: 'Select two koi to breed.' };
    const [a, b] = this.selected.map((id) => this.getFish(id));
    if (!a || !b) return { ok: false, msg: 'Select two koi to breed.' };
    if (this.isFull()) return { ok: false, msg: 'Pond is full — release a koi to make room.' };
    if (this.coins < CONFIG.breedCost) return { ok: false, msg: 'Not enough coins to breed.' };
    if (now < a.breedReadyAt || now < b.breedReadyAt) return { ok: false, msg: 'A parent is still resting.' };
    return { ok: true, a, b };
  }

  breedSelected(now = Date.now()) {
    const check = this.canBreed(now);
    if (!check.ok) return check;
    const { a, b } = check;
    this.coins -= CONFIG.breedCost;

    const wanted = offspringCount(a.genome, b.genome, this.rng);
    const room = this.room;
    const n = Math.min(wanted, room);

    const babies = [];
    const discoveries = [];
    for (let i = 0; i < n; i++) {
      const fish = this._spawn(breed(a.genome, b.genome, this.rng), now);
      if (this._record(fish)) discoveries.push(fish.desc.subspecies);
      babies.push(fish);
    }
    a.breedReadyAt = now + CONFIG.breedCooldownMs;
    b.breedReadyAt = now + CONFIG.breedCooldownMs;

    return {
      ok: true, babies, discoveries,
      crowded: wanted > n,
      msg: babies.length === 1 ? 'A koi was born!' : `${babies.length} koi were born!`,
    };
  }

  // Release a fish back to the wild for coins (frees a slot). Already counted
  // toward lifetime when it was created, so the score is preserved.
  release(id) {
    const i = this.fish.findIndex((f) => f.id === id);
    if (i < 0) return { ok: false, msg: 'No such koi.' };
    const fish = this.fish[i];
    const coins = Math.max(1, Math.round(fish.desc.value * 0.6));
    this.coins += coins;
    this.fish.splice(i, 1);
    const s = this.selected.indexOf(id);
    if (s >= 0) this.selected.splice(s, 1);
    return { ok: true, coins, msg: `Released a ${fish.desc.subspecies.name} for ${coins} coins.` };
  }

  // --- time ----------------------------------------------------------------
  // Advance live income. Call every frame; dt is derived from `now`.
  tick(now = Date.now()) {
    const dt = Math.max(0, (now - this.lastSeen) / 1000);
    this.lastSeen = now;
    const gained = this.incomePerSec(now) * dt;
    this.coins += gained;
    return gained;
  }

  // Grant capped, discounted income for time away. Call once on load.
  applyOffline(now = Date.now()) {
    const elapsed = Math.min(CONFIG.offlineCapMs, Math.max(0, now - this.lastSeen));
    const gained = this.incomePerSec(now) * (elapsed / 1000) * CONFIG.offlineRate;
    this.coins += gained;
    this.lastSeen = now;
    return { gained, elapsed };
  }

  // --- persistence ---------------------------------------------------------
  toJSON() {
    return {
      version: this.version,
      coins: this.coins,
      capacity: this.capacity,
      lifetimeFish: this.lifetimeFish,
      bought: this.bought,
      capUpgrades: this.capUpgrades,
      discovered: this.discovered,
      feedUntil: this.feedUntil,
      lastSeen: this.lastSeen,
      best: this.best,
      selected: this.selected,
      nextId: _id,
      fish: this.fish.map((f) => ({
        id: f.id, genome: f.genome, bornAt: f.bornAt, breedReadyAt: f.breedReadyAt,
      })),
    };
  }

  static fromJSON(data, { rng = Math.random } = {}) {
    const s = new GameState({ now: data.lastSeen || Date.now(), rng });
    s.version = data.version || 1;
    s.coins = data.coins ?? CONFIG.startingCoins;
    s.capacity = data.capacity ?? CONFIG.startingCapacity;
    s.lifetimeFish = data.lifetimeFish ?? 0;
    s.bought = data.bought ?? 0;
    s.capUpgrades = data.capUpgrades ?? 0;
    s.discovered = data.discovered ?? {};
    s.feedUntil = data.feedUntil ?? 0;
    s.lastSeen = data.lastSeen ?? Date.now();
    s.best = data.best ?? { stars: 0, value: 0 };
    s.selected = data.selected ?? [];
    _id = Math.max(_id, data.nextId || 1);
    s.fish = (data.fish || []).map((f) => ({
      id: f.id,
      genome: makeGenome(f.genome),
      desc: describe(makeGenome(f.genome)),
      bornAt: f.bornAt ?? Date.now(),
      breedReadyAt: f.breedReadyAt ?? 0,
    }));
    if (data.nextId) _id = data.nextId;
    return s;
  }

  save(storage) {
    try {
      const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
      if (!store) return false;
      store.setItem(CONFIG.saveKey, JSON.stringify(this.toJSON()));
      return true;
    } catch (e) { return false; }
  }

  static load({ storage, rng = Math.random } = {}) {
    try {
      const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
      if (!store) return null;
      const raw = store.getItem(CONFIG.saveKey);
      if (!raw) return null;
      return GameState.fromJSON(JSON.parse(raw), { rng });
    } catch (e) { return null; }
  }

  static clear(storage) {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (store) store.removeItem(CONFIG.saveKey);
  }
}

// Seed a brand-new game with a small starter pond of varied koi.
export function newGame({ now = Date.now(), rng = Math.random } = {}) {
  const s = new GameState({ now, rng });
  for (let i = 0; i < 4; i++) {
    const fish = s._spawn(i < 2 ? randomCommonGenome(rng) : randomWildGenome(rng), now);
    s._record(fish);
  }
  return s;
}
