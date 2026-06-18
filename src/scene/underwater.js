// =============================================================================
// Underwater scene — the pond bed you can now see through the clearer water:
// a sandy floor, scattered low-poly pebbles & rocks, swaying water plants, and
// gently drifting light caustics. Sits below the koi for real depth.
// =============================================================================

import * as THREE from 'three';

export const FLOOR_Y = -2.0;

function sandTexture() {
  const s = 256;
  const c = document.createElement('canvas'); c.width = c.height = s;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s * 0.6);
  g.addColorStop(0, '#cdb88c'); g.addColorStop(1, '#9c855c');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(${90 + Math.random() * 90},${70 + Math.random() * 70},${40 + Math.random() * 60},0.25)`;
    const r = Math.random() * 2.2;
    x.beginPath(); x.arc(Math.random() * s, Math.random() * s, r, 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function causticTexture() {
  const s = 256;
  const c = document.createElement('canvas'); c.width = c.height = s;
  const x = c.getContext('2d');
  x.clearRect(0, 0, s, s);
  for (let i = 0; i < 16; i++) {
    const cx = Math.random() * s, cy = Math.random() * s, r = 20 + Math.random() * 40;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,250,0.5)'); g.addColorStop(0.5, 'rgba(220,245,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  return t;
}

function pebble() {
  const r = 0.12 + Math.random() * 0.22;
  const geo = new THREE.IcosahedronGeometry(r, 0);
  const shade = 0.5 + Math.random() * 0.3;
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: new THREE.Color(shade, shade * 0.92, shade * 0.78), flatShading: true, roughness: 1,
  }));
  m.scale.y = 0.45 + Math.random() * 0.3;
  m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
  return m;
}

function waterPlant() {
  const g = new THREE.Group();
  const hue = 0.28 + Math.random() * 0.08;
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue, 0.5, 0.3), flatShading: true, side: THREE.DoubleSide, roughness: 0.9 });
  const blades = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < blades; i++) {
    const h = 0.8 + Math.random() * 1.3;
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.06, h, 4), mat);
    blade.position.set((Math.random() - 0.5) * 0.3, h / 2, (Math.random() - 0.5) * 0.3);
    blade.userData.base = (Math.random() - 0.5) * 0.2;
    blade.userData.phase = Math.random() * 6.28;
    g.add(blade);
  }
  g.userData.mat = mat;
  return g;
}

export function createUnderwater(pondRadius) {
  const group = new THREE.Group();
  const plants = [];

  // sandy floor
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(pondRadius * 1.0, 48),
    new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  group.add(floor);

  // pebbles
  for (let i = 0; i < 46; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * (pondRadius - 1);
    const p = pebble();
    p.position.set(Math.cos(a) * r, FLOOR_Y + 0.06, Math.sin(a) * r);
    group.add(p);
  }

  // a few larger sunken rocks
  for (let i = 0; i < 5; i++) {
    const a = Math.random() * Math.PI * 2, r = pondRadius * (0.4 + Math.random() * 0.5);
    const rock = pebble();
    rock.scale.multiplyScalar(3 + Math.random() * 2);
    rock.position.set(Math.cos(a) * r, FLOOR_Y + 0.2, Math.sin(a) * r);
    group.add(rock);
  }

  // water plants
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * (pondRadius - 3);
    const pl = waterPlant();
    pl.position.set(Math.cos(a) * r, FLOOR_Y, Math.sin(a) * r);
    group.add(pl);
    plants.push(pl);
  }

  // drifting light caustics just above the floor
  const causticMap = causticTexture();
  const caustics = new THREE.Mesh(
    new THREE.CircleGeometry(pondRadius * 0.99, 48),
    new THREE.MeshBasicMaterial({ map: causticMap, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
  caustics.rotation.x = -Math.PI / 2;
  caustics.position.y = FLOOR_Y + 0.05;
  group.add(caustics);

  function update(t) {
    causticMap.offset.set(Math.sin(t * 0.05) * 0.1 + t * 0.01, Math.cos(t * 0.04) * 0.1);
    for (const pl of plants)
      for (const blade of pl.children) blade.rotation.z = blade.userData.base + Math.sin(t * 0.9 + blade.userData.phase) * 0.18;
  }

  return { group, update, floorY: FLOOR_Y };
}
