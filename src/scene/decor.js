// =============================================================================
// Decoration models + placement manager for the building system.
// buildDecoration(type) returns a low-poly, characterful Japanese-garden model.
// createDecor() tracks placed structures by id so they can be removed.
// (Ducks & snails are handled by critters.js; pondScene routes those.)
// =============================================================================

import * as THREE from 'three';

const STONE = 0x9a958c, DARKWOOD = 0x5b3b26, RED = 0xc0392b, GREEN = 0x4f7a3a;
const std = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...opts });
function mesh(geo, mat) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; }
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };

function lantern() {
  const g = new THREE.Group();
  const s = std(STONE);
  g.add(at(mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.2, 6), s), 0, 0.1, 0));
  g.add(at(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 6), s), 0, 0.45, 0));
  const box = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.32, 6), std(0x6a655c));
  box.position.y = 0.86; g.add(box);
  const glow = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.26, 6), std(0xffdf9a, { emissive: 0xffb347, emissiveIntensity: 0.9 }));
  glow.position.y = 0.86; glow.castShadow = false; g.add(glow);
  const roof = mesh(new THREE.ConeGeometry(0.42, 0.3, 6), s); roof.position.y = 1.16; g.add(roof);
  g.add(at(mesh(new THREE.ConeGeometry(0.08, 0.16, 6), s), 0, 1.36, 0));
  return g;
}

function torii() {
  const g = new THREE.Group();
  const m = std(RED, { roughness: 0.6 });
  for (const s of [-1, 1]) {
    const post = mesh(new THREE.CylinderGeometry(0.14, 0.17, 2.4, 10), m);
    post.position.set(s * 0.9, 1.2, 0); g.add(post);
  }
  const kasagi = mesh(new THREE.BoxGeometry(2.6, 0.22, 0.34), m); kasagi.position.y = 2.42; g.add(kasagi);
  const top = mesh(new THREE.BoxGeometry(2.9, 0.16, 0.28), std(0x222024)); top.position.y = 2.6; g.add(top);
  const nuki = mesh(new THREE.BoxGeometry(2.2, 0.16, 0.26), m); nuki.position.y = 1.9; g.add(nuki);
  g.scale.setScalar(0.9);
  return g;
}

function bridge() {
  const g = new THREE.Group();
  const wood = std(RED, { roughness: 0.6 });
  // an arched walkway: two side rails plus stepped planks
  const arch = mesh(new THREE.TorusGeometry(1.4, 0.12, 8, 24, Math.PI), wood);
  arch.rotation.x = Math.PI / 2; arch.position.y = 0.1;
  const arch2 = arch.clone(); arch2.position.z = 0.7; arch.position.z = -0.7; g.add(arch, arch2);
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI;
    const plank = mesh(new THREE.BoxGeometry(0.22, 0.06, 1.5), wood);
    plank.position.set(Math.cos(a) * 1.4, 0.1 + Math.sin(a) * 1.4, 0);
    plank.rotation.z = a - Math.PI / 2; g.add(plank);
  }
  return g;
}

function pagoda() {
  const g = new THREE.Group();
  const wood = std(0x6b4a30), roofM = std(0x2f3a44), white = std(0xeae3d2);
  let y = 0;
  for (let tier = 0; tier < 5; tier++) {
    const w = 1.6 - tier * 0.24;
    const wall = mesh(new THREE.BoxGeometry(w, 0.5, w), tier % 2 ? white : wood);
    wall.position.y = y + 0.25; g.add(wall);
    const roof = mesh(new THREE.ConeGeometry(w * 0.95, 0.4, 4), roofM);
    roof.position.y = y + 0.7; roof.rotation.y = Math.PI / 4; g.add(roof);
    y += 0.85;
  }
  g.add(at(mesh(new THREE.ConeGeometry(0.1, 0.5, 6), std(0xc8a44a)), 0, y + 0.2, 0));
  g.scale.setScalar(0.8);
  return g;
}

function bonsai() {
  const g = new THREE.Group();
  const pot = mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.24, 8), std(0x7a3b2e));
  pot.position.y = 0.12; g.add(pot);
  const trunk = mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.4, 6), std(0x5b3b26));
  trunk.position.y = 0.42; trunk.rotation.z = 0.2; g.add(trunk);
  for (const o of [[0, 0.7, 0, 0.28], [0.18, 0.62, 0.1, 0.2], [-0.16, 0.66, -0.08, 0.18]]) {
    const f = mesh(new THREE.IcosahedronGeometry(o[3], 0), std(GREEN));
    f.position.set(o[0], o[1], o[2]); g.add(f);
  }
  return g;
}

function steppingStones() {
  const g = new THREE.Group();
  const s = std(0x7f7a70);
  for (let i = 0; i < 4; i++) {
    const st = mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.12, 7), s);
    st.position.set((i - 1.5) * 0.8, 0.06, (Math.random() - 0.5) * 0.3);
    st.scale.y = 1; g.add(st);
  }
  return g;
}

function fountain() {
  const g = new THREE.Group();
  const bamboo = std(0x8aa653, { roughness: 0.6 });
  const base = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8), bamboo); base.position.y = 0.4; g.add(base);
  const pipe = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 8), bamboo);
  pipe.position.set(0.1, 0.7, 0); pipe.rotation.z = -0.5; g.add(pipe);
  const basin = mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.18, 10), std(STONE)); basin.position.y = 0.09; g.add(basin);
  return g;
}

function maple() {
  const g = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.2, 7), std(0x5b3b26));
  trunk.position.y = 0.6; g.add(trunk);
  for (const o of [[0, 1.5, 0, 0.6, 0xc94f3a], [0.4, 1.3, 0.2, 0.42, 0xd96a3a], [-0.35, 1.35, -0.2, 0.44, 0xe08a3a]]) {
    const c = mesh(new THREE.IcosahedronGeometry(o[3], 0), std(o[4]));
    c.position.set(o[0], o[1], o[2]); g.add(c);
  }
  return g;
}

function pine() {
  const g = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.0, 7), std(0x4a3120));
  trunk.position.y = 0.5; g.add(trunk);
  let y = 1.0;
  for (let i = 0; i < 3; i++) {
    const c = mesh(new THREE.ConeGeometry(0.7 - i * 0.16, 0.7, 7), std(0x3c6b3f));
    c.position.y = y; g.add(c); y += 0.45;
  }
  return g;
}

function bush() {
  const g = new THREE.Group();
  for (const o of [[0, 0.25, 0, 0.34], [0.28, 0.22, 0.1, 0.26], [-0.24, 0.24, -0.12, 0.28]]) {
    const b = mesh(new THREE.IcosahedronGeometry(o[3], 0), std(0x4f7a3a));
    b.position.set(o[0], o[1], o[2]); g.add(b);
  }
  for (let i = 0; i < 6; i++) {
    const f = mesh(new THREE.SphereGeometry(0.05, 6, 5), std(0xe87aa0));
    f.position.set((Math.random() - 0.5) * 0.7, 0.2 + Math.random() * 0.3, (Math.random() - 0.5) * 0.7); f.castShadow = false; g.add(f);
  }
  return g;
}

function lilyCluster() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const pad = mesh(new THREE.CircleGeometry(0.4 + Math.random() * 0.3, 10), std(0x3f7a44, { side: THREE.DoubleSide }));
    pad.rotation.x = -Math.PI / 2; pad.position.set((Math.random() - 0.5) * 1.4, 0.06, (Math.random() - 0.5) * 1.4);
    pad.castShadow = false; g.add(pad);
  }
  const flower = mesh(new THREE.IcosahedronGeometry(0.12, 0), std(0xf6a6c0));
  flower.position.set(0, 0.12, 0); g.add(flower);
  return g;
}

const BUILDERS = { lantern, torii, bridge, pagoda, bonsai, stones: steppingStones, fountain, maple, pine, bush, lilies: lilyCluster };
const WATER_TYPES = new Set(['bridge', 'stones', 'lilies']);

export function buildDecoration(type) {
  const fn = BUILDERS[type];
  return fn ? fn() : null;
}

export function createDecor() {
  const group = new THREE.Group();
  const placed = new Map(); // recId -> object3d

  function add(rec) {
    const obj = buildDecoration(rec.type);
    if (!obj) return null;
    obj.position.set(rec.x, WATER_TYPES.has(rec.type) ? 0.04 : -0.05, rec.z);
    obj.rotation.y = rec.rot || 0;
    obj.userData.recId = rec.id;
    group.add(obj);
    placed.set(rec.id, obj);
    return obj;
  }
  function remove(id) {
    const obj = placed.get(id);
    if (!obj) return;
    group.remove(obj);
    obj.traverse((o) => { if (o.isMesh) { o.geometry.dispose?.(); if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose()); else o.material.dispose?.(); } });
    placed.delete(id);
  }
  function has(id) { return placed.has(id); }

  return { group, add, remove, has };
}
