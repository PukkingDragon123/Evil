// =============================================================================
// Plenty Fish in the Sea — bootstrap & wiring.
//
// Ties together the game state (genetics + economy), the 3D pond scene, and the
// DOM UI. Owns the player actions (so state changes, scene updates, toasts and
// saving all happen in one place), input handling, the animation loop, offline
// income and autosave.
// =============================================================================

import { CONFIG } from './config.js';
import { GameState, newGame } from './game/state.js';
import { createPondScene } from './scene/pondScene.js';
import { createUI } from './ui/ui.js';

const root = document.getElementById('ui');
const stage = document.getElementById('stage');

// --- boot the 3D scene (guarded — WebGL may be unavailable) ----------------
let scene;
try {
  scene = createPondScene();
  scene.mount(stage);
} catch (err) {
  console.error(err);
  document.getElementById('loading').innerHTML =
    `<div class="fatal">This game needs WebGL.<br><small>${err.message}</small></div>`;
  throw err;
}

// --- load or start a game ---------------------------------------------------
const loaded = GameState.load();
const freshGame = !loaded;
const state = loaded || newGame();
for (const fish of state.fish) scene.addFish(fish.id, fish.desc);
scene.syncSelection(state.selected);

// --- UI (actions are defined just below; `ui` is referenced lazily) ---------
let ui;

let lastSave = Date.now();
function save() { state.save(); lastSave = Date.now(); }

function afterAction() {
  scene.syncSelection(state.selected);
  ui.refresh(Date.now());
  save();
}

function celebrate(fish) {
  if (fish.desc.stars >= 5) ui.toast(`✨ A breathtaking ${fish.desc.stars}★ ${fish.desc.subspecies.name}!`, 'great');
}

const actions = {
  buyFish(kind) {
    const r = state.buyFish(kind, Date.now());
    if (!r.ok) return ui.toast(r.msg, 'warn');
    scene.addFish(r.fish.id, r.fish.desc);
    if (r.discovered) ui.toast(`📖 New variety discovered: ${r.fish.desc.subspecies.name}!`, 'great');
    ui.toast(r.msg, 'info');
    celebrate(r.fish);
    afterAction();
  },
  buyCapacity() {
    const r = state.buyCapacity();
    ui.toast(r.msg, r.ok ? 'info' : 'warn');
    afterAction();
  },
  buyFertilizer() {
    const r = state.buyFertilizer();
    ui.toast(r.msg, r.ok ? 'info' : 'warn');
    afterAction();
  },
  buyFood() {
    const r = state.buyFood(Date.now());
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
  toggleSelect(id) {
    state.toggleSelect(id);
    ui.showInspect(id);
    afterAction();
  },
};

ui = createUI(root, { state, actions });

// --- welcome ----------------------------------------------------------------
document.getElementById('loading').remove();
if (freshGame) {
  ui.toast('🪷 Welcome to your pond. Tap a koi, or open Help (？).', 'info', 5000);
  ui.openPanel('help');
} else {
  const off = state.applyOffline(Date.now());
  if (off.gained >= 1) {
    ui.toast(`🪷 Welcome back — your koi earned 🪙 ${Math.floor(off.gained)} while you were away.`, 'great', 5000);
  }
}
ui.refresh(Date.now());

// =============================================================================
// Input — tap to select / ripple, drag to orbit, wheel to zoom.
// =============================================================================
const canvas = scene.renderer.domElement;
let down = false, dragging = false, sx = 0, sy = 0, lx = 0, ly = 0, moved = 0;

canvas.addEventListener('pointerdown', (e) => {
  down = true; dragging = false; moved = 0;
  sx = lx = e.clientX; sy = ly = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!down) return;
  const dx = e.clientX - lx, dy = e.clientY - ly;
  lx = e.clientX; ly = e.clientY;
  moved += Math.abs(dx) + Math.abs(dy);
  if (moved > 8) {
    dragging = true;
    scene.orbit(-dx * 0.005, -dy * 0.005);
  }
});

canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  down = false;
  try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  if (dragging) return; // it was a camera drag, not a tap
  const pt = scene.surfacePoint(e.clientX, e.clientY);
  if (!pt) return;
  const id = scene.nearestFish(pt);
  scene.ripples.splash(pt.x, pt.z, id != null ? 0.7 : 1.0);
  scene.startle(pt, 3.5);
  if (id != null) actions.toggleSelect(id);
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  scene.zoom(e.deltaY * 0.02);
}, { passive: false });

window.addEventListener('resize', () => scene.resize());

// Save when the tab is hidden or closed.
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

  // If the tab was backgrounded for a while, grant capped offline income
  // instead of a huge single-frame jump.
  if (now - state.lastSeen > 4000) state.applyOffline(now);
  else state.tick(now);

  scene.update(dt);
  ui.tick(now);

  if (now - lastSave > CONFIG.autosaveMs) save();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
