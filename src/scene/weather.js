// =============================================================================
// Weather — a slow, cozy cycle of sunny / petals / cloudy / rain. Eases the sun
// intensity, sky gradient and fog between moods, drifts sakura petals on calm
// days, and falls rain (dimpling the pond with ripples) on wet ones.
// =============================================================================

import * as THREE from 'three';
import { CONFIG } from '../config.js';

const STATES = {
  Sunny:  { label: '☀️ Sunny',  w: 4, sun: 1.85, top: 0x7fb0e6, bottom: 0xf6e7c6, rain: 0, petals: 0.25 },
  Petals: { label: '🌸 Petals', w: 2, sun: 1.70, top: 0x86b2e2, bottom: 0xf7e3df, rain: 0, petals: 1.0 },
  Cloudy: { label: '☁️ Cloudy', w: 2, sun: 0.95, top: 0x9fb0bf, bottom: 0xd9d2c4, rain: 0, petals: 0 },
  Rain:   { label: '🌧️ Rain',  w: 2, sun: 0.55, top: 0x6f7d88, bottom: 0xaab0ad, rain: 1, petals: 0 },
};

function pickState(rng, exclude) {
  const keys = Object.keys(STATES).filter((k) => k !== exclude);
  const total = keys.reduce((a, k) => a + STATES[k].w, 0);
  let t = rng() * total;
  for (const k of keys) if ((t -= STATES[k].w) <= 0) return k;
  return 'Sunny';
}

function particleField(count, size, colorHex, opacity) {
  const pos = new Float32Array(count * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: colorHex, size, sizeAttenuation: true, transparent: true, opacity,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, pos, mat };
}

export function createWeather({ sun, sky, fog, ripples, rng = Math.random }) {
  const R = CONFIG.pondRadius;
  const group = new THREE.Group();

  // rain (thin, fast) + petals (soft, slow) particle fields
  const RAIN = 700, PET = 160;
  const rain = particleField(RAIN, 0.16, 0xbcd4e8, 0);
  const rainV = new Float32Array(RAIN);
  const pet = particleField(PET, 0.5, 0xffc6d8, 0);
  const petV = new Float32Array(PET * 2); // vx, sway phase
  const reset = (arr, i, top) => {
    arr[i * 3] = (rng() - 0.5) * R * 2.4;
    arr[i * 3 + 1] = top ? rng() * 22 : 6 + rng() * 16;
    arr[i * 3 + 2] = (rng() - 0.5) * R * 2.4;
  };
  for (let i = 0; i < RAIN; i++) { reset(rain.pos, i, true); rainV[i] = 14 + rng() * 8; }
  for (let i = 0; i < PET; i++) { reset(pet.pos, i, true); petV[i * 2] = (rng() - 0.5) * 0.4; petV[i * 2 + 1] = rng() * 6.28; }
  group.add(rain.points, pet.points);

  let state = 'Sunny';
  const target = { ...STATES.Sunny };
  const cur = { sun: STATES.Sunny.sun, rain: 0, petals: 0.25 };
  const topC = new THREE.Color(STATES.Sunny.top), botC = new THREE.Color(STATES.Sunny.bottom);
  const topTarget = new THREE.Color(STATES.Sunny.top), botTarget = new THREE.Color(STATES.Sunny.bottom);
  let timer = rng() * 20000 + CONFIG.weather.minMs;
  let rippleAcc = 0;

  function go(name) {
    state = name;
    const s = STATES[name];
    Object.assign(target, s);
    topTarget.set(s.top); botTarget.set(s.bottom);
  }

  function update(dt) {
    timer -= dt * 1000;
    if (timer <= 0) { go(pickState(rng, state)); timer = CONFIG.weather.minMs + rng() * (CONFIG.weather.maxMs - CONFIG.weather.minMs); }

    const k = 1 - Math.pow(0.06, Math.min(dt, 0.05));
    cur.sun += (target.sun - cur.sun) * k;
    cur.rain += (target.rain - cur.rain) * k;
    cur.petals += (target.petals - cur.petals) * k;
    topC.lerp(topTarget, k); botC.lerp(botTarget, k);

    if (sun) sun.intensity = cur.sun;
    if (sky) { sky.material.uniforms.top.value.copy(topC); sky.material.uniforms.bottom.value.copy(botC); }
    if (fog) fog.color.copy(botC);

    // rain
    rain.mat.opacity = cur.rain * 0.7;
    rain.points.visible = cur.rain > 0.02;
    if (rain.points.visible) {
      for (let i = 0; i < RAIN; i++) {
        rain.pos[i * 3 + 1] -= rainV[i] * dt;
        if (rain.pos[i * 3 + 1] < 0) reset(rain.pos, i, true);
      }
      rain.geometryNeedsUpdate = true;
      rain.points.geometry.attributes.position.needsUpdate = true;
      // dimple the pond
      rippleAcc += dt * cur.rain * 14;
      while (rippleAcc >= 1) {
        rippleAcc -= 1;
        if (ripples) {
          const a = rng() * 6.28, r = rng() * (R - 1.5);
          ripples.ring(Math.cos(a) * r, Math.sin(a) * r, { strength: 0.4, maxR: 1.0, life: 1.0 });
        }
      }
    }

    // petals
    pet.mat.opacity = cur.petals * 0.95;
    pet.points.visible = cur.petals > 0.02;
    if (pet.points.visible) {
      for (let i = 0; i < PET; i++) {
        pet.pos[i * 3 + 1] -= (0.7 + (i % 5) * 0.1) * dt;
        pet.pos[i * 3] += Math.sin(petV[i * 2 + 1] + pet.pos[i * 3 + 1] * 0.5) * petV[i * 2] * dt * 3;
        if (pet.pos[i * 3 + 1] < 0.2) reset(pet.pos, i, true);
      }
      pet.points.geometry.attributes.position.needsUpdate = true;
    }
  }

  return {
    group, update,
    getState: () => ({ name: state, label: STATES[state].label }),
  };
}
