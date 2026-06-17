// =============================================================================
// Origami koi — procedural faceted fish built from a phenotype.
//
// The body is a folded "paper" form: a chain of diamond cross-sections from
// nose to tail, giving sharp creased facets when flat-shaded. Coloured material
// groups paint koi patches (base / patch / sumi / belly). Tail & pectoral fins
// hang off pivots so they can sway as the fish swims.
//
// Geometries depend only on pattern / fin style / size band, so they are cached
// and shared; only the (cheap) materials are unique per fish.
// =============================================================================

import * as THREE from 'three';

// --- Body silhouette: rings of {top, bottom, left, right} along the length ---
// x: +nose .. -tail, y: up, z: width. Tuned to read as a koi from above.
const RINGS = [
  { x: 1.00, ry: 0.06, by: 0.03, hw: 0.001 }, // nose (near-point)
  { x: 0.66, ry: 0.20, by: 0.12, hw: 0.26 },  // head
  { x: 0.18, ry: 0.26, by: 0.15, hw: 0.40 },  // shoulder (widest)
  { x: -0.30, ry: 0.18, by: 0.10, hw: 0.30 }, // mid
  { x: -0.74, ry: 0.07, by: 0.05, hw: 0.10 }, // peduncle (tail base)
];

function ringVerts(r) {
  return {
    top: new THREE.Vector3(r.x, r.ry, 0),
    bottom: new THREE.Vector3(r.x, -r.by, 0),
    left: new THREE.Vector3(r.x, 0, -r.hw),
    right: new THREE.Vector3(r.x, 0, r.hw),
  };
}

function pushTri(arr, a, b, c) {
  arr.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
}
function pushQuad(arr, a, b, c, d) {
  pushTri(arr, a, b, c);
  pushTri(arr, a, c, d);
}

// Material index (0 base, 1 patch, 2 sumi) for an upper panel's two triangles.
function upperPanelMats(pattern, hasSumi, seg, side) {
  const r = side === 'R' ? 1 : 0;
  switch (pattern) {
    case 'Solid': return [0, 0];
    case 'Capped': return seg === 0 ? [1, 1] : [0, 0];
    case 'Banded': return seg === 1 ? [1, 1] : [0, 0];
    case 'Spotted': {
      const spot = (seg + r) % 2 === 0;
      if (!spot) return [0, 0];
      return hasSumi && seg % 2 === 1 ? [2, 2] : [1, 1];
    }
    case 'Netted': {
      // Alternating mosaic; with sumi it becomes a five-colour Goshiki net.
      const i = seg * 2 + r;
      return hasSumi
        ? [[0, 1, 2][i % 3], [0, 1, 2][(i + 1) % 3]]
        : [(i % 2 ? 1 : 0), ((i + 1) % 2 ? 1 : 0)];
    }
    case 'Dragon': {
      const blotch = seg % 2 === 0;
      if (!blotch) return [0, 0];
      return hasSumi ? [2, 2] : [1, 1];
    }
    default: return [0, 0];
  }
}

// Build the body as four arrays of triangles (by material), then one geometry
// with groups so a single mesh can wear up to four colours.
const _bodyCache = new Map();
function bodyGeometry(pattern, hasSumi) {
  const key = pattern + (hasSumi ? '+s' : '');
  if (_bodyCache.has(key)) return _bodyCache.get(key);

  const rings = RINGS.map(ringVerts);
  const buckets = [[], [], [], []]; // base, patch, sumi, belly

  for (let s = 0; s < rings.length - 1; s++) {
    const A = rings[s], B = rings[s + 1];
    const [mL1, mL2] = upperPanelMats(pattern, hasSumi, s, 'L');
    const [mR1, mR2] = upperPanelMats(pattern, hasSumi, s, 'R');

    // Upper-left panel (two tris may differ in colour).
    pushTri(buckets[mL1], A.top, A.left, B.left);
    pushTri(buckets[mL2], A.top, B.left, B.top);
    // Upper-right panel.
    pushTri(buckets[mR1], A.top, B.top, B.right);
    pushTri(buckets[mR2], A.top, B.right, A.right);
    // Belly (always the pale underside).
    pushQuad(buckets[3], A.left, A.bottom, B.bottom, B.left);
    pushQuad(buckets[3], A.right, B.right, B.bottom, A.bottom);
  }

  const positions = [];
  const groups = [];
  let start = 0;
  for (let m = 0; m < 4; m++) {
    const verts = buckets[m].length / 3;
    if (verts > 0) {
      positions.push(...buckets[m]);
      groups.push({ start, count: verts, material: m });
      start += verts;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  for (const g of groups) geo.addGroup(g.start, g.count, g.material);
  _bodyCache.set(key, geo);
  return geo;
}

// --- Fins -------------------------------------------------------------------
const FIN_LEN = { Standard: 1.0, Fan: 1.18, Long: 1.7, Veil: 2.4 };
const FIN_DROOP = { Standard: 0.0, Fan: 0.02, Long: 0.12, Veil: 0.26 };

const _tailCache = new Map();
function tailGeometry(finStyle) {
  if (_tailCache.has(finStyle)) return _tailCache.get(finStyle);
  const len = 0.55 * FIN_LEN[finStyle];
  const droop = FIN_DROOP[finStyle];
  const spread = finStyle === 'Fan' ? 0.5 : 0.38;
  // A folded fan: apex at pivot, tips fanning back with alternating folds.
  const apex = new THREE.Vector3(0, 0.02, 0);
  const tips = [];
  const N = 4;
  for (let i = 0; i <= N; i++) {
    const u = i / N;                 // 0..1 across the fan
    const z = (u - 0.5) * 2 * spread; // left..right
    const fold = i % 2 === 0 ? 0.06 : -0.04; // crease up/down
    tips.push(new THREE.Vector3(-len, fold - droop, z * len * 1.6));
  }
  const pos = [];
  for (let i = 0; i < N; i++) pushTri(pos, apex, tips[i], tips[i + 1]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  _tailCache.set(finStyle, geo);
  return geo;
}

const _pecCache = new Map();
function pectoralGeometry(finStyle) {
  if (_pecCache.has(finStyle)) return _pecCache.get(finStyle);
  const len = 0.34 * FIN_LEN[finStyle];
  const droop = 0.12 + FIN_DROOP[finStyle];
  // A single folded triangle that sweeps out and back from the shoulder.
  const a = new THREE.Vector3(0, 0, 0);
  const b = new THREE.Vector3(-0.05, 0.02, len * 0.5);
  const c = new THREE.Vector3(-len * 0.9, -droop, len);
  const pos = [];
  pushTri(pos, a, b, c);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  _pecCache.set(finStyle, geo);
  return geo;
}

let _dorsalGeo = null;
function dorsalGeometry() {
  if (_dorsalGeo) return _dorsalGeo;
  const a = new THREE.Vector3(0.28, 0.26, 0);
  const b = new THREE.Vector3(-0.28, 0.18, 0);
  const c = new THREE.Vector3(0.0, 0.46, 0);
  const pos = [];
  pushTri(pos, a, b, c);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  _dorsalGeo = geo;
  return geo;
}

let _eyeGeo = null;
function eyeGeometry() {
  if (!_eyeGeo) _eyeGeo = new THREE.OctahedronGeometry(0.05, 0);
  return _eyeGeo;
}

// --- Colour helpers ---------------------------------------------------------
function col(hsl) {
  const c = new THREE.Color();
  c.setHSL((hsl.h % 360) / 360, Math.min(1, hsl.s / 100), Math.min(1, hsl.l / 100));
  return c;
}

function bodyMaterials(p) {
  const metalness = 0.05 + 0.7 * p.luster;
  const roughness = Math.max(0.12, 0.92 - 0.7 * p.luster);
  const mk = (c) => new THREE.MeshStandardMaterial({
    color: c, flatShading: true, side: THREE.DoubleSide, metalness, roughness,
  });
  const base = mk(col(p.base));
  const patch = mk(col(p.patch));
  const sumi = mk(col(p.accent));
  const belly = mk(col({ h: p.base.h, s: 12, l: 92 })); // pale koi belly
  return [base, patch, sumi, belly];
}

function finMaterial(p) {
  const c = col(p.patch).lerp(col(p.base), 0.5).lerp(new THREE.Color(0xffffff), 0.25);
  return new THREE.MeshStandardMaterial({
    color: c, flatShading: true, side: THREE.DoubleSide,
    transparent: true, opacity: p.fin === 'Veil' ? 0.7 : 0.85,
    metalness: 0.1 + 0.5 * p.luster, roughness: 0.6,
  });
}

// =============================================================================
// Public: build a swimming origami koi as a THREE.Group.
// =============================================================================
export function createOrigamiFish(desc) {
  const p = desc.phenotype;
  const group = new THREE.Group();

  const mats = bodyMaterials(p);
  const body = new THREE.Mesh(bodyGeometry(p.pattern, p.hasSumi), mats);
  group.add(body);

  // Dorsal fin (decorative, static).
  const dorsal = new THREE.Mesh(dorsalGeometry(), mats[p.hasSumi ? 2 : 0]);
  dorsal.position.x = 0.05;
  group.add(dorsal);

  // Tail on a pivot at the peduncle so it can wag.
  const fmat = finMaterial(p);
  const tailPivot = new THREE.Group();
  tailPivot.position.set(-0.74, 0.02, 0);
  const tail = new THREE.Mesh(tailGeometry(p.fin), fmat);
  tailPivot.add(tail);
  group.add(tailPivot);

  // Pectoral fins on pivots at the shoulder.
  const pecGeo = pectoralGeometry(p.fin);
  const pecL = new THREE.Group();
  pecL.position.set(0.18, -0.02, -0.34);
  const finL = new THREE.Mesh(pecGeo, fmat);
  pecL.add(finL);
  group.add(pecL);

  const pecR = new THREE.Group();
  pecR.position.set(0.18, -0.02, 0.34);
  pecR.scale.z = -1; // mirror
  const finR = new THREE.Mesh(pecGeo, fmat);
  pecR.add(finR);
  group.add(pecR);

  // Eyes.
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x15110d, roughness: 0.35, metalness: 0.1 });
  const eyeL = new THREE.Mesh(eyeGeometry(), eyeMat);
  eyeL.position.set(0.62, 0.12, -0.2);
  const eyeR = new THREE.Mesh(eyeGeometry(), eyeMat);
  eyeR.position.set(0.62, 0.12, 0.2);
  group.add(eyeL, eyeR);

  // A soft round shadow under the fish, added to its own plane on the floor.
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x05202a, transparent: true, opacity: 0.28, depthWrite: false,
  });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 18), shadowMat);
  shadow.rotation.x = -Math.PI / 2;

  // Selection ring (hidden until selected).
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffe28a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.05, 28), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;

  group.userData = {
    fishId: null,
    phase: Math.random() * Math.PI * 2,
    tailPivot, pecL, pecR, finL, finR,
    materials: [...mats, fmat, eyeMat],
    shadow, shadowMat, ring, ringMat,
    radius: 1.0, // picking radius (in fish-local units, scaled later)
  };

  // Scale whole fish to its genetic size.
  group.scale.setScalar(p.size);
  return group;
}

// Animate a fish's fins/bob. `speed` (0..~1.5) drives wag intensity.
export function updateFishMesh(group, t, speed = 0.5) {
  const u = group.userData;
  const ph = u.phase;
  const wag = 0.35 + Math.min(1.2, speed) * 0.9;
  u.tailPivot.rotation.y = Math.sin(t * 7 + ph) * 0.5 * wag;
  const flap = Math.sin(t * 4 + ph) * 0.25;
  u.pecL.rotation.x = flap;
  u.pecR.rotation.x = flap;
  // Gentle roll so facets catch the light as they cruise.
  group.rotation.z = Math.sin(t * 1.5 + ph) * 0.06;
}

// Free the per-fish materials (geometries are cached & shared, so kept).
export function disposeFishMesh(group) {
  for (const m of group.userData.materials) m.dispose();
  group.userData.shadowMat.dispose();
  group.userData.ringMat.dispose();
  group.userData.shadow.geometry.dispose();
  group.userData.ring.geometry.dispose();
}
