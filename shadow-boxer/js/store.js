/* store.js — localStorage save state for Shadow Boxer Ultimate:
   SPIN balance, owned + equipped cosmetics/styles, career stats and
   quest progress. All purchases & rewards funnel through here.
   Exposes SB.store. */
(function (global) {
  const SB = (global.SB = global.SB || {});
  const KEY = 'shadowBoxerUltimate.v1';
  const today = () => new Date().toISOString().slice(0, 10);

  const DEFAULTS = () => ({
    name: 'YOU',
    spin: 300, // enough to grab a glove or chip toward a style
    owned: { styles: ['orthodox'], gloves: ['classic'], kofx: ['flash'], arenas: ['gym'] },
    // keyed by category (plural) to match store.equip()/equipped() callers
    equip: { styles: 'orthodox', gloves: 'classic', kofx: 'flash', arenas: 'gym' },
    stats: { wins: 0, losses: 0, kos: 0, punches: 0, bestCombo: 0, damage: 0, fights: 0 },
    quests: {}, // id -> { progress, claimed, day }
    settings: { sensitivity: 1.0, sound: true },
  });

  let s = DEFAULTS();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) s = mergeDefaults(JSON.parse(raw));
    } catch (e) { /* corrupt save -> fresh */ s = DEFAULTS(); }
    rolloverDailies();
    save();
    return s;
  }

  // keep old saves working when fields are added
  function mergeDefaults(saved) {
    const d = DEFAULTS();
    const out = { ...d, ...saved };
    out.owned = { ...d.owned, ...(saved.owned || {}) };
    out.equip = { ...d.equip, ...(saved.equip || {}) };
    out.stats = { ...d.stats, ...(saved.stats || {}) };
    out.settings = { ...d.settings, ...(saved.settings || {}) };
    out.quests = saved.quests || {};
    // make sure every owned list at least holds its free default
    for (const cat of Object.keys(d.owned))
      if (!out.owned[cat] || !out.owned[cat].length) out.owned[cat] = d.owned[cat].slice();
    return out;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
  }

  // Daily quests reset their progress once per calendar day.
  function rolloverDailies() {
    const day = today();
    for (const q of SB.data.QUESTS) {
      const rec = s.quests[q.id] || (s.quests[q.id] = { progress: 0, claimed: false, day });
      if (q.daily && rec.day !== day) { rec.progress = 0; rec.claimed = false; rec.day = day; }
    }
  }

  // ---- spin ----
  const getSpin = () => s.spin;
  function addSpin(n) { s.spin = Math.max(0, s.spin + Math.round(n)); save(); return s.spin; }
  function spend(n) { if (s.spin < n) return false; s.spin -= n; save(); return true; }

  // ---- inventory ----
  const owned = (cat) => s.owned[cat] || [];
  const isOwned = (cat, id) => owned(cat).includes(id);
  function buy(cat, id, cost) {
    if (isOwned(cat, id)) return true;
    if (!spend(cost)) return false;
    s.owned[cat].push(id);
    save();
    return true;
  }
  function equip(cat, id) {
    if (!isOwned(cat, id)) return false;
    s.equip[cat] = id; save(); return true;
  }
  const equipped = (cat) => s.equip[cat];

  // ---- stats ----
  const stats = () => s.stats;
  function bump(stat, by) { s.stats[stat] = (s.stats[stat] || 0) + by; save(); }
  function best(stat, val) { if (val > (s.stats[stat] || 0)) { s.stats[stat] = val; save(); } }

  // ---- quests (record access; logic lives in quests.js) ----
  const questRec = (id) => s.quests[id] || (s.quests[id] = { progress: 0, claimed: false, day: today() });

  // ---- settings / profile ----
  const settings = () => s.settings;
  function setSetting(k, v) { s.settings[k] = v; save(); }
  function setName(n) { s.name = (n || 'YOU').slice(0, 14).toUpperCase(); save(); }
  const name = () => s.name;

  function reset() { s = DEFAULTS(); save(); }

  SB.store = {
    load, save, reset,
    getSpin, addSpin, spend,
    owned, isOwned, buy, equip, equipped,
    stats, bump, best,
    questRec, today,
    settings, setSetting, name, setName,
    get raw() { return s; },
  };
})(window);
