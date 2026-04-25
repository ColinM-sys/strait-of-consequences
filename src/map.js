import * as THREE from 'three';

// ── Water shader — clearly oceanic blue ───────────────────────────────────────
const WATER_VERT = `
  uniform float time;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    pos.y += sin(pos.x * 0.07 + time * 0.55) * 0.5
           + cos(pos.z * 0.055 + time * 0.42) * 0.35
           + sin(pos.x * 0.13 - pos.z * 0.09 + time * 0.9) * 0.18;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;
const WATER_FRAG = `
  uniform float time;
  varying vec2 vUv;
  void main() {
    float w = sin(vUv.x * 18.0 + time * 0.7) * 0.07
            + cos(vUv.y * 14.0 + time * 0.5) * 0.06
            + sin((vUv.x + vUv.y) * 9.0 + time * 1.0) * 0.04;
    vec3 deep    = vec3(0.02, 0.18, 0.44);
    vec3 bright  = vec3(0.06, 0.32, 0.64);
    gl_FragColor = vec4(mix(deep, bright, clamp(w + 0.5, 0.0, 1.0)), 1.0);
  }
`;

// ── Coastline polygons ─────────────────────────────────────────────────────────
// Coordinate system: X = east(+)/west(-), Z = south(+)/north(-)
// 1 unit ≈ 3 km.  Center (0,0) = middle of strait.
//
// Real Hormuz geography:
//   Iran coast: Z ≈ -22 to -28, runs E-W across top
//   Musandam tip: Z ≈ -8, X ≈ 42–50  (14-unit gap from Iran = ~42km ≈ real 21nm chokepoint)
//   Musandam base: Z ≈ +40, elongated N-S peninsula on east/right side
//   UAE coast: Z ≈ +16 running W from Musandam base
//   Strait widens LEFT (west) into Persian Gulf
//   Strait opens RIGHT (east) into Gulf of Oman

// IRAN — south-facing coast + mainland going north off-screen
const IRAN_POINTS = [
  [100, -24],  // eastern edge near Gulf of Oman opening
  [ 78, -23],
  [ 60, -22],
  [ 45, -20],  // Bandar Abbas area (coast dips slightly south here — port faces strait)
  [ 32, -22],
  [ 18, -25],
  [  4, -27],
  [-14, -28],  // Abu Musa / Tunb area
  [-36, -27],
  [-60, -26],
  [-88, -24],
  [-112,-23],  // western edge
  // Box off north (mainland, off screen)
  [-112,-90],
  [100, -90],
];

// MUSANDAM PENINSULA — rocky wedge jutting north into strait from SE
// Real shape: elongated N-S, narrow at tip, wider at base, eastern side of strait
const MUSANDAM_POINTS = [
  [ 44,  -8],  // TIP — closest point to Iran (14 units south of Iran coast)
  [ 40,  -5],
  [ 36,   0],
  [ 33,   8],  // west flank narrows going north
  [ 31,  17],
  [ 32,  27],
  [ 36,  40],  // SW base corner — meets UAE coast
  // Eastern coast of peninsula (Gulf of Oman side)
  [ 84,  40],  // SE base corner
  [ 82,  26],
  [ 76,  14],
  [ 68,   5],
  [ 60,  -3],
  [ 54,  -7],
  [ 48,  -9],
  [ 44,  -8],  // back to tip
];

// UAE + OMAN SOUTH/WEST COAST
// The coast curves — further north (smaller Z) in the west, meeting Musandam base in the east
const UAE_COAST_POINTS = [
  [-112,   6],  // far western edge — coast is close to strait here
  [ -80,   7],
  [ -50,   8],
  [ -20,  10],
  [   0,  11],
  [  20,  13],
  [  32,  16],  // connects to Musandam SW base
  [  32,  80],  // south, off-screen
  [-112,  80],
];

// QESHM ISLAND — large elongated island just south of Bandar Abbas
const QESHM_POINTS = [
  [ 16, -32], [ 24, -34], [ 36, -35], [ 46, -34],
  [ 52, -32], [ 50, -28], [ 38, -27], [ 22, -28],
  [ 16, -30], [ 16, -32],
];

// Small islands
const SMALL_ISLANDS = [
  { x: -14, z: -24, w: 6,  d: 5,  h: 3 },  // Greater Tunb
  { x: -24, z: -20, w: 4,  d: 4,  h: 2 },  // Lesser Tunb
  { x: -30, z: -15, w: 5,  d: 5,  h: 3 },  // Abu Musa
  { x:  28, z: -24, w: 6,  d: 6,  h: 3 },  // Hormuz Island
  { x:  46, z: -30, w: 7,  d: 6,  h: 3 },  // Larak Island
];

// ── Builder helpers ───────────────────────────────────────────────────────────

// Extrude a coastline polygon upward from Y=0
// points = [[worldX, worldZ], ...]
// After mesh.rotation.x = -PI/2: shapeX→worldX, shapeY→-worldZ
function makeCoast(scene, points, height, color) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], -points[0][1]);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i][0], -points[i][1]);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  const mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  scene.add(mesh);
  return mesh;
}

function makeIslandBox(scene, { x, z, w, d, h }, color) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, h / 2, z);
  scene.add(mesh);
}

// Shipping lane as a wide translucent BAND — not dashed lines
function addLaneBand(scene, z1, z2, color) {
  const cx = -5, cz = (z1 + z2) / 2, w = 200, d = Math.abs(z2 - z1);
  const geo = new THREE.PlaneGeometry(w, d);
  const mat = new THREE.MeshBasicMaterial({
    color, side: THREE.DoubleSide, transparent: true, opacity: 0.09, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(cx, 0.3, cz);
  scene.add(mesh);

  // Single solid border lines at each edge (not dashes)
  [[z1], [z2]].forEach(([z]) => {
    const pts = [new THREE.Vector3(-105, 0.4, z), new THREE.Vector3(95, 0.4, z)];
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 })
    );
    scene.add(line);
  });
}

function makeLabel(scene, text, worldX, worldZ, color = '#3a7aaa', scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = 320; canvas.height = 48;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 320, 48);
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(13 * scale)}px Courier New`;
  ctx.textAlign = 'center';
  ctx.fillText(text, 160, 32);
  const mat = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(22 * scale, 3.5 * scale), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(worldX, 0.8, worldZ);
  scene.add(mesh);
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildMap(scene, waterUniforms) {
  // ── Water plane ────────────────────────────────────────────────────────────
  const waterGeo = new THREE.PlaneGeometry(700, 700, 60, 60);
  waterGeo.rotateX(-Math.PI / 2);
  scene.add(new THREE.Mesh(waterGeo, new THREE.ShaderMaterial({
    vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, uniforms: waterUniforms,
  })));

  // ── Land ───────────────────────────────────────────────────────────────────
  const C_IRAN   = 0xc8a45a;   // sandy desert coast (Iran)
  const C_OMAN   = 0xd4b06a;   // slightly lighter (Oman/UAE)
  const C_ISLAND = 0xa87840;   // darker rocky islands

  makeCoast(scene, IRAN_POINTS,      5, C_IRAN);
  makeCoast(scene, MUSANDAM_POINTS,  5, C_OMAN);
  makeCoast(scene, UAE_COAST_POINTS, 4, C_OMAN);
  makeCoast(scene, QESHM_POINTS,     3, C_ISLAND);
  SMALL_ISLANDS.forEach(def => makeIslandBox(scene, def, C_ISLAND));

  // ── Shipping lane bands (wide translucent — NOT dashed road lines) ─────────
  addLaneBand(scene,  -7, -14, 0x44cc88);  // Inbound / Oman side (safe)
  addLaneBand(scene, -16, -23, 0x4488cc);  // Outbound / Iran side (dangerous)

  // ── Geographic labels ──────────────────────────────────────────────────────
  makeLabel(scene, 'IRAN',                    -8, -55, '#c09050', 1.5);
  makeLabel(scene, 'MUSANDAM  (OMAN)',         52,  18, '#8a7040', 1.0);
  makeLabel(scene, 'U.A.E.',                 -60,  32, '#8a7040', 1.0);
  makeLabel(scene, 'BANDAR ABBAS',            38, -19, '#806040', 0.85);
  makeLabel(scene, 'QESHM',                   34, -32, '#806040', 0.8);
  makeLabel(scene, 'ABU MUSA',               -28, -12, '#806040', 0.8);
  makeLabel(scene, 'STRAIT OF HORMUZ',         0,  -2, '#2a7aaa', 1.2);
  makeLabel(scene, 'PERSIAN GULF',           -72,  -8, '#1a5a8a', 1.0);
  makeLabel(scene, 'GULF OF OMAN',            60,  28, '#1a5a8a', 1.0);
  makeLabel(scene, '✓ TSS INBOUND  (safe)',   -18, -10, '#44cc88', 0.8);
  makeLabel(scene, '✗ TSS OUTBOUND',          -18, -20, '#4488cc', 0.8);
}
