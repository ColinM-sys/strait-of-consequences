import * as THREE from 'three';

// ── Unit type definitions ────────────────────────────────────────────────────
const DEFS = {
  carrier:          { w: 14, h: 1.6, d: 3.0, speed: 8,  color: 0x3366bb, sup: true  },
  destroyer:        { w:  7, h: 1.3, d: 1.6, speed: 14, color: 0x2255aa, sup: true  },
  cruiser:          { w:  8, h: 1.4, d: 2.0, speed: 11, color: 0x2244aa, sup: true  },
  tanker:           { w: 16, h: 1.0, d: 2.8, speed: 6,  color: 0xccccdd, sup: false },
  fac:              { w:  3, h: 0.8, d: 1.0, speed: 20, color: 0xcc2222, sup: false },
  submarine:        { w:  7, h: 0.9, d: 1.2, speed: 10, color: 0x882222, sup: false },
  minelayer:        { w:  5, h: 1.0, d: 1.5, speed: 7,  color: 0xdd6600, sup: false },
  coastal_battery:  { w:  2, h: 3.0, d: 2.0, speed: 0,  color: 0x992222, sup: false },
};

// ── Actions available per unit type ──────────────────────────────────────────
export const UNIT_ACTIONS = {
  carrier:   ['air_cover', 'airstrike'],
  destroyer: ['ciws', 'mine_sweep', 'airstrike', 'sigint'],
  cruiser:   ['ciws', 'ew_jam', 'sigint'],
  tanker:    [],
};

const STRIPE_BLUE = 0x5599ff;
const STRIPE_RED  = 0xff4444;

export class Unit {
  constructor({ id, name, side, type, position }) {
    this.id      = id;
    this.name    = name;
    this.side    = side;
    this.type    = type;
    this.health  = 100;
    this.speed   = DEFS[type].speed;
    this.actionUsed = false;
    this.destroyed  = false;

    this.group = new THREE.Group();
    this.group.userData.unitId = id;

    this._hull = this._buildHull();
    this._buildLabel();
    this._buildSelectionRing();
    this._buildHealthBar();

    this.group.position.copy(position);
    this.group.position.y = 0;
    this._targetPos = position.clone();
    this._targetPos.y = 0;

    // for bob animation — stagger by id hash
    this._bobOffset = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 0.37;
  }

  _buildHull() {
    const def = DEFS[this.type];
    const g   = new THREE.Group();
    const col = def.color;
    const stripeCol = this.side === 'blue' ? STRIPE_BLUE : STRIPE_RED;

    // ── Top-down ship silhouette ────────────────────────────────────────────
    // Build a pointed-bow ship shape in the X-Z plane using ShapeGeometry,
    // then rotate flat so it's visible from above.
    const shape = _shipShape(def.w, def.d, this.type);
    const hullGeo = new THREE.ShapeGeometry(shape);
    const hullMat = new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.rotation.x = -Math.PI / 2;
    hull.position.y = 0.3;
    hull.userData.unitId = this.id;
    g.add(hull);

    // Faction color silhouette outline (slightly larger, drawn below)
    const outlineShape = _shipShape(def.w + 1.2, def.d + 0.8, this.type);
    const outlineGeo = new THREE.ShapeGeometry(outlineShape);
    const outline = new THREE.Mesh(
      outlineGeo,
      new THREE.MeshBasicMaterial({ color: stripeCol, side: THREE.DoubleSide })
    );
    outline.rotation.x = -Math.PI / 2;
    outline.position.y = 0.15;
    outline.userData.unitId = this.id;
    g.add(outline);

    // Bridge/superstructure dot (visible from above)
    if (def.sup) {
      const bridgeGeo = new THREE.CircleGeometry(def.d * 0.3, 8);
      const bridge = new THREE.Mesh(
        bridgeGeo,
        new THREE.MeshBasicMaterial({ color: stripeCol, side: THREE.DoubleSide })
      );
      bridge.rotation.x = -Math.PI / 2;
      bridge.position.set(def.w * 0.1, 0.6, 0);
      g.add(bridge);
    }

    this.group.add(g);
    this.meshes = [hull, outline];
    return g;
  }

  _buildLabel() {
    const canvas = document.createElement('canvas');
    canvas.width = 288; canvas.height = 44;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 288, 44);
    ctx.fillStyle = this.side === 'blue' ? '#88bbff' : '#ff8888';
    ctx.font = 'bold 13px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(this.name, 144, 30);
    const mat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.5), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 5;
    this.group.add(mesh);
  }

  _buildSelectionRing() {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffee00, side: THREE.DoubleSide,
      transparent: true, opacity: 0,
    });
    this._ring = new THREE.Mesh(new THREE.RingGeometry(7, 8.2, 28), mat);
    this._ring.rotation.x = -Math.PI / 2;
    this._ring.position.y = 0.25;
    this.group.add(this._ring);
  }

  _buildHealthBar() {
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 0.9),
      new THREE.MeshBasicMaterial({ color: 0x222222, depthWrite: false })
    );
    bg.rotation.x = -Math.PI / 2;
    bg.position.set(0, 0.3, -5);
    this.group.add(bg);

    this._hpFill = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 0.9),
      new THREE.MeshBasicMaterial({ color: 0x00ff44, depthWrite: false })
    );
    this._hpFill.rotation.x = -Math.PI / 2;
    this._hpFill.position.set(0, 0.35, -5);
    this.group.add(this._hpFill);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  select(on) {
    this._ring.material.opacity = on ? 0.9 : 0;
    this._ring.material.color.set(on ? 0xffee00 : 0xffffff);
  }

  pulse(on) {
    this._ring.material.opacity = on ? 0.55 : 0;
    this._ring.material.color.set(0x00ffcc);
  }

  setHealth(hp) {
    this.health = Math.max(0, Math.min(100, hp));
    const pct = this.health / 100;
    this._hpFill.scale.x = pct;
    this._hpFill.position.x = (pct - 1) * 4.5;
    this._hpFill.material.color.set(
      this.health > 60 ? 0x00ff44 : this.health > 30 ? 0xffaa00 : 0xff2200
    );
    if (this.health <= 0) this.destroy();
  }

  applyDamage(amt) { this.setHealth(this.health - amt); }

  destroy() {
    this.destroyed = true;
    this.group.visible = false;
  }

  moveTo(worldPos) {
    this._targetPos.set(worldPos.x, 0, worldPos.z);
  }

  update(delta) {
    if (this.destroyed) return;

    // Smooth slide to target
    const dx = this._targetPos.x - this.group.position.x;
    const dz = this._targetPos.z - this.group.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 0.08) {
      const spd = Math.min(dist, delta * 22);
      this.group.position.x += (dx / dist) * spd;
      this.group.position.z += (dz / dist) * spd;
      // Face direction of travel
      this.group.rotation.y = Math.atan2(dx, dz);
    }

    // Gentle bobbing on the water
    this.group.position.y = Math.sin(Date.now() * 0.0008 + this._bobOffset) * 0.18;

    // Pulse the selection ring
    if (this._ring.material.opacity > 0) {
      this._ring.material.opacity = 0.6 + Math.sin(Date.now() * 0.006) * 0.3;
    }
  }

  getWorldPos() {
    return this.group.position.clone();
  }

  toStateObj() {
    return {
      id: this.id,
      name: this.name,
      side: this.side,
      type: this.type,
      health: this.health,
      position: {
        x: Math.round(this.group.position.x),
        z: Math.round(this.group.position.z),
      },
    };
  }
}

// ── Ship silhouette shape (top-down view, pointed bow) ────────────────────────
function _shipShape(len, wid, type) {
  const shape = new THREE.Shape();
  const hw = wid / 2;
  const hl = len / 2;

  if (type === 'fac') {
    // Fast attack craft — arrowhead shape
    shape.moveTo(hl, 0);           // bow tip
    shape.lineTo(hl * 0.3,  hw);
    shape.lineTo(-hl,       hw * 0.7);
    shape.lineTo(-hl,      -hw * 0.7);
    shape.lineTo(hl * 0.3, -hw);
    shape.closePath();
  } else if (type === 'submarine') {
    // Submarine — simple rounded cigar
    shape.absarc(0, 0, hw, 0, Math.PI * 2, false);
    // Elongate it
    const pts = [];
    for (let a = 0; a <= Math.PI * 2; a += 0.3) {
      pts.push(new THREE.Vector2(Math.cos(a) * hl, Math.sin(a) * hw));
    }
    shape.setFromPoints(pts);
  } else if (type === 'coastal_battery') {
    // Shore battery — square
    shape.moveTo(-hw, -hw); shape.lineTo(hw, -hw);
    shape.lineTo(hw, hw); shape.lineTo(-hw, hw);
    shape.closePath();
  } else {
    // Default warship/tanker — classic ship silhouette with pointed bow, squared stern
    shape.moveTo(hl,        0);         // bow tip
    shape.lineTo(hl * 0.5,  hw);        // bow shoulder
    shape.lineTo(-hl * 0.7, hw);        // midship
    shape.lineTo(-hl,       hw * 0.6);  // stern
    shape.lineTo(-hl,      -hw * 0.6);
    shape.lineTo(-hl * 0.7,-hw);
    shape.lineTo(hl * 0.5, -hw);
    shape.closePath();
  }
  return shape;
}

// ── Default fleet for Strait of Hormuz scenario ───────────────────────────────
export function createDefaultUnits() {
  const V = (x, z) => new THREE.Vector3(x, 0, z);
  return [
    // ── US NAVY (blue) — staging in Gulf of Oman, east of the chokepoint ────
    new Unit({ id: 'cvn76',   name: 'CVN-76 REAGAN',    side: 'blue', type: 'carrier',   position: V( 76, 30) }),
    new Unit({ id: 'ddg102',  name: 'DDG-102 SAMPSON',  side: 'blue', type: 'destroyer', position: V( 62, 18) }),
    new Unit({ id: 'ddg119',  name: 'DDG-119 D.BLACK',  side: 'blue', type: 'destroyer', position: V( 65, 36) }),
    new Unit({ id: 'cg62',    name: 'CG-62 CHANCELLORS',side: 'blue', type: 'cruiser',   position: V( 82, 22) }),
    new Unit({ id: 'tanker1', name: 'MV PACIFIC LION',  side: 'blue', type: 'tanker',    position: V( 88, 10) }),

    // ── IRGC (red) — blocking inside the strait near Iran coast & islands ───
    new Unit({ id: 'fac1',  name: 'IRGC FAC-1',       side: 'red', type: 'fac',             position: V( -8, -14) }),
    new Unit({ id: 'fac2',  name: 'IRGC FAC-2',       side: 'red', type: 'fac',             position: V(  6, -16) }),
    new Unit({ id: 'fac3',  name: 'IRGC FAC-3',       side: 'red', type: 'fac',             position: V( 16, -12) }),
    new Unit({ id: 'fac4',  name: 'IRGC FAC-4',       side: 'red', type: 'fac',             position: V( -4,  -8) }),
    new Unit({ id: 'sub1',  name: 'IRS GHADIR-881',   side: 'red', type: 'submarine',       position: V( 24, -16) }),
    new Unit({ id: 'mine1', name: 'IRGC MINELAYER',   side: 'red', type: 'minelayer',       position: V(  8,  -5) }),
    new Unit({ id: 'batt1', name: 'NOOR BATTERY',     side: 'red', type: 'coastal_battery', position: V( 38, -20) }),
  ];
}
