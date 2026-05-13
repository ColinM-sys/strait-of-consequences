import { UNIT_ACTIONS } from './leaflet-game.js';

const SHIP_ABILITIES = {
  carrier: [
    { icon: '✈', label: 'AIR COVER',  desc: 'Deploys F/A-18 CAP — suppresses threats in 65km radius' },
    { icon: '🎯', label: 'AIR STRIKE', desc: 'Click target within 165km — direct hit destroys ship' },
  ],
  destroyer: [
    { icon: '⚡', label: 'CIWS',        desc: 'Intercepts incoming missiles in 35km radius' },
    { icon: '🔻', label: 'MINE SWEEP',  desc: 'DDG-102 only — clears mines in 20km radius. Immune to mines.' },
    { icon: '🎯', label: 'AIR STRIKE',  desc: 'Click target within 80km — direct hit destroys ship' },
    { icon: '📻', label: 'SIGINT',      desc: 'Kills Noor Battery radar — neutralizes coastal missiles' },
  ],
  cruiser: [
    { icon: '⚡', label: 'CIWS',        desc: 'Intercepts incoming missiles in 35km radius' },
    { icon: '📡', label: 'EW JAMMING',  desc: 'Degrades IRGC targeting in 95km radius' },
    { icon: '📻', label: 'SIGINT',      desc: 'Kills Noor Battery radar — neutralizes coastal missiles' },
  ],
  tanker: [
    { icon: '⚠', label: 'NO WEAPONS',  desc: 'Escort through TSS safe corridor to win. Mines, collisions, and IRGC attacks will sink it.' },
  ],
  fac: [
    { icon: '💥', label: 'RAM / ATTACK', desc: 'Rushes nearest blue ship — collision sinks both. Fires rockets when in range.' },
  ],
  submarine: [
    { icon: '👁', label: 'STEALTH',     desc: 'Moves toward blue fleet — hard to detect until contact' },
  ],
  minelayer: [
    { icon: '💣', label: 'LAY MINES',   desc: 'Deploys mines in shipping lanes. Only DDG-102 can see and sweep them.' },
  ],
  coastal_battery: [
    { icon: '🔴', label: 'NOOR BATTERY', desc: 'Long-range coastal missiles (65km). Use SIGINT to destroy the radar.' },
  ],
};

const ACTION_BTN_MAP = {
  air_cover:  'act-air-cover',
  ciws:       'act-ciws',
  ew_jam:     'act-ew-jam',
  mine_sweep: 'act-mine-sweep',
  airstrike:  'act-airstrike',
  sigint:     'act-sigint',
};
const ALL_ACTION_IDS = Object.values(ACTION_BTN_MAP);

export class UI {
  constructor() {
    this._turnNum   = document.getElementById('turn-num');
    this._phaseEl   = document.getElementById('phase-label');
    this._scenTitle = document.getElementById('scenario-title');
    this._scenText  = document.getElementById('scenario-text');
    this._unitName  = document.getElementById('unit-name');
    this._unitStats = document.getElementById('unit-stats');
    this._moveHint  = document.getElementById('move-hint');
    this._log       = document.getElementById('ai-log');
    this._loading   = document.getElementById('loading');
    this._btnEnd    = document.getElementById('btn-end-turn');
    this._btnNew    = document.getElementById('btn-new-scenario');
    this._actionBar = document.getElementById('action-bar');
    this._actionHint = document.getElementById('action-hint');
  }

  setTurn(n) {
    this._turnNum.textContent = n;
  }

  setPhase(phase) {
    this._phaseEl.textContent = phase === 'player' ? 'PLAYER PHASE' : 'AI PROCESSING';
    this._phaseEl.className = phase;
    this._btnEnd.disabled = phase !== 'player';
    this._btnNew.disabled = phase !== 'player';
  }

  setScenario(title, text) {
    this._scenTitle.textContent = title.toUpperCase();
    this._scenText.textContent  = text;
  }

  showUnitInfo(unit) {
    if (!unit) {
      this._unitName.textContent = '— SELECT A BLUE UNIT —';
      this._unitName.className   = 'none';
      this._unitStats.innerHTML  = '';
      this._moveHint.textContent = '';
      this._hideActionBar();
      return;
    }
    this._unitName.textContent = unit.name;
    this._unitName.className   = unit.side;

    const abilities = SHIP_ABILITIES[unit.type] ?? [];
    const abilitiesHtml = abilities.length
      ? `<div style="margin-top:6px;border-top:1px solid var(--border);padding-top:6px">` +
        abilities.map(a =>
          `<div style="margin-bottom:4px"><span style="font-size:11px">${a.icon}</span> ` +
          `<span style="color:var(--text)">${a.label}</span><br>` +
          `<span style="padding-left:16px;color:var(--dim)">${a.desc}</span></div>`
        ).join('') + `</div>`
      : '';

    this._unitStats.innerHTML  =
      `TYPE: ${unit.type.replace(/_/g, ' ').toUpperCase()}<br>` +
      `HEALTH: ${unit.health}%<br>` +
      (unit.side === 'blue'
        ? `ACTIONS: ${unit.actionsLeft > 0
            ? `<span style="color:var(--green)">${unit.actionsLeft} REMAINING</span>`
            : '<span style="color:var(--dim)">USED</span>'}`
        : '') +
      abilitiesHtml;

    this._moveHint.textContent =
      unit.side === 'blue' ? '→ CLICK MAP  •  WASD  •  ARROW KEYS' : '';

    if (unit.side === 'blue') {
      this._showActionBar(unit);
    } else {
      this._hideActionBar();
    }
  }

  // ── Action bar ─────────────────────────────────────────────────────────────

  _showActionBar(unit) {
    this._actionBar.classList.remove('hidden');
    const available = UNIT_ACTIONS[unit.id] ?? UNIT_ACTIONS[unit.type] ?? [];

    ALL_ACTION_IDS.forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      const actionId = Object.keys(ACTION_BTN_MAP).find(k => ACTION_BTN_MAP[k] === btnId);
      btn.style.display = available.includes(actionId) ? '' : 'none';
      btn.disabled = unit.actionsLeft <= 0;
    });

    const moveBtn = document.getElementById('act-move');
    if (moveBtn) moveBtn.disabled = unit.actionsLeft <= 0;

    if (this._actionHint) {
      this._actionHint.style.display = available.length === 0 ? '' : 'none';
    }
  }

  _hideActionBar() {
    this._actionBar.classList.add('hidden');
  }

  markActionUsed() {
    ALL_ACTION_IDS.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = true;
    });
    const moveBtn = document.getElementById('act-move');
    if (moveBtn) moveBtn.disabled = true;
  }

  // ── Log ────────────────────────────────────────────────────────────────────

  addLog(source, text, type = 'system') {
    // Legacy #ai-log is hidden in the exercise-pivot UI. To avoid duplicate "side"
    // spam during transit/scenario events, drop everything except errors & critical
    // adjudication. Combat / transit events go to the left-side activity log only.
    if (type !== 'error' && type !== 'adjudication') return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<div class="log-source">${source}</div><div class="log-text">${text}</div>`;
    if (this._log) {
      this._log.appendChild(entry);
      this._log.scrollTop = this._log.scrollHeight;
    }
  }

  showLoading(on) {
    this._loading.classList.toggle('visible', on);
  }

  lockButtons(on) {
    this._btnEnd.disabled = on;
    this._btnNew.disabled = on;
  }
}
