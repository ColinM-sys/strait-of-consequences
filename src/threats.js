import * as THREE from 'three';

// ── Threat zone definitions (fixed geography) ─────────────────────────────────
const STATIC_ZONES = [
  {
    id: 'noor_battery',
    label: 'NOOR BATTERY RANGE',
    x: 38, z: -20, radius: 22,
    color: 0xcc2222, fillOpacity: 0.14, ringOpacity: 0.55,
    level: 0.85,
  },
  {
    id: 'abu_musa_patrol',
    label: 'IRGC FAC PATROL ZONE',
    x: -28, z: -14, radius: 18,
    color: 0xff6600, fillOpacity: 0.10, ringOpacity: 0.45,
    level: 0.65,
  },
  {
    id: 'chokepoint',
    label: 'RESTRICTED WATERS',
    x: 44, z: -8, radius: 14,       // Musandam chokepoint
    color: 0xff4400, fillOpacity: 0.10, ringOpacity: 0.40,
    level: 0.70,
  },
];

// Safe corridor — TSS inbound lane, Oman coast side
const SAFE_CORRIDOR = { x: -5, z: -10, w: 200, d: 9 };

export class ThreatZoneManager {
  constructor(scene) {
    this.scene       = scene;
    this._zones      = [];
    this._mitigations = [];

    this._buildStaticZones();
    this._buildSafeCorridor();
    this._buildLabels();
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  _buildStaticZones() {
    STATIC_ZONES.forEach(def => {
      // Fill
      const fill = new THREE.Mesh(
        new THREE.CircleGeometry(def.radius, 48),
        new THREE.MeshBasicMaterial({
          color: def.color, side: THREE.DoubleSide,
          transparent: true, opacity: def.fillOpacity, depthWrite: false,
        })
      );
      fill.rotation.x = -Math.PI / 2;
      fill.position.set(def.x, 0.4, def.z);
      this.scene.add(fill);

      // Border ring
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(def.radius - 0.6, def.radius + 0.6, 48),
        new THREE.MeshBasicMaterial({
          color: def.color, side: THREE.DoubleSide,
          transparent: true, opacity: def.ringOpacity, depthWrite: false,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(def.x, 0.45, def.z);
      this.scene.add(ring);

      this._zones.push({
        id: def.id,
        center: new THREE.Vector3(def.x, 0, def.z),
        radius: def.radius,
        level: def.level,
        fill, ring,
      });
    });
  }

  _buildSafeCorridor() {
    const { x, z, w, d } = SAFE_CORRIDOR;
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({
        color: 0x44cc88, side: THREE.DoubleSide,
        transparent: true, opacity: 0.07, depthWrite: false,
      })
    );
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(x, 0.35, z);
    this.scene.add(fill);

    // Dashed border lines
    [[z - d / 2], [z + d / 2]].forEach(([zLine]) => {
      const pts = [
        new THREE.Vector3(x - w / 2, 0.5, zLine),
        new THREE.Vector3(x + w / 2, 0.5, zLine),
      ];
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x44cc88, transparent: true, opacity: 0.5 })
      );
      this.scene.add(line);
    });
  }

  _buildLabels() {
    const labelDefs = [
      { text: '⚠ NOOR BATTERY RANGE',   x: 24,  z: -26, color: '#cc4444' },
      { text: '⚠ IRGC FAC PATROL',      x: -20, z:  -1, color: '#ff6600' },
      { text: '⚠ RESTRICTED WATERS',    x: 16,  z: -14, color: '#ff4400' },
      { text: '✓ TSS SAFE CORRIDOR',     x: -28, z:  -6, color: '#44cc88' },
    ];
    labelDefs.forEach(({ text, x, z, color }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 340; canvas.height = 44;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 340, 44);
      ctx.fillStyle = color;
      ctx.font = 'bold 13px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(text, 170, 28);
      const mat = new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(canvas),
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(22, 3), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.7, z);
      this.scene.add(mesh);
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns 0..1 threat level at a world position.
   * Mitigations reduce this. Being in the safe corridor reduces it.
   */
  getThreatLevel(position) {
    let threat = 0;
    this._zones.forEach(z => {
      const dist = new THREE.Vector3(position.x, 0, position.z)
        .distanceTo(z.center);
      if (dist < z.radius) {
        const falloff = 1 - dist / z.radius;
        threat = Math.max(threat, z.level * falloff);
      }
    });

    // Safe corridor bonus
    if (this._inSafeCorridor(position)) {
      threat *= 0.35;
    }

    // Mitigations
    this._mitigations.forEach(m => {
      const dist = new THREE.Vector3(position.x, 0, position.z)
        .distanceTo(m.center);
      if (dist < m.radius) {
        const reduction = m.type === 'air_cover' ? 0.30
          : m.type === 'ciws'     ? 0.40
          : m.type === 'ew_jam'   ? 0.55
          : 0.50;
        threat *= reduction;
      }
    });

    return Math.min(1, Math.max(0, threat));
  }

  _inSafeCorridor(pos) {
    const { x, z, w, d } = SAFE_CORRIDOR;
    return (
      pos.x >= x - w / 2 && pos.x <= x + w / 2 &&
      pos.z >= z - d / 2 && pos.z <= z + d / 2
    );
  }

  /**
   * Add a mitigation zone (from player action). Shown in green.
   * Returns the mitigation object so callers can track it.
   */
  addMitigation(type, center, radius, turns = 2) {
    const colorMap = {
      air_cover: 0x4488ff,
      ciws:      0x44ffff,
      ew_jam:    0xaa44ff,
      mine_sweep:0x44ff88,
    };
    const color = colorMap[type] ?? 0x44cc88;

    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 32),
      new THREE.MeshBasicMaterial({
        color, side: THREE.DoubleSide,
        transparent: true, opacity: 0.13, depthWrite: false,
      })
    );
    fill.rotation.x = -Math.PI / 2;
    fill.position.copy(center);
    fill.position.y = 0.5;
    this.scene.add(fill);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.5, radius + 0.5, 32),
      new THREE.MeshBasicMaterial({
        color, side: THREE.DoubleSide,
        transparent: true, opacity: 0.6, depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(center);
    ring.position.y = 0.55;
    this.scene.add(ring);

    const mit = {
      type, center: center.clone(), radius, turnsLeft: turns, fill, ring,
    };
    this._mitigations.push(mit);
    return mit;
  }

  /** Call at end of each full turn to age out mitigations. */
  advanceTurn() {
    this._mitigations = this._mitigations.filter(m => {
      m.turnsLeft--;
      if (m.turnsLeft <= 0) {
        this.scene.remove(m.fill);
        this.scene.remove(m.ring);
        return false;
      }
      // Fade as it expires
      m.fill.material.opacity *= 0.65;
      m.ring.material.opacity *= 0.65;
      return true;
    });
  }

  /** Serialise for the AI prompts. */
  getSummary() {
    return {
      threat_zones: STATIC_ZONES.map(z => ({
        id: z.id, label: z.label,
        center: { x: z.x, z: z.z }, radius: z.radius, level: z.level,
      })),
      safe_corridor: {
        description: 'TSS inbound lane, Oman coast side',
        center: { x: SAFE_CORRIDOR.x, z: SAFE_CORRIDOR.z },
        width: SAFE_CORRIDOR.w, depth: SAFE_CORRIDOR.d,
        effect: 'Reduces hit probability by 65% for units inside',
      },
      active_mitigations: this._mitigations.map(m => ({
        type: m.type,
        center: { x: Math.round(m.center.x), z: Math.round(m.center.z) },
        radius: m.radius,
        turns_remaining: m.turnsLeft,
        effect: _mitigationEffect(m.type),
      })),
    };
  }
}

function _mitigationEffect(type) {
  return {
    air_cover:  'F/A-18 CAP active — 70% hit reduction within zone, 2 turns',
    ciws:       'CIWS active — 60% missile intercept chance within zone, 1 turn',
    ew_jam:     'EW jamming — 45% IRGC targeting degradation within zone, 2 turns',
    mine_sweep: 'MCM sweep — mines cleared in zone',
  }[type] ?? 'unknown mitigation';
}
