// Smoke test for the 3D/visual modules. It constructs the scene objects with
// the real (vendored) Three.js but no GL context, which catches Three API
// misuse, bad geometry/material setup, and runtime errors in the builders.
//
// Run: node test/visual.smoke.mjs   (requires the node_modules/three shim)

// --- minimal browser stubs (installed before any module code runs) ----------
globalThis.self = globalThis;
globalThis.window = { devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720 };
function ctx2d() {
  const noop = () => {};
  const grad = () => ({ addColorStop: noop });
  return {
    fillStyle: '', strokeStyle: '', lineWidth: 0,
    fillRect: noop, beginPath: noop, arc: noop, stroke: noop, fill: noop, moveTo: noop, lineTo: noop,
    createRadialGradient: grad, createLinearGradient: grad,
  };
}
globalThis.document = {
  createElement: (t) => (t === 'canvas'
    ? { width: 0, height: 0, getContext: () => ctx2d() }
    : {}),
};

let passed = 0, failed = 0;
const ok = (c, m) => c ? passed++ : (failed++, console.error('  ✗ FAIL: ' + m));

const THREE = await import('three');
const { describe, makeGenome, randomWildGenome, PATTERNS, FINS } =
  await import('../src/game/genetics.js');
const { createKoiFish, updateKoiFish, disposeKoiFish, setKoiTime } =
  await import('../src/scene/koiFish.js');
const { createWater } = await import('../src/scene/water.js');
const { createRipples } = await import('../src/scene/ripples.js');
const { createGarden } = await import('../src/scene/garden.js');

console.log('visual smoke test');

// --- koi fish across every pattern & fin ------------------------------------
{
  let built = 0, animated = 0;
  setKoiTime(1.0);
  for (let pi = 0; pi < PATTERNS.length; pi++) {
    for (let fi = 0; fi < FINS.length; fi++) {
      const desc = describe(makeGenome({
        pattern: PATTERNS[pi].t + 0.01,
        fin: FINS[fi].t + 0.01,
        sumi: pi % 2 ? 0.8 : 0.2,
        baseHue: Math.random(), baseSat: Math.random(), baseLight: Math.random(),
        patchHue: Math.random(), size: Math.random(), luster: Math.random(),
      }));
      const fish = createKoiFish(desc);
      if (!(fish instanceof THREE.Group)) { ok(false, 'fish is a Group'); break; }
      built++;

      // Body: a single textured mesh with proper UVs + indices.
      const body = fish.children.find((c) => c.isMesh && c.material && c.material.map);
      ok(body, 'fish has a textured body mesh');
      ok(body.geometry.getAttribute('uv'), 'body geometry has UVs for the koi texture');
      ok(body.geometry.getIndex(), 'body geometry is indexed (smooth, not faceted)');
      ok(body.material.flatShading !== true, 'body uses smooth shading (not origami)');

      const u = fish.userData;
      ok(u.bend && u.bend.uAmp && u.bend.uPhase, 'fish has swim-bend uniforms');
      ok(u.pecL && u.pecR, 'fish has pectoral fins');
      ok(u.shadow && u.ring, 'fish has shadow & selection ring');
      ok(u.materials.length === 4 && u.texture, 'per-fish materials + texture tracked for disposal');
      ok(fish.scale.x === desc.phenotype.size, 'scaled to genetic size');

      updateKoiFish(fish, 0.5, 0.8);
      updateKoiFish(fish, 1.7, 1.4);
      ok(Number.isFinite(u.bend.uAmp.value), 'swim amplitude is finite');
      animated++;

      disposeKoiFish(fish);
      if (failed) break;
    }
    if (failed) break;
  }
  ok(built === PATTERNS.length * FINS.length, `built every pattern×fin combo (${built})`);
  ok(animated === built, 'animated every built fish');
}

// --- random fish stress -----------------------------------------------------
{
  let okCount = 0;
  for (let i = 0; i < 80; i++) {
    const fish = createKoiFish(describe(randomWildGenome(Math.random)));
    updateKoiFish(fish, i * 0.13, Math.random() * 1.5);
    disposeKoiFish(fish);
    okCount++;
  }
  ok(okCount === 80, 'built & animated 80 random koi without error');
}

// --- water ------------------------------------------------------------------
{
  const water = createWater(18);
  ok(water.mesh && water.mesh.isMesh, 'water mesh created');
  ok(water.material instanceof THREE.ShaderMaterial, 'water uses a ShaderMaterial');
  ok('uTime' in water.material.uniforms && 'uPondR' in water.material.uniforms, 'water uniforms present');
  ok('uLight' in water.material.uniforms, 'water exposes a light direction (synced to the sun)');
  ok(water.material.uniforms.uPondR.value === 18, 'pond radius wired into shader');
  water.update(3.2);
  ok(water.material.uniforms.uTime.value === 3.2, 'water update sets time');
  ok(water.material.transparent && water.material.depthWrite === false,
    'water is translucent with depthWrite off (koi show through)');
}

// --- ripples ----------------------------------------------------------------
{
  const r = createRipples();
  ok(r.group instanceof THREE.Group, 'ripple group created');
  ok(r.group.children.length > 0, 'ripple pools populated');
  r.ring(1, 2, { strength: 1 });
  r.splash(0, 0, 1.2);
  for (let i = 0; i < 200; i++) r.update(0.016); // run long enough to land droplets
  ok(true, 'ripples animate & recycle without error');
}

// --- garden -----------------------------------------------------------------
{
  const g = createGarden(18);
  ok(g.group instanceof THREE.Group, 'garden group created');
  ok(g.group.children.length > 5, 'garden populated (sand, lip, rocks, pads...)');
  let shadowCasters = 0;
  g.group.traverse((o) => { if (o.isMesh && o.castShadow) shadowCasters++; });
  ok(shadowCasters > 0, 'garden objects cast shadows in the sunlight');
  g.update(2.0);
  g.update(4.0);
  ok(true, 'garden floaters animate without error');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
