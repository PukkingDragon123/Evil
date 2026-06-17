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
import { createOrigamiFish, updateFishMesh, disposeFishMesh } from './origamiFish.js';

const POND_R = CONFIG.pondRadius;

export function createPondScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1518);
  scene.fog = new THREE.Fog(0x0e1518, 60, 170);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);

  // --- lights ---
  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x3f5a36, 0.95));
  const key = new THREE.DirectionalLight(0xfff2dc, 1.15);
  key.position.set(-10, 18, 7);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fd0ff, 0.35);
  fill.position.set(9, 8, -6);
  scene.add(fill);

  // --- world ---
  const garden = createGarden(POND_R);
  scene.add(garden.group);
  const water = createWater(POND_R);
  scene.add(water.mesh);
  const ripples = createRipples();
  scene.add(ripples.group);

  // Decals (shadows + selection rings) live in their own group on/near the floor.
  const decals = new THREE.Group();
  scene.add(decals);

  // --- camera rig (orbit around pond centre) ---
  const target = new THREE.Vector3(0, 0, 0);
  const cam = { radius: 42, azimuth: -Math.PI / 2, polar: 0.62 };
  function applyCamera() {
    const sinP = Math.sin(cam.polar), cosP = Math.cos(cam.polar);
    camera.position.set(
      target.x + cam.radius * sinP * Math.cos(cam.azimuth),
      target.y + cam.radius * cosP,
      target.z + cam.radius * sinP * Math.sin(cam.azimuth));
    camera.lookAt(target);
  }
  applyCamera();

  // --- fish view registry ---
  const views = new Map(); // fishId -> view

  function addFish(id, desc) {
    if (views.has(id)) return;
    const group = createOrigamiFish(desc);
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
    disposeFishMesh(v.group);
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
    v.wanderTimer -= dt;
    if (v.wanderTimer <= 0) {
      v.targetAngle = v.heading + (Math.random() - 0.5) * 2.2;
      v.targetSpeed = (0.7 + Math.random() * 0.8) * (1.4 / (0.7 + v.size));
      v.wanderTimer = 1.4 + Math.random() * 2.6;
    }

    // Steer back toward the centre as we near the rim.
    const r = Math.hypot(v.x, v.z);
    if (r > POND_R - 2.4) {
      v.targetAngle = Math.atan2(-v.z, -v.x) + (Math.random() - 0.5) * 0.6;
      v.targetSpeed = Math.max(v.targetSpeed, 1.0);
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
    updateFishMesh(g, t, v.speed);

    // Shadow tracks on the floor; ring tracks on the surface.
    const sh = g.userData.shadow;
    sh.position.set(v.x, -0.8, v.z);
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
        v.targetSpeed = 2.4;
        v.speed = Math.max(v.speed, 2.0);
        v.wanderTimer = 0.8;
      }
    }
  }

  let elapsed = 0;
  function update(dt) {
    elapsed += dt;
    water.update(elapsed);
    garden.update(elapsed);
    ripples.update(dt);
    for (const v of views.values()) stepFish(v, dt, elapsed);
    renderer.render(scene, camera);
  }

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

  // --- camera controls ---
  function orbit(dAz, dPolar) {
    cam.azimuth += dAz;
    cam.polar = Math.max(0.12, Math.min(1.0, cam.polar + dPolar));
    applyCamera();
  }
  function zoom(delta) {
    cam.radius = Math.max(16, Math.min(72, cam.radius + delta));
    applyCamera();
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
    orbit, zoom,
  };
}
