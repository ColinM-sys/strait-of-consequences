import { LeafletGame } from './leaflet-game.js';
import { UI }          from './ui.js';
import * as Tour       from './demo-narrative.js';

const API = 'http://localhost:8000';

const game = new LeafletGame('map');
const ui   = new UI();

// ── Strategic situation display ───────────────────────────────────────────────
let _escalation = 70; // start at 70 — strait already closed Apr 18
const _coalitionTriggered = new Set();

const LADDER_RUNGS = ['HARASS', 'SEIZURE', 'MINING', 'STRIKE', 'CLOSURE', 'WAR'];

function _updateStakes(delta = 0) {
  const prev = _escalation;
  _escalation = Math.min(100, Math.max(0, _escalation + delta));
  const e = _escalation;

  // ── Economic ticker ──────────────────────────────────────────
  const oilPct  = Math.round(21 + (e / 100) * 16);
  const bpd     = (18.5 + (e / 100) * 3.5).toFixed(1);
  const insRate  = Math.round(85 + (e / 100) * 915); // +85% → +1000%
  const closure  = Math.round(8 + (e / 100) * 88);

  const elOil  = document.getElementById('econ-oil');
  const elBpd  = document.getElementById('econ-bpd');
  const elIns  = document.getElementById('econ-insurance');
  const elClos = document.getElementById('econ-closure');

  if (elOil)  { elOil.textContent  = `${oilPct}%`;    elOil.style.color  = e > 50 ? '#ff8833' : '#ffdd55'; }
  if (elBpd)  { elBpd.textContent  = `${bpd}M BPD`; }
  if (elIns) {
    if (e >= 65) { elIns.textContent = 'SUSPENDED'; elIns.style.color = '#ff4444'; }
    else { elIns.textContent = `+${insRate}%`; elIns.style.color = e > 60 ? '#ff4444' : '#ff8833'; }
  }
  if (elClos) {
    if (e >= 70) { elClos.textContent = 'CLOSED'; elClos.style.color = '#ff4444'; }
    else { elClos.textContent = `${closure}%`; elClos.style.color = e > 40 ? '#ff8833' : '#44cc88'; }
  }

  // ── Escalation ladder ────────────────────────────────────────
  const ladderLevel = Math.min(5, Math.floor(e / 17));
  document.querySelectorAll('.rung').forEach(r => {
    const lvl = parseInt(r.dataset.lvl);
    r.classList.remove('past', 'current');
    if (lvl < ladderLevel)  r.classList.add('past');
    if (lvl === ladderLevel) r.classList.add('current');
  });

  // ── Coalition triggers ───────────────────────────────────────
  const triggers = [
    { at: 20, id: 'cf-uk',  flag: 'active',  msg: 'UK Royal Navy activates Operation Kipion escort posture. HMS Dragon deployed to TSS corridor.' },
    { at: 35, id: 'cf-fr',  flag: 'active',  msg: 'France deploys FS Provence (D652) to Gulf of Oman. NATO Article 5 consultations begin.' },
    { at: 50, id: 'cf-sa',  flag: 'active',  msg: 'Saudi Arabia activates East-West Pipeline bypass. Yanbu terminal on standby. -2M BPD rerouted.' },
    { at: 55, id: 'cf-un',  flag: 'active',  msg: 'UN Security Council convenes emergency session. Resolution 2847 tabled — China and Russia abstain.' },
    { at: 65, id: 'cf-cn',  flag: 'hostile', msg: 'China demands unimpeded passage for VLCC fleet. PLAN task group departs Zhoushan. Strategic ambiguity ends.' },
    { at: 80, id: 'lloyd',  flag: null,       msg: "Lloyd's of London SUSPENDS war risk coverage for Hormuz-transiting vessels. Spot rates +340%. Global tanker fleet holds position." },
  ];

  triggers.forEach(t => {
    if (e >= t.at && !_coalitionTriggered.has(t.id)) {
      _coalitionTriggered.add(t.id);
      if (t.flag) {
        const el = document.getElementById(t.id);
        if (el) { el.classList.remove('inactive'); el.classList.add(t.flag); }
      }
      ui.addLog('GEOPOLITICAL', t.msg, 'adjudication');
    }
  });
}

// ── Presentation mode toggle ──────────────────────────────────────────────────
document.getElementById('btn-present')?.addEventListener('click', () => {
  document.body.classList.toggle('present');
});

// ── Guided tour ───────────────────────────────────────────────────────────────
document.getElementById('btn-tour')?.addEventListener('click', () => {
  if (Tour.isActive()) {
    Tour.stop();
    document.getElementById('btn-tour').textContent = '▶ GUIDED TOUR';
  } else {
    Tour.start(game.map);
    document.getElementById('btn-tour').textContent = '✕ EXIT TOUR';
  }
});

// ── Event wiring ──────────────────────────────────────────────────────────────

game.on('select', unit => ui.showUnitInfo(unit));

game.on('moved', () => {
  if (game.controlled) ui.showUnitInfo(game.controlled);
});

game.on('info', msg => ui.addLog('GAME', msg, 'system'));

// Typed log entries from demo steps
game.on('log', ({ source, text, type }) => {
  const cssType = type === 'blue' ? 'scenario' : type === 'red' ? 'redcell' : type === 'victory' ? 'adjudication' : 'system';
  ui.addLog(source, text, cssType);
});

game.on('phaseChange', phase => ui.setPhase(phase));

game.on('adjudicated', result => {
  ui.addLog('ADJUDICATOR', result?.narrative ?? 'Turn resolved.', 'adjudication');
  if (result?.strategic_assessment) ui.addLog('SITREP', result.strategic_assessment, 'system');
  // Escalate based on outcomes
  const outcomes = result?.outcomes ?? [];
  const sunk     = outcomes.filter(o => o.effect === 'sunk').length;
  const damaged  = outcomes.filter(o => o.effect === 'damaged').length;
  _updateStakes(sunk * 18 + damaged * 6);
});

game.on('turnStart', n => {
  ui.setTurn(n);
  _updateStakes(3); // each turn escalates slightly
});

game.on('escalation', ({ level, reason }) => {
  const delta = level - _escalation;
  if (delta > 0) {
    _updateStakes(delta);
    ui.addLog('ESCALATION', `+${delta} — ${reason}. Level: ${level}/100`, 'redcell');
  }
});

game.on('redCellMoved', result => {
  const reasoning = result?.reasoning ?? 'IRGC forces repositioned.';
  // Red cell reasoning is the intelligence product — log it prominently with a separator
  ui.addLog('⬛ IRGC COMMANDER', reasoning, 'redcell');
  (result?.moves ?? []).forEach(m => { if (m.narrative) ui.addLog('  └ IRGC MOVE', m.narrative, 'redcell'); });
});


game.on('demoStep', ({ step, text }) => {
  const prog = document.getElementById('demo-progress');
  if (prog) prog.textContent = `STEP ${step + 1}/12 — ${text.slice(0, 40)}...`;
});

game.on('demoComplete', () => {
  const btn = document.getElementById('btn-demo');
  if (btn) { btn.classList.remove('running'); btn.textContent = '▶▶ DEMO — WATCH FULL OPERATION'; }
  const prog = document.getElementById('demo-progress');
  if (prog) { prog.textContent = '✓ MISSION COMPLETE'; prog.style.color = 'var(--green)'; }
  ui.lockButtons(false);

  // Victory overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:calc(100% - 340px);height:calc(100% - 110px);background:rgba(0,40,0,0.35);z-index:99;display:flex;align-items:center;justify-content:center;pointer-events:none';
  overlay.innerHTML = `<div style="font-family:Courier New;font-size:30px;letter-spacing:8px;color:#44cc88;text-shadow:0 0 30px #00ff88;text-align:center;line-height:1.8">
    ✓ MISSION COMPLETE<br>
    <span style="font-size:13px;letter-spacing:4px;color:#aaffcc">MV PACIFIC LION — STRAIT TRANSITED</span><br>
    <span style="font-size:11px;letter-spacing:2px;color:#44aa66">ALL THREATS NEUTRALIZED</span>
  </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 5000);
});

game.on('victory', ({ blueAlive }) => {
  ui.addLog('OPCON', `MISSION COMPLETE — ${blueAlive} ship${blueAlive !== 1 ? 's' : ''} reached the extraction zone. Strait transited.`, 'adjudication');
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:calc(100% - 340px);height:100%;background:rgba(0,50,30,0.45);z-index:99;display:flex;align-items:center;justify-content:center;pointer-events:none';
  overlay.innerHTML = `<div style="font-family:Courier New;font-size:28px;letter-spacing:8px;color:#00ffcc;text-shadow:0 0 30px #00ffcc;text-align:center;line-height:1.9">
    🏁 EXTRACTION COMPLETE<br>
    <span style="font-size:14px;letter-spacing:4px;color:#aaffee">US FLEET CLEARED THE STRAIT</span><br>
    <span style="font-size:11px;letter-spacing:2px;color:#44ccaa">${blueAlive} SHIP${blueAlive !== 1 ? 'S' : ''} REACHED QATAR WATERS</span>
  </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 8000);
});

game.on('civilianStrike', civ => {
  ui.addLog('⚠ WAR CRIME', `FRIENDLY FIRE: ${civ.name} struck and sunk. International incident. −3 turns.`, 'redcell');
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(200,0,0,0.22);z-index:99;display:flex;align-items:center;justify-content:center;pointer-events:none';
  overlay.innerHTML = '<div style="font-family:Courier New;font-size:26px;letter-spacing:6px;color:#ff4444;text-shadow:0 0 20px #ff0000;text-align:center">⚠ CIVILIAN VESSEL SUNK<br><span style="font-size:13px;letter-spacing:3px">INTERNATIONAL INCIDENT — −3 TURNS</span></div>';
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 3500);
});

// ── Action buttons ────────────────────────────────────────────────────────────

['air-cover', 'ciws', 'ew-jam', 'mine-sweep', 'airstrike', 'sigint'].forEach(slug => {
  document.getElementById(`act-${slug}`)
    ?.addEventListener('click', () => game.triggerAction(slug.replace(/-/g, '_')));
});

const DPAD_KEYS = { 'dp-up':'ArrowUp', 'dp-down':'ArrowDown', 'dp-left':'ArrowLeft', 'dp-right':'ArrowRight' };
Object.entries(DPAD_KEYS).forEach(([btnId, key]) => {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const fire = () => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  btn.addEventListener('click', fire);
  let _hold;
  btn.addEventListener('mousedown', () => { _hold = setInterval(fire, 120); });
  btn.addEventListener('mouseup',   () => clearInterval(_hold));
  btn.addEventListener('mouseleave',() => clearInterval(_hold));
});

// On-map D-pad (touch-friendly, phone use)
const MAP_DPAD_KEYS = { 'mdp-u':'ArrowUp', 'mdp-d':'ArrowDown', 'mdp-l':'ArrowLeft', 'mdp-r':'ArrowRight' };
Object.entries(MAP_DPAD_KEYS).forEach(([btnId, key]) => {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const fire = () => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  let _hold;
  const start = (e) => { e.preventDefault(); btn.classList.add('pressed'); fire(); _hold = setInterval(fire, 120); };
  const stop  = ()  => { btn.classList.remove('pressed'); clearInterval(_hold); };
  btn.addEventListener('touchstart',  start, { passive: false });
  btn.addEventListener('touchend',    stop);
  btn.addEventListener('touchcancel', stop);
  btn.addEventListener('mousedown', start);
  btn.addEventListener('mouseup',   stop);
  btn.addEventListener('mouseleave', stop);
});

document.getElementById('act-move')?.addEventListener('click', () => {
  const u = game.controlled;
  if (u) ui.addLog('MOVE', `${u.name}: click map to move, or use WASD / arrow keys.`, 'system');
});

// ── Demo ──────────────────────────────────────────────────────────────────────

const _demoBtn  = document.getElementById('btn-demo');
const _demoProg = document.getElementById('demo-progress');

_demoBtn?.addEventListener('click', () => {
  if (game._demoRunning) {
    game.stopDemo();
    _demoBtn.classList.remove('running');
    _demoBtn.textContent = '▶▶ DEMO — WATCH FULL OPERATION';
    if (_demoProg) { _demoProg.style.display = 'none'; _demoProg.style.color = ''; }
    ui.lockButtons(false);
  } else {
    _demoBtn.classList.add('running');
    _demoBtn.textContent = '■ STOP DEMO';
    if (_demoProg) { _demoProg.style.display = 'block'; _demoProg.style.color = ''; }
    ui.lockButtons(true);
    _demoBtn.disabled = false; // keep stop button active
    ui.addLog('DEMO', 'Starting automated operation demo — all capabilities will be demonstrated.', 'system');
    game.startDemo();
  }
});

// ── Turn / Scenario ───────────────────────────────────────────────────────────

document.getElementById('btn-end-turn').addEventListener('click', async () => {
  ui.lockButtons(true);
  ui.showLoading(true);
  await game.endTurn(callAdjudicate, callRedCell);
  ui.showLoading(false);
  ui.lockButtons(false);
});

document.getElementById('btn-new-scenario').addEventListener('click', loadScenario);

// ── AI API calls ──────────────────────────────────────────────────────────────

async function callAdjudicate(state, moves, threatCtx, threatLevels) {
  try {
    const res = await fetch(`${API}/adjudicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, moves, threat_context: threatCtx ?? {}, unit_threat_levels: threatLevels ?? [] }),
    });
    return await res.json();
  } catch {
    return { narrative: '[AI offline] No adjudication.', outcomes: [], strategic_assessment: 'Backend unreachable.' };
  }
}

async function callRedCell(state, threatCtx) {
  try {
    const res = await fetch(`${API}/redcell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, threat_context: threatCtx ?? {} }),
    });
    return await res.json();
  } catch {
    return { reasoning: '[AI offline] Red Cell skipped.', moves: [] };
  }
}

async function loadScenario() {
  ui.lockButtons(true);
  ui.showLoading(true);
  try {
    const res  = await fetch(`${API}/scenario`);
    const data = await res.json();
    ui.setScenario(data.title ?? 'UNKNOWN SCENARIO', data.situation ?? '');
    if (data.blue_briefing)       ui.addLog('INTEL BRIEF', data.blue_briefing, 'scenario');
    if (data.special_rules?.length) ui.addLog('RULES OF ENGAGEMENT', data.special_rules.join(' • '), 'system');
  } catch {
    ui.setScenario(
      'CEASEFIRE EXPIRING',
      'Day 51. USS Spruance seized Iranian cargo vessel Touska at 0340 local. ' +
      'IRGC fast attack craft massing near Abu Musa. MV Pacific Lion must transit before dawn.'
    );
    ui.addLog('INTEL BRIEF', 'Route tanker through TSS safe corridor. Use destroyer screen + EW jamming to reduce missile threat. CIWS intercepts IRGC rockets.', 'scenario');
    ui.addLog('RULES OF ENGAGEMENT', 'Safe corridor −65% hit  •  CIWS 60% intercept  •  Air cover −70% threat  •  SIGINT kills Noor battery', 'system');
  }
  ui.showLoading(false);
  ui.lockButtons(false);
}

loadScenario();

// ── Simulated AIS ship traffic (real names/positions along Hormuz lanes) ───────
// WebSocket API (aisstream.io) silently drops messages on the free tier in this
// region.  We simulate realistic vessel traffic instead — same visual effect.

const _aisVessels = new Map(); // mmsi → { marker, label, lat, lng }

// Real vessel names + realistic starting positions + headings along the TSS lanes
// COG 0=N 90=E 180=S 270=W  |  sog in knots
const SIM_VESSELS = [
  // ── Eastbound (outbound, heading SE toward Gulf of Oman) ──
  { mmsi: 477001234, name: 'ALPINE CONFIDENCE', flag: '🇭🇰', type: 80, lat: 26.34, lng: 56.22, cog: 112, sog: 12.4 },
  { mmsi: 564123456, name: 'OLYMPIC SPIRIT',    flag: '🇸🇬', type: 70, lat: 25.85, lng: 57.10, cog: 118, sog: 11.2 },
  { mmsi: 636091234, name: 'STENA SUEDE',       flag: '🇱🇷', type: 80, lat: 25.80, lng: 56.88, cog: 122, sog: 10.8 },
  { mmsi: 229045678, name: 'MAERSK HONAM',      flag: '🇲🇹', type: 70, lat: 24.72, lng: 58.52, cog: 128, sog: 13.1 },
  { mmsi: 311023456, name: 'BAHRI JEDDAH',      flag: '🇧🇸', type: 80, lat: 26.08, lng: 55.68, cog: 108, sog: 11.5 },
  { mmsi: 477234567, name: 'NISSOS KEROS',      flag: '🇭🇰', type: 80, lat: 25.62, lng: 58.10, cog: 115, sog: 10.1 },
  // ── Westbound (inbound, heading NW into Persian Gulf) ──
  { mmsi: 538034567, name: 'PACIFIC LAGOON',    flag: '🇲🇭', type: 70, lat: 25.52, lng: 57.78, cog: 292, sog: 12.0 },
  { mmsi: 477056789, name: 'EURONAV VENUS',     flag: '🇧🇪', type: 80, lat: 25.92, lng: 56.48, cog: 284, sog:  9.8 },
  { mmsi: 371098765, name: 'GULF TRADER',       flag: '🇵🇦', type: 80, lat: 26.05, lng: 55.42, cog: 278, sog: 10.3 },
  { mmsi: 636056789, name: 'MSC SARAH',         flag: '🇱🇷', type: 70, lat: 24.22, lng: 59.08, cog: 288, sog: 14.2 },
  { mmsi: 229087654, name: 'NAVIGATOR AURORA',  flag: '🇬🇷', type: 80, lat: 25.32, lng: 58.18, cog: 298, sog: 11.7 },
  { mmsi: 338901234, name: 'FURE NORD',         flag: '🇳🇴', type: 80, lat: 26.20, lng: 54.90, cog: 270, sog:  8.9 },
  // ── Slow / anchored near Fujairah / Khor Fakkan ──
  { mmsi: 303012345, name: 'DELTA NAVIGATOR',   flag: '🇺🇸', type: 70, lat: 25.11, lng: 56.38, cog: 180, sog:  0.3 },
  { mmsi: 538090123, name: 'OCEAN TRIUMPH',     flag: '🇲🇭', type: 80, lat: 25.07, lng: 57.12, cog:   0, sog:  0.1 },
  { mmsi: 413012345, name: 'HONG FA',           flag: '🇨🇳', type: 70, lat: 24.95, lng: 57.45, cog:  45, sog:  1.2 },
];

function _aisIcon(shipType, flag, cogDeg = 90) {
  const isTanker = shipType >= 80 && shipType <= 89;
  const bg    = isTanker ? '#c8920a' : '#1e6fa0';
  const bdr   = isTanker ? '#ffe080' : '#80d0ff';
  const f     = flag ?? '';
  const rot   = cogDeg - 90;

  // CSS-only ship box — no SVG, works everywhere
  return L.divIcon({
    html: `<div style="
        transform:rotate(${rot}deg);
        transform-origin:center;
        width:64px;height:22px;
        background:${bg};
        border:2px solid ${bdr};
        border-radius:4px 12px 12px 4px;
        box-shadow:0 0 8px ${bdr}aa;
        cursor:pointer;
        box-sizing:border-box">
    </div>
    <div style="position:absolute;top:-17px;left:50%;transform:translateX(-50%);font-size:13px;line-height:1;white-space:nowrap;pointer-events:none;text-shadow:0 0 4px #000">${f}</div>`,
    className: '',
    iconSize: [64, 22],
    iconAnchor: [32, 11],
  });
}

// ── Transit counter ───────────────────────────────────────────────────────────
// Pre-seeded with realistic vessel transits from the past 48 hours (Apr 21-22 2026)
const _transitLog = [
  { name:'ATLANTIC LILY',    flag:'🇲🇹', dir:'OUTBOUND', time:'Apr 22 · 07:12', type:80 },
  { name:'NORDIC CROWN',     flag:'🇳🇴', dir:'INBOUND',  time:'Apr 22 · 06:48', type:80 },
  { name:'MSC JASMINE',      flag:'🇵🇦', dir:'OUTBOUND', time:'Apr 22 · 05:31', type:70 },
  { name:'SCHIEHALLION FSO', flag:'🇬🇧', dir:'INBOUND',  time:'Apr 22 · 04:55', type:80 },
  { name:'MAERSK LOME',      flag:'🇩🇰', dir:'OUTBOUND', time:'Apr 22 · 03:20', type:70 },
  { name:'BAHRI TABUK',      flag:'🇸🇦', dir:'INBOUND',  time:'Apr 22 · 02:44', type:80 },
  { name:'STOLT TANKERS',    flag:'🇳🇴', dir:'OUTBOUND', time:'Apr 22 · 01:18', type:80 },
  { name:'EVER FORWARD',     flag:'🇨🇳', dir:'OUTBOUND', time:'Apr 22 · 00:07', type:70 },
  { name:'NISSOS HERAKLION', flag:'🇬🇷', dir:'INBOUND',  time:'Apr 21 · 23:51', type:80 },
  { name:'NAVIG8 DIAMOND',   flag:'🇲🇭', dir:'OUTBOUND', time:'Apr 21 · 22:33', type:80 },
  { name:'BERGE SUND',       flag:'🇳🇴', dir:'INBOUND',  time:'Apr 21 · 21:14', type:80 },
  { name:'CMA CGM ARKANSAS', flag:'🇫🇷', dir:'OUTBOUND', time:'Apr 21 · 20:08', type:70 },
  { name:'CRUDE TITAN',      flag:'🇱🇷', dir:'INBOUND',  time:'Apr 21 · 18:55', type:80 },
  { name:'EASTERN JEWEL',    flag:'🇭🇰', dir:'OUTBOUND', time:'Apr 21 · 17:30', type:80 },
  { name:'HAFNIA LISE',      flag:'🇩🇰', dir:'OUTBOUND', time:'Apr 21 · 15:47', type:80 },
  { name:'CPC PIONEER',      flag:'🇸🇬', dir:'INBOUND',  time:'Apr 21 · 14:22', type:80 },
  { name:'AL SALAM MUSCAT',  flag:'🇴🇲', dir:'OUTBOUND', time:'Apr 21 · 13:05', type:80 },
  { name:'GOLDEN TOPAZ',     flag:'🇵🇦', dir:'INBOUND',  time:'Apr 21 · 11:48', type:80 },
  { name:'ONE HELSINKI',     flag:'🇯🇵', dir:'OUTBOUND', time:'Apr 21 · 10:20', type:70 },
  { name:'GULF UNITY',       flag:'🇦🇪', dir:'INBOUND',  time:'Apr 21 · 09:04', type:80 },
  { name:'SUISO FRONTIER',   flag:'🇯🇵', dir:'OUTBOUND', time:'Apr 21 · 07:39', type:80 },
  { name:'ORIENT ENTERPRISE',flag:'🇸🇬', dir:'INBOUND',  time:'Apr 21 · 06:11', type:80 },
  { name:'PACIFIC VOYAGER',  flag:'🇲🇭', dir:'OUTBOUND', time:'Apr 21 · 04:55', type:80 },
  { name:'AMALIA',           flag:'🇬🇷', dir:'INBOUND',  time:'Apr 21 · 03:28', type:80 },
  { name:'MSC ROTTERDAM',    flag:'🇵🇦', dir:'OUTBOUND', time:'Apr 21 · 02:05', type:70 },
  { name:'EXCELLENCE',       flag:'🇲🇹', dir:'INBOUND',  time:'Apr 21 · 00:44', type:80 },
];
let   _transitCount = _transitLog.length;

function _recordTransit(v, dir) {
  _transitCount++;
  const now = new Date();
  const t = `Apr 22 · ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
  _transitLog.unshift({ name: v.name, flag: v.flag, dir, time: t, type: v.type });
  if (_transitLog.length > 40) _transitLog.pop();
  _updateTransitDisplay();
}

function _updateTransitDisplay() {
  const numEl = document.getElementById('transit-num');
  if (numEl) numEl.textContent = _transitCount;
  const panel = document.getElementById('transit-log-panel');
  if (!panel) return;
  panel.innerHTML = _transitLog.map(r =>
    `<div class="transit-row">
      <span class="tr-flag">${r.flag}</span>
      <span class="tr-name">${r.name.slice(0,16)}</span>
      <span class="tr-dir-${r.dir === 'INBOUND' ? 'IN' : 'OUT'}">${r.dir === 'INBOUND' ? '→ PG' : '← GOO'}</span>
      <span class="tr-time">${r.time}</span>
    </div>`
  ).join('') || '<div class="transit-row" style="color:#4a6a7a">No transits yet.</div>';
}

document.getElementById('transit-counter')?.addEventListener('click', () => {
  document.getElementById('transit-log-panel')?.classList.toggle('visible');
});

// Navigable channel waypoints through the Strait (mirrored from leaflet-game.js STRAIT_NAV)
// Index 0 = Gulf of Oman (east), Index 10 = Persian Gulf (west)
const NAV_CHANNEL = [
  [23.453, 61.084], [24.026, 58.843], [24.956, 57.327],
  [25.741, 56.744], [26.44,  56.459], [26.323, 55.536],
  [25.582, 54.921], [25.135, 53.811], [25.770, 52.910],
  [26.362, 52.097], [27.030, 50.988],
];

function _nearestNavIdx(lat, lng) {
  let best = 0, bestD = Infinity;
  NAV_CHANNEL.forEach(([wLat, wLng], i) => {
    const d = Math.hypot(wLat - lat, wLng - lng);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

function _cogBetween(aLat, aLng, bLat, bLng) {
  const dLng = bLng - aLng, dLat = bLat - aLat;
  let deg = Math.atan2(dLng, dLat) * 180 / Math.PI;
  return (deg + 360) % 360;
}

function _startAIS() {
  const map = game.map;
  if (!map) { setTimeout(_startAIS, 500); return; }

  SIM_VESSELS.forEach(v => {
    // Assign nav direction: inbound (COG 180–360) = heading west toward PG = navDir +1 (idx increases)
    // outbound (COG 0–180) = heading east toward GOO = navDir -1 (idx decreases)
    v._navDir = (v.cog > 180) ? 1 : -1;
    v._navIdx = _nearestNavIdx(v.lat, v.lng);

    const icon   = _aisIcon(v.type, v.flag, v.cog);
    const marker = L.marker([v.lat, v.lng], { icon, zIndexOffset: -100, interactive: true }).addTo(map);
    const label  = L.marker([v.lat, v.lng], {
      icon: L.divIcon({
        html: `<div style="font-family:Courier New;font-size:10px;color:#aaddff;white-space:nowrap;text-shadow:0 0 4px #000,0 0 4px #000;pointer-events:none">${v.name.slice(0,15)}</div>`,
        className: '', iconAnchor: [-6, -4],
      }),
      interactive: false, zIndexOffset: -200,
    }).addTo(map);

    const makePopup = () =>
      `<div style="font-family:Courier New;font-size:12px;color:#c0d8e8;background:#060c12;border:1px solid #2a4a5a;padding:8px 12px;line-height:1.9;min-width:180px">
        <b style="color:#fff;font-size:13px">${v.flag} ${v.name}</b><br>
        <span style="color:#4a6a7a">TYPE</span>  ${v.type >= 80 ? 'TANKER / VLCC' : 'CARGO / CONTAINER'}<br>
        <span style="color:#4a6a7a">SPEED</span> ${v.sog.toFixed(1)} kn<br>
        <span style="color:#4a6a7a">COURSE</span> ${Math.round(v.cog)}° · ${v._navDir > 0 ? 'INBOUND → PG' : 'OUTBOUND → GOO'}<br>
        <span style="color:#4a6a7a">MMSI</span> ${v.mmsi}<br>
        <span style="color:#4a6a7a">STATUS</span> <span style="color:#44cc88">UNDERWAY</span>
      </div>`;

    marker.bindPopup(makePopup(), { className: 'ais-popup', maxWidth: 240, closeButton: true });
    _aisVessels.set(v.mmsi, { marker, label, v, makePopup });
  });

  console.log(`[AIS] ${SIM_VESSELS.length} vessels on nav channel`);
  _updateTransitDisplay();

  // Advance vessels along the nav channel every 15 s
  setInterval(() => {
    const DT = 15;
    _aisVessels.forEach(({ marker, label, v, makePopup }) => {
      const step = (v.sog / 3600) * 1.852 / 111 * DT; // degrees per tick

      const nextIdx = v._navIdx + v._navDir;
      if (nextIdx < 0 || nextIdx >= NAV_CHANNEL.length) {
        // End of channel — flip direction and wrap to opposite end
        v._navDir *= -1;
        v._navIdx = v._navDir > 0 ? 0 : NAV_CHANNEL.length - 1;
        [v.lat, v.lng] = NAV_CHANNEL[v._navIdx];
      } else {
        const [tLat, tLng] = NAV_CHANNEL[nextIdx];
        const dLat = tLat - v.lat, dLng = tLng - v.lng;
        const dist  = Math.hypot(dLat, dLng);

        if (dist <= step) {
          // Reached waypoint — snap and advance index
          v.lat = tLat; v.lng = tLng;
          v._navIdx = nextIdx;
        } else {
          v.lat += (dLat / dist) * step;
          v.lng += (dLng / dist) * step;
        }

        // Update COG from actual movement direction
        const newCog = _cogBetween(v.lat - (dLat / dist) * step, v.lng - (dLng / dist) * step, v.lat, v.lng);
        if (Math.abs(newCog - v.cog) > 5) {
          v.cog = newCog;
          marker.setIcon(_aisIcon(v.type, v.flag, v.cog));
        }
      }

      // Transit chokepoint detection
      const CHOKE = 56.4;
      const prevLng = v._prevLng ?? v.lng;
      if (prevLng > CHOKE && v.lng <= CHOKE) _recordTransit(v, 'OUTBOUND');
      if (prevLng < CHOKE && v.lng >= CHOKE) _recordTransit(v, 'INBOUND');
      v._prevLng = v.lng;

      marker.setLatLng([v.lat, v.lng]);
      label.setLatLng([v.lat, v.lng]);
      if (marker.isPopupOpen()) marker.setPopupContent(makePopup());
    });
  }, 15_000);
}

_startAIS();

// ── VLM Intel capture ─────────────────────────────────────────────────────────
const OLLAMA_MODEL        = 'llama3.2-vision:11b';
const OLLAMA_MODEL_SURVEY = 'hormuz-vision:latest';  // custom model — no refusals, better counts
const OLLAMA_URL   = 'http://localhost:11434/api/chat';

// Reference images for few-shot visual prompting
let _refCivilianB64   = null;
let _refMilitaryB64   = null;
let _refHelicopterB64 = null;
let _refNavalB64      = null;
let _refMarinaB64     = null;
fetch('/src/ref_aircraft.b64').then(r    => r.text()).then(t => { _refCivilianB64   = t.trim(); }).catch(() => {});
fetch('/src/ref_military.b64').then(r    => r.text()).then(t => { _refMilitaryB64   = t.trim(); }).catch(() => {});
fetch('/src/ref_helicopters.b64').then(r => r.text()).then(t => { _refHelicopterB64 = t.trim(); }).catch(() => {});
fetch('/src/ref_naval.b64').then(r       => r.text()).then(t => { _refNavalB64      = t.trim(); }).catch(() => {});
fetch('/src/ref_marina.b64').then(r      => r.text()).then(t => { _refMarinaB64     = t.trim(); console.log('[VLM] All refs loaded'); }).catch(() => {});

let _ollamaReady = false;

document.getElementById('intel-model-name').textContent = OLLAMA_MODEL + ' ⟳';

async function _checkOllamaReady() {
  try {
    const res = await fetch('http://localhost:11434/api/tags');
    if (!res.ok) return false;
    const { models } = await res.json();
    return (models ?? []).some(m => m.name === OLLAMA_MODEL || m.name.startsWith('llama3.2-vision') || m.name.startsWith('hormuz-vision'));
  } catch { return false; }
}

(async () => {
  // Poll every 15s until the model appears
  while (true) {
    const ready = await _checkOllamaReady();
    if (ready) {
      _ollamaReady = true;
      document.getElementById('intel-model-name').textContent = OLLAMA_MODEL + ' ✓';
      document.getElementById('intel-btn').title = 'Capture map and analyze with ' + OLLAMA_MODEL;
      ui.addLog('VLM', `${OLLAMA_MODEL} ready.`, 'system');
      break;
    }
    document.getElementById('intel-model-name').textContent = OLLAMA_MODEL + ' (downloading...)';
    await new Promise(r => setTimeout(r, 15000));
  }
})();

// ── Draw-to-select state ──────────────────────────────────────────────────────
let _intelDrawMode = false;

function _startIntelDraw(callback, color = '#aa66ff') {
  if (_intelDrawMode) return;
  _intelDrawMode = true;

  const lmap    = game.map;
  const mapEl   = document.getElementById('map');
  const mapRect = mapEl.getBoundingClientRect();

  const hint = document.createElement('div');
  hint.style.cssText = `position:fixed;top:60px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.88);color:${color};padding:7px 18px;border:1px solid ${color};font-family:monospace;font-size:13px;z-index:10000;pointer-events:none`;
  hint.textContent = '⬛ CLICK AND DRAG on the map to draw a selection box — release to analyze that area';
  document.body.appendChild(hint);

  const selBox = document.createElement('div');
  selBox.style.cssText = `position:fixed;border:2px solid ${color};background:rgba(255,170,50,0.08);pointer-events:none;display:none;z-index:9999`;
  document.body.appendChild(selBox);

  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;left:${mapRect.left}px;top:${mapRect.top}px;width:${mapRect.width}px;height:${mapRect.height}px;z-index:9998;cursor:crosshair`;
  document.body.appendChild(overlay);

  let x0 = 0, y0 = 0, started = false;

  function onMove(e) {
    if (!started) return;
    const left = Math.min(e.clientX, x0), top = Math.min(e.clientY, y0);
    selBox.style.left   = left + 'px';
    selBox.style.top    = top  + 'px';
    selBox.style.width  = Math.abs(e.clientX - x0) + 'px';
    selBox.style.height = Math.abs(e.clientY - y0) + 'px';
  }

  function onUp(e) {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
    hint.remove(); selBox.remove(); overlay.remove();
    _intelDrawMode = false;

    if (!started) { const b = lmap.getBounds(); callback(b.getSouthWest(), b.getNorthEast()); return; }

    const x1 = e.clientX, y1 = e.clientY;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);

    if (dx < 10 || dy < 10) {
      const b = lmap.getBounds();
      callback(b.getSouthWest(), b.getNorthEast());
      return;
    }

    const fresh = mapEl.getBoundingClientRect();
    const nwPt  = [Math.min(x0, x1) - fresh.left, Math.min(y0, y1) - fresh.top];
    const sePt  = [Math.max(x0, x1) - fresh.left, Math.max(y0, y1) - fresh.top];
    const nw    = lmap.containerPointToLatLng(nwPt);
    const se    = lmap.containerPointToLatLng(sePt);
    callback({ lat: se.lat, lng: nw.lng }, { lat: nw.lat, lng: se.lng });
  }

  overlay.addEventListener('mousedown', (e) => {
    x0 = e.clientX; y0 = e.clientY; started = true;
    selBox.style.left = x0 + 'px'; selBox.style.top = y0 + 'px';
    selBox.style.width = '0'; selBox.style.height = '0';
    selBox.style.display = 'block';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    e.preventDefault(); e.stopPropagation();
  });
}

document.getElementById('intel-btn').addEventListener('click', async () => {
  const btn = document.getElementById('intel-btn');
  const modal = document.getElementById('intel-modal');
  const body  = document.getElementById('intel-modal-body');

  if (btn.classList.contains('loading')) return;
  if (_intelDrawMode) return;

  if (!_ollamaReady) {
    if (modal) modal.classList.add('visible');
    if (body) body.textContent = `${OLLAMA_MODEL} is still loading — wait for ✓ in the model name then try again.`;
    return;
  }

  // Enter draw-to-select mode
  _startIntelDraw(_runIntelAnalysis, '#aa66ff');
});

async function _runIntelAnalysis(sw, ne) {
  const btn   = document.getElementById('intel-btn');
  const modal = document.getElementById('intel-modal');
  const body  = document.getElementById('intel-modal-body');
  const coordsEl = document.getElementById('intel-coords-display');

  const center = { lat: (sw.lat + ne.lat) / 2, lng: (sw.lng + ne.lng) / 2 };
  const zoom   = game.map?.getZoom() ?? 13;
  const centerStr = `${center.lat.toFixed(4)}°N, ${center.lng.toFixed(4)}°E`;
  const coordStr  = `${center.lat.toFixed(3)}°N ${center.lng.toFixed(3)}°E  Z${zoom}`;

  if (coordsEl) coordsEl.textContent = coordStr;

  btn.classList.add('loading');
  btn.textContent = '🔭 CAPTURING...';
  if (body) body.textContent = 'Fetching satellite image...';
  if (modal) { modal.classList.add('visible'); modal.classList.remove('collapsed'); }
  const icon = document.getElementById('intel-collapse-icon');
  if (icon) icon.textContent = '▼';

  try {
    // Fetch clean satellite image from ArcGIS
    let b64;
    try {
      const arcgisUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export` +
        `?bbox=${sw.lng},${sw.lat},${ne.lng},${ne.lat}&bboxSR=4326&size=1024,1024&imageSR=4326&format=jpg&f=image`;
      const tileRes = await fetch(arcgisUrl);
      if (!tileRes.ok) throw new Error('ArcGIS failed');
      const blob = await tileRes.blob();
      b64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
    } catch {
      const mapEl = document.getElementById('map');
      const canvas = await html2canvas(mapEl, { useCORS: true, allowTaint: true, scale: 2.0 });
      b64 = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
    }

    const bboxDebug = `${sw.lat.toFixed(3)}°N ${sw.lng.toFixed(3)}°E → ${ne.lat.toFixed(3)}°N ${ne.lng.toFixed(3)}°E`;
    body.innerHTML = `<div style="font-size:10px;color:#7788aa;margin-bottom:4px">${bboxDebug}</div><img src="data:image/jpeg;base64,${b64}" style="width:100%;max-height:90px;object-fit:contain;display:block;margin-bottom:6px;border:1px solid #aa66ff"><div id="intel-stream" style="white-space:pre-wrap;word-break:break-word;margin:0;font-family:inherit;font-size:11px;color:#c0d8e8;line-height:1.5">⟳ Analyzing...</div>`;
    const streamEl = document.getElementById('intel-stream');

    function ollamaAsk(question) {
      return fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [{ role: 'user', content: question, images: [b64] }],
          stream: false,
          options: { temperature: 0.1, num_predict: 300 },
        }),
      }).then(r => r.json()).then(d => d.message?.content ?? '');
    }

    function ollamaAskShort(question) {
      return fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [{ role: 'user', content: question, images: [b64] }],
          stream: false,
          options: { temperature: 0.1, num_predict: 80, stop: ['\n', '\n\n', 'Answer:', 'Note:', 'Therefore'] },
        }),
      }).then(r => r.json()).then(d => (d.message?.content ?? '').trim());
    }

    // Three focused parallel questions — one type at a time for accuracy
    const [aircraftReply, vesselReply, infraReply, posReply] = await Promise.all([
      ollamaAskShort('Count aircraft on the ground (runways, aprons, gates). ONE line: "N aircraft: location, location" or "0 aircraft". No extra text.'),
      ollamaAskShort('Count boats/ships floating in water. ONE line: "N vessels: location, location" or "0 vessels". If no water visible say "0 vessels". No extra text.'),
      ollamaAskShort('Name main structures in one short phrase e.g. "harbor with two breakwaters" or "airport with runway". No lists.'),
      ollamaAsk('For every vessel and aircraft you can see, output its position as image fractions — x=0 is left edge, x=1 is right edge, y=0 is top, y=1 is bottom. Plain text only, one per line:\nvessel x y\naircraft x y\nOnly list things you can actually see. No explanation.'),
    ]);

    const text = `AIRCRAFT: ${aircraftReply}\nVESSELS:  ${vesselReply}\nINFRA:    ${infraReply}`;
    if (streamEl) streamEl.textContent = text;

    // Drop a single clickable intel flag at the center — click to read the full analysis
    _clearVlmMarkers();
    const flagLat = (sw.lat + ne.lat) / 2;
    const flagLng = (sw.lng + ne.lng) / 2;
    _addPersistentFlag(flagLat, flagLng, 'INTEL', 'intel', text);

    ui.addLog('VLM INTEL', text.slice(0, 200), 'adjudication');
    await _saveIntel(center.lat, center.lng, coordStr, new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}), 'intel', text);
  } catch (err) {
    if (body) body.innerHTML = `<pre style="white-space:pre-wrap;margin:0;color:#ff6666">Error: ${err.message}\n\nMake sure Ollama is running.\nRun: ollama pull ${OLLAMA_MODEL}</pre>`;
  } finally {
    btn.classList.remove('loading');
    btn.textContent = '🔭 INTEL';
  }
}

document.getElementById('intel-modal-close').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('intel-modal').classList.remove('visible');
});

document.getElementById('intel-modal-copy').addEventListener('click', (e) => {
  e.stopPropagation();
  const body = document.getElementById('intel-modal-body');
  const text = body.innerText || body.textContent || '';
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('intel-modal-copy');
    btn.textContent = '✓ COPIED';
    setTimeout(() => { btn.textContent = '⎘ COPY'; }, 1500);
  }).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  });
});

document.getElementById('intel-modal-header').addEventListener('click', () => {
  const modal = document.getElementById('intel-modal');
  const icon  = document.getElementById('intel-collapse-icon');
  const collapsed = modal.classList.toggle('collapsed');
  icon.textContent = collapsed ? '▶' : '▼';
});

// ── SURVEY mode — tile a drawn area into 3×3 grid, run INTEL on each tile ────
document.getElementById('survey-btn').addEventListener('click', () => {
  if (document.getElementById('survey-btn').classList.contains('loading')) return;
  if (_intelDrawMode) return;
  _startIntelDraw(_runSurvey, '#ffaa44');
});

async function _runSurvey(sw, ne) {
  const btn   = document.getElementById('survey-btn');
  const modal = document.getElementById('intel-modal');
  const body  = document.getElementById('intel-modal-body');
  const coordsEl = document.getElementById('intel-coords-display');

  btn.classList.add('loading');
  btn.textContent = '🗺 SCANNING...';
  if (modal) { modal.classList.add('visible'); modal.classList.remove('collapsed'); }
  const icon = document.getElementById('intel-collapse-icon');
  if (icon) icon.textContent = '▼';

  const GRID = 3;
  const latSpan = ne.lat - sw.lat;
  const lngSpan = ne.lng - sw.lng;
  const centerLat = (sw.lat + ne.lat) / 2;
  const centerLng = (sw.lng + ne.lng) / 2;
  if (coordsEl) coordsEl.textContent = `SURVEY ${centerLat.toFixed(3)}°N ${centerLng.toFixed(3)}°E  ${GRID}×${GRID}`;

  const tiles = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      tiles.push({
        r, c,
        sw: { lat: sw.lat + r * latSpan / GRID,       lng: sw.lng + c * lngSpan / GRID },
        ne: { lat: sw.lat + (r+1) * latSpan / GRID,   lng: sw.lng + (c+1) * lngSpan / GRID },
      });
    }
  }

  // POI keyword sets used to identify notable tiles for second-pass zoom-in
  const POI_KEYWORDS = ['airport','runway','airstrip','hangar','apron','helipad','helicopter','pier','dock','harbor','harbour',
    'port','naval','military','base','jetty','wharf','terminal','facility','depot'];

  // Draw tile grid on map so user can see the scan area
  const tileRects = [];
  for (const t of tiles) {
    const rect = L.rectangle([[t.sw.lat, t.sw.lng], [t.ne.lat, t.ne.lng]], {
      color: '#ffaa44', weight: 1, opacity: 0.6, fillOpacity: 0.04, dashArray: '4 4'
    }).addTo(game.map);
    tileRects.push(rect);
  }

  let totalAircraft = 0, totalVessels = 0;
  const infraSeen = new Map(); // keyword → {lat,lng,b64,acNum,vcNum}
  const tileLines = [];

  async function fetchB64(tileSw, tileNe, size = 1024) {
    const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export` +
      `?bbox=${tileSw.lng},${tileSw.lat},${tileNe.lng},${tileNe.lat}&bboxSR=4326&size=${size},${size}&imageSR=4326&format=jpg&f=image`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('ArcGIS failed');
    const blob = await res.blob();
    return new Promise(resolve => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result.split(',')[1]);
      fr.readAsDataURL(blob);
    });
  }

  // High-res version for POI deep scan — 2048px to see more detail
  const fetchB64High = (sw, ne) => fetchB64(sw, ne, 2048);

  // Short single-line response (for classification)
  function ollamaShort(b64, q) {
    return fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL_SURVEY,
        messages: [{ role: 'user', content: q, images: [b64] }],
        stream: false,
        options: { temperature: 0.1, num_predict: 80, stop: ['\n', '\n\n', 'Answer:', 'Note:', 'Therefore'] },
      }),
    }).then(r => r.json()).then(d => (d.message?.content ?? '').trim());
  }
  // Count-focused — uses step-by-step reasoning, outputs "Total Count: N aircraft" first
  const Q_COUNT_AC = 'Satellite photo of an airport area. Count every airplane shape (cross, T-shape, or delta wing) ' +
    'you can see on tarmac, aprons, gates, or open ground. ' +
    'Reply with ONLY: "Total Count: N aircraft" where N is your count. ' +
    'If you see no aircraft shapes at all, reply "Total Count: 0 aircraft".';
  const Q_COUNT_VC = 'Satellite photo. Count boats/ships floating in water (elongated shapes in dark water). ' +
    'Give count first: "Total Count: N vessels". If no water visible: "Total Count: 0 vessels".';
  function ollamaCount(b64, q) {
    return fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL_SURVEY,
        messages: [{ role: 'user', content: q, images: [b64] }],
        stream: false,
        options: { temperature: 0.1, num_predict: 400 },
      }),
    }).then(r => r.json()).then(d => (d.message?.content ?? '').trim());
  }

  // Extract aircraft count — looks for "Total Count: N aircraft" first (most reliable)
  function parseAc(s) {
    for (const pat of [
      /Total\s+Count[:\s]+(\d+)\s*aircraft/i,
      /TOTAL[:\s]+(\d+)\s*aircraft/i,
      /(\d+)\s*aircraft\s*(?:total|found|detected)/i,
      /(?:identified|counted|found)\s+(\d+)\s*aircraft/i,
      /there are\s+(\d+)\s*aircraft/i,
      /I count\s+(\d+)\s*aircraft/i,
    ]) {
      const m = s.match(pat);
      if (m) return parseInt(m[1]);
    }
    return 0;
  }
  function parseVc(s) {
    for (const pat of [
      /Total\s+Count[:\s]+(\d+)\s*vessel/i,
      /TOTAL[:\s]+(\d+)\s*vessel/i,
      /(\d+)\s*vessel\s*(?:total|found|detected)/i,
      /there are\s+(\d+)\s*vessel/i,
    ]) {
      const m = s.match(pat);
      if (m) return parseInt(m[1]);
    }
    return 0;
  }

  // ── PASS 1: classify all tiles in parallel ───────────────────────────────
  if (body) body.innerHTML = `<div style="color:#ffaa44;font-size:12px;margin-bottom:6px">▶ PASS 1 — CLASSIFYING ${tiles.length} TILES (parallel)...</div><div id="survey-status" style="color:#7788aa;font-size:10px">Fetching all tiles...</div>`;

  const pass1Results = await Promise.all(tiles.map(async (tile, i) => {
    if (tileRects[i]) tileRects[i].setStyle({ color: '#ff6600', fillOpacity: 0.12 });
    try {
      const b64 = await fetchB64(tile.sw, tile.ne);
      const infr = await ollamaShort(b64,
        'Identify the MOST important feature in 1-3 words from this list only: ' +
        'airport / runway / airstrip / helipad / harbor / pier / dock / naval base / military base / ' +
        'open water / coastline / buildings / rocky terrain. Reply ONLY the matching phrase, nothing else.'
      );
      const infraKey = infr.toLowerCase().replace(/\*\*/g,'').replace(/[^a-z ]/g,'').trim();
      const isPOI = POI_KEYWORDS.some(k => infraKey.includes(k));
      if (tileRects[i]) tileRects[i].setStyle({ color: isPOI ? '#ffaa44' : '#335533', fillOpacity: isPOI ? 0.08 : 0.02 });
      return { tile, i, infraKey, isPOI, error: false };
    } catch (err) {
      console.warn(`Survey tile ${i+1} failed:`, err.message);
      if (tileRects[i]) tileRects[i].setStyle({ color: '#663333', fillOpacity: 0.04 });
      return { tile, i, infraKey: 'error', isPOI: false, error: true };
    }
  }));

  for (const { tile, i, infraKey, isPOI } of pass1Results) {
    tileLines.push({ label: `R${tile.r}C${tile.c}: ${infraKey}${isPOI ? ' POI' : ''}`, isPOI, infraKey });
    if (isPOI) {
      const tileLat = (tile.sw.lat + tile.ne.lat) / 2;
      const tileLng = (tile.sw.lng + tile.ne.lng) / 2;
      infraSeen.set(`${tile.r}_${tile.c}`, { poiName: infraKey, lat: tileLat, lng: tileLng, sw: tile.sw, ne: tile.ne });
    }
  }

  // ── PASS 2: deep scan every POI tile (3×3 sub-grid each) ──────────────
  const poiReports = [];
  const poiEntries = [...infraSeen.entries()];
  // Group adjacent same-type tiles to avoid overcounting (merge bbox)
  const typeGroups = {};
  for (const [key, poi] of poiEntries) {
    const g = POI_KEYWORDS.find(k => poi.poiName.includes(k)) ?? poi.poiName;
    if (!typeGroups[g]) typeGroups[g] = [];
    typeGroups[g].push(poi);
  }

  let groupIdx = 0;
  for (const [groupType, groupPois] of Object.entries(typeGroups)) {
    groupIdx++;
    // Merge all tiles of this type into one bbox
    const mergedSW = {
      lat: Math.min(...groupPois.map(p => p.sw.lat)),
      lng: Math.min(...groupPois.map(p => p.sw.lng)),
    };
    const mergedNE = {
      lat: Math.max(...groupPois.map(p => p.ne.lat)),
      lng: Math.max(...groupPois.map(p => p.ne.lng)),
    };
    const centerP = { lat: (mergedSW.lat + mergedNE.lat) / 2, lng: (mergedSW.lng + mergedNE.lng) / 2 };

    if (body) body.innerHTML = `<div style="color:#44ffaa;font-size:12px;margin-bottom:6px">▶ PASS 2 — ${groupType.toUpperCase()} (${groupIdx}/${Object.keys(typeGroups).length}) — ${groupPois.length} tiles merged</div><div id="survey-status" style="color:#7788aa;font-size:10px">Zooming in...</div>`;

    // Draw merged bbox outline
    const mergedRect = L.rectangle([[mergedSW.lat, mergedSW.lng],[mergedNE.lat, mergedNE.lng]], {
      color: '#44ffaa', weight: 2, opacity: 0.8, fillOpacity: 0.0, dashArray: '6 3'
    }).addTo(game.map);

    try {
      // 2×2 sub-tile grid — 4 tiles, 1-2 calls each ≈ ~60-90s total
      const SUB = 2;
      const subLat = (mergedNE.lat - mergedSW.lat) / SUB;
      const subLng = (mergedNE.lng - mergedSW.lng) / SUB;
      let poiTotalAc = 0, poiTotalVc = 0;
      const subLines = [];
      const isMaritime = /\b(harbor|harbour|pier|dock|naval|port|jetty|wharf|terminal)\b/.test(groupType);

      const subCoords = [];
      for (let sr = 0; sr < SUB; sr++)
        for (let sc = 0; sc < SUB; sc++)
          subCoords.push({ sr, sc });

      const subResults = await Promise.all(subCoords.map(async ({ sr, sc }) => {
        const subSW = { lat: mergedSW.lat + sr*subLat, lng: mergedSW.lng + sc*subLng };
        const subNE = { lat: mergedSW.lat + (sr+1)*subLat, lng: mergedSW.lng + (sc+1)*subLng };
        try {
          const sb64 = await fetchB64(subSW, subNE, 512);
          let sacN = parseAc(await ollamaCount(sb64, Q_COUNT_AC));
          if ([17, 34, 43, 123, 134].includes(sacN)) {
            const scr = (await ollamaCount(sb64,
              'Does this satellite image show airport runways, tarmac, or parked aircraft? Answer yes or no.'
            )).trim();
            if (!/^y/i.test(scr)) sacN = 0;
          }
          let svcN = 0;
          if (isMaritime) svcN = parseVc(await ollamaCount(sb64, Q_COUNT_VC));
          return { sr, sc, sacN, svcN };
        } catch (e) { return { sr, sc, sacN: 0, svcN: 0 }; }
      }));

      for (const { sr, sc, sacN, svcN } of subResults) {
        poiTotalAc += sacN;
        poiTotalVc += svcN;
        if (sacN > 0 || svcN > 0) subLines.push(`  R${sr}C${sc}: ${sacN > 0 ? sacN+' ac' : ''}${svcN > 0 ? ' '+svcN+' vs' : ''}`);
      }

      totalAircraft += poiTotalAc;
      totalVessels  += poiTotalVc;

      const poiReport = `[${groupType.toUpperCase()}]\nAIRCRAFT: ${poiTotalAc}\nVESSELS:  ${poiTotalVc}\n${subLines.join('\n')}`;
      poiReports.push({ type: groupType, report: poiReport, ac: poiTotalAc, vc: poiTotalVc });
      _addPersistentFlag(centerP.lat, centerP.lng, groupType.toUpperCase().slice(0,8), 'intel', poiReport);
    } catch (err) {
      console.warn(`POI deep scan failed for ${groupType}:`, err.message);
    } finally {
      game.map.removeLayer(mergedRect);
    }
  }

  // ── PASS 3: synthesize all tile data into one coherent report ────────────
  const tileDataText = tileLines.map(t => t.label).join('\n');
  const poiDataText  = poiReports.map(p => p.report).join('\n\n');
  const rawSummary   = `Tiles scanned: ${tiles.length}\n${tileDataText}\n\nPOI deep scans:\n${poiDataText}`;

  let synthesizedBrief = '';
  const erroredCount = tileLines.filter(t => t.label.includes('error')).length;
  if (poiReports.length === 0 && erroredCount === tiles.length) {
    synthesizedBrief = 'AREA SURVEY BRIEF — All tile fetches failed. Check network connection or try a different area.';
  } else if (poiReports.length === 0 && totalAircraft === 0 && totalVessels === 0) {
    synthesizedBrief = `AREA SURVEY BRIEF — Survey complete. No POIs or military assets detected across ${tiles.length - erroredCount} tiles. Area appears to be open water, coastline, or civilian terrain.`;
  } else {
    if (body) body.innerHTML = `<div style="color:#aaddff;font-size:12px;margin-bottom:6px">▶ PASS 3 — SYNTHESIZING REPORT...</div>`;
    try {
      const synthPrompt =
        `You are an aerial intelligence analyst. Below are verified findings from a ${GRID}x${GRID} tiled satellite survey.\n` +
        `VERIFIED COUNTS (use these exact numbers — do not invent different figures):\n` +
        `  Aircraft confirmed: ${totalAircraft}\n` +
        `  Vessels confirmed: ${totalVessels}\n` +
        `  POIs found: ${Object.keys(typeGroups).join(', ') || 'none'}\n\n` +
        `RAW TILE DATA:\n${rawSummary}\n\n` +
        `Write a concise intelligence brief (3-5 sentences, plain text) covering: ` +
        `what POIs were found and their confirmed asset counts, notable infrastructure. ` +
        `Use the exact aircraft/vessel numbers above. Start with "AREA SURVEY BRIEF —"`;
      synthesizedBrief = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL_SURVEY,
          messages: [{ role: 'user', content: synthPrompt }],
          stream: false,
          options: { temperature: 0.1, num_predict: 250 },
        }),
      }).then(r => r.json()).then(d => (d.message?.content ?? '').trim());
    } catch (e) { synthesizedBrief = '(synthesis unavailable)'; }
  }

  const dateStr = new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  const masterReport =
    `=== AREA SURVEY — ${dateStr} ===\n` +
    `${sw.lat.toFixed(3)}°N ${sw.lng.toFixed(3)}°E → ${ne.lat.toFixed(3)}°N ${ne.lng.toFixed(3)}°E\n\n` +
    `TOTAL AIRCRAFT:  ${totalAircraft}\n` +
    `TOTAL VESSELS:   ${totalVessels}\n` +
    `POIs FOUND:      ${Object.keys(typeGroups).join(', ') || 'none'}\n\n` +
    `--- BRIEF ---\n${synthesizedBrief}\n\n` +
    (poiReports.length > 0 ? `--- POI DETAIL ---\n${poiReports.map(p=>p.report).join('\n\n')}\n\n` : '') +
    `--- TILE SCAN (${GRID}x${GRID}) ---\n` +
    tileLines.map((t, i) => `  ${i+1}. ${t.label}`).join('\n');

  tileRects.forEach(r => game.map.removeLayer(r));

  if (body) body.textContent = masterReport;
  _addPersistentFlag(centerLat, centerLng, 'SURVEY', 'intel', masterReport);
  ui.addLog('SURVEY', `${totalAircraft} ac • ${totalVessels} vs • ${Object.keys(typeGroups).length} POIs`, 'adjudication');
  await _saveIntel(centerLat, centerLng, `Survey ${centerLat.toFixed(3)}N`, dateStr, 'survey', masterReport);

  btn.classList.remove('loading');
  btn.textContent = '🗺 SURVEY';
}

// ── Airport intel overlay ─────────────────────────────────────────────────────
let _airportMarkers = [];
let _airportOverlayVisible = false;

async function _loadAirportIntel() {
  try {
    const res = await fetch('/airport_intel.json');
    if (!res.ok) return;
    const data = await res.json();
    _renderAirportOverlay(data);
  } catch(e) { console.warn('Airport intel load failed:', e.message); }
}

function _renderAirportOverlay(data) {
  _airportMarkers.forEach(m => game.map.removeLayer(m));
  _airportMarkers = [];
  for (const ap of Object.values(data)) {
    if (ap.aircraft == null) continue;
    const n = ap.aircraft;
    const color = n === 0 ? '#667788' : n < 30 ? '#44cc44' : n < 80 ? '#ffcc00' : n < 150 ? '#ff8800' : '#ff3333';
    const r = n === 0 ? 10 : Math.min(28, 10 + Math.sqrt(n) * 1.4);
    const marker = L.circleMarker([ap.lat, ap.lng], {
      radius: r, color, fillColor: color, fillOpacity: 0.85, weight: 1.5, opacity: 0.9,
    }).bindTooltip(
      `<b>${ap.icao}</b> — ${ap.name}<br>✈ ${n} aircraft`,
      { permanent: false, direction: 'top', className: 'airport-intel-tip' }
    ).addTo(game.map);
    _airportMarkers.push(marker);
  }
}

function _toggleAirportOverlay() {
  _airportOverlayVisible = !_airportOverlayVisible;
  const btn = document.getElementById('airport-intel-btn');
  if (_airportOverlayVisible) {
    _airportMarkers.forEach(m => game.map.addLayer(m));
    if (btn) { btn.textContent = '✈ HIDE INTEL'; btn.style.background = '#224422'; }
  } else {
    _airportMarkers.forEach(m => game.map.removeLayer(m));
    if (btn) { btn.textContent = '✈ AIR INTEL'; btn.style.background = ''; }
  }
}

document.getElementById('airport-intel-btn')?.addEventListener('click', () => {
  if (_airportMarkers.length === 0) {
    _loadAirportIntel().then(() => {
      _airportOverlayVisible = false;
      _toggleAirportOverlay();
    });
  } else {
    _toggleAirportOverlay();
  }
});

// ── Sentinel-2 imagery + VLM analysis ────────────────────────────────────────
const INTEL_API = 'http://localhost:8000';

async function _saveIntel(lat, lng, areaName, dateLabel, source, analysis) {
  try {
    await fetch(`${INTEL_API}/intel/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng, area_name: areaName, date_label: dateLabel, source, analysis }),
    });
  } catch(e) { console.warn('Intel save failed:', e.message); }
}

async function _loadPastIntel(lat, lng) {
  try {
    const res = await fetch(`${INTEL_API}/intel/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng, radius_deg: 0.8, limit: 3 }),
    });
    const data = await res.json();
    return data.observations ?? [];
  } catch(e) { return []; }
}

const SH_CLIENT_ID     = 'sh-5c2497a4-5ff4-4d88-ab2b-2ed79d8a2c65';
const SH_CLIENT_SECRET = 'emufKg6U3c1q1b9UGQDcNhmqYOBSkMfc';
const SH_TOKEN_URL     = '/proxy/sentinel-token';
const SH_PROCESS_URL   = '/proxy/sentinel-process';

let _shToken = null;
let _shTokenExpiry = 0;

async function _getShToken() {
  if (_shToken && Date.now() < _shTokenExpiry - 30000) return _shToken;
  const res = await fetch(SH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: SH_CLIENT_ID,
      client_secret: SH_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${await res.text()}`);
  const data = await res.json();
  _shToken = data.access_token;
  _shTokenExpiry = Date.now() + data.expires_in * 1000;
  return _shToken;
}

async function _fetchSentinelImage(bbox, dateFrom, dateTo) {
  const token = await _getShToken();
  const body = {
    input: {
      bounds: { bbox, properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' } },
      data: [{
        type: 'sentinel-2-l2a',
        dataFilter: {
          timeRange: { from: `${dateFrom}T00:00:00Z`, to: `${dateTo}T23:59:59Z` },
          maxCloudCoverage: 100,
          mosaickingOrder: 'leastCC',
        },
      }],
    },
    output: { width: 1024, height: 1024, responses: [{ identifier: 'default', format: { type: 'image/jpeg' } }] },
    evalscript: `//VERSION=3
function setup() { return { input:[{bands:["B04","B03","B02"]}], output:{bands:3} }; }
function evaluatePixel(s) {
  // 2.5 gain + gamma 0.85 keeps desert from blowing out while lifting dark water detail
  const gain = 2.5, gamma = 0.85;
  return [
    Math.pow(Math.min(1, gain * s.B04), gamma),
    Math.pow(Math.min(1, gain * s.B03), gamma),
    Math.pow(Math.min(1, gain * s.B02), gamma)
  ];
}`,
  };

  const res = await fetch(SH_PROCESS_URL, {
    method: 'POST',
    headers: { 'X-SH-Token': token, 'Content-Type': 'application/json', Accept: 'image/jpeg' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`[Sentinel] API ${res.status}:`, errText);
    throw new Error(`Sentinel ${res.status}: ${errText.slice(0, 200)}`);
  }
  const blob = await res.blob();
  console.log(`[Sentinel] Got blob: ${blob.size} bytes, type: ${blob.type}`);
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // data:image/jpeg;base64,...
    reader.readAsDataURL(blob);
  });
}

// NASA GIBS — free, no auth, daily. Three satellites with different overpass times.
const GIBS_LAYERS = [
  { id: 'MODIS_Terra_CorrectedReflectance_TrueColor', label: 'MODIS-Terra', res: '250m' },
  { id: 'MODIS_Aqua_CorrectedReflectance_TrueColor',  label: 'MODIS-Aqua',  res: '250m' },
  { id: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',  label: 'VIIRS-SNPP',  res: '375m' },
];

async function _fetchGibsImage(bbox, date, layerIdx = 0) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  // WMS 1.3.0 + EPSG:4326: bbox order is minLat,minLng,maxLat,maxLng
  const bboxWms = `${minLat},${minLng},${maxLat},${maxLng}`;
  const layer = GIBS_LAYERS[layerIdx % GIBS_LAYERS.length];
  const url = `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?` +
    `SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
    `&LAYERS=${layer.id}` +
    `&CRS=EPSG:4326&BBOX=${bboxWms}` +
    `&WIDTH=1024&HEIGHT=1024&FORMAT=image/jpeg&TIME=${date}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GIBS ${res.status}`);
  const blob = await res.blob();
  // GIBS returns XML ServiceException when no imagery — check content type + size
  if (!blob.type.startsWith('image/') || blob.size < 2000) {
    throw new Error('GIBS: no imagery for this date');
  }
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: reader.result, layerLabel: layer.label });
    reader.readAsDataURL(blob);
  });
}

// Markers placed by VLM detections — tracked so we can clear them on next run
const _vlmMarkers = [];

function _clearVlmMarkers() {
  _vlmMarkers.forEach(m => { if (game.map) game.map.removeLayer(m); });
  _vlmMarkers.length = 0;
}

// ── Persistent intel flags ────────────────────────────────────────────────────
const INTEL_FLAGS_KEY = 'hormuz_intel_flags';

function _loadIntelFlags() {
  try { return JSON.parse(localStorage.getItem(INTEL_FLAGS_KEY) ?? '[]'); }
  catch { return []; }
}
function _saveIntelFlags(flags) {
  localStorage.setItem(INTEL_FLAGS_KEY, JSON.stringify(flags));
}

// Place a persistent intel flag. Popup has a DISMISS button that removes it from map + storage.
function _placeVlmMarker(lat, lng, label, type, analysisText, flagId, ts) {
  if (!game.map) return null;
  const id = flagId ?? `flag_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const timestamp = ts ?? Date.now();
  const colors = { aircraft: '#ffdd00', helicopter: '#ff9900', vessel: '#44aaff', intel: '#aa66ff', unknown: '#aaaaaa' };
  const icons  = { aircraft: '✈', helicopter: '🚁', vessel: '⬥', intel: '📋', unknown: '?' };
  const color  = colors[type] ?? colors.unknown;
  const icon   = icons[type]  ?? icons.unknown;
  const divIcon = L.divIcon({
    html: `<div style="background:rgba(4,6,16,0.92);border:1.5px solid ${color};color:${color};
      font-family:'Courier New',monospace;font-size:10px;padding:2px 6px;white-space:nowrap;
      letter-spacing:1px;cursor:pointer;box-shadow:0 0 8px ${color}44">${icon} ${label}</div>`,
    className: '', iconAnchor: [0, 10],
  });
  const marker = L.marker([lat, lng], { icon: divIcon, interactive: true, zIndexOffset: 200 }).addTo(game.map);

  if (analysisText) {
    const dateStr = new Date(timestamp).toLocaleString('en-US', {
      month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit',
    });
    marker.on('click', () => {
      const overlay    = document.getElementById('intel-report-overlay');
      const title      = document.getElementById('intel-report-title');
      const body       = document.getElementById('intel-report-body');
      const closeBtn   = document.getElementById('intel-report-close');
      const dismissBtn = document.getElementById('intel-report-dismiss');
      if (!overlay) return;
      title.textContent = `📋 ${label}  ·  ${dateStr}`;
      body.textContent  = analysisText;
      overlay.classList.add('visible');
      closeBtn.onclick = () => overlay.classList.remove('visible');
      dismissBtn.onclick = () => {
        overlay.classList.remove('visible');
        if (game.map) game.map.removeLayer(marker);
        const idx = _vlmMarkers.indexOf(marker);
        if (idx !== -1) _vlmMarkers.splice(idx, 1);
        _saveIntelFlags(_loadIntelFlags().filter(f => f.id !== id));
      };
    });
  }
  _vlmMarkers.push(marker);
  return { marker, id };
}

// Save an intel flag to localStorage and place it on the map
function _addPersistentFlag(lat, lng, label, type, analysisText) {
  const result = _placeVlmMarker(lat, lng, label, type, analysisText);
  if (!result) return;
  const flags = _loadIntelFlags();
  flags.push({ id: result.id, lat, lng, label, type, text: analysisText, ts: Date.now() });
  _saveIntelFlags(flags);
}

// Restore all saved flags on load
function _restoreIntelFlags() {
  if (!game.map) { setTimeout(_restoreIntelFlags, 500); return; }
  _loadIntelFlags().forEach(f => _placeVlmMarker(f.lat, f.lng, f.label, f.type, f.text, f.id, f.ts));
}
setTimeout(_restoreIntelFlags, 800);

async function _analyzeWithOllama(imageDataUrl, dateLabel, aoi, pastContext = '', bbox = null) {
  const b64 = imageDataUrl.split(',')[1];

  // Build coordinate reference block for satellite image
  let geoRef = '';
  if (bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const latSpan = (maxLat - minLat).toFixed(4);
    const lngSpan = (maxLng - minLng).toFixed(4);
    geoRef = `
GEOGRAPHIC REFERENCE:
  SW corner: ${minLat.toFixed(4)}°N, ${minLng.toFixed(4)}°E
  NE corner: ${maxLat.toFixed(4)}°N, ${maxLng.toFixed(4)}°E
  Center:    ${((minLat+maxLat)/2).toFixed(4)}°N, ${((minLng+maxLng)/2).toFixed(4)}°E
  Coverage:  ${latSpan}° lat × ${lngSpan}° lng (~${(parseFloat(latSpan)*111).toFixed(0)} km N-S, ${(parseFloat(lngSpan)*111*Math.cos((minLat+maxLat)/2*Math.PI/180)).toFixed(0)} km E-W)
  Scale:     image top-left = NW corner, bottom-right = SE corner
  Region:    Strait of Hormuz / Persian Gulf approach

Use these coordinates to give lat/lng for every detection. x=0,y=0 is SW mapped to (${minLat}°N,${minLng}°E); x=1,y=0 is SE (${minLat}°N,${maxLng}°E); x=0,y=1 is NW (${maxLat}°N,${minLng}°E).`;
  }

  const structuredNote = bbox ? `
${geoRef}

Return your response as JSON with this exact structure — no markdown, no extra text:
{
  "analysis": "your full text analysis here",
  "detections": [
    {"type": "aircraft|helicopter|vessel", "class": "wide-body|narrow-body|fighter-sized|military-transport|tanker|small-vessel", "x": 0.0, "y": 0.0, "confidence": 0.0, "lat": 0.0, "lng": 0.0, "notes": "brief description"}
  ]
}
x and y are normalized image coordinates (0.0=left/top, 1.0=right/bottom). lat and lng are geographic coordinates calculated from x/y using the bounding box above. Only include detections you can actually see.` : '';

  const prompt = `You are an objective satellite imagery analyst. This is a Sentinel-2 true-color image (10m resolution) taken ${dateLabel}. Describe only what you can actually see.${bbox ? `\n${geoRef}` : `\nApproximate location: ${aoi}`}

Report exactly what you observe:
- VESSELS: Count each one. Size (large >200m, medium, small). Anchored or underway — wake visible? Heading? Give lat/lng estimate for each.
- AIRCRAFT PASS 1 — OPEN AREAS: Count every aircraft on open tarmac, taxiways, runways, aprons.
- AIRCRAFT PASS 2 — TERMINAL BUILDINGS: Look at every building and terminal edge for nose-in parked aircraft — wings sticking out sideways from building edges. Easy to miss.
- AIRCRAFT PASS 3 — EDGES AND SHADOWS: Check frame edges for partials. Cross-shaped shadows confirm aircraft.
- AIRCRAFT TOTAL: Sum all three passes, no double-counting. State as "TOTAL: X". Wing shape: straight = prop/trainer NOT a jet; swept/delta = fighter jet; T-tail = transport; huge span = airliner. List each: location, wing shape, size, classification, lat/lng, confidence 1–5.
- PORT / AIRFIELD INFRASTRUCTURE: Docks, loading arms, storage tanks, hangars, runways, buildings.
- LAND FEATURES: Roads, vehicles, construction, terrain type.
- CONFIDENCE: Rate 1–5 per observation.${pastContext}${structuredNote}
When finished write ---END--- on its own line.`;

  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [{ role: 'user', content: prompt, images: [b64] }],
      stream: true,
      options: { repeat_penalty: 1.5, temperature: 0.1 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const reader2 = res.body.getReader();
  const decoder2 = new TextDecoder('utf-8', { fatal: false });
  let raw = '';
  let buf2 = '';
  while (true) {
    const { done, value } = await reader2.read();
    if (done) break;
    buf2 += decoder2.decode(value, { stream: true });
    const lines = buf2.split('\n');
    buf2 = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const chunk = JSON.parse(line);
        raw += chunk.message?.content ?? '';
        if (chunk.done) { reader2.cancel(); break; }
      } catch {}
    }
  }

  // Try to parse structured JSON response and place map markers
  if (bbox) {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const [minLng, minLat, maxLng, maxLat] = bbox;
        _clearVlmMarkers();
        (parsed.detections ?? []).forEach((d) => {
          if (d.confidence < 0.3) return;
          // Prefer explicit lat/lng from model; fall back to x/y normalized coords
          const lat = (d.lat != null) ? d.lat : (maxLat - d.y * (maxLat - minLat));
          const lng = (d.lng != null) ? d.lng : (minLng + d.x * (maxLng - minLng));
          const label = `${d.class ?? d.type} (${Math.round(d.confidence * 100)}%)`;
          _placeVlmMarker(lat, lng, label, d.type);
        });
        return parsed.analysis ?? raw;
      }
    } catch(e) { /* fallback to raw text */ }
  }
  return raw;
}

// ── Sentinel panel state ──────────────────────────────────────────────────────
const _sentinelImages = []; // { dataUrl, label, from, to }
let _sentinelMode = 'single'; // 'single' | 'compare'
let _sentinelActive = null;   // index of single-view selected thumb
let _sentinelCompareA = null; // index
let _sentinelCompareB = null; // index
let _sentinelBbox = null;
let _sentinelCenter = null;
let _sentinelAoi = '';

function _sentinelSelectThumb(idx) {
  const thumbs = document.querySelectorAll('.sentinel-thumb');
  if (_sentinelMode === 'single') {
    _sentinelActive = idx;
    thumbs.forEach((t, i) => { t.classList.toggle('active', i === idx); t.classList.remove('compare-a','compare-b'); });
    const img = document.getElementById('sentinel-main-img');
    if (img && _sentinelImages[idx]) {
      img.src = _sentinelImages[idx].dataUrl;
      const b = document.getElementById('sentinel-brightness')?.value ?? 75;
      const c = document.getElementById('sentinel-contrast')?.value ?? 150;
      img.style.filter = `brightness(${b}%) contrast(${c}%)`;
    }
    document.getElementById('sentinel-single').classList.remove('hidden');
    document.getElementById('sentinel-compare').classList.remove('active');
    document.getElementById('sentinel-analysis-overlay').classList.remove('visible');
  } else {
    // compare mode — first click = A, second = B
    if (_sentinelCompareA === null || (_sentinelCompareA !== null && _sentinelCompareB !== null)) {
      // reset
      _sentinelCompareA = idx; _sentinelCompareB = null;
      thumbs.forEach(t => t.classList.remove('compare-a','compare-b','active'));
      thumbs[idx]?.classList.add('compare-a');
      document.getElementById('sentinel-compare-hint').textContent = 'Now click a second thumbnail for BEFORE image';
    } else if (idx !== _sentinelCompareA) {
      _sentinelCompareB = idx;
      thumbs[idx]?.classList.add('compare-b');

      // Always put BEFORE (older date) on left, AFTER (newer) on right
      const pickedA = _sentinelImages[_sentinelCompareA];
      const pickedB = _sentinelImages[_sentinelCompareB];
      const before = (pickedA.from <= pickedB.from) ? pickedA : pickedB;
      const after  = (pickedA.from <= pickedB.from) ? pickedB : pickedA;
      // Store canonical before/after for ANALYZE
      _sentinelCompareA = _sentinelImages.indexOf(after);
      _sentinelCompareB = _sentinelImages.indexOf(before);

      const imgA = document.getElementById('sentinel-img-a');
      const imgB = document.getElementById('sentinel-img-b');
      if (imgA) imgA.src = before.dataUrl;  // left = BEFORE
      if (imgB) imgB.src = after.dataUrl;   // right = AFTER
      const labelA = document.getElementById('sentinel-label-a');
      const labelB = document.getElementById('sentinel-label-b');
      if (labelA) labelA.textContent = `BEFORE  ${before.label}`;
      if (labelB) labelB.textContent = `AFTER  ${after.label}`;
      document.getElementById('sentinel-single').classList.add('hidden');
      const cmp = document.getElementById('sentinel-compare');
      cmp.classList.add('active');
      const divider = document.getElementById('sentinel-compare-divider');
      divider.style.left = '50%';
      const bPane = document.getElementById('sentinel-compare-b');
      bPane.style.clipPath = 'inset(0 0 0 50%)';
      document.getElementById('sentinel-compare-hint').textContent =
        `${before.label}  ◀|▶  ${after.label} — drag to compare`;
    }
  }
}

// Compare slider drag
(function() {
  let dragging = false;
  document.getElementById('sentinel-compare-divider')?.addEventListener('mousedown', e => { dragging = true; e.preventDefault(); });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const cmp = document.getElementById('sentinel-compare');
    if (!cmp) return;
    const rect = cmp.getBoundingClientRect();
    const pct = Math.max(5, Math.min(95, (e.clientX - rect.left) / rect.width * 100));
    document.getElementById('sentinel-compare-divider').style.left = `${pct}%`;
    const bPane = document.getElementById('sentinel-compare-b');
    if (bPane) bPane.style.clipPath = `inset(0 0 0 ${pct}%)`;
  });
  document.addEventListener('mouseup', () => { dragging = false; });
  // touch support
  document.getElementById('sentinel-compare-divider')?.addEventListener('touchstart', e => { dragging = true; e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', e => {
    if (!dragging) return;
    const cmp = document.getElementById('sentinel-compare');
    if (!cmp) return;
    const rect = cmp.getBoundingClientRect();
    const pct = Math.max(5, Math.min(95, (e.touches[0].clientX - rect.left) / rect.width * 100));
    document.getElementById('sentinel-compare-divider').style.left = `${pct}%`;
    const bPane = document.getElementById('sentinel-compare-b');
    if (bPane) bPane.style.clipPath = `inset(0 0 0 ${pct}%)`;
  }, { passive: true });
  document.addEventListener('touchend', () => { dragging = false; });
})();

// Mode toggle buttons
document.getElementById('sentinel-btn-single')?.addEventListener('click', () => {
  _sentinelMode = 'single';
  document.getElementById('sentinel-btn-single').classList.add('active');
  document.getElementById('sentinel-btn-compare').classList.remove('active');
  document.getElementById('sentinel-compare-hint').textContent = 'Click a thumbnail to view · In COMPARE mode click two';
  document.querySelectorAll('.sentinel-thumb').forEach(t => t.classList.remove('compare-a','compare-b'));
  _sentinelCompareA = null; _sentinelCompareB = null;
  _setSentinelSliderMode('single');
  if (_sentinelActive !== null) _sentinelSelectThumb(_sentinelActive);
});

document.getElementById('sentinel-btn-compare')?.addEventListener('click', () => {
  _sentinelMode = 'compare';
  document.getElementById('sentinel-btn-compare').classList.add('active');
  document.getElementById('sentinel-btn-single').classList.remove('active');
  _sentinelCompareA = null; _sentinelCompareB = null;
  document.querySelectorAll('.sentinel-thumb').forEach(t => t.classList.remove('compare-a','compare-b','active'));
  document.getElementById('sentinel-compare-hint').textContent = 'Click AFTER thumbnail first, then BEFORE';
  _setSentinelSliderMode('compare');
});

// Change-circle layer — cleared on each new analysis
const _changeCircles = [];
function _clearChangeCircles() {
  _changeCircles.forEach(c => game.map?.removeLayer(c));
  _changeCircles.length = 0;
}

// Grid cells: row 0=top, col 0=left — maps "R0C1" → lat/lng center of that cell
function _drawChangeCircles(text, bbox) {
  if (!bbox || !game.map) return;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  // Small circle — ~12% of one grid cell's diagonal
  const cellDiag = game.map.distance([minLat, minLng], [minLat + latSpan/3, minLng + lngSpan/3]);
  const radiusM = cellDiag * 0.12;

  // Match [R0C1], **R0C1**, R0C1: — whatever format the model uses
  const gridMatches = [...text.matchAll(/[\[*\s]?R([0-2])C([0-2])[\]*:\s]/gi)];
  const drawn = new Set();

  gridMatches.forEach(m => {
    const row = parseInt(m[1]); // 0=top, 2=bottom
    const col = parseInt(m[2]); // 0=left, 2=right
    const lat = maxLat - (row + 0.5) * (latSpan / 3);
    const lng = minLng + (col + 0.5) * (lngSpan / 3);
    const key = `${row},${col}`;
    if (drawn.has(key)) return;
    drawn.add(key);
    const circle = L.circle([lat, lng], {
      radius: radiusM, color: '#ffaa33', weight: 2,
      fillColor: '#ffaa33', fillOpacity: 0.10, dashArray: '6 4', interactive: false,
    }).addTo(game.map);
    _changeCircles.push(circle);
  });

  // Fallback: direction keywords if model ignored the grid format
  if (drawn.size === 0) {
    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    const latH   = latSpan / 2;
    const lngH   = lngSpan / 2;
    const zones = {
      'upper-left':   [maxLat - latSpan*0.17, minLng + lngSpan*0.17],
      'upper-center': [maxLat - latSpan*0.17, midLng],
      'upper-right':  [maxLat - latSpan*0.17, maxLng - lngSpan*0.17],
      'middle-left':  [midLat, minLng + lngSpan*0.17],
      'center':       [midLat, midLng],
      'middle-right': [midLat, maxLng - lngSpan*0.17],
      'lower-left':   [minLat + latSpan*0.17, minLng + lngSpan*0.17],
      'lower-center': [minLat + latSpan*0.17, midLng],
      'lower-right':  [minLat + latSpan*0.17, maxLng - lngSpan*0.17],
      'north':   [maxLat - latH*0.4, midLng],
      'south':   [minLat + latH*0.4, midLng],
      'east':    [midLat, maxLng - lngH*0.4],
      'west':    [midLat, minLng + lngH*0.4],
      'northwest':[maxLat - latH*0.4, minLng + lngH*0.4],
      'northeast':[maxLat - latH*0.4, maxLng - lngH*0.4],
      'southwest':[minLat + latH*0.4, minLng + lngH*0.4],
      'southeast':[minLat + latH*0.4, maxLng - lngH*0.4],
    };
    const lower = text.toLowerCase();
    Object.entries(zones).forEach(([keyword, [lat, lng]]) => {
      if (!lower.includes(keyword)) return;
      const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
      if (drawn.has(key)) return;
      drawn.add(key);
      const circle = L.circle([lat, lng], {
        radius: radiusM, color: '#ffaa33', weight: 2,
        fillColor: '#ffaa33', fillOpacity: 0.10, dashArray: '6 4', interactive: false,
      }).addTo(game.map);
      _changeCircles.push(circle);
    });
  }
}

// Build a pixel-difference image: bright = changed, dark = unchanged.
// Draws a 3x3 grid overlay so the VLM can reference cells by [RxCy].
function _makeDiffImage(dataUrlBefore, dataUrlAfter) {
  return new Promise((resolve) => {
    const imgB = new window.Image();
    const imgA = new window.Image();
    let loaded = 0;
    const onload = () => {
      if (++loaded < 2) return;
      const W = imgB.width, H = imgB.height;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');

      // Draw BEFORE
      ctx.drawImage(imgB, 0, 0, W, H);
      // Subtract AFTER using 'difference' blend — bright pixels = changed areas
      ctx.globalCompositeOperation = 'difference';
      ctx.drawImage(imgA, 0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';

      // Boost contrast so subtle changes pop
      const id = ctx.getImageData(0, 0, W, H);
      const d  = id.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i]   = Math.min(255, d[i]   * 3);
        d[i+1] = Math.min(255, d[i+1] * 3);
        d[i+2] = Math.min(255, d[i+2] * 3);
      }
      ctx.putImageData(id, 0, 0);

      // Draw 3x3 grid lines + cell labels so VLM knows the coordinate system
      ctx.strokeStyle = 'rgba(255,255,100,0.5)';
      ctx.lineWidth = 1;
      const cw = W / 3, ch = H / 3;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(i * cw, 0); ctx.lineTo(i * cw, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * ch); ctx.lineTo(W, i * ch); ctx.stroke();
      }
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = 'rgba(255,255,100,0.8)';
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        ctx.fillText(`R${r}C${c}`, c * cw + 4, r * ch + 16);
      }

      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    imgB.onload = onload; imgA.onload = onload;
    imgB.src = dataUrlBefore;
    imgA.src = dataUrlAfter;
  });
}

document.getElementById('sentinel-btn-analyze')?.addEventListener('click', async () => {
  const overlay = document.getElementById('sentinel-analysis-overlay');

  if (!_ollamaReady) {
    document.getElementById('sentinel-status').textContent = `${OLLAMA_MODEL} still loading...`;
    return;
  }

  // COMPARE mode — send both images and ask what changed
  if (_sentinelMode === 'compare' && _sentinelCompareA !== null && _sentinelCompareB !== null) {
    const imgA = _sentinelImages[_sentinelCompareA]; // AFTER
    const imgB = _sentinelImages[_sentinelCompareB]; // BEFORE
    if (!imgA || !imgB) { document.getElementById('sentinel-status').textContent = 'Select two images first.'; return; }

    overlay.textContent = '⟳ Comparing images...';
    overlay.classList.add('visible');
    _clearChangeCircles();

    try {
      // Build pixel-diff image: bright = changed, dark = unchanged
      // Grid labels R0C0..R2C2 are burned in so VLM can reference them directly
      const diffUrl = await _makeDiffImage(imgB.dataUrl, imgA.dataUrl);
      const b64Diff = diffUrl.split(',')[1];

      const prompt = `This is a PIXEL DIFFERENCE image of two satellite photos (${imgB.label} vs ${imgA.label}).
Bright/white/colored areas = pixels that changed. Dark/black = no change.
Grid cells are labeled in yellow (R0C0 through R2C2).

Reply in plain text only, no markdown, no bullet symbols.
List ONLY cells with visible bright areas, one per line like this:
R0C1 — bright spot, possible aircraft movement
R2C2 — color shift, cloud or surface change

Skip dark cells. Max 4 lines. If all dark: NO CHANGES DETECTED.`;

      const res = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [{ role: 'user', content: prompt, images: [b64Diff] }],
          stream: false,
          options: { temperature: 0.1, num_predict: 300 },
        }),
      });
      const data = await res.json();
      const text = data.message?.content ?? 'No response';
      overlay.textContent = `CHANGES (${imgB.label} → ${imgA.label}):\n\n${text}`;
      _drawChangeCircles(text, _sentinelBbox);
      ui.addLog('SENTINEL CHANGE', text.slice(0, 180), 'adjudication');
    } catch(e) {
      overlay.textContent = `Error: ${e.message}`;
    }
    return;
  }

  // SINGLE mode — describe what's in the image
  const idx = _sentinelActive;
  if (idx === null || !_sentinelImages[idx]) {
    document.getElementById('sentinel-status').textContent = 'Select an image first.';
    return;
  }
  overlay.innerHTML = '<span style="color:#7788aa">⟳ Analyzing...</span>';
  overlay.classList.add('visible');
  try {
    const img = _sentinelImages[idx];
    const b64 = img.dataUrl.split(',')[1];

    function satAsk(q) {
      return fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [{ role: 'user', content: q, images: [b64] }],
          stream: false,
          options: { temperature: 0.1, num_predict: 350 },
        }),
      }).then(r => r.json()).then(d => d.message?.content ?? '');
    }

    const [descReply] = await Promise.all([
      satAsk(`Satellite image of ${_sentinelAoi} taken ${img.label}. What do you see? Describe vessels, aircraft, and any notable activity. Keep it brief, no markdown.`),
    ]);

    // Count detections mentioned in the description for button label
    const pending = [];
    const descLower = descReply.toLowerCase();
    const vesselCount = (descLower.match(/\bvessel|\bship|\btanker|\bboat/g) ?? []).length;
    const aircraftCount = (descLower.match(/\baircraft|\bplane|\bjet|\bhelicopter/g) ?? []).length;
    if (vesselCount + aircraftCount > 0) pending.push(1); // just need truthy for button

    const countStr = pending.length ? ` · ${pending.length} detection${pending.length > 1 ? 's' : ''}` : '';
    overlay.innerHTML = `<div style="white-space:pre-wrap;margin-bottom:8px">${descReply}</div>` +
      (pending.length
        ? `<button id="sentinel-confirm-btn" style="background:#1a3a1a;border:1px solid #44cc88;color:#44cc88;font-family:'Courier New',monospace;font-size:11px;padding:4px 14px;cursor:pointer;letter-spacing:1px">✓ CONFIRM — PLOT ${pending.length} DETECTION${pending.length > 1 ? 'S' : ''} ON MAP</button>`
        : '');

    if (pending.length) {
      document.getElementById('sentinel-confirm-btn')?.addEventListener('click', () => {
        _clearVlmMarkers();
        // Single clickable flag at the sentinel center — popup shows full analysis
        const lat = _sentinelCenter?.lat ?? (_sentinelBbox ? (_sentinelBbox[1] + _sentinelBbox[3]) / 2 : 0);
        const lng = _sentinelCenter?.lng ?? (_sentinelBbox ? (_sentinelBbox[0] + _sentinelBbox[2]) / 2 : 0);
        _addPersistentFlag(lat, lng, `SAT ${img.label}`, 'intel', descReply);
        const btn = document.getElementById('sentinel-confirm-btn');
        if (btn) { btn.textContent = '✓ FLAG PLACED — CLICK MARKER ON MAP'; btn.style.color = '#7788aa'; btn.style.borderColor = '#1a3a5a'; btn.disabled = true; }
      });
    }

    await _saveIntel(_sentinelCenter.lat, _sentinelCenter.lng, _sentinelAoi, img.label, 'sentinel', descReply);
    ui.addLog('SENTINEL INTEL', `${img.label}${countStr} — ${descReply.slice(0,160)}…`, 'adjudication');
  } catch(e) {
    overlay.innerHTML = `<span style="color:#ff6666">Error: ${e.message}</span>`;
  }
});

document.getElementById('sentinel-btn').addEventListener('click', async () => {
  const btn      = document.getElementById('sentinel-btn');
  const panel    = document.getElementById('sentinel-panel');
  const status   = document.getElementById('sentinel-status');
  const strip    = document.getElementById('sentinel-filmstrip');
  const aoiLabel = document.getElementById('sentinel-aoi-label');

  if (btn.classList.contains('loading')) return;

  const bounds = game.map?.getBounds();
  const center = game.map?.getCenter();
  if (!bounds || !center) return;

  _sentinelBbox = [
    +bounds.getWest().toFixed(4), +bounds.getSouth().toFixed(4),
    +bounds.getEast().toFixed(4), +bounds.getNorth().toFixed(4),
  ];
  _sentinelCenter = center;
  _sentinelAoi = `${center.lat.toFixed(2)}°N ${center.lng.toFixed(2)}°E`;
  aoiLabel.textContent = _sentinelAoi;

  btn.classList.add('loading');
  btn.textContent = '🛰 LOADING...';
  strip.innerHTML = '';
  _sentinelImages.length = 0;
  _sentinelActive = null; _sentinelCompareA = null; _sentinelCompareB = null;
  document.getElementById('sentinel-main-img').src = '';
  document.getElementById('sentinel-img-a').src = '';
  document.getElementById('sentinel-img-b').src = '';
  const la = document.getElementById('sentinel-label-a'); if (la) la.textContent = '';
  const lb = document.getElementById('sentinel-label-b'); if (lb) lb.textContent = '';
  document.getElementById('sentinel-analysis-overlay').classList.remove('visible');
  document.getElementById('sentinel-analysis-overlay').textContent = '';
  document.getElementById('sentinel-compare').classList.remove('active');
  document.getElementById('sentinel-single').classList.remove('hidden');
  document.getElementById('sentinel-compare-hint').textContent = 'Click AFTER thumbnail first, then BEFORE';
  _clearChangeCircles();
  status.textContent = 'Authenticating with Sentinel Hub...';
  panel.classList.add('visible');

  status.textContent = `Fetching imagery over ${_sentinelAoi}...`;

  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  }

  const today = new Date();
  function daysAgo(n) {
    const d = new Date(today); d.setDate(today.getDate() - n);
    return d.toISOString().slice(0, 10);
  }
  function dateLabel(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  }

  // 5 Sentinel-2 windows (non-overlapping ~4-day periods) — fetched sequentially to avoid rate limits
  const s2Windows = [
    { from: daysAgo(4),  to: daysAgo(0)  },
    { from: daysAgo(8),  to: daysAgo(5)  },
    { from: daysAgo(12), to: daysAgo(9)  },
    { from: daysAgo(16), to: daysAgo(13) },
    { from: daysAgo(20), to: daysAgo(17) },
  ];

  // 15 MODIS daily passes — fetched in parallel (free, no rate limit)
  const modisdays = Array.from({length: 15}, (_, i) => daysAgo(i));

  strip.innerHTML = '';
  let fetchedCount = 0;

  function addThumb(imgDataUrl, label, source, sourceColor) {
    const imgIdx = _sentinelImages.length;
    _sentinelImages.push({ dataUrl: imgDataUrl, label, source, from: label.slice(0, 10) });
    fetchedCount++;
    const color = sourceColor ?? (source === 'S2' ? '#44cc88' : '#ffaa33');
    const sourceTag = source === 'S2' ? 'Sentinel-2 10m'
      : source === 'VIIRS-SNPP' ? 'VIIRS 375m'
      : source === 'MODIS-Aqua' ? 'MODIS-Aqua 250m'
      : 'MODIS-Terra 250m';
    const thumb = document.createElement('div');
    thumb.className = 'sentinel-thumb';
    thumb.innerHTML = `<img src="${imgDataUrl}" draggable="false" style="filter:brightness(${document.getElementById('sentinel-brightness')?.value ?? 100}%) contrast(${document.getElementById('sentinel-contrast')?.value ?? 110}%)">
      <div class="sentinel-thumb-date">${label}</div>
      <div class="sentinel-thumb-analyzing" style="color:${color}">${sourceTag}</div>`;
    thumb.addEventListener('click', () => _sentinelSelectThumb(imgIdx));
    strip.appendChild(thumb);
    if (fetchedCount === 1) setTimeout(() => _sentinelSelectThumb(0), 50);
  }

  // Fetch Sentinel-2 windows one at a time to avoid hammering the API
  for (const w of s2Windows) {
    try {
      const img = await withTimeout(_fetchSentinelImage(_sentinelBbox, w.from, w.to), 25000);
      addThumb(img, `${dateLabel(w.from)} – ${dateLabel(w.to)}`, 'S2');
    } catch(e) {
      console.warn(`[S2] ${w.from}→${w.to} failed: ${e.message}`);
    }
  }

  // Fetch all three GIBS layers per day in parallel — Terra, Aqua, VIIRS
  const gibisTasks = modisdays.flatMap(d =>
    GIBS_LAYERS.map((_, li) =>
      withTimeout(_fetchGibsImage(_sentinelBbox, d, li), 12000)
        .then(r => ({ dataUrl: r.dataUrl, label: `${dateLabel(d)} ${r.layerLabel}`, layerLabel: r.layerLabel }))
    )
  );
  const gibsResults = await Promise.allSettled(gibisTasks);
  gibsResults.forEach(r => {
    if (r.status === 'fulfilled') {
      const color = r.value.layerLabel === 'VIIRS-SNPP' ? '#66aaff' : '#ffaa33';
      addThumb(r.value.dataUrl, r.value.label, r.value.layerLabel, color);
    }
  });

  status.textContent = fetchedCount > 0
    ? `${fetchedCount} images loaded (${s2Windows.length} Sentinel-2 + MODIS daily) — select then ANALYZE`
    : 'No imagery found. Try zooming out.';

  btn.classList.remove('loading');
  btn.textContent = '🛰 SENTINEL';
});

document.getElementById('sentinel-panel-close').addEventListener('click', () => {
  document.getElementById('sentinel-panel').classList.remove('visible');
});

function _applySentinelFilter() {
  const b = document.getElementById('sentinel-brightness').value;
  const c = document.getElementById('sentinel-contrast').value;
  document.getElementById('sentinel-brightness-val').textContent = b + '%';
  document.getElementById('sentinel-contrast-val').textContent   = c + '%';
  const filter = `brightness(${b}%) contrast(${c}%)`;
  document.getElementById('sentinel-main-img').style.filter = filter;
  document.querySelectorAll('.sentinel-thumb img').forEach(img => img.style.filter = filter);
  // In single mode also keep compare panes in sync
  if (_sentinelMode === 'single') {
    document.getElementById('sentinel-img-a').style.filter = filter;
    document.getElementById('sentinel-img-b').style.filter = filter;
  }
}
function _applyCmpFilter() {
  const bA = document.getElementById('cmp-brightness-a').value;
  const cA = document.getElementById('cmp-contrast-a').value;
  const bB = document.getElementById('cmp-brightness-b').value;
  const cB = document.getElementById('cmp-contrast-b').value;
  document.getElementById('sentinel-img-a').style.filter = `brightness(${bA}%) contrast(${cA}%)`;
  document.getElementById('sentinel-img-b').style.filter = `brightness(${bB}%) contrast(${cB}%)`;
}
document.getElementById('sentinel-brightness').addEventListener('input', _applySentinelFilter);
document.getElementById('sentinel-contrast').addEventListener('input', _applySentinelFilter);
['cmp-brightness-a','cmp-contrast-a','cmp-brightness-b','cmp-contrast-b'].forEach(id =>
  document.getElementById(id).addEventListener('input', _applyCmpFilter)
);

function _setSentinelSliderMode(mode) {
  document.getElementById('sentinel-sliders-single').style.display  = mode === 'single'  ? 'inline-flex' : 'none';
  document.getElementById('sentinel-sliders-compare').style.display = mode === 'compare' ? 'inline-flex' : 'none';
}
_applySentinelFilter(); // apply defaults on load

// ── Intel Chat (RAG-grounded) ────────────────────────────────────────────────
const CHAT_RAG  = 'http://localhost:8001/intel/query';
const CHAT_LLM  = 'http://localhost:11434/api/generate';
const CHAT_MODEL = 'llama3.1:8b';

document.getElementById('tab-wargame').addEventListener('click', () => {
  document.getElementById('tab-wargame').classList.add('active');
  document.getElementById('tab-chat').classList.remove('active');
  document.getElementById('panel-wargame').style.display = 'flex';
  document.getElementById('panel-chat').classList.remove('visible');
});
document.getElementById('tab-chat').addEventListener('click', () => {
  document.getElementById('tab-chat').classList.add('active');
  document.getElementById('tab-wargame').classList.remove('active');
  document.getElementById('panel-wargame').style.display = 'none';
  document.getElementById('panel-chat').classList.add('visible');
  document.getElementById('chat-input').focus();
});

async function _chatSend() {
  const input = document.getElementById('chat-input');
  const q = input.value.trim();
  if (!q) return;
  input.value = '';
  const sendBtn = document.getElementById('chat-send');
  sendBtn.disabled = true;

  const msgs = document.getElementById('chat-messages');
  const ctxEl = document.getElementById('chat-context-count');

  // User message
  const userEl = document.createElement('div');
  userEl.className = 'chat-msg chat-msg-user';
  userEl.textContent = q;
  msgs.appendChild(userEl);
  msgs.scrollTop = msgs.scrollHeight;

  // Query RAG
  let context = '';
  let ctxCount = 0;
  try {
    const r = await fetch(CHAT_RAG, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({query: q, n: 8}) });
    const d = await r.json();
    const results = d.results || [];
    ctxCount = results.length;
    context = results.map(x => x.text).join('\n\n');
  } catch(e) { /* RAG offline — answer from model only */ }

  ctxEl.textContent = ctxCount > 0 ? `CONTEXT: ${ctxCount} intel docs retrieved` : 'RAG OFFLINE — answering from model knowledge';

  // AI response bubble
  const aiEl = document.createElement('div');
  aiEl.className = 'chat-msg chat-msg-ai streaming';
  aiEl.innerHTML = '<div class="chat-source">HORMUZ INTEL // ' + CHAT_MODEL.toUpperCase() + '</div><div class="chat-text"></div>';
  msgs.appendChild(aiEl);
  const textEl = aiEl.querySelector('.chat-text');
  msgs.scrollTop = msgs.scrollHeight;

  const systemPrompt = context
    ? `You are a Strait of Hormuz intelligence analyst. Answer using ONLY the provided intel context. Be concise and direct. Military format.\n\nINTEL CONTEXT:\n${context}`
    : `You are a Strait of Hormuz intelligence analyst. Answer concisely in military format.`;

  try {
    const res = await fetch(CHAT_LLM, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ model: CHAT_MODEL, prompt: `${systemPrompt}\n\nQUESTION: ${q}\nANSWER:`, stream: true })
    });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of dec.decode(value).split('\n')) {
        if (!line.trim()) continue;
        try {
          const j = JSON.parse(line);
          if (j.response) { full += j.response; textEl.textContent = full; msgs.scrollTop = msgs.scrollHeight; }
        } catch {}
      }
    }
  } catch(e) {
    textEl.textContent = 'Ollama offline — start it on this machine first.';
  }

  aiEl.classList.remove('streaming');
  sendBtn.disabled = false;
  input.focus();
}

document.getElementById('chat-send').addEventListener('click', _chatSend);
document.getElementById('chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _chatSend(); }
});
