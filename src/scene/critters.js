// =============================================================================
// Pond critters: ducks that paddle on the surface (leaving little wakes) and
// snails resting near the water's edge. Adds gentle, cozy life to the pond.
// =============================================================================

import * as THREE from 'three';

function makeDuck() {
  const g = new THREE.Group();
  const drake = Math.random() < 0.5;
  const bodyCol = drake ? 0xb8b0a4 : 0xf3efe6;
  const headCol = drake ? 0x2f6b43 : 0xf3efe6;

  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyCol, roughness: 0.7, flatShading: true });
  const headMat = new THREE.MeshStandardMaterial({ color: headCol, roughness: 0.55, metalness: drake ? 0.25 : 0, flatShading: true });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xe8a13a, roughness: 0.5 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), bodyMat);
  body.scale.set(1.35, 0.78, 0.95); body.castShadow = true; g.add(body);

  // tail tip up
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8), bodyMat);
  tail.position.set(-0.42, 0.12, 0); tail.rotation.z = -Math.PI / 2.6; g.add(tail);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.26, 10), headMat);
  neck.position.set(0.3, 0.2, 0); neck.rotation.z = 0.5; g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), headMat);
  head.position.set(0.42, 0.34, 0); head.castShadow = true; g.add(head);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 8), beakMat);
  beak.position.set(0.6, 0.31, 0); beak.rotation.z = -Math.PI / 2; g.add(beak);

  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), eyeMat);
    eye.position.set(0.5, 0.4, 0.09 * s); g.add(eye);
  }
  g.userData.mats = [bodyMat, headMat, beakMat, eyeMat];
  return g;
}

function makeSnail() {
  const g = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.6, flatShading: true });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xc9bda8, roughness: 0.8 });
  const shell = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.05, 8, 14), shellMat);
  shell.rotation.x = Math.PI / 2.2; shell.position.y = 0.09; shell.castShadow = true; g.add(shell);
  const foot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), bodyMat);
  foot.scale.set(1.8, 0.5, 0.8); foot.position.y = 0.03; g.add(foot);
  g.scale.setScalar(0.9 + Math.random() * 0.5);
  g.userData.mats = [shellMat, bodyMat];
  return g;
}

export function createCritters(pondRadius, ripples) {
  const group = new THREE.Group();
  const ducks = [];
  const snails = [];

  function addDuck(x = (Math.random() - 0.5) * pondRadius, z = (Math.random() - 0.5) * pondRadius) {
    const mesh = makeDuck();
    const d = {
      mesh, x, z, heading: Math.random() * Math.PI * 2,
      speed: 0.5, targetSpeed: 0.5, targetAngle: Math.random() * 6.28,
      wander: Math.random() * 3, wakeT: 1 + Math.random() * 3, phase: Math.random() * 6.28,
    };
    mesh.position.set(x, 0.12, z);
    group.add(mesh);
    ducks.push(d);
    return d;
  }

  function addSnail(x, z) {
    const mesh = makeSnail();
    mesh.position.set(x, 0.04, z);
    mesh.rotation.y = Math.random() * 6.28;
    group.add(mesh);
    snails.push(mesh);
    return mesh;
  }

  function stepDuck(d, dt, t) {
    d.wander -= dt;
    if (d.wander <= 0) {
      d.targetAngle = d.heading + (Math.random() - 0.5) * 1.6;
      d.targetSpeed = 0.25 + Math.random() * 0.5;
      d.wander = 2.5 + Math.random() * 4;
    }
    const r = Math.hypot(d.x, d.z);
    if (r > pondRadius - 2.5) { d.targetAngle = Math.atan2(-d.z, -d.x) + (Math.random() - 0.5) * 0.5; d.targetSpeed = 0.5; }
    let diff = d.targetAngle - d.heading;
    while (diff > Math.PI) diff -= 6.283; while (diff < -Math.PI) diff += 6.283;
    d.heading += Math.max(-1.0 * dt, Math.min(1.0 * dt, diff));
    d.speed += (d.targetSpeed - d.speed) * Math.min(1, dt * 1.5);
    d.x += Math.cos(d.heading) * d.speed * dt;
    d.z += Math.sin(d.heading) * d.speed * dt;
    d.mesh.position.set(d.x, 0.12 + Math.sin(t * 1.5 + d.phase) * 0.03, d.z);
    d.mesh.rotation.y = -d.heading + Math.PI; // beak forward
    d.mesh.rotation.z = Math.sin(t * 1.2 + d.phase) * 0.05;

    d.wakeT -= dt;
    if (d.wakeT <= 0 && ripples && d.speed > 0.2) {
      d.wakeT = 1.4 + Math.random() * 2;
      ripples.ring(d.x - Math.cos(d.heading) * 0.4, d.z - Math.sin(d.heading) * 0.4, { strength: 0.4, maxR: 1.3, life: 1.4 });
    }
  }

  function removeDuck(d) {
    const i = ducks.indexOf(d);
    if (i >= 0) { group.remove(d.mesh); d.mesh.userData.mats.forEach((m) => m.dispose()); ducks.splice(i, 1); }
  }
  function removeSnail(mesh) {
    const i = snails.indexOf(mesh);
    if (i >= 0) { group.remove(mesh); mesh.userData.mats.forEach((m) => m.dispose()); snails.splice(i, 1); }
  }

  function update(dt, t) {
    for (const d of ducks) stepDuck(d, dt, t);
    for (const s of snails) s.rotation.y += dt * 0.05;
  }

  return { group, addDuck, addSnail, removeDuck, removeSnail, update, ducks, snails };
}
