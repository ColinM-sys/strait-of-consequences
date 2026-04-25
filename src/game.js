import * as THREE from 'three';

export class GameEngine {
  constructor(units) {
    this.units = units;
    this.turn  = 1;
    this.phase = 'player'; // 'player' | 'ai'
    this.selectedUnit  = null;
    this.pendingMoves  = [];
    this._callbacks    = {};
  }

  on(event, fn) { this._callbacks[event] = fn; }
  _emit(event, data) { if (this._callbacks[event]) this._callbacks[event](data); }

  // ── Selection ─────────────────────────────────────────────────────────────

  selectUnit(unit) {
    if (this.phase !== 'player') return;
    // Deselect previous
    if (this.selectedUnit) this.selectedUnit.select(false);

    if (unit && unit.side !== 'blue') {
      // Clicked a red unit — just show info, don't select for movement
      this._emit('inspect', unit);
      this.selectedUnit = null;
      return;
    }

    this.selectedUnit = unit || null;
    if (this.selectedUnit) this.selectedUnit.select(true);
    this._emit('select', this.selectedUnit);
  }

  // ── Movement ──────────────────────────────────────────────────────────────

  moveSelectedTo(worldPos) {
    const u = this.selectedUnit;
    if (!u || this.phase !== 'player') return;
    if (u.actionUsed) {
      this._emit('info', `${u.name} has already moved this turn.`);
      u.select(false);
      this.selectedUnit = null;
      return;
    }

    // Clamp to unit's speed radius
    const dist = u.group.position.distanceTo(
      new THREE.Vector3(worldPos.x, 0, worldPos.z)
    );
    let target = worldPos.clone();
    target.y = 0;
    if (dist > u.speed) {
      const dir = target.clone().sub(u.group.position).normalize();
      target = u.group.position.clone().addScaledVector(dir, u.speed);
      target.y = 0;
    }

    const from = u.group.position.clone();
    u.moveTo(target);
    u.actionUsed = true;
    this.pendingMoves.push({ unitId: u.id, from, to: { x: target.x, z: target.z } });

    u.select(false);
    this.selectedUnit = null;
    this._emit('moved', { unit: u, to: target });
  }

  // ── Turn resolution ───────────────────────────────────────────────────────

  async endTurn(adjudicateFn, redCellFn) {
    if (this.phase !== 'player') return;
    this.phase = 'ai';
    this._emit('phaseChange', 'ai');

    const state = this._buildState();

    // Step 1: adjudicate player moves
    const adjResult = await adjudicateFn(state, this.pendingMoves);
    this._applyAdjudication(adjResult);
    this._emit('adjudicated', adjResult);

    // Small pause so the player can see damage
    await _sleep(800);

    // Step 2: Red Cell picks its moves
    const redResult = await redCellFn(this._buildState());
    this._applyRedCell(redResult);
    this._emit('redCellMoved', redResult);

    // Advance turn
    this.turn++;
    this.pendingMoves = [];
    this.units.filter(u => !u.destroyed).forEach(u => { u.actionUsed = false; });
    this.phase = 'player';
    this._emit('phaseChange', 'player');
    this._emit('turnStart', this.turn);
  }

  // ── Apply AI results ──────────────────────────────────────────────────────

  _applyAdjudication(result) {
    if (!result?.outcomes) return;
    const dmgMap = { sunk: 100, damaged: 35, suppressed: 15, miss: 0 };
    result.outcomes.forEach(o => {
      const u = this._findUnit(o.unit_id);
      if (!u) return;
      const dmg = dmgMap[o.effect] ?? 0;
      if (dmg > 0) u.applyDamage(dmg);
    });
  }

  _applyRedCell(result) {
    if (!result?.moves) return;
    result.moves.forEach(m => {
      const u = this._findUnit(m.unit_id);
      if (!u || u.destroyed) return;
      if (m.position) {
        u.moveTo(new THREE.Vector3(m.position.x, 0, m.position.z));
      }
    });
  }

  /** Record a non-movement action (air cover, CIWS, airstrike, etc.) */
  recordAction(unit, actionData) {
    unit.actionUsed = true;
    this.pendingMoves.push({ unitId: unit.id, action: actionData });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _findUnit(idOrName) {
    return this.units.find(u =>
      u.id === idOrName || u.name === idOrName ||
      u.name.toLowerCase() === (idOrName || '').toLowerCase()
    );
  }

  _buildState() {
    return {
      turn: this.turn,
      units: this.units
        .filter(u => !u.destroyed)
        .map(u => u.toStateObj()),
    };
  }

  getState() { return this._buildState(); }
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
