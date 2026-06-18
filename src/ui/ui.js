// =============================================================================
// UI layer — a dojo-styled DOM overlay above the 3D pond.
//
// HUD + toolbar + slide-in panels: Market (買), Visitors/offers (客), Breeding
// Cave with simulated odds (繁殖), Shop/foods (店), Build (普請), Koi-dex (図鑑)
// and Help (道場), plus the fish inspect card. Reads game state to render and
// calls back into `actions` (owned by main) to mutate it.
// =============================================================================

import { CONFIG } from '../config.js';
import { SUBSPECIES } from '../game/genetics.js';
import { FOODS } from '../game/foods.js';
import { DECOR } from '../game/decorations.js';
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
const secs = (ms) => Math.max(0, Math.ceil(ms / 1000)) + 's';

export function createUI(root, { state, actions, info }) {
  const toaster = createToaster(root);

  root.insertAdjacentHTML('beforeend', `
    <div class="brand"><div class="seal">鯉</div><h1>Plenty Fish<span>in the Sea</span></h1></div>

    <div class="hud">
      <div class="pill" title="Coins"><b>🪙</b> <span id="hud-coins">0</span></div>
      <div class="pill" title="Pond population"><b>🐟</b> <span id="hud-pop">0/0</span></div>
      <div class="pill" title="Koi raised — your score"><b>🧬</b> <span id="hud-bred">0</span></div>
      <div class="pill" title="Income per second"><b>✨</b> <span id="hud-income">0</span>/s</div>
      <div class="pill" id="hud-weather" title="Weather"><b>☀️</b> <span id="hud-weather-t">Sunny</span></div>
      <div class="pill pill--buff" id="hud-buff" hidden></div>
    </div>

    <div class="toolbar">
      <button class="tool" data-panel="market">🏮<small>Market</small></button>
      <button class="tool" data-panel="offers">🙇<small>Visitors</small></button>
      <button class="tool tool--breed" id="tool-breed" data-panel="breed">🧬<small>Breed</small></button>
      <button class="tool" data-panel="shop">🍃<small>Shop</small></button>
      <button class="tool" data-panel="build">⛩️<small>Build</small></button>
      <button class="tool" data-panel="koidex">📖<small>Koi-dex</small></button>
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
    weather: root.querySelector('#hud-weather'),
    weatherT: root.querySelector('#hud-weather-t'),
    buff: root.querySelector('#hud-buff'),
    breedTool: root.querySelector('#tool-breed'),
    panel: root.querySelector('#panel'),
    panelBody: root.querySelector('#panel-body'),
    inspect: root.querySelector('#inspect'),
  };

  let panelName = null;
  let inspectId = null;
  let preview = null, previewKey = '';

  root.querySelectorAll('[data-panel]').forEach((b) =>
    b.addEventListener('click', () => togglePanel(b.dataset.panel)));
  root.querySelector('#panel-close').addEventListener('click', () => closePanel());

  // ===========================================================================
  function togglePanel(name) { panelName === name ? closePanel() : openPanel(name); }
  function openPanel(name) {
    if (name !== 'build') actions.stopPlacing?.();
    panelName = name; el.panel.hidden = false; el.panel.dataset.kind = name; renderPanel();
  }
  function closePanel() { actions.stopPlacing?.(); panelName = null; el.panel.hidden = true; }

  function renderPanel() {
    if (!panelName) return;
    ({ market: renderMarket, offers: renderOffers, breed: renderBreed, shop: renderShop, build: renderBuild, koidex: renderKoidex, help: renderHelp }[panelName] || (() => {}))();
  }

  // --- Market ---------------------------------------------------------------
  function listingCard(l) {
    const d = l.desc, p = d.phenotype;
    const afford = state.coins >= l.price && !state.isFull();
    return `<div class="listing">
      <div class="listing__top">
        <div><div class="listing__name">${d.subspecies.name}</div><div class="listing__jp">${d.subspecies.jp}</div></div>
        <div class="listing__stars">${stars(d.stars)}</div>
      </div>
      <div class="listing__sw">${swatch(p.base)}${swatch(p.patch)}
        <span class="tag">${p.pattern}</span><span class="tag">${p.fin}</span>${p.hasSumi ? '<span class="tag tag--sumi">sumi</span>' : ''}</div>
      <div class="listing__buy">
        <span>✨ ${d.income.toFixed(2)}/s</span>
        <button class="buy" data-buy="${l.id}" ${afford ? '' : 'disabled'}>🪙 ${fmt(l.price)}</button>
      </div>
    </div>`;
  }
  function renderMarket() {
    const left = state.market.nextRefresh - Date.now();
    el.panelBody.innerHTML = `<h2>🏮 Koi Market · 市場</h2>
      <p class="countdown">New koi arrive in <b id="mkt-count">${secs(left)}</b>. ${state.isFull() ? '⚠️ Pond full — make room.' : ''}</p>
      <div class="listings">${state.market.listings.map(listingCard).join('') || '<p class="hint">The market is empty — check back soon.</p>'}</div>`;
    el.panelBody.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => actions.buyListing(b.dataset.buy)));
  }

  // --- Visitors / offers ----------------------------------------------------
  function offerCard(o) {
    const matches = state.offerMatchCount(o);
    return `<div class="offer">
      <div class="offer__txt"><b>${o.label}</b><span class="${matches ? 'ok' : 'no'}">${matches ? `You have ${matches} matching koi` : 'No matching koi yet'}</span></div>
      <button class="buy" data-fulfill="${o.id}" ${matches ? '' : 'disabled'}>🪙 ${fmt(o.price)}</button>
    </div>`;
  }
  function renderOffers() {
    const left = state.nextOfferAt - Date.now();
    el.panelBody.innerHTML = `<h2>🙇 Visitors · 客</h2>
      <p class="countdown">Buyers pay a premium for the koi they seek. ${state.offers.length < CONFIG.offers.max ? `Next visitor ~<b id="off-count">${secs(left)}</b>.` : 'A queue has formed!'}</p>
      <div class="offers">${state.offers.map(offerCard).join('') || '<p class="hint">No visitors right now. Raise fine koi and they will come.</p>'}</div>`;
    el.panelBody.querySelectorAll('[data-fulfill]').forEach((b) => b.addEventListener('click', () => actions.fulfillOffer(b.dataset.fulfill)));
  }

  // --- Breeding cave (simulated odds) ---------------------------------------
  function miniCard(fish) {
    const d = fish.desc, p = d.phenotype;
    return `<div class="mini"><div class="mini__name">${d.subspecies.name}</div>
      <div class="mini__sw">${swatch(p.base)}${swatch(p.patch)}</div><div class="mini__stars">${stars(d.stars)}</div></div>`;
  }
  function renderBreed() {
    const sel = state.getSelectedFish();
    let body;
    if (sel.length < 2) {
      preview = null; previewKey = '';
      body = `<p class="hint">Tap two koi in the pond to choose a pair, then study their breeding possibilities here before you commit.</p>`;
    } else {
      const key = sel.map((f) => f.id).join('-');
      if (key !== previewKey) { preview = state.previewSelected(); previewKey = key; }
      const can = state.canBreed();
      const top = preview.dist.slice(0, 5).map((d) => `
        <div class="obar"><label>${d.name}</label><div class="bar"><span style="width:${Math.round(d.pct * 100)}%"></span></div><b>${Math.round(d.pct * 100)}%</b></div>`).join('');
      const starsRow = [1, 2, 3, 4, 5].map((s) => {
        const pct = preview.starHist[s] / preview.trials;
        return `<div class="starbar"><span style="height:${Math.round(8 + pct * 60)}px"></span><label>${s}★</label></div>`;
      }).join('');
      body = `
        <div class="pair">${miniCard(sel[0])}<div class="pair__heart">♥</div>${miniCard(sel[1])}</div>
        <h3>Likely varieties</h3><div class="odds">${top}</div>
        <h3>Quality spread</h3><div class="stars-spread">${starsRow}</div>
        <div class="preview-stats"><span>✨ best ${stars(preview.bestStars)}</span><span>avg ${preview.avgStars.toFixed(1)}★</span><span>🌟 new-trait ${Math.round(preview.mutationChance * 100)}%</span></div>
        <button class="breedbtn" id="do-breed" ${can.ok ? '' : 'disabled'}>${can.ok ? `Breed this pair · 🪙 ${CONFIG.breedCost}` : can.msg}</button>`;
    }
    el.panelBody.innerHTML = `<h2>🧬 Breeding Cave · 繁殖の洞</h2>${body}`;
    const btn = el.panelBody.querySelector('#do-breed');
    if (btn) btn.addEventListener('click', () => actions.breed());
  }

  // --- Shop (pond + foods) --------------------------------------------------
  function renderShop() {
    const capCost = state.capacityCost();
    const capRow = `<div class="shop__row">
      <div class="shop__icon">🪷</div>
      <div class="shop__txt"><b>Enlarge Pond (+${CONFIG.capacityStep})</b><span>${state.capacity >= CONFIG.maxCapacity ? 'The pond is as large as it can be.' : 'Room for more koi.'}</span></div>
      <button class="buy" id="buy-cap" ${state.capacity < CONFIG.maxCapacity && state.coins >= capCost ? '' : 'disabled'}>${state.capacity >= CONFIG.maxCapacity ? 'MAX' : '🪙 ' + fmt(capCost)}</button>
    </div>`;
    const foods = FOODS.map((f) => `<div class="shop__row">
      <div class="shop__icon">🍙</div>
      <div class="shop__txt"><b>${f.name} · ${f.jp}</b><span>${f.desc}</span></div>
      <button class="buy" data-food="${f.id}" ${state.coins >= f.price ? '' : 'disabled'}>🪙 ${fmt(f.price)}</button>
    </div>`).join('');
    el.panelBody.innerHTML = `<h2>🍃 Shop · 店</h2><div class="shop">${capRow}${foods}</div>`;
    el.panelBody.querySelector('#buy-cap').addEventListener('click', () => actions.buyCapacity());
    el.panelBody.querySelectorAll('[data-food]').forEach((b) => b.addEventListener('click', () => actions.buyFood(b.dataset.food)));
  }

  // --- Build ----------------------------------------------------------------
  function renderBuild() {
    const b = info.getBuild ? info.getBuild() : {};
    const cards = DECOR.map((d) => `<div class="build__card ${b.placingType === d.id ? 'active' : ''}">
      <div class="build__icon">${d.icon}</div>
      <div class="build__name">${d.name}<small>${d.jp}</small></div>
      <button class="buy" data-place="${d.id}" ${state.coins >= d.price ? '' : 'disabled'}>🪙 ${fmt(d.price)}</button>
    </div>`).join('');
    el.panelBody.innerHTML = `<h2>⛩️ Build · 普請</h2>
      <p class="hint">Choose a piece, then <b>tap the garden</b> to place it. ${b.placingType ? `Placing <b>${b.placingType}</b>…` : ''}</p>
      <button class="toolbtn ${b.removeMode ? 'active' : ''}" id="rm-toggle">${b.removeMode ? '✓ Remove mode — tap a piece to sell it' : '🗑 Remove mode'}</button>
      <div class="buildgrid">${cards}</div>`;
    el.panelBody.querySelectorAll('[data-place]').forEach((bt) => bt.addEventListener('click', () => { actions.beginPlace(bt.dataset.place); renderBuild(); }));
    el.panelBody.querySelector('#rm-toggle').addEventListener('click', () => { actions.toggleRemoveMode(); renderBuild(); });
  }

  // --- Koi-dex --------------------------------------------------------------
  function renderKoidex() {
    const total = SUBSPECIES.length;
    const found = SUBSPECIES.filter((s) => state.discovered[s.id]).length;
    el.panelBody.innerHTML = `<h2>📖 Koi-dex · 図鑑 <small>${found}/${total}</small></h2><div class="dex">` +
      SUBSPECIES.map((sp) => {
        const got = state.discovered[sp.id];
        const r = Math.max(1, Math.min(5, Math.round(sp.rarity)));
        return got
          ? `<div class="dex__card"><div class="dex__name">${sp.name}</div><div class="dex__jp">${sp.jp}</div><div class="dex__rar">${stars(r)}</div><p>${sp.desc}</p></div>`
          : `<div class="dex__card dex__card--locked"><div class="dex__q">？</div><span>Undiscovered</span></div>`;
      }).join('') + `</div>`;
  }

  function renderHelp() {
    el.panelBody.innerHTML = `<h2>？ How to play · 道場</h2><div class="help">
      <p><b>Goal:</b> raise as many fine koi as you can. Koi are precious now.</p>
      <p>🏮 <b>Market</b> — three koi arrive each minute with their own traits, rarity & price. Buy the bloodlines you want.</p>
      <p>🙇 <b>Visitors</b> seek a particular variety or trait and pay a premium — your steadiest income.</p>
      <p>🧬 <b>Breeding Cave</b> — pick two koi, study the simulated odds of each variety & quality, then breed.</p>
      <p>🍃 <b>Shop</b> — enlarge the pond and feed special foods (income, faster breeding, finer broods, more visitors).</p>
      <p>⛩️ <b>Build</b> — buy lanterns, torii, bridges, trees, ducks & more, then tap to place them.</p>
      <p>🌦️ Weather drifts from sun to rain. 🦆 Ducks paddle, 🐌 snails roam. Drag to look, scroll to zoom.</p>
    </div>`;
  }

  // --- inspect card ---------------------------------------------------------
  function showInspect(fishId) { inspectId = fishId; renderInspect(); }
  function hideInspect() { inspectId = null; el.inspect.hidden = true; }
  function renderInspect() {
    const fish = inspectId != null ? state.getFish(inspectId) : null;
    if (!fish) { el.inspect.hidden = true; return; }
    const d = fish.desc, p = d.phenotype, selected = state.isSelected(fish.id);
    el.inspect.hidden = false;
    el.inspect.innerHTML = `
      <button class="inspect__x" id="insp-x">✕</button>
      <div class="inspect__head"><div><div class="inspect__name">${d.subspecies.name}</div><div class="inspect__jp">${d.subspecies.jp}</div></div><div class="inspect__stars">${stars(d.stars)}</div></div>
      <div class="inspect__sw">${swatch(p.base)}${swatch(p.patch)}<span class="tag">${p.pattern}</span><span class="tag">${p.fin} fins</span>${p.hasSumi ? '<span class="tag tag--sumi">sumi</span>' : ''}</div>
      <div class="traits">${bar('Size', p.sizeNorm)}${bar('Lustre', p.luster)}${bar('Pattern', p.patternRarity)}${bar('Fins', p.finRarity)}${bar('Vigour', p.vigor)}${bar('Fertility', p.fertility)}</div>
      <div class="inspect__stats"><span>✨ ${d.income.toFixed(2)}/s</span><span>🪙 worth ${fmt(d.value)}</span></div>
      <div class="inspect__btns">
        <button id="insp-pair" class="${selected ? 'on' : ''}">${selected ? '♥ Paired' : '♡ Pair'}</button>
        <button id="insp-rel" class="ghost">Release +🪙${fmt(Math.max(1, Math.round(d.value * 0.6)))}</button>
      </div>`;
    el.inspect.querySelector('#insp-x').addEventListener('click', hideInspect);
    el.inspect.querySelector('#insp-pair').addEventListener('click', () => actions.toggleSelect(fish.id));
    el.inspect.querySelector('#insp-rel').addEventListener('click', () => actions.release(fish.id));
  }

  // --- HUD / tick -----------------------------------------------------------
  function renderHud(now) {
    el.coins.textContent = fmt(state.coins);
    el.pop.textContent = `${state.count}/${state.capacity}`;
    el.bred.textContent = fmt(state.lifetimeFish);
    const inc = state.incomePerSec(now);
    el.income.textContent = inc >= 1 ? fmt(inc) : inc.toFixed(2);

    if (info.getWeather) {
      const w = info.getWeather();
      const sp = w.label.split(' ');
      el.weather.querySelector('b').textContent = sp[0];
      el.weatherT.textContent = sp.slice(1).join(' ') || w.name;
    }

    const buffs = state.activeBuffs(now);
    if (buffs.length) { el.buff.hidden = false; el.buff.innerHTML = `<b>🍙</b> ${buffs.length} buff${buffs.length > 1 ? 's' : ''}`; }
    else el.buff.hidden = true;

    const can = state.canBreed(now);
    el.breedTool.classList.toggle('ready', can.ok);
    el.breedTool.classList.toggle('armed', state.selected.length === 2);
  }

  function tick(now) {
    renderHud(now);
    if (panelName === 'market') { const c = el.panelBody.querySelector('#mkt-count'); if (c) c.textContent = secs(state.market.nextRefresh - now); }
    if (panelName === 'offers') { const c = el.panelBody.querySelector('#off-count'); if (c) c.textContent = secs(state.nextOfferAt - now); }
    if (panelName === 'breed') { const b = el.panelBody.querySelector('#do-breed'); if (b) { const can = state.canBreed(now); b.disabled = !can.ok; b.textContent = can.ok ? `Breed this pair · 🪙 ${CONFIG.breedCost}` : can.msg; } }
  }

  function refresh(now = Date.now()) { renderHud(now); renderPanel(); renderInspect(); }

  return {
    toast: toaster.toast,
    tick, refresh,
    openPanel, closePanel, togglePanel,
    showInspect, hideInspect,
    get inspectId() { return inspectId; },
  };
}
