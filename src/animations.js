import * as THREE from 'three';

export class AnimationManager {
  constructor(scene) {
    this.scene  = scene;
    this._active = [];
    this._moveTarget = null;
  }

  update(delta) {
    this._active = this._active.filter(a => {
      a.update(delta);
      return !a.done;
    });
  }

  // ── Public ────────────────────────────────────────────────────────────────

  fireMissile(fromVec3, toVec3, color = 0xff4400) {
    this._active.push(new MissileArc(this.scene, fromVec3, toVec3, color));
  }

  explode(position, color = 0xff6600) {
    this._active.push(new Explosion(this.scene, position, color));
  }

  showMoveTarget(position) {
    if (this._moveTarget) {
      this.scene.remove(this._moveTarget);
      this._moveTarget = null;
    }
    const geo = new THREE.RingGeometry(2.5, 3.5, 20);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ffaa, side: THREE.DoubleSide,
      transparent: true, opacity: 0.85, depthWrite: false,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(position);
    ring.position.y = 0.4;
    this.scene.add(ring);
    this._moveTarget = ring;
    setTimeout(() => {
      if (this._moveTarget === ring) {
        this.scene.remove(ring);
        this._moveTarget = null;
      }
    }, 1800);
  }

  // Speed-line burst when a unit is attacked
  impactFlash(position) {
    this._active.push(new ImpactFlash(this.scene, position));
  }
}

// ── Missile arc ───────────────────────────────────────────────────────────────
class MissileArc {
  constructor(scene, from, to, color) {
    this.scene    = scene;
    this.from     = from.clone();
    this.to       = to.clone();
    this.t        = 0;
    this.duration = 1.4;
    this.done     = false;

    // Head sphere
    const geo = new THREE.SphereGeometry(0.5, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color });
    this.head = new THREE.Mesh(geo, mat);
    scene.add(this.head);

    // Glow halo
    const gGeo = new THREE.SphereGeometry(1.4, 8, 8);
    const gMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28 });
    this.glow = new THREE.Mesh(gGeo, gMat);
    this.head.add(this.glow);

    // Trail line
    this._trailPts  = [];
    this._trailGeo  = new THREE.BufferGeometry();
    this._trailLine = new THREE.Line(
      this._trailGeo,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 })
    );
    scene.add(this._trailLine);
  }

  update(delta) {
    this.t += delta / this.duration;
    if (this.t >= 1) {
      this.done = true;
      this.scene.remove(this.head);
      this.scene.remove(this._trailLine);
      return;
    }

    // Parabolic arc
    const pos = new THREE.Vector3().lerpVectors(this.from, this.to, this.t);
    pos.y += 30 * Math.sin(this.t * Math.PI);
    this.head.position.copy(pos);

    this._trailPts.push(pos.clone());
    if (this._trailPts.length > 22) this._trailPts.shift();
    this._trailGeo.setFromPoints(this._trailPts);
  }
}

// ── PS2-style chunky explosion ────────────────────────────────────────────────
class Explosion {
  constructor(scene, position, color) {
    this.scene = scene;
    this.t     = 0;
    this.done  = false;
    this.parts = [];

    const altColor = color === 0xff4400 ? 0xffdd00 : 0xff6600;

    for (let i = 0; i < 14; i++) {
      const s = 0.5 + Math.random() * 1.2;
      const geo = new THREE.BoxGeometry(s, s, s);
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? color : altColor,
        transparent: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 22,
        4 + Math.random() * 18,
        (Math.random() - 0.5) * 22
      );
      this.parts.push({ mesh, vel });
      scene.add(mesh);
    }
  }

  update(delta) {
    this.t += delta;
    if (this.t > 1.6) {
      this.done = true;
      this.parts.forEach(p => this.scene.remove(p.mesh));
      return;
    }
    const fade = 1 - this.t / 1.6;
    this.parts.forEach(p => {
      p.vel.y -= 18 * delta;
      p.mesh.position.addScaledVector(p.vel, delta);
      p.mesh.rotation.x += delta * 4;
      p.mesh.rotation.z += delta * 3;
      p.mesh.material.opacity = fade;
    });
  }
}

// ── Brief impact flash ring ───────────────────────────────────────────────────
class ImpactFlash {
  constructor(scene, position) {
    this.scene = scene;
    this.t = 0;
    this.done = false;

    const geo = new THREE.RingGeometry(0.5, 8, 24);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffee44, side: THREE.DoubleSide, transparent: true, opacity: 1,
    });
    this.ring = new THREE.Mesh(geo, mat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.copy(position);
    this.ring.position.y = 1;
    scene.add(this.ring);
  }

  update(delta) {
    this.t += delta;
    if (this.t > 0.5) {
      this.done = true;
      this.scene.remove(this.ring);
      return;
    }
    const p = this.t / 0.5;
    this.ring.scale.setScalar(1 + p * 3);
    this.ring.material.opacity = 1 - p;
  }
}
