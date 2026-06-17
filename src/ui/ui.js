// =============================================================================
// UI layer — a DOM overlay above the 3D canvas.
//
// Builds the HUD, the bottom toolbar, the slide-in panels (Shop / Breed /
// Koi-dex), a help sheet, and the fish inspection card. It reads the game
// state to render and calls back into `actions` to mutate it. main.js owns the
// actions (so scene + toasts + persistence stay in one place) and calls
// refresh()/tick() to keep the overlay in sync.
// =============================================================================

import { CONFIG } from '../config.js';
import { SUBSPECIES } from '../game/genetics.js';
import { createToaster } from './toast.js';

const fmt = (n) => {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
};
const stars = (n) => '★★★★★☆☆☆☆☆'.slice(5 - n, 10 - n);
const swatch = (c) => `<i class="sw" style="background:hsl(${c.h} ${c.s}% ${c.l}%)"></i>`;
const bar = (label, v) =>
  `<div class="trait"><label>${label}</label><div class="bar"><span style="width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%"></span></div></div>`;

export function createUI(root, { state, actions }) {
  const toaster = createToaster(root);

  // --- build skeleton ---
  root.insertAdjacentHTML('beforeend', `
    <div class="brand"><h1>Plenty Fish<span>in the Sea</span></h1></div>

    <div class="hud">
      <div class="pill" title="Coins"><b>🪙</b> <span id="hud-coins">0</span></div>
      <div class="pill" title="Pond population"><b>🐟</b> <span id="hud-pop">0/0</span></div>
      <div class="pill" title="Koi bred — your score"><b>🧬</b> <span id="hud-bred">0</span></div>
      <div class="pill" title="Income per second"><b>✨</b> <span id="hud-income">0</span>/s</div>
      <div class="pill" title="Best koi"><b>🏆</b> <span id="hud-best">—</span></div>
      <div class="pill pill--feed" id="hud-feed" hidden><b>🍃</b> <span id="hud-feed-t">0s</span></div>
    </div>

    <div class="toolbar">
      <button class="tool" data-panel="shop">🛒<small>Shop</small></button>
      <button class="tool tool--breed" id="tool-breed">🧬<small>Breed</small></button>
      <button class="tool" data-panel="koidex">📖<small>Koi-dex</small></button>
      <button class="tool" id="tool-feed">🍃<small>Feed</small></button>
      <button class="tool" data-panel="help">？<small>Help</small></button>
    </div>

    <aside class="panel" id="panel" hidden>
      <button class="panel__close" id="panel-close">✕</button>
      <div class="panel__body" id="panel-body"></div>
    </aside>

    <div class="inspect" id="inspect" hidden></div>
  `);

  const el = {
    coins: root.querySelector('#hud-coins'),
    pop: root.querySelector('#hud-pop'),
    bred: root.querySelector('#hud-bred'),
    income: root.querySelector('#hud-income'),
    best: root.querySelector('#hud-best'),
    feed: root.querySelector('#hud-feed'),
    feedT: root.querySelector('#hud-feed-t'),
    breedTool: root.querySelector('#tool-breed'),
    panel: root.querySelector('#panel'),
    panelBody: root.querySelector('#panel-body'),
    inspect: root.querySelector('#inspect'),
  };

  let panelName = null;
  let inspectId = null;

  // --- toolbar wiring ---
  root.querySelectorAll('[data-panel]').forEach((b) =>
    b.addEventListener('click', () => togglePanel(b.dataset.panel)));
  root.querySelector('#panel-close').addEventListener('click', () => closePanel());
  el.breedTool.addEventListener('click', () => actions.breed());
  root.querySelector('#tool-feed').addEventListener('click', () => actions.buyFood());

  // =====================================================================
  // Panels
  // =====================================================================
  function togglePanel(name) { panelName === name ? closePanel() : openPanel(name); }
  function openPanel(name) {
    panelName = name;
    el.panel.hidden = false;
    el.panel.dataset.kind = name;
    renderPanel();
  }
  function closePanel() { panelName = null; el.panel.hidden = true; }

  function renderPanel() {
    if (!panelName) return;
    if (panelName === 'shop') renderShop();
    else if (panelName === 'koidex') renderKoidex();
    else if (panelName === 'breed') renderBreed();
    else if (panelName === 'help') renderHelp();
  }

  function shopRow(icon, title, desc, cost, enabled, onBuy, costLabel) {
    return { icon, title, desc, cost, enabled, onBuy, costLabel };
  }

  function renderShop() {
    const s = state;
    const rows = [
      shopRow('🐟', 'Common Koi', 'A modest pond koi — a fresh line to begin from.',
        s.basicFishCost('common'), !s.isFull() && s.coins >= s.basicFishCost('common'),
        () => actions.buyFish('common')),
      shopRow('🌿', 'Wild Koi', 'Unpredictable wild stock. Rare traits hide in here.',
        s.basicFishCost('wild'), !s.isFull() && s.coins >= s.basicFishCost('wild'),
        () => actions.buyFish('wild')),
      shopRow('🪷', `Enlarge Pond  (+${CONFIG.capacityStep})`,
        s.capacity >= CONFIG.maxCapacity ? 'The pond is as large as it can be.' : 'Room for more koi to thrive.',
        s.capacityCost(), s.capacity < CONFIG.maxCapacity && s.coins >= s.capacityCost(),
        () => actions.buyCapacity(), s.capacity >= CONFIG.maxCapacity ? 'MAX' : null),
      shopRow('🍃', 'Fish Food', `Double pond income for ${Math.round(CONFIG.feedBoostMs / 1000)}s.`,
        CONFIG.feedCost, s.coins >= CONFIG.feedCost, () => actions.buyFood()),
      shopRow('💮', 'Fertilizer', 'Instantly rest-ready every koi for breeding.',
        CONFIG.fertilizerCost, s.coins >= CONFIG.fertilizerCost, () => actions.buyFertilizer()),
    ];
    el.panelBody.innerHTML = `<h2>🛒 Shop</h2><div class="shop">` + rows.map((r, i) => `
      <div class="shop__row">
        <div class="shop__icon">${r.icon}</div>
        <div class="shop__txt"><b>${r.title}</b><span>${r.desc}</span></div>
        <button class="buy" data-i="${i}" ${r.enabled ? '' : 'disabled'}>
          ${r.costLabel ? r.costLabel : '🪙 ' + fmt(r.cost)}
        </button>
      </div>`).join('') + `</div>`;
    el.panelBody.querySelectorAll('.buy').forEach((b) =>
      b.addEventListener('click', () => { rows[+b.dataset.i].onBuy(); }));
  }

  function renderKoidex() {
    const total = SUBSPECIES.length;
    const found = SUBSPECIES.filter((s) => state.discovered[s.id]).length;
    el.panelBody.innerHTML = `<h2>📖 Koi-dex <small>${found}/${total} discovered</small></h2>
      <div class="dex">` + SUBSPECIES.map((sp) => {
        const got = state.discovered[sp.id];
        const r = Math.max(1, Math.min(5, Math.round(sp.rarity)));
        return got
          ? `<div class="dex__card">
               <div class="dex__name">${sp.name}</div>
               <div class="dex__jp">${sp.jp}</div>
               <div class="dex__rar">${stars(r)}</div>
               <p>${sp.desc}</p>
             </div>`
          : `<div class="dex__card dex__card--locked"><div class="dex__q">？</div><span>Undiscovered</span></div>`;
      }).join('') + `</div>`;
  }

  function miniCard(fish) {
    const d = fish.desc, p = d.phenotype;
    return `<div class="mini">
      <div class="mini__name">${d.subspecies.name}</div>
      <div class="mini__sw">${swatch(p.base)}${swatch(p.patch)}</div>
      <div class="mini__stars">${stars(d.stars)}</div>
    </div>`;
  }

  function renderBreed() {
    const sel = state.selected.map((id) => state.getFish(id)).filter(Boolean);
    let body;
    if (sel.length < 2) {
      body = `<p class="hint">Tap two koi in the pond to pair them, then breed to mix their genes.
        Offspring inherit a blend of both parents — with the occasional surprise mutation.</p>`;
    } else {
      const can = state.canBreed();
      body = `<div class="pair">${miniCard(sel[0])}<div class="pair__heart">♥</div>${miniCard(sel[1])}</div>
        <button class="breedbtn" id="do-breed" ${can.ok ? '' : 'disabled'}>
          ${can.ok ? `Breed  ·  🪙 ${CONFIG.breedCost}` : can.msg}
        </button>`;
    }
    el.panelBody.innerHTML = `<h2>🧬 Breeding</h2>${body}`;
    const btn = el.panelBody.querySelector('#do-breed');
    if (btn) btn.addEventListener('click', () => actions.breed());
  }

  function renderHelp() {
    el.panelBody.innerHTML = `<h2>？ How to play</h2>
      <div class="help">
        <p><b>Goal:</b> raise as many koi as you can — and breed ever finer fish.</p>
        <p>🪙 Your pond earns <b>coins</b> every second. Better, rarer koi earn more.</p>
        <p>🛒 Spend coins in the <b>Shop</b> on new koi, a bigger pond, food and fertilizer.</p>
        <p>🐟 <b>Tap a koi</b> to inspect it. Tap two to <b>pair</b> them, then <b>Breed</b> (🧬).</p>
        <p>🧬 Offspring blend both parents' <b>genes</b>; rare mutations create new traits.</p>
        <p>📖 Matching trait combinations reveal real koi <b>varieties</b> for your Koi-dex.</p>
        <p>🌊 Drag to look around, scroll to zoom, and tap the water to make ripples.</p>
        <p>♻️ Pond full? <b>Release</b> a koi for coins to make room for finer fish.</p>
      </div>`;
  }

  // =====================================================================
  // Inspect card
  // =====================================================================
  function showInspect(fishId) { inspectId = fishId; renderInspect(); }
  function hideInspect() { inspectId = null; el.inspect.hidden = true; }

  function renderInspect() {
    const fish = inspectId != null ? state.getFish(inspectId) : null;
    if (!fish) { el.inspect.hidden = true; return; }
    const d = fish.desc, p = d.phenotype;
    const selected = state.isSelected(fish.id);
    el.inspect.hidden = false;
    el.inspect.innerHTML = `
      <button class="inspect__x" id="insp-x">✕</button>
      <div class="inspect__head">
        <div>
          <div class="inspect__name">${d.subspecies.name}</div>
          <div class="inspect__jp">${d.subspecies.jp}</div>
        </div>
        <div class="inspect__stars">${stars(d.stars)}</div>
      </div>
      <div class="inspect__sw">${swatch(p.base)}${swatch(p.patch)}
        <span class="tag">${p.pattern}</span><span class="tag">${p.fin} fins</span>
        ${p.hasSumi ? '<span class="tag tag--sumi">sumi</span>' : ''}</div>
      <div class="traits">
        ${bar('Size', p.sizeNorm)}
        ${bar('Lustre', p.luster)}
        ${bar('Pattern', p.patternRarity)}
        ${bar('Fins', p.finRarity)}
        ${bar('Vigour', p.vigor)}
        ${bar('Fertility', p.fertility)}
      </div>
      <div class="inspect__stats">
        <span>✨ ${d.income.toFixed(2)}/s</span>
        <span>🪙 worth ${fmt(d.value)}</span>
      </div>
      <div class="inspect__btns">
        <button id="insp-pair" class="${selected ? 'on' : ''}">${selected ? '♥ Paired' : '♡ Pair'}</button>
        <button id="insp-rel" class="ghost">Release +🪙${fmt(Math.max(1, Math.round(d.value * 0.6)))}</button>
      </div>`;
    el.inspect.querySelector('#insp-x').addEventListener('click', hideInspect);
    el.inspect.querySelector('#insp-pair').addEventListener('click', () => actions.toggleSelect(fish.id));
    el.inspect.querySelector('#insp-rel').addEventListener('click', () => actions.release(fish.id));
  }

  // =====================================================================
  // HUD / per-frame tick
  // =====================================================================
  function renderHud(now) {
    el.coins.textContent = fmt(state.coins);
    el.pop.textContent = `${state.count}/${state.capacity}`;
    el.bred.textContent = fmt(state.lifetimeFish);
    el.income.textContent = fmt(state.incomePerSec(now)) === '0'
      ? state.incomePerSec(now).toFixed(2) : fmt(state.incomePerSec(now));
    el.best.textContent = state.best.stars ? stars(state.best.stars) : '—';

    const feedLeft = state.feedUntil - now;
    if (feedLeft > 0) { el.feed.hidden = false; el.feedT.textContent = Math.ceil(feedLeft / 1000) + 's'; }
    else el.feed.hidden = true;

    // Breed tool state.
    const can = state.canBreed(now);
    el.breedTool.classList.toggle('ready', can.ok);
    el.breedTool.classList.toggle('armed', state.selected.length === 2);
  }

  // Light, cheap refresh every frame (numbers + cooldown labels).
  function tick(now) {
    renderHud(now);
    // keep breed panel button label live (cooldown counting down)
    if (panelName === 'breed') {
      const btn = el.panelBody.querySelector('#do-breed');
      if (btn) {
        const can = state.canBreed(now);
        btn.disabled = !can.ok;
        btn.textContent = can.ok ? `Breed  ·  🪙 ${CONFIG.breedCost}` : can.msg;
      }
    }
  }

  // Full refresh after a state-changing action.
  function refresh(now = Date.now()) {
    renderHud(now);
    renderPanel();
    renderInspect();
  }

  return {
    toast: toaster.toast,
    tick, refresh,
    openPanel, closePanel, togglePanel,
    showInspect, hideInspect,
    get inspectId() { return inspectId; },
  };
}
