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
  return {
    fillStyle: '', strokeStyle: '', lineWidth: 0,
    fillRect: noop, beginPath: noop, arc: noop, stroke: noop, moveTo: noop, lineTo: noop,
    createRadialGradient: () => ({ addColorStop: noop }),
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
const { createOrigamiFish, updateFishMesh, disposeFishMesh } =
  await import('../src/scene/origamiFish.js');
const { createWater } = await import('../src/scene/water.js');
const { createRipples } = await import('../src/scene/ripples.js');
const { createGarden } = await import('../src/scene/garden.js');

console.log('visual smoke test');

// --- origami fish across every pattern & fin --------------------------------
{
  let built = 0, animated = 0;
  for (let pi = 0; pi < PATTERNS.length; pi++) {
    for (let fi = 0; fi < FINS.length; fi++) {
      const desc = describe(makeGenome({
        pattern: PATTERNS[pi].t + 0.01,
        fin: FINS[fi].t + 0.01,
        sumi: pi % 2 ? 0.8 : 0.2,
        baseHue: Math.random(), baseSat: Math.random(), baseLight: Math.random(),
        patchHue: Math.random(), size: Math.random(), luster: Math.random(),
      }));
      const fish = createOrigamiFish(desc);
      if (!(fish instanceof THREE.Group)) { ok(false, 'fish is a Group'); break; }
      built++;

      // Body mesh present with material groups that cover the whole geometry.
      const body = fish.children.find((c) => c.isMesh && Array.isArray(c.material));
      ok(body, 'fish has a multi-material body mesh');
      const pos = body.geometry.getAttribute('position');
      const groupVerts = body.geometry.groups.reduce((a, g) => a + g.count, 0);
      ok(groupVerts === pos.count, `material groups cover all body verts (${groupVerts}/${pos.count})`);
      ok(body.geometry.groups.every((g) => g.materialIndex >= 0 && g.materialIndex < 4),
        'every group uses a valid material slot');

      // Expected rig.
      const u = fish.userData;
      ok(u.tailPivot && u.pecL && u.pecR, 'fish has tail & pectoral pivots');
      ok(u.shadow && u.ring, 'fish has shadow & selection ring');
      ok(u.materials.length === 6, 'six per-fish materials');
      ok(fish.scale.x === desc.phenotype.size, 'scaled to genetic size');

      // Animate a couple of frames — must not throw or NaN.
      updateFishMesh(fish, 0.5, 0.8);
      updateFishMesh(fish, 1.7, 1.4);
      ok(Number.isFinite(u.tailPivot.rotation.y), 'tail wag is finite');
      animated++;

      disposeFishMesh(fish);
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
    const fish = createOrigamiFish(describe(randomWildGenome(Math.random)));
    updateFishMesh(fish, i * 0.13, Math.random() * 1.5);
    disposeFishMesh(fish);
    okCount++;
  }
  ok(okCount === 80, 'built & animated 80 random fish without error');
}

// --- water ------------------------------------------------------------------
{
  const water = createWater(18);
  ok(water.mesh && water.mesh.isMesh, 'water mesh created');
  ok(water.material instanceof THREE.ShaderMaterial, 'water uses a ShaderMaterial');
  ok('uTime' in water.material.uniforms && 'uPondR' in water.material.uniforms, 'water uniforms present');
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
  g.update(2.0);
  g.update(4.0);
  ok(true, 'garden floaters animate without error');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
