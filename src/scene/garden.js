// =============================================================================
// Zen garden surroundings for the koi pond:
//   • a deep basin beneath the translucent water (gives the pond depth)
//   • a raked-sand border (procedural canvas texture) with a dark stone lip
//   • scattered low-poly rocks
//   • lily pads that bob on the surface, some crowned with origami lotus flowers
//   • a small cluster of reeds
// Returns a group plus an update(t) that animates the floating elements.
// =============================================================================

import * as THREE from 'three';

// --- procedural raked-sand texture ------------------------------------------
function rakedSandTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Warm sand base with a soft vignette toward the centre (the pond).
  ctx.fillStyle = '#e9dcc0';
  ctx.fillRect(0, 0, size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size * 0.6);
  g.addColorStop(0, 'rgba(180,160,120,0.5)');
  g.addColorStop(1, 'rgba(233,220,192,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Concentric raked rings.
  ctx.lineWidth = 2;
  for (let r = 30; r < size * 0.72; r += 11) {
    ctx.strokeStyle = (r / 11) % 2 < 1 ? 'rgba(206,190,156,0.9)' : 'rgba(255,248,232,0.55)';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r + Math.sin(r * 0.3) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // A few raked swirls around imagined stones for that zen-garden feel.
  for (let s = 0; s < 5; s++) {
    const cx = size * (0.18 + Math.random() * 0.64);
    const cy = size * (0.18 + Math.random() * 0.64);
    for (let r = 8; r < 46; r += 7) {
      ctx.strokeStyle = 'rgba(200,184,150,0.8)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRock(scale) {
  const geo = new THREE.IcosahedronGeometry(scale, 0);
  // Jitter vertices a touch so rocks aren't perfect.
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i,
      pos.getX(i) * (0.8 + Math.random() * 0.4),
      pos.getY(i) * (0.6 + Math.random() * 0.5),
      pos.getZ(i) * (0.8 + Math.random() * 0.4));
  }
  geo.computeVertexNormals();
  const shade = 0.35 + Math.random() * 0.25;
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(shade, shade * 0.96, shade * 0.9),
    flatShading: true, roughness: 0.95, metalness: 0.0,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
  return m;
}

function makeLilyPad() {
  // A round pad with a single wedge notch (classic lily-pad silhouette).
  const radius = 0.8 + Math.random() * 0.7;
  const notch = 0.5;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, notch / 2, Math.PI * 2 - notch / 2, false);
  shape.lineTo(0, 0);
  const geo = new THREE.ShapeGeometry(shape, 20);
  geo.rotateX(-Math.PI / 2);
  const hue = 0.28 + Math.random() * 0.06;
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(hue, 0.55, 0.32 + Math.random() * 0.08),
    flatShading: true, roughness: 0.8, side: THREE.DoubleSide,
  });
  const pad = new THREE.Mesh(geo, mat);
  pad.rotation.y = Math.random() * Math.PI * 2;
  return { pad, radius };
}

function makeLotus() {
  const lotus = new THREE.Group();
  const petalGeo = new THREE.ConeGeometry(0.12, 0.34, 4);
  const outer = new THREE.MeshStandardMaterial({ color: 0xf6a6c0, flatShading: true, roughness: 0.6 });
  const inner = new THREE.MeshStandardMaterial({ color: 0xfde3ee, flatShading: true, roughness: 0.6 });

  const rings = [{ n: 7, r: 0.16, tilt: 1.05, mat: outer }, { n: 5, r: 0.09, tilt: 0.6, mat: inner }];
  for (const ring of rings) {
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeo, ring.mat);
      petal.position.set(Math.cos(a) * ring.r, 0.12, Math.sin(a) * ring.r);
      petal.rotation.set(ring.tilt * Math.cos(a + Math.PI / 2), -a, ring.tilt * Math.sin(a + Math.PI / 2));
      petal.rotation.z += ring.tilt; // lean petals outward
      lotus.add(petal);
    }
  }
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xf2d23a, roughness: 0.5 }));
  center.position.y = 0.14;
  lotus.add(center);
  lotus.scale.setScalar(0.9 + Math.random() * 0.5);
  return lotus;
}

function makeReeds(count = 6) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4f7a3a, flatShading: true, roughness: 0.8 });
  for (let i = 0; i < count; i++) {
    const h = 1.6 + Math.random() * 1.6;
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.06, h, 4), mat);
    blade.position.set((Math.random() - 0.5) * 1.2, h / 2, (Math.random() - 0.5) * 1.2);
    blade.rotation.z = (Math.random() - 0.5) * 0.4;
    blade.rotation.x = (Math.random() - 0.5) * 0.3;
    blade.castShadow = true;
    group.add(blade);
  }
  return group;
}

export function createGarden(pondRadius) {
  const group = new THREE.Group();
  const floaters = []; // {obj, baseY, phase, speed, spin}

  // Deep basin under the water for a sense of depth.
  const basin = new THREE.Mesh(
    new THREE.CircleGeometry(pondRadius * 1.01, 64),
    new THREE.MeshStandardMaterial({ color: 0x07343a, roughness: 1.0 }));
  basin.rotation.x = -Math.PI / 2;
  basin.position.y = -1.2;
  basin.renderOrder = 0;
  basin.receiveShadow = true;
  group.add(basin);

  // Raked-sand ground (a big disc the water sits on top of).
  const sand = new THREE.Mesh(
    new THREE.CircleGeometry(pondRadius + 11, 96),
    new THREE.MeshStandardMaterial({ map: rakedSandTexture(), roughness: 1.0 }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -0.08;
  sand.receiveShadow = true;
  group.add(sand);

  // Dark stone lip framing the water's edge.
  const lip = new THREE.Mesh(
    new THREE.RingGeometry(pondRadius * 0.985, pondRadius * 1.07, 80),
    new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.9, flatShading: true }));
  lip.rotation.x = -Math.PI / 2;
  lip.position.y = 0.02;
  group.add(lip);

  // Rocks: a ring around the rim, plus a few wading in the shallows.
  const rockCount = 12;
  for (let i = 0; i < rockCount; i++) {
    const a = (i / rockCount) * Math.PI * 2 + Math.random() * 0.4;
    const inWater = i % 4 === 0;
    const rad = inWater ? pondRadius - 1.2 - Math.random() * 1.5 : pondRadius + 1.5 + Math.random() * 4;
    const scale = 0.8 + Math.random() * 1.8;
    const rock = makeRock(scale);
    rock.position.set(Math.cos(a) * rad, scale * (inWater ? 0.2 : 0.35) - 0.1, Math.sin(a) * rad);
    rock.scale.y = 0.7 + Math.random() * 0.5;
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  // Reed clusters at a couple of spots.
  for (let i = 0; i < 3; i++) {
    const a = Math.random() * Math.PI * 2;
    const reeds = makeReeds(5 + Math.floor(Math.random() * 4));
    reeds.position.set(Math.cos(a) * (pondRadius + 2.5), -0.1, Math.sin(a) * (pondRadius + 2.5));
    group.add(reeds);
  }

  // Lily pads (some with lotus flowers) floating on the surface.
  const padCount = 11;
  for (let i = 0; i < padCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const rad = 3 + Math.random() * (pondRadius - 4.5);
    const { pad, radius } = makeLilyPad();
    const baseY = 0.06;
    pad.position.set(Math.cos(a) * rad, baseY, Math.sin(a) * rad);
    pad.renderOrder = 3;
    pad.castShadow = true;
    pad.receiveShadow = true;
    group.add(pad);
    floaters.push({ obj: pad, baseY, phase: Math.random() * 6.28, speed: 0.6 + Math.random() * 0.5, spin: (Math.random() - 0.5) * 0.05 });

    if (Math.random() < 0.4) {
      const lotus = makeLotus();
      lotus.position.copy(pad.position);
      lotus.position.y = baseY + 0.02;
      lotus.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      group.add(lotus);
      floaters.push({ obj: lotus, baseY: lotus.position.y, phase: Math.random() * 6.28, speed: 0.6, spin: 0 });
      void radius;
    }
  }

  function update(t) {
    for (const f of floaters) {
      f.obj.position.y = f.baseY + Math.sin(t * f.speed + f.phase) * 0.035;
      if (f.spin) f.obj.rotation.y += f.spin * 0.016;
    }
  }

  return { group, update };
}
