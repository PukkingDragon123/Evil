// =============================================================================
// Koi fish — slim, realistic procedural models.
//
// A shared smooth tubular body (slim koi proportions) wears a per-fish painted
// texture (Kohaku patches, sumi, scale-nets, metallic Ogon…). Soft-edged
// translucent dorsal / pectoral / caudal fins, small barbels (whiskers) and
// glossy eyes with a catch-light complete the look. A light vertex-shader bend
// makes the whole body undulate. Geometries are shared; only materials &
// textures are per-fish, so a big school stays cheap.
// =============================================================================

import * as THREE from 'three';
import { CONFIG } from '../config.js';

const BEND_TIME = { value: 0 };
export function setKoiTime(t) { BEND_TIME.value = t; }

// --- shared body geometry ---------------------------------------------------
const NOSE_X = 1.05, TAIL_X = -1.15, TAIL_MOUNT_X = -1.12;
function lerp(a, b, t) { return a + (b - a) * t; }
function sampleProfile(arr, t) {
  const x = t * (arr.length - 1);
  const i = Math.floor(x);
  return i >= arr.length - 1 ? arr[arr.length - 1] : lerp(arr[i], arr[i + 1], x - i);
}

let _bodyGeo = null;
function bodyGeometry() {
  if (_bodyGeo) return _bodyGeo;
  const N = 20, M = 12; // low-poly: faceted, stylised, but a graceful silhouette
  // Slim koi: rounded head, fullest just behind it, tapering to a fine peduncle.
  const WIDTH = [0.02, 0.15, 0.24, 0.285, 0.28, 0.245, 0.195, 0.145, 0.095, 0.05, 0.02];
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = lerp(NOSE_X, TAIL_X, t);
    const wr = sampleProfile(WIDTH, t);
    const hr = wr * 0.95; // near-round cross-section -> slim, not flat
    for (let j = 0; j <= M; j++) {
      const u = j / M;
      const theta = u * Math.PI * 2 - Math.PI / 2;
      pos.push(x, Math.sin(theta) * hr, Math.cos(theta) * wr);
      uv.push(u, t);
    }
  }
  for (let i = 0; i < N; i++)
    for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j, b = a + 1, c = a + (M + 1), d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  _bodyGeo = g;
  return g;
}

function shapeGeo(build, segments, vertical = false) {
  const s = new THREE.Shape();
  build(s);
  const g = new THREE.ShapeGeometry(s, segments);
  if (!vertical) g.rotateX(-Math.PI / 2); // lay flat (horizontal fan)
  return g;
}

let _tailGeo = null;
function tailGeometry() {
  if (_tailGeo) return _tailGeo;
  _tailGeo = shapeGeo((s) => {
    s.moveTo(0, 0.04);
    s.quadraticCurveTo(-0.38, 0.26, -0.92, 0.40);
    s.quadraticCurveTo(-1.02, 0.24, -0.82, 0.08);
    s.quadraticCurveTo(-0.96, 0.0, -0.82, -0.08);
    s.quadraticCurveTo(-1.02, -0.24, -0.92, -0.40);
    s.quadraticCurveTo(-0.38, -0.26, 0, -0.04);
    s.quadraticCurveTo(0.03, 0, 0, 0.04);
  }, 28);
  return _tailGeo;
}

let _pecGeo = null;
function pectoralGeometry() {
  if (_pecGeo) return _pecGeo;
  _pecGeo = shapeGeo((s) => {
    s.moveTo(0, 0.02);
    s.quadraticCurveTo(-0.12, 0.16, -0.34, 0.16);
    s.quadraticCurveTo(-0.28, 0.03, -0.05, -0.03);
    s.quadraticCurveTo(-0.02, 0, 0, 0.02);
  }, 14);
  return _pecGeo;
}

let _dorsalGeo = null;
function dorsalGeometry() {
  if (_dorsalGeo) return _dorsalGeo;
  // vertical membrane along the back
  _dorsalGeo = shapeGeo((s) => {
    s.moveTo(0.36, -0.04);
    s.quadraticCurveTo(0.1, 0.20, -0.16, 0.20);
    s.quadraticCurveTo(-0.42, 0.16, -0.5, -0.04);
    s.lineTo(0.36, -0.04);
  }, 20, true);
  return _dorsalGeo;
}

let _barbelGeo = null;
function barbelGeometry() {
  if (!_barbelGeo) { _barbelGeo = new THREE.CylinderGeometry(0.012, 0.005, 0.22, 5); _barbelGeo.rotateZ(Math.PI / 2); }
  return _barbelGeo;
}
let _eyeGeo = null, _eyeHiGeo = null;
function eyeGeometry() { if (!_eyeGeo) _eyeGeo = new THREE.IcosahedronGeometry(0.055, 0); return _eyeGeo; }
function eyeHiGeometry() { if (!_eyeHiGeo) _eyeHiGeo = new THREE.SphereGeometry(0.018, 8, 6); return _eyeHiGeo; }

// shared soft-edge alpha for fins
let _finAlpha = null;
function finAlpha() {
  if (_finAlpha) return _finAlpha;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.62, '#cfcfcf'); g.addColorStop(1, '#0a0a0a');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  _finAlpha = new THREE.CanvasTexture(c); _finAlpha.needsUpdate = true;
  return _finAlpha;
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
  x.fillStyle = css(p.base); x.fillRect(0, 0, w, h);

  const belly = { h: p.base.h, s: 16, l: 93 };
  const bg = x.createLinearGradient(0, 0, w, 0);
  bg.addColorStop(0.0, css(belly, 0.92)); bg.addColorStop(0.26, css(belly, 0));
  bg.addColorStop(0.74, css(belly, 0)); bg.addColorStop(1.0, css(belly, 0.92));
  x.fillStyle = bg; x.fillRect(0, 0, w, h);

  const blob = (bx, by, r, c, a = 0.95) => {
    // crisp koi markings: solid centre, quick soft edge
    const g = x.createRadialGradient(bx, by, r * 0.2, bx, by, r);
    g.addColorStop(0, css(c, a)); g.addColorStop(0.84, css(c, a)); g.addColorStop(1, css(c, 0));
    x.fillStyle = g; x.beginPath(); x.arc(bx, by, r, 0, Math.PI * 2); x.fill();
  };
  const patch = p.patch;
  const sumi = { h: p.accent.h, s: p.accent.s, l: Math.max(6, p.accent.l) };

  switch (p.pattern) {
    case 'Capped': blob(cx + (rng() - 0.5) * 18, h * 0.16, w * 0.46, patch, 0.96); break;
    case 'Banded': for (let k = -1; k <= 1; k++) blob(cx + k * w * 0.28, h * (0.48 + (rng() - 0.5) * 0.08), w * 0.34, patch, 0.9); break;
    case 'Spotted': { const n = 3 + Math.floor(rng() * 4); for (let i = 0; i < n; i++) blob(cx + (rng() - 0.5) * w * 0.6, h * (0.14 + rng() * 0.72), w * (0.15 + rng() * 0.12), patch, 0.95); break; }
    case 'Netted': { x.lineWidth = 2; for (let row = 0; row < 22; row++) { const yy = (row / 22) * h; for (let col = -3; col <= 3; col++) { const xx = cx + col * (w * 0.13) + (row % 2) * (w * 0.065); x.strokeStyle = css(patch, 0.5); x.beginPath(); x.arc(xx, yy, w * 0.075, 0, Math.PI); x.stroke(); } } break; }
    case 'Dragon': for (let k = 0; k < 6; k++) blob(cx + (rng() - 0.5) * w * 0.22, h * (0.1 + k * 0.15), w * 0.19, p.hasSumi ? sumi : patch, 0.9); break;
    default: break;
  }
  if (p.hasSumi && p.pattern !== 'Dragon') { const n = 2 + Math.floor(rng() * 3); for (let i = 0; i < n; i++) blob(cx + (rng() - 0.5) * w * 0.5, h * (0.18 + rng() * 0.64), w * (0.12 + rng() * 0.1), sumi, 0.9); }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 4; tex.needsUpdate = true;
  return tex;
}

function color(hsl) {
  const c = new THREE.Color();
  c.setHSL((hsl.h % 360) / 360, Math.min(1, hsl.s / 100), Math.min(1, hsl.l / 100));
  return c;
}

function applyBend(material, bend, xOffset) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = BEND_TIME;
    shader.uniforms.uPhase = bend.uPhase;
    shader.uniforms.uAmp = bend.uAmp;
    shader.uniforms.uFreq = bend.uFreq;
    shader.uniforms.uSpeed = bend.uSpeed;
    shader.uniforms.uXOffset = { value: xOffset };
    shader.vertexShader = 'uniform float uTime,uPhase,uAmp,uFreq,uSpeed,uXOffset;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float _bx = transformed.x + uXOffset;
      float _env = clamp((0.55 - _bx) / 1.8, 0.0, 1.0);
      transformed.z += sin(_bx * uFreq + uTime * uSpeed + uPhase) * uAmp * _env;`);
  };
}

// =============================================================================
export function createKoiFish(desc) {
  const p = desc.phenotype;
  const group = new THREE.Group();
  const bend = {
    uPhase: { value: Math.random() * Math.PI * 2 },
    uAmp: { value: 0.06 }, uFreq: { value: 2.4 }, uSpeed: { value: 5 + (1 - p.sizeNorm) * 3 },
  };
  const materials = [];

  // body
  const tex = makeKoiTexture(p);
  const bodyMat = new THREE.MeshStandardMaterial({
    map: tex, roughness: Math.max(0.18, 0.82 - 0.55 * p.luster), metalness: 0.08 + 0.62 * p.luster,
    emissive: color(p.base).multiplyScalar(p.luster > 0.7 ? 0.12 : 0), side: THREE.DoubleSide,
    flatShading: true,
  });
  applyBend(bodyMat, bend, 0); materials.push(bodyMat);
  group.add(new THREE.Mesh(bodyGeometry(), bodyMat));

  // Clean stylised ink outline (inverted hull that bends with the body).
  if (CONFIG.koiOutline) {
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x2a1c10, side: THREE.BackSide });
    applyBend(outlineMat, bend, 0); materials.push(outlineMat);
    const outline = new THREE.Mesh(bodyGeometry(), outlineMat);
    outline.scale.setScalar(1.06);
    group.add(outline);
  }

  // fins (soft, translucent)
  const finCol = color(p.patch).lerp(color(p.base), 0.45).lerp(new THREE.Color(0xffffff), 0.4);
  const finBase = {
    color: finCol, transparent: true, opacity: p.fin === 'Veil' ? 0.62 : 0.8,
    roughness: 0.5, metalness: 0.1 + 0.4 * p.luster, side: THREE.DoubleSide,
    depthWrite: false, alphaMap: finAlpha(), flatShading: true,
  };
  const finMat = new THREE.MeshStandardMaterial(finBase); materials.push(finMat);
  const finLen = { Standard: 1, Fan: 1.18, Long: 1.6, Veil: 2.1 }[p.fin] || 1;
  const finSpread = { Standard: 1, Fan: 1.3, Long: 1.05, Veil: 1.15 }[p.fin] || 1;

  // caudal (tail) — shares the bend so it sweeps with the body
  const tailMat = new THREE.MeshStandardMaterial(finBase); applyBend(tailMat, bend, TAIL_MOUNT_X); materials.push(tailMat);
  const tail = new THREE.Mesh(tailGeometry(), tailMat);
  tail.position.x = TAIL_MOUNT_X; tail.scale.set(finLen, 1, finSpread); group.add(tail);

  // dorsal — vertical membrane that waves with the body
  const dorsalMat = new THREE.MeshStandardMaterial(finBase); applyBend(dorsalMat, bend, 0); materials.push(dorsalMat);
  const dorsal = new THREE.Mesh(dorsalGeometry(), dorsalMat);
  dorsal.position.y = 0.16; group.add(dorsal);

  // pectorals
  const pecGeo = pectoralGeometry();
  const pecL = new THREE.Group(); pecL.position.set(0.28, -0.05, -0.13); pecL.scale.setScalar(0.8 * finLen); pecL.add(new THREE.Mesh(pecGeo, finMat)); group.add(pecL);
  const pecR = new THREE.Group(); pecR.position.set(0.28, -0.05, 0.13); pecR.scale.set(0.8 * finLen, 0.8 * finLen, -0.8 * finLen); pecR.add(new THREE.Mesh(pecGeo, finMat)); group.add(pecR);

  // barbels (whiskers)
  const barbelMat = new THREE.MeshStandardMaterial({ color: color(p.base).lerp(new THREE.Color(0xffffff), 0.3), roughness: 0.7 }); materials.push(barbelMat);
  const bgeo = barbelGeometry();
  for (const s of [-1, 1]) {
    const bar = new THREE.Mesh(bgeo, barbelMat);
    bar.position.set(0.98, -0.05, 0.05 * s);
    bar.rotation.z = -0.4; bar.rotation.y = 0.5 * s;
    group.add(bar);
  }

  // eyes (dark glossy + catch-light)
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0e0a06, roughness: 0.15, metalness: 0.3 }); materials.push(eyeMat);
  const hiMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.2 }); materials.push(hiMat);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeometry(), eyeMat);
    eye.position.set(0.74, 0.05, 0.12 * s); group.add(eye);
    const hi = new THREE.Mesh(eyeHiGeometry(), hiMat);
    hi.position.set(0.78, 0.09, 0.14 * s); group.add(hi);
  }

  // contact shadow + selection ring
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x04161c, transparent: true, opacity: 0.3, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.8, 20), shadowMat); shadow.rotation.x = -Math.PI / 2;
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.18, 32), ringMat); ring.rotation.x = -Math.PI / 2; ring.visible = false;

  group.userData = { fishId: null, phase: bend.uPhase.value, bend, pecL, pecR, materials, texture: tex, shadow, shadowMat, ring, ringMat };
  group.scale.setScalar(p.size);
  return group;
}

export function updateKoiFish(group, time, speed = 0.6) {
  const u = group.userData;
  u.bend.uAmp.value = 0.05 + Math.min(2.2, speed) * 0.045;
  const flap = Math.sin(time * 4.5 + u.phase) * 0.22;
  u.pecL.rotation.z = -0.25 + flap;
  u.pecR.rotation.z = -0.25 + flap;
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
