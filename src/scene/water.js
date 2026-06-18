// =============================================================================
// Pond water surface.
//
// A tessellated disc with a small, self-contained stylised shader: a few sine
// waves give gentle motion, the surface normal is derived analytically (so the
// GLSL stays simple and reliable), and lighting is faked with a fixed key
// light + fresnel rim + faint caustics + an edge-foam ring. The material is
// translucent with depthWrite off so koi swimming just beneath show through.
// =============================================================================

import * as THREE from 'three';

const vertexShader = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vRadius;

  // Surface height as a sum of travelling sine waves.
  float waveH(vec2 q, float t) {
    float h = 0.0;
    h += sin(q.x * 0.50 + t * 0.90) * 0.10;
    h += sin(q.y * 0.42 - t * 0.70) * 0.09;
    h += sin((q.x + q.y) * 0.33 + t * 1.30) * 0.05;
    return h;
  }

  void main() {
    vec2 q = position.xy;
    float h = waveH(q, uTime);

    // Analytic slope -> normal (local space; +z is "up" before the mesh tilt).
    float dHdx = 0.50 * cos(q.x * 0.50 + uTime * 0.90) * 0.10
               + 0.33 * cos((q.x + q.y) * 0.33 + uTime * 1.30) * 0.05;
    float dHdy = 0.42 * cos(q.y * 0.42 - uTime * 0.70) * 0.09
               + 0.33 * cos((q.x + q.y) * 0.33 + uTime * 1.30) * 0.05;
    vec3 nLocal = normalize(vec3(-dHdx, -dHdy, 1.0));

    vec4 displaced = vec4(position.x, position.y, h, 1.0);
    vec4 world = modelMatrix * displaced;
    vWorldPos = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * nLocal);
    vRadius = length(world.xz);

    gl_Position = projectionMatrix * modelViewMatrix * displaced;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uPondR;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uHi;
  uniform vec3 uFoam;
  uniform vec3 uLight;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vRadius;

  void main() {
    // Clip the square mesh into a circular pond.
    if (vRadius > uPondR) discard;

    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLight);
    vec3 V = normalize(cameraPosition - vWorldPos);

    float shore = clamp(vRadius / uPondR, 0.0, 1.0);
    vec3 base = mix(uShallow, uDeep, shore);
    float up = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
    base *= 0.82 + 0.32 * up;

    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 80.0);
    float spec2 = pow(max(dot(N, H), 0.0), 14.0) * 0.25;
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);

    float c = sin(vWorldPos.x * 0.7 + uTime) * sin(vWorldPos.z * 0.7 - uTime * 0.8);
    c = smoothstep(0.6, 1.0, c) * 0.05;

    float foam = smoothstep(0.9, 0.99, shore) * (0.5 + 0.5 * sin(vRadius * 6.0 + uTime * 2.0));

    vec3 colr = base + uHi * (spec + spec2) + uHi * fres * 0.22 + c + uFoam * foam * 0.6;
    float alpha = mix(0.30, 0.62, shore); // very clear water — the pond bed shows through
    gl_FragColor = vec4(colr, alpha);
  }
`;

export function createWater(pondRadius) {
  const d = pondRadius * 2 * 1.02;
  const geo = new THREE.PlaneGeometry(d, d, 100, 100);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPondR: { value: pondRadius },
      uDeep: { value: new THREE.Color(0x15616a) },
      uShallow: { value: new THREE.Color(0x4cc0a8) },
      uHi: { value: new THREE.Color(0xffffff) },
      uFoam: { value: new THREE.Color(0xf3fff9) },
      uLight: { value: new THREE.Vector3(-0.4, 0.85, 0.35) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2; // lay flat, waves push +y
  mesh.position.y = 0;
  mesh.renderOrder = 2;

  return {
    mesh,
    material,
    update(t) { material.uniforms.uTime.value = t; },
  };
}
