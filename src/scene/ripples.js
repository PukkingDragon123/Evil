// =============================================================================
// Ripples & droplets.
//
// Expanding rings spread across the surface when you tap the pond or when a koi
// breaks the surface; little droplets arc up and fall back, each splash seeding
// a fresh ring. Pure mesh animation — no shader dependency — so it is robust.
// =============================================================================

import * as THREE from 'three';

const RING_POOL = 28;
const DROP_POOL = 60;
const Y = 0.05; // just above the water surface

export function createRipples() {
  const group = new THREE.Group();
  group.renderOrder = 4;

  // --- ring pool ---
  const ringGeo = new THREE.RingGeometry(0.55, 0.72, 36);
  ringGeo.rotateX(-Math.PI / 2);
  const rings = [];
  for (let i = 0; i < RING_POOL; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xcdf7ef, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(ringGeo, mat);
    mesh.visible = false;
    mesh.renderOrder = 4;
    group.add(mesh);
    rings.push({ mesh, mat, active: false, age: 0, life: 1.6, maxR: 3, strength: 1 });
  }

  // --- droplet pool ---
  const dropGeo = new THREE.SphereGeometry(0.09, 6, 5);
  const dropMatTemplate = new THREE.MeshStandardMaterial({
    color: 0xbff0ea, roughness: 0.2, metalness: 0.2, transparent: true, opacity: 0.95,
  });
  const drops = [];
  for (let i = 0; i < DROP_POOL; i++) {
    const mesh = new THREE.Mesh(dropGeo, dropMatTemplate.clone());
    mesh.visible = false;
    group.add(mesh);
    drops.push({ mesh, active: false, vx: 0, vy: 0, vz: 0 });
  }

  let ringCursor = 0, dropCursor = 0;

  function getRing() {
    // Prefer an inactive ring; otherwise recycle the oldest.
    for (let i = 0; i < RING_POOL; i++) {
      const r = rings[(ringCursor + i) % RING_POOL];
      if (!r.active) { ringCursor = (ringCursor + i + 1) % RING_POOL; return r; }
    }
    const r = rings[ringCursor];
    ringCursor = (ringCursor + 1) % RING_POOL;
    return r;
  }

  function ring(x, z, { strength = 1, maxR = 3, life = 1.6 } = {}) {
    const r = getRing();
    r.active = true; r.age = 0; r.life = life; r.maxR = maxR; r.strength = strength;
    r.mesh.position.set(x, Y, z);
    r.mesh.scale.setScalar(0.2);
    r.mat.opacity = 0.6 * strength;
    r.mesh.visible = true;
  }

  function droplet(x, z, strength = 1) {
    const d = drops[dropCursor];
    dropCursor = (dropCursor + 1) % DROP_POOL;
    d.active = true;
    const a = Math.random() * Math.PI * 2;
    const sp = (0.8 + Math.random() * 1.2) * strength;
    d.vx = Math.cos(a) * sp;
    d.vz = Math.sin(a) * sp;
    d.vy = 2.2 + Math.random() * 2.0 * strength;
    d.mesh.position.set(x, Y + 0.05, z);
    d.mesh.scale.setScalar(0.6 + Math.random() * 0.6);
    d.mesh.visible = true;
  }

  // A full splash: a strong ring plus a spray of droplets.
  function splash(x, z, strength = 1) {
    ring(x, z, { strength: Math.min(1.4, strength), maxR: 3.2 * strength, life: 1.7 });
    const n = Math.min(10, 3 + Math.floor(strength * 5));
    for (let i = 0; i < n; i++) droplet(x, z, strength);
  }

  function update(dt) {
    for (const r of rings) {
      if (!r.active) continue;
      r.age += dt;
      const u = r.age / r.life;
      if (u >= 1) { r.active = false; r.mesh.visible = false; continue; }
      const ease = 1 - Math.pow(1 - u, 2);
      r.mesh.scale.setScalar(0.2 + ease * r.maxR);
      r.mat.opacity = (1 - u) * 0.6 * r.strength;
    }
    for (const d of drops) {
      if (!d.active) continue;
      d.vy -= 9.0 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      if (d.mesh.position.y <= Y && d.vy < 0) {
        d.active = false;
        d.mesh.visible = false;
        ring(d.mesh.position.x, d.mesh.position.z, { strength: 0.5, maxR: 1.0, life: 1.0 });
      }
    }
  }

  return { group, ring, splash, droplet, update };
}
