// =============================================================================
// Koi fish — smooth, full-bodied procedural models (replaces the origami look).
//
// A single smooth tubular body geometry is shared by every fish; each koi gets
// a unique painted canvas texture for its colours & pattern (Kohaku patches,
// sumi spots, scale nets, metallic Ogon…), plus translucent flowing tail and
// pectoral fins. Bodies undulate via a lightweight vertex-shader bend so the
// whole school swims naturally. Geometries are shared; only materials/textures
// are per-fish, so hundreds of koi stay cheap.
// =============================================================================

import * as THREE from 'three';

// Global swim clock, shared by every bend material (updated once per frame).
const BEND_TIME = { value: 0 };
export function setKoiTime(t) { BEND_TIME.value = t; }

// --- shared geometry (built once) -------------------------------------------
const BODY_LEN_NOSE = 0.95;
const BODY_LEN_TAIL = -1.05;
const TAIL_MOUNT_X = -1.02;

function lerp(a, b, t) { return a + (b - a) * t; }
function sampleProfile(arr, t) {
  const x = t * (arr.length - 1);
  const i = Math.floor(x);
  if (i >= arr.length - 1) return arr[arr.length - 1];
  return lerp(arr[i], arr[i + 1], x - i);
}

let _bodyGeo = null;
function bodyGeometry() {
  if (_bodyGeo) return _bodyGeo;
  const N = 32, M = 22;                  // rings along length, segments around
  const WIDTH = [0.015, 0.20, 0.36, 0.44, 0.44, 0.40, 0.33, 0.26, 0.19, 0.10, 0.05];
  const pos = [], uv = [], idx = [];

  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = lerp(BODY_LEN_NOSE, BODY_LEN_TAIL, t);
    const wr = sampleProfile(WIDTH, t);
    const hr = wr * 0.78;                 // a touch flatter than wide => reads well from above
    for (let j = 0; j <= M; j++) {
      const u = j / M;
      const theta = u * Math.PI * 2 - Math.PI / 2; // u=0.5 -> top (dorsal)
      pos.push(x, Math.sin(theta) * hr, Math.cos(theta) * wr);
      uv.push(u, t);
    }
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j, b = a + 1, c = a + (M + 1), d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  _bodyGeo = g;
  return g;
}

function shapeGeometry(build, segments = 26) {
  const s = new THREE.Shape();
  build(s);
  const g = new THREE.ShapeGeometry(s, segments);
  g.rotateX(-Math.PI / 2); // lay the fin flat (horizontal fan)
  return g;
}

let _tailGeo = null;
function tailGeometry() {
  if (_tailGeo) return _tailGeo;
  _tailGeo = shapeGeometry((s) => {
    s.moveTo(0, 0.05);
    s.quadraticCurveTo(-0.35, 0.30, -0.85, 0.44);
    s.quadraticCurveTo(-0.98, 0.28, -0.80, 0.10);
    s.quadraticCurveTo(-0.94, 0.0, -0.80, -0.10);
    s.quadraticCurveTo(-0.98, -0.28, -0.85, -0.44);
    s.quadraticCurveTo(-0.35, -0.30, 0, -0.05);
    s.quadraticCurveTo(0.03, 0, 0, 0.05);
  });
  return _tailGeo;
}

let _pecGeo = null;
function pectoralGeometry() {
  if (_pecGeo) return _pecGeo;
  _pecGeo = shapeGeometry((s) => {
    s.moveTo(0, 0.03);
    s.quadraticCurveTo(-0.12, 0.20, -0.36, 0.20);
    s.quadraticCurveTo(-0.30, 0.04, -0.06, -0.03);
    s.quadraticCurveTo(-0.02, 0, 0, 0.03);
  }, 16);
  return _pecGeo;
}

let _eyeGeo = null;
function eyeGeometry() {
  if (!_eyeGeo) _eyeGeo = new THREE.SphereGeometry(0.055, 12, 10);
  return _eyeGeo;
}

// --- per-fish painted koi texture -------------------------------------------
function seedFrom(p) {
  let s = (Math.floor(p.base.h * 131 + p.base.s * 17 + p.base.l * 7 + p.patch.h * 197 +
    p.size * 1000 + p.sumiLevel * 1300 + p.luster * 333) >>> 0) || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
const css = (c, a = 1) => `hsla(${Math.round(c.h)}, ${Math.round(c.s)}%, ${Math.round(c.l)}%, ${a})`;

function makeKoiTexture(p) {
  const rng = seedFrom(p);
  const w = 160, h = 320, cx = w / 2;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const x = canvas.getContext('2d');

  // base colour
  x.fillStyle = css(p.base);
  x.fillRect(0, 0, w, h);

  // pale belly toward the side seams (u=0 & u=1 -> canvas edges)
  const belly = { h: p.base.h, s: 16, l: 93 };
  const bg = x.createLinearGradient(0, 0, w, 0);
  bg.addColorStop(0.00, css(belly, 0.92));
  bg.addColorStop(0.24, css(belly, 0));
  bg.addColorStop(0.76, css(belly, 0));
  bg.addColorStop(1.00, css(belly, 0.92));
  x.fillStyle = bg; x.fillRect(0, 0, w, h);

  const blob = (bx, by, r, c, a = 0.95) => {
    const g = x.createRadialGradient(bx, by, r * 0.15, bx, by, r);
    g.addColorStop(0, css(c, a));
    g.addColorStop(0.65, css(c, a));
    g.addColorStop(1, css(c, 0));
    x.fillStyle = g;
    x.beginPath(); x.arc(bx, by, r, 0, Math.PI * 2); x.fill();
  };

  const patch = p.patch;
  const sumi = { h: p.accent.h, s: p.accent.s, l: Math.max(6, p.accent.l) };

  switch (p.pattern) {
    case 'Capped':
      blob(cx + (rng() - 0.5) * 18, h * 0.16, w * 0.46, patch, 0.96);
      break;
    case 'Banded':
      for (let k = -1; k <= 1; k++) blob(cx + k * w * 0.28, h * (0.48 + (rng() - 0.5) * 0.08), w * 0.34, patch, 0.9);
      break;
    case 'Spotted': {
      const n = 3 + Math.floor(rng() * 4);
      for (let i = 0; i < n; i++)
        blob(cx + (rng() - 0.5) * w * 0.6, h * (0.14 + rng() * 0.72), w * (0.15 + rng() * 0.12), patch, 0.95);
      break;
    }
    case 'Netted': {
      // scale-net mosaic across the dorsal band
      x.lineWidth = 2;
      for (let row = 0; row < 22; row++) {
        const yy = (row / 22) * h;
        for (let col = -3; col <= 3; col++) {
          const xx = cx + col * (w * 0.13) + (row % 2) * (w * 0.065);
          x.strokeStyle = css(patch, 0.5);
          x.beginPath(); x.arc(xx, yy, w * 0.075, 0, Math.PI); x.stroke();
        }
      }
      break;
    }
    case 'Dragon':
      for (let k = 0; k < 6; k++)
        blob(cx + (rng() - 0.5) * w * 0.22, h * (0.1 + k * 0.15), w * 0.19, p.hasSumi ? sumi : patch, 0.9);
      break;
    default: break; // Solid
  }

  if (p.hasSumi && p.pattern !== 'Dragon') {
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++)
      blob(cx + (rng() - 0.5) * w * 0.5, h * (0.18 + rng() * 0.64), w * (0.12 + rng() * 0.1), sumi, 0.9);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// --- colour helpers ----------------------------------------------------------
function color(hsl) {
  const c = new THREE.Color();
  c.setHSL((hsl.h % 360) / 360, Math.min(1, hsl.s / 100), Math.min(1, hsl.l / 100));
  return c;
}

// --- vertex-shader body bend (swim undulation) ------------------------------
function applyBend(material, bend, xOffset) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = BEND_TIME;
    shader.uniforms.uPhase = bend.uPhase;
    shader.uniforms.uAmp = bend.uAmp;
    shader.uniforms.uFreq = bend.uFreq;
    shader.uniforms.uSpeed = bend.uSpeed;
    shader.uniforms.uXOffset = { value: xOffset };
    shader.vertexShader =
      'uniform float uTime,uPhase,uAmp,uFreq,uSpeed,uXOffset;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float _bx = transformed.x + uXOffset;
       float _env = clamp((0.55 - _bx) / 1.8, 0.0, 1.0);
       transformed.z += sin(_bx * uFreq + uTime * uSpeed + uPhase) * uAmp * _env;`);
  };
}

// =============================================================================
// Public: build a swimming koi.
// =============================================================================
export function createKoiFish(desc) {
  const p = desc.phenotype;
  const group = new THREE.Group();

  const bend = {
    uPhase: { value: Math.random() * Math.PI * 2 },
    uAmp: { value: 0.06 },
    uFreq: { value: 2.4 },
    uSpeed: { value: 5 + (1 - p.sizeNorm) * 3 },
  };

  // Body
  const tex = makeKoiTexture(p);
  const bodyMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: Math.max(0.18, 0.82 - 0.55 * p.luster),
    metalness: 0.08 + 0.62 * p.luster,
    emissive: color(p.base).multiplyScalar(p.luster > 0.7 ? 0.12 : 0.0),
    side: THREE.DoubleSide,
  });
  applyBend(bodyMat, bend, 0);
  const body = new THREE.Mesh(bodyGeometry(), bodyMat);
  group.add(body);

  // Fins (translucent, flowing)
  const finCol = color(p.patch).lerp(color(p.base), 0.45).lerp(new THREE.Color(0xffffff), 0.35);
  const finMat = new THREE.MeshStandardMaterial({
    color: finCol, transparent: true, opacity: p.fin === 'Veil' ? 0.6 : 0.78,
    roughness: 0.5, metalness: 0.1 + 0.4 * p.luster, side: THREE.DoubleSide,
    depthWrite: false,
  });
  const finLen = { Standard: 1.0, Fan: 1.18, Long: 1.6, Veil: 2.1 }[p.fin] || 1.0;
  const finSpread = { Standard: 1.0, Fan: 1.3, Long: 1.05, Veil: 1.15 }[p.fin] || 1.0;

  // Tail (shares the bend so it sweeps with the body)
  const tailMat = finMat.clone();
  applyBend(tailMat, bend, TAIL_MOUNT_X);
  const tail = new THREE.Mesh(tailGeometry(), tailMat);
  tail.position.x = TAIL_MOUNT_X;
  tail.scale.set(finLen, 1, finSpread);
  group.add(tail);

  // Pectoral fins (gentle independent flap)
  const pecGeo = pectoralGeometry();
  const pecL = new THREE.Group();
  pecL.position.set(0.22, -0.04, -0.16);
  pecL.add(new THREE.Mesh(pecGeo, finMat));
  pecL.scale.setScalar(0.85 * finLen);
  group.add(pecL);

  const pecR = new THREE.Group();
  pecR.position.set(0.22, -0.04, 0.16);
  pecR.scale.set(0.85 * finLen, 0.85 * finLen, -0.85 * finLen); // mirror
  pecR.add(new THREE.Mesh(pecGeo, finMat));
  group.add(pecR);

  // Eyes
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x140f0a, roughness: 0.25, metalness: 0.2 });
  const eyeL = new THREE.Mesh(eyeGeometry(), eyeMat);
  eyeL.position.set(0.6, 0.06, -0.17);
  const eyeR = new THREE.Mesh(eyeGeometry(), eyeMat);
  eyeR.position.set(0.6, 0.06, 0.17);
  group.add(eyeL, eyeR);

  // Soft contact shadow on the pond floor.
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x04161c, transparent: true, opacity: 0.3, depthWrite: false,
  });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.85, 20), shadowMat);
  shadow.rotation.x = -Math.PI / 2;

  // Selection ring (hidden until paired).
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffd98a, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.18, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;

  group.userData = {
    fishId: null,
    phase: bend.uPhase.value,
    bend, pecL, pecR,
    materials: [bodyMat, finMat, tailMat, eyeMat],
    texture: tex,
    shadow, shadowMat, ring, ringMat,
  };

  group.scale.setScalar(p.size);
  return group;
}

// Per-fish per-frame animation. `speed` (0..~2.4) scales the swim sway.
export function updateKoiFish(group, time, speed = 0.6) {
  const u = group.userData;
  u.bend.uAmp.value = 0.05 + Math.min(2.2, speed) * 0.045;
  const flap = Math.sin(time * 4.5 + u.phase) * 0.22;
  u.pecL.rotation.z = -0.25 + flap;
  u.pecR.rotation.z = -0.25 + flap; // mirrored by negative scale
  group.rotation.z = Math.sin(time * 1.3 + u.phase) * 0.05;
}

export function disposeKoiFish(group) {
  for (const m of group.userData.materials) m.dispose();
  group.userData.texture.dispose();
  group.userData.shadowMat.dispose();
  group.userData.ringMat.dispose();
  group.userData.shadow.geometry.dispose();
  group.userData.ring.geometry.dispose();
}
