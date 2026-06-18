// =============================================================================
// Plenty Fish in the Sea — bootstrap & wiring.
//
// Ties the game state (genetics, economy, market, offers, foods, decorations)
// to the 3D pond scene and the dojo UI. Owns the player actions, build mode,
// input handling, the market/offer/weather ticks, the loop and autosave.
// =============================================================================

import { CONFIG } from './config.js';
import { GameState, newGame } from './game/state.js';
import { DECOR_BY_ID } from './game/decorations.js';
import { createPondScene } from './scene/pondScene.js';
import { createUI } from './ui/ui.js';

const root = document.getElementById('ui');
const stage = document.getElementById('stage');

let scene;
try {
  scene = createPondScene();
  scene.mount(stage);
} catch (err) {
  console.error(err);
  document.getElementById('loading').innerHTML = `<div class="fatal">This game needs WebGL.<br><small>${err.message}</small></div>`;
  throw err;
}

const loaded = GameState.load();
const freshGame = !loaded;
const state = loaded || newGame();
for (const fish of state.fish) scene.addFish(fish.id, fish.desc);
for (const rec of state.decorations) scene.addDecoration(rec);
scene.syncSelection(state.selected);

// --- build mode (owned here; UI reads it through `info.getBuild`) -----------
let pendingPlace = null;
let removeMode = false;

let ui;
let lastSave = Date.now();
function save() { state.save(); lastSave = Date.now(); }
function afterAction() { scene.syncSelection(state.selected); ui.refresh(Date.now()); save(); }
function celebrate(fish) { if (fish.desc.stars >= 5) ui.toast(`✨ A breathtaking ${fish.desc.stars}★ ${fish.desc.subspecies.name}!`, 'great'); }

const actions = {
  buyListing(id) {
    const r = state.buyListing(id, Date.now());
    if (!r.ok) return ui.toast(r.msg, 'warn');
    scene.addFish(r.fish.id, r.fish.desc);
    if (r.discovered) ui.toast(`📖 New variety discovered: ${r.fish.desc.subspecies.name}!`, 'great');
    ui.toast(r.msg, 'info');
    celebrate(r.fish);
    afterAction();
  },
  fulfillOffer(id) {
    const r = state.fulfillOffer(id, Date.now());
    if (!r.ok) return ui.toast(r.msg, 'warn');
    scene.removeFish(r.fish.id);
    if (ui.inspectId === r.fish.id) ui.hideInspect();
    ui.toast(r.msg, 'great');
    afterAction();
  },
  buyFood(foodId) {
    const r = state.buyFood(foodId, Date.now());
    ui.toast(r.msg, r.ok ? 'birth' : 'warn');
    afterAction();
  },
  buyCapacity() {
    const r = state.buyCapacity();
    ui.toast(r.msg, r.ok ? 'info' : 'warn');
    afterAction();
  },
  breed() {
    const r = state.breedSelected(Date.now());
    if (!r.ok) return ui.toast(r.msg, 'warn');
    for (const baby of r.babies) scene.addFish(baby.id, baby.desc);
    for (const sp of r.discoveries) ui.toast(`📖 New variety discovered: ${sp.name}!`, 'great');
    ui.toast(r.msg, 'birth');
    for (const baby of r.babies) celebrate(baby);
    if (r.crowded) ui.toast('The pond is full — some fry swam off downstream.', 'warn');
    afterAction();
  },
  release(id) {
    const r = state.release(id);
    if (!r.ok) return ui.toast(r.msg, 'warn');
    scene.removeFish(id);
    if (ui.inspectId === id) ui.hideInspect();
    ui.toast(r.msg, 'info');
    afterAction();
  },
  toggleSelect(id) { state.toggleSelect(id); ui.showInspect(id); afterAction(); },

  // build mode
  beginPlace(type) {
    const d = DECOR_BY_ID[type];
    if (!d) return;
    if (state.coins < d.price) return ui.toast('Not enough coins for that.', 'warn');
    ui.closePanel();           // gives a clear view of the garden to place in
    pendingPlace = type; removeMode = false;
    scene.setGhost(type);
  },
  toggleRemoveMode() {
    removeMode = !removeMode; pendingPlace = null; scene.clearGhost();
  },
  stopPlacing() { pendingPlace = null; removeMode = false; scene.clearGhost(); },
};

const info = {
  getWeather: () => scene.getWeather(),
  getBuild: () => ({ placingType: pendingPlace, removeMode }),
};

ui = createUI(root, { state, actions, info });

document.getElementById('loading').remove();
if (freshGame) {
  ui.toast('🪷 Welcome. Buy koi at the Market (🏮), pair them, and breed.', 'info', 5500);
  ui.openPanel('help');
} else {
  const off = state.applyOffline(Date.now());
  if (off.gained >= 1) ui.toast(`🪷 Welcome back — your koi earned 🪙 ${Math.floor(off.gained)} while away.`, 'great', 5000);
}
ui.refresh(Date.now());

// =============================================================================
// Input — tap to select / place / remove, drag to orbit, wheel to zoom.
// =============================================================================
const canvas = scene.renderer.domElement;
let down = false, dragging = false, lx = 0, ly = 0, moved = 0;

canvas.addEventListener('pointerdown', (e) => {
  down = true; dragging = false; moved = 0; lx = e.clientX; ly = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (pendingPlace) { const pt = scene.surfacePoint(e.clientX, e.clientY); if (pt) scene.moveGhost(pt); }
  if (!down) return;
  const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
  moved += Math.abs(dx) + Math.abs(dy);
  if (moved > 8) { dragging = true; scene.orbit(-dx * 0.005, -dy * 0.005); }
});
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  down = false;
  try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  if (dragging) return;
  const pt = scene.surfacePoint(e.clientX, e.clientY);
  if (!pt) return;

  // placing a decoration
  if (pendingPlace) {
    const r = state.placeDecoration(pendingPlace, pt.x, pt.z, Date.now());
    if (r.ok) { scene.addDecoration(r.rec); ui.toast(r.msg, 'info'); if (state.coins < (DECOR_BY_ID[pendingPlace]?.price || 0)) pendingPlace = null; }
    else { ui.toast(r.msg, 'warn'); pendingPlace = null; }
    afterAction();
    return;
  }
  // removing a decoration
  if (removeMode) {
    const id = scene.pickDecoration(pt);
    if (id != null) { const r = state.removeDecoration(id); scene.removeDecoration(id); ui.toast(r.msg, 'info'); afterAction(); }
    else ui.toast('Tap a placed piece to remove it.', 'warn');
    return;
  }
  // otherwise: ripple + select a koi
  const id = scene.nearestFish(pt);
  scene.ripples.splash(pt.x, pt.z, id != null ? 0.7 : 1.0);
  scene.startle(pt, 3.5);
  if (id != null) actions.toggleSelect(id);
});
canvas.addEventListener('wheel', (e) => { e.preventDefault(); scene.zoom(e.deltaY * 0.02); }, { passive: false });
window.addEventListener('resize', () => scene.resize());
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('beforeunload', save);

// =============================================================================
// Main loop
// =============================================================================
let last = performance.now();
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  const now = Date.now();

  if (now - state.lastSeen > 4000) state.applyOffline(now);
  else state.tick(now);

  // market & visitors (quietly — no nagging)
  if (state.refreshMarket(now)) ui.refresh(now);
  const ot = state.tickOffers(now);
  if (ot.added) { ui.toast(`🙇 A visitor — ${ot.added.label}`, 'info'); ui.refresh(now); }
  else if (ot.expired) ui.refresh(now);

  scene.update(dt);
  ui.tick(now);

  if (now - lastSave > CONFIG.autosaveMs) save();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
