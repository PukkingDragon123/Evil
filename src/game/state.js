// =============================================================================
// Game state & economy.
//
// Owns the pond population, coins, capacity, the koi market, buyer offers, food
// buffs and placed decorations, plus save/load. Player actions return small
// result objects the UI turns into toasts. Pure logic — clock & RNG injectable.
// =============================================================================

import { CONFIG } from '../config.js';
import {
  describe, breed, offspringCount, randomCommonGenome, makeGenome,
  previewBreeding, clamp01,
} from './genetics.js';
import { generateListings, generateOffer, cheapestMatch, countMatches } from './market.js';
import { FOOD_BY_ID } from './foods.js';
import { DECOR_BY_ID } from './decorations.js';

let _id = 1;
function nextId() { return _id++; }

export function makeFish(genome, now) {
  return {
    id: nextId(),
    genome,
    desc: describe(genome),
    bornAt: now,
    breedReadyAt: 0,
  };
}

export class GameState {
  constructor({ now = Date.now(), rng = Math.random } = {}) {
    this.rng = rng;
    this.version = 2;
    this.coins = CONFIG.startingCoins;
    this.capacity = CONFIG.startingCapacity;
    this.lifetimeFish = 0;
    this.capUpgrades = 0;
    this.discovered = {};
    this.fish = [];
    this.selected = [];
    this.lastSeen = now;
    this.best = { stars: 0, value: 0 };

    this.market = { listings: [], nextRefresh: 0 };
    this.offers = [];
    this.nextOfferAt = now + CONFIG.offers.intervalMs * 0.5;
    this.buffs = {};            // kind -> { value, until }
    this.decorations = [];
    this.nextDecoId = 1;
  }

  // --- queries -------------------------------------------------------------
  get count() { return this.fish.length; }
  get room() { return this.capacity - this.fish.length; }
  isFull() { return this.room <= 0; }
  getFish(id) { return this.fish.find((f) => f.id === id); }
  isSelected(id) { return this.selected.includes(id); }
  getSelectedFish() { return this.selected.map((id) => this.getFish(id)).filter(Boolean); }

  // --- buffs ---------------------------------------------------------------
  buffValue(kind, now, def = 1) {
    const b = this.buffs[kind];
    return b && now < b.until ? b.value : def;
  }
  incomeMult(now) { return this.buffValue('income', now, 1); }
  breedSpeedMult(now) { return this.buffValue('breedSpeed', now, 1); }
  offerRateMult(now) { return this.buffValue('offerRate', now, 1); }
  breedQuality(now) { return this.buffValue('breedQuality', now, 0); }
  activeBuffs(now) {
    return Object.entries(this.buffs)
      .filter(([, b]) => now < b.until)
      .map(([kind, b]) => ({ kind, value: b.value, msLeft: b.until - now }));
  }

  incomePerSec(now = Date.now()) {
    let sum = 0;
    for (const f of this.fish) sum += f.desc.income;
    return sum * this.incomeMult(now);
  }

  capacityCost() {
    if (this.capacity >= CONFIG.maxCapacity) return Infinity;
    return Math.round(CONFIG.capacityBaseCost * Math.pow(CONFIG.capacityCostGrowth, this.capUpgrades));
  }

  // --- internals -----------------------------------------------------------
  _spawn(genome, now) {
    const fish = makeFish(genome, now);
    this.fish.push(fish);
    this.lifetimeFish++;
    return fish;
  }
  _record(fish) {
    const newly = !this.discovered[fish.desc.subspecies.id];
    this.discovered[fish.desc.subspecies.id] = true;
    if (fish.desc.stars > this.best.stars) this.best.stars = fish.desc.stars;
    if (fish.desc.value > this.best.value) this.best.value = fish.desc.value;
    return newly;
  }
  _removeFish(id) {
    const i = this.fish.findIndex((f) => f.id === id);
    if (i < 0) return null;
    const [fish] = this.fish.splice(i, 1);
    const s = this.selected.indexOf(id);
    if (s >= 0) this.selected.splice(s, 1);
    return fish;
  }

  // --- market --------------------------------------------------------------
  refreshMarket(now = Date.now(), force = false) {
    if (!force && this.market.listings.length && now < this.market.nextRefresh) return false;
    this.market.listings = generateListings(this.rng);
    this.market.nextRefresh = now + CONFIG.market.refreshMs;
    return true;
  }

  buyListing(listingId, now = Date.now()) {
    const i = this.market.listings.findIndex((l) => l.id === listingId);
    if (i < 0) return { ok: false, msg: 'That koi has already been taken.' };
    if (this.isFull()) return { ok: false, msg: 'The pond is full — make room first.' };
    const listing = this.market.listings[i];
    if (this.coins < listing.price) return { ok: false, msg: 'Not enough coins.' };
    this.coins -= listing.price;
    const fish = this._spawn(listing.genome, now);
    const discovered = this._record(fish);
    this.market.listings.splice(i, 1);
    return { ok: true, fish, discovered, msg: `Welcomed a ${fish.desc.subspecies.name} to the pond.` };
  }

  // --- offers --------------------------------------------------------------
  tickOffers(now = Date.now()) {
    const before = this.offers.length;
    this.offers = this.offers.filter((o) => now < o.expiresAt);
    let added = null;
    if (now >= this.nextOfferAt && this.offers.length < CONFIG.offers.max) {
      added = generateOffer(this.rng, now);
      this.offers.push(added);
      this.nextOfferAt = now + CONFIG.offers.intervalMs * this.offerRateMult(now);
    } else if (now >= this.nextOfferAt) {
      // queue is full; check again soon
      this.nextOfferAt = now + 8000;
    }
    return { added, expired: before !== this.offers.length && !added };
  }

  offerMatchCount(offer) { return countMatches(offer, this.fish); }

  fulfillOffer(offerId, now = Date.now()) {
    const i = this.offers.findIndex((o) => o.id === offerId);
    if (i < 0) return { ok: false, msg: 'That visitor has left.' };
    const offer = this.offers[i];
    const fish = cheapestMatch(offer, this.fish);
    if (!fish) return { ok: false, msg: 'You have no koi matching that request.' };
    this._removeFish(fish.id);
    this.coins += offer.price;
    this.offers.splice(i, 1);
    return { ok: true, coins: offer.price, fish, msg: `Sold a ${fish.desc.subspecies.name} for 🪙 ${offer.price}!` };
  }

  // --- foods ---------------------------------------------------------------
  buyFood(foodId, now = Date.now()) {
    const food = FOOD_BY_ID[foodId];
    if (!food) return { ok: false, msg: 'No such food.' };
    if (this.coins < food.price) return { ok: false, msg: 'Not enough coins.' };
    this.coins -= food.price;
    this.buffs[food.buff.kind] = { value: food.buff.value, until: now + food.buff.ms };
    return { ok: true, msg: `Fed the pond ${food.name}. ${food.desc}` };
  }

  // --- decorations / building ---------------------------------------------
  placeDecoration(type, x, z, now = Date.now()) {
    const d = DECOR_BY_ID[type];
    if (!d) return { ok: false, msg: 'Unknown decoration.' };
    if (this.coins < d.price) return { ok: false, msg: 'Not enough coins.' };
    this.coins -= d.price;
    const rec = { id: this.nextDecoId++, type, x, z, rot: this.rng() * Math.PI * 2 };
    this.decorations.push(rec);
    return { ok: true, rec, msg: `Placed a ${d.name}.` };
  }

  removeDecoration(id) {
    const i = this.decorations.findIndex((r) => r.id === id);
    if (i < 0) return { ok: false };
    const [rec] = this.decorations.splice(i, 1);
    const d = DECOR_BY_ID[rec.type];
    const refund = d ? Math.round(d.price * 0.5) : 0;
    this.coins += refund;
    return { ok: true, rec, refund, msg: `Removed a ${d ? d.name : 'decoration'} (+🪙 ${refund}).` };
  }

  // --- capacity ------------------------------------------------------------
  buyCapacity() {
    const cost = this.capacityCost();
    if (!isFinite(cost)) return { ok: false, msg: 'Pond is already at maximum size.' };
    if (this.coins < cost) return { ok: false, msg: 'Not enough coins.' };
    this.coins -= cost;
    this.capUpgrades++;
    this.capacity = Math.min(CONFIG.maxCapacity, this.capacity + CONFIG.capacityStep);
    return { ok: true, msg: `Pond enlarged — capacity is now ${this.capacity}.` };
  }

  // --- selection -----------------------------------------------------------
  toggleSelect(id) {
    const i = this.selected.indexOf(id);
    if (i >= 0) { this.selected.splice(i, 1); return { ok: true, selected: false }; }
    if (this.selected.length >= 2) this.selected.shift();
    this.selected.push(id);
    return { ok: true, selected: true };
  }
  clearSelection() { this.selected = []; }

  // --- breeding ------------------------------------------------------------
  canBreed(now = Date.now()) {
    if (this.selected.length !== 2) return { ok: false, msg: 'Pick two koi to pair.' };
    const [a, b] = this.getSelectedFish();
    if (!a || !b) return { ok: false, msg: 'Pick two koi to pair.' };
    if (this.isFull()) return { ok: false, msg: 'Pond is full — make room first.' };
    if (this.coins < CONFIG.breedCost) return { ok: false, msg: 'Not enough coins to breed.' };
    if (now < a.breedReadyAt || now < b.breedReadyAt) return { ok: false, msg: 'A parent is still resting.' };
    return { ok: true, a, b };
  }

  // Simulated odds for the currently-selected pair (call on demand, not per frame).
  previewSelected() {
    const [a, b] = this.getSelectedFish();
    if (!a || !b) return null;
    return previewBreeding(a.genome, b.genome, { trials: CONFIG.breedPreviewTrials, rng: this.rng });
  }

  breedSelected(now = Date.now()) {
    const check = this.canBreed(now);
    if (!check.ok) return check;
    const { a, b } = check;
    this.coins -= CONFIG.breedCost;

    const q = this.breedQuality(now); // food enrichment
    const wanted = offspringCount(a.genome, b.genome, this.rng);
    const n = Math.min(wanted, this.room);

    const babies = [], discoveries = [];
    for (let i = 0; i < n; i++) {
      const g = breed(a.genome, b.genome, this.rng);
      if (q > 0) { g.luster = clamp01(g.luster + q); g.size = clamp01(g.size + q * 0.5); }
      const fish = this._spawn(g, now);
      if (this._record(fish)) discoveries.push(fish.desc.subspecies);
      babies.push(fish);
    }
    const cd = CONFIG.breedCooldownMs * this.breedSpeedMult(now);
    a.breedReadyAt = now + cd;
    b.breedReadyAt = now + cd;

    return {
      ok: true, babies, discoveries, crowded: wanted > n,
      msg: babies.length === 1 ? 'A koi was born!' : `${babies.length} koi were born!`,
    };
  }

  // --- release -------------------------------------------------------------
  release(id) {
    const fish = this.getFish(id);
    if (!fish) return { ok: false, msg: 'No such koi.' };
    const coins = Math.max(1, Math.round(fish.desc.value * 0.6));
    this.coins += coins;
    this._removeFish(id);
    return { ok: true, coins, msg: `Released a ${fish.desc.subspecies.name} for ${coins} coins.` };
  }

  // --- time ----------------------------------------------------------------
  tick(now = Date.now()) {
    const dt = Math.max(0, (now - this.lastSeen) / 1000);
    this.lastSeen = now;
    const gained = this.incomePerSec(now) * dt;
    this.coins += gained;
    return gained;
  }

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
      coins: this.coins, capacity: this.capacity, lifetimeFish: this.lifetimeFish,
      capUpgrades: this.capUpgrades, discovered: this.discovered,
      lastSeen: this.lastSeen, best: this.best, selected: this.selected,
      nextId: _id,
      fish: this.fish.map((f) => ({ id: f.id, genome: f.genome, bornAt: f.bornAt, breedReadyAt: f.breedReadyAt })),
      market: {
        nextRefresh: this.market.nextRefresh,
        listings: this.market.listings.map((l) => ({ id: l.id, genome: l.genome, price: l.price })),
      },
      offers: this.offers,
      nextOfferAt: this.nextOfferAt,
      buffs: this.buffs,
      decorations: this.decorations,
      nextDecoId: this.nextDecoId,
    };
  }

  static fromJSON(data, { rng = Math.random } = {}) {
    const s = new GameState({ now: data.lastSeen || Date.now(), rng });
    s.version = data.version || 2;
    s.coins = data.coins ?? CONFIG.startingCoins;
    s.capacity = data.capacity ?? CONFIG.startingCapacity;
    s.lifetimeFish = data.lifetimeFish ?? 0;
    s.capUpgrades = data.capUpgrades ?? 0;
    s.discovered = data.discovered ?? {};
    s.lastSeen = data.lastSeen ?? Date.now();
    s.best = data.best ?? { stars: 0, value: 0 };
    s.selected = data.selected ?? [];
    _id = Math.max(_id, data.nextId || 1);
    s.fish = (data.fish || []).map((f) => {
      const genome = makeGenome(f.genome);
      return { id: f.id, genome, desc: describe(genome), bornAt: f.bornAt ?? Date.now(), breedReadyAt: f.breedReadyAt ?? 0 };
    });
    if (data.market) {
      s.market.nextRefresh = data.market.nextRefresh ?? 0;
      s.market.listings = (data.market.listings || []).map((l) => {
        const genome = makeGenome(l.genome);
        return { id: l.id, genome, desc: describe(genome), price: l.price };
      });
    }
    s.offers = data.offers ?? [];
    s.nextOfferAt = data.nextOfferAt ?? Date.now();
    s.buffs = data.buffs ?? {};
    s.decorations = data.decorations ?? [];
    s.nextDecoId = data.nextDecoId ?? (s.decorations.reduce((m, r) => Math.max(m, r.id), 0) + 1);
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

// A brand-new game: a small starter pond plus an initial stocked market.
export function newGame({ now = Date.now(), rng = Math.random } = {}) {
  const s = new GameState({ now, rng });
  for (let i = 0; i < 3; i++) s._record(s._spawn(randomCommonGenome(rng), now));
  s.refreshMarket(now, true);
  return s;
}
