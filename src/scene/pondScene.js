// =============================================================================
// PondScene — owns the renderer, camera, lights and every 3D object.
//
// Gameplay code talks to it through a small surface: addFish / removeFish /
// syncSelection / update / pointer helpers / camera controls. Fish wander
// autonomously within the pond; each has a soft floor shadow and a (hidden)
// gold selection ring. Picking is forgiving: project the pointer onto the
// water plane, then grab the nearest koi.
// =============================================================================

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createWater } from './water.js';
import { createGarden } from './garden.js';
import { createRipples } from './ripples.js';
import { createKoiFish, updateKoiFish, disposeKoiFish, setKoiTime } from './koiFish.js';
import { createCritters } from './critters.js';
import { createWeather } from './weather.js';
import { createDecor } from './decor.js';

const POND_R = CONFIG.pondRadius;

export function createPondScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xefdcb8, 80, 210); // warm daytime haze in the distance

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 600);

  // --- sky dome (soft daytime gradient) ---
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(280, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x7fb0e6) },
        bottom: { value: new THREE.Color(0xf6e7c6) },
      },
      vertexShader: `varying float vy;
        void main(){ vy = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying float vy; uniform vec3 top; uniform vec3 bottom;
        void main(){ float t = clamp(vy*0.5+0.5,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, pow(t,0.8)), 1.0); }`,
    }));
  scene.add(sky);

  // --- sunshine ---
  const sunDir = new THREE.Vector3(-0.55, 0.74, 0.38).normalize();
  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x6f5d3e, 0.75));
  const sun = new THREE.DirectionalLight(0xfff1d4, 1.85);
  sun.position.copy(sunDir).multiplyScalar(70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.near = 10; sc.far = 220;
  sc.left = -(POND_R + 12); sc.right = POND_R + 12;
  sc.top = POND_R + 12; sc.bottom = -(POND_R + 12);
  sc.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.7;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0x9fc2ff, 0.28);
  fill.position.set(12, 9, -8);
  scene.add(fill);

  // Visible sun glow billboarded high in the sky.
  const sunGlow = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,252,238,1)');
    grd.addColorStop(0.18, 'rgba(255,242,205,0.95)');
    grd.addColorStop(0.5, 'rgba(255,224,160,0.32)');
    grd.addColorStop(1, 'rgba(255,224,160,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false,
    }));
    sprite.scale.setScalar(70);
    sprite.position.copy(sunDir).multiplyScalar(200);
    return sprite;
  })();
  scene.add(sunGlow);

  // --- world ---
  const garden = createGarden(POND_R);
  scene.add(garden.group);
  const water = createWater(POND_R);
  water.material.uniforms.uLight.value.copy(sunDir); // align glints with the sun
  scene.add(water.mesh);
  const ripples = createRipples();
  scene.add(ripples.group);

  // Weather drives the sun, sky and fog, and dimples the pond when it rains.
  const weather = createWeather({ sun, sky, fog: scene.fog, ripples });
  scene.add(weather.group);

  // Ducks & snails for cozy ambient life.
  const critters = createCritters(POND_R, ripples);
  scene.add(critters.group);
  critters.addDuck();
  critters.addDuck();
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2, r = POND_R + 0.5 + Math.random() * 0.9;
    critters.addSnail(Math.cos(a) * r, Math.sin(a) * r);
  }

  // Placed decorations (building system).
  const decor = createDecor();
  scene.add(decor.group);
  const placedReg = new Map(); // recId -> { kind, handle?, x, z }

  // Decals (shadows + selection rings) live in their own group on/near the floor.
  const decals = new THREE.Group();
  scene.add(decals);

  // --- camera rig (smooth, damped orbit around the pond) ---
  const target = new THREE.Vector3(0, 0, 0);
  const camCur = { radius: 44, az: -Math.PI / 2, polar: 0.58 };
  const camTgt = { radius: 44, az: -Math.PI / 2, polar: 0.58 };
  let idle = 0;
  function applyCam() {
    const sinP = Math.sin(camCur.polar), cosP = Math.cos(camCur.polar);
    camera.position.set(
      target.x + camCur.radius * sinP * Math.cos(camCur.az),
      target.y + camCur.radius * cosP,
      target.z + camCur.radius * sinP * Math.sin(camCur.az));
    camera.lookAt(target);
  }
  function stepCamera(dt) {
    idle += dt;
    if (idle > 5) camTgt.az += dt * 0.05; // slow, zen drift when left alone
    const k = 1 - Math.pow(0.0016, Math.min(dt, 0.05)); // frame-rate independent damping
    camCur.radius += (camTgt.radius - camCur.radius) * k;
    camCur.az += (camTgt.az - camCur.az) * k;
    camCur.polar += (camTgt.polar - camCur.polar) * k;
    applyCam();
  }
  applyCam();

  // --- fish view registry ---
  const views = new Map(); // fishId -> view

  function addFish(id, desc) {
    if (views.has(id)) return;
    const group = createKoiFish(desc);
    group.userData.fishId = id;
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * (POND_R - 3);
    const view = {
      id, group, desc,
      x: Math.cos(a) * r, z: Math.sin(a) * r,
      heading: Math.random() * Math.PI * 2,
      speed: 1.2, targetSpeed: 1.2, targetAngle: Math.random() * Math.PI * 2,
      wanderTimer: Math.random() * 2,
      size: desc.phenotype.size,
      rippleTimer: 1 + Math.random() * 4,
    };
    group.position.set(view.x, CONFIG.swimDepth, view.z);
    scene.add(group);

    const shadow = group.userData.shadow;
    const ring = group.userData.ring;
    shadow.scale.setScalar(view.size);
    ring.scale.setScalar(view.size);
    decals.add(shadow, ring);

    views.set(id, view);
  }

  function removeFish(id) {
    const v = views.get(id);
    if (!v) return;
    scene.remove(v.group);
    decals.remove(v.group.userData.shadow, v.group.userData.ring);
    disposeKoiFish(v.group);
    views.delete(id);
  }

  function hasFish(id) { return views.has(id); }
  function fishIds() { return [...views.keys()]; }

  function syncSelection(selectedIds) {
    const set = new Set(selectedIds);
    for (const v of views.values()) v.group.userData.ring.visible = set.has(v.id);
  }

  // --- movement & animation ---
  function stepFish(v, dt, t) {
    const SP = CONFIG.fishSpeed;
    v.wanderTimer -= dt;
    if (v.wanderTimer <= 0) {
      v.targetAngle = v.heading + (Math.random() - 0.5) * 2.2;
      v.targetSpeed = (0.7 + Math.random() * 0.8) * (1.4 / (0.7 + v.size)) * SP;
      v.wanderTimer = 1.8 + Math.random() * 3.0;
    }

    // Steer back toward the centre as we near the rim.
    const r = Math.hypot(v.x, v.z);
    if (r > POND_R - 2.4) {
      v.targetAngle = Math.atan2(-v.z, -v.x) + (Math.random() - 0.5) * 0.6;
      v.targetSpeed = Math.max(v.targetSpeed, SP);
    }

    // Turn toward target heading along the shortest arc.
    let d = v.targetAngle - v.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const turn = Math.max(-1.8 * dt, Math.min(1.8 * dt, d));
    v.heading += turn;
    v.speed += (v.targetSpeed - v.speed) * Math.min(1, dt * 2.2);

    v.x += Math.cos(v.heading) * v.speed * dt;
    v.z += Math.sin(v.heading) * v.speed * dt;

    const g = v.group;
    g.position.x = v.x;
    g.position.z = v.z;
    g.position.y = CONFIG.swimDepth + Math.sin(t * 1.1 + g.userData.phase) * 0.05;
    g.rotation.y = -v.heading;
    updateKoiFish(g, t, v.speed);

    // Shadow tracks on the pond floor; ring tracks on the surface.
    const sh = g.userData.shadow;
    sh.position.set(v.x, -1.16, v.z);
    const ring = g.userData.ring;
    ring.position.set(v.x, 0.07, v.z);
    ring.rotation.z += dt * 0.8;

    // Occasional surface ripple as a koi noses the surface.
    v.rippleTimer -= dt;
    if (v.rippleTimer <= 0) {
      v.rippleTimer = 4 + Math.random() * 8;
      if (r < POND_R - 1) ripples.ring(v.x, v.z, { strength: 0.4 + v.size * 0.2, maxR: 1.6, life: 1.4 });
    }
  }

  // Startle fish away from a point (used when the player taps the water).
  function startle(point, radius = 4) {
    for (const v of views.values()) {
      const dx = v.x - point.x, dz = v.z - point.z;
      const d = Math.hypot(dx, dz);
      if (d < radius) {
        v.targetAngle = Math.atan2(dz, dx);
        v.targetSpeed = 2.4 * CONFIG.fishSpeed;
        v.speed = Math.max(v.speed, 2.0 * CONFIG.fishSpeed);
        v.wanderTimer = 0.8;
      }
    }
  }

  let elapsed = 0;
  function update(dt) {
    elapsed += dt;
    setKoiTime(elapsed);
    weather.update(dt);
    water.update(elapsed);
    garden.update(elapsed);
    critters.update(dt, elapsed);
    ripples.update(dt);
    for (const v of views.values()) stepFish(v, dt, elapsed);
    stepCamera(dt);
    renderer.render(scene, camera);
  }

  // --- decorations / building ---------------------------------------------
  function addDecoration(rec) {
    if (rec.type === 'duck') { const h = critters.addDuck(rec.x, rec.z); placedReg.set(rec.id, { kind: 'duck', handle: h, x: rec.x, z: rec.z }); }
    else if (rec.type === 'snail') { const h = critters.addSnail(rec.x, rec.z); placedReg.set(rec.id, { kind: 'snail', handle: h, x: rec.x, z: rec.z }); }
    else { decor.add(rec); placedReg.set(rec.id, { kind: 'decor', x: rec.x, z: rec.z }); }
  }
  function removeDecoration(id) {
    const e = placedReg.get(id);
    if (!e) return;
    if (e.kind === 'duck') critters.removeDuck(e.handle);
    else if (e.kind === 'snail') critters.removeSnail(e.handle);
    else decor.remove(id);
    placedReg.delete(id);
  }
  function pickDecoration(point, maxDist = 2.4) {
    let best = null, bd = maxDist;
    for (const [id, e] of placedReg) {
      const d = Math.hypot(e.x - point.x, e.z - point.z);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }
  function getWeather() { return weather.getState(); }

  // --- pointer helpers ---
  const raycaster = new THREE.Raycaster();
  const surfacePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();

  function surfacePoint(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    return raycaster.ray.intersectPlane(surfacePlane, hit) ? hit : null;
  }

  function nearestFish(point) {
    let best = null, bestD = Infinity;
    for (const v of views.values()) {
      const d = Math.hypot(v.x - point.x, v.z - point.z);
      const reach = 1.3 * v.size + 0.6;
      if (d < reach && d < bestD) { bestD = d; best = v.id; }
    }
    return best;
  }

  // --- camera controls (adjust the target; stepCamera eases toward it) ---
  function orbit(dAz, dPolar) {
    camTgt.az += dAz;
    camTgt.polar = Math.max(0.12, Math.min(1.28, camTgt.polar + dPolar));
    idle = 0;
  }
  function zoom(delta) {
    camTgt.radius = Math.max(16, Math.min(82, camTgt.radius + delta));
    idle = 0;
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function mount(container) {
    container.appendChild(renderer.domElement);
    resize();
  }

  return {
    scene, camera, renderer, ripples,
    mount, resize, update,
    addFish, removeFish, hasFish, fishIds, syncSelection,
    surfacePoint, nearestFish, startle,
    addDecoration, removeDecoration, pickDecoration, getWeather,
    orbit, zoom,
  };
}
