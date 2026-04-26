let activeExercise = null;

function renderScenarioCards() {
  const container = document.getElementById('scenario-cards');
  if (!container) return;
  container.innerHTML = '';
  for (const s of SCENARIOS) {
    const card = document.createElement('div');
    card.style.cssText = `
      border:1px solid ${s.rungColor}66; padding:10px 12px; margin-bottom:8px;
      cursor:pointer; transition:all 0.15s; background:rgba(255,170,0,0.04)`;
    card.innerHTML = `
      <div style="color:${s.rungColor};font-size:11px;letter-spacing:2px;font-weight:bold">${s.rung}</div>
      <div style="color:#e0e8f0;font-size:13px;margin:4px 0">${s.title}</div>
      <div style="color:#7a8896;font-size:10px;line-height:1.4">${s.summary.substring(0, 120)}…</div>
    `;
    card.addEventListener('mouseenter', () => card.style.background = 'rgba(255,170,0,0.12)');
    card.addEventListener('mouseleave', () => card.style.background = 'rgba(255,170,0,0.04)');
    card.addEventListener('click', () => startExercise(s.id));
    container.appendChild(card);
  }
}

// Scenario-specific map dressings (mines, threat zones) — placed at startExercise
const _scenarioMapMarkers = [];
function _addScenarioMarker(marker) { _scenarioMapMarkers.push(marker); }
function _clearScenarioMarkers() {
  if (window.game && window.game.map) {
    _scenarioMapMarkers.forEach(m => { try { window.game.map.removeLayer(m); } catch (e) {} });
  }
  _scenarioMapMarkers.length = 0;
  if (window._activeMines) window._activeMines.length = 0;
}

// Global mine registry — destroyer transit code reads this to sweep mines.
window._activeMines = window._activeMines || [];

function dropMineMarkers(positions) {
  if (!window.game || !window.game.map) return;
  const map = window.game.map;
  for (const p of positions) {
    const icon = L.divIcon({
      className: 'mine-marker',
      html: `<div style="width:18px;height:18px;background:radial-gradient(circle,#ff2200 30%,#660000 70%);border:2px solid #000;border-radius:50%;box-shadow:0 0 10px #ff2200;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:bold;font-family:monospace">M</div>`,
      iconSize: [22, 22], iconAnchor: [11, 11],
    });
    const m = L.marker([p.lat, p.lng], { icon, zIndexOffset: 250 }).addTo(map);
    m.bindPopup(`<div style="font-family:Courier New,monospace;font-size:11px;color:#222"><b style="color:#cc2200">⚠ ${p.label || 'IRGC LIMPET MINE'}</b><br><span style="font-size:10px">${p.note || 'Sub-surface contact mine, M-08 pattern'}</span></div>`);
    _addScenarioMarker(m);
    // Pulsing kill-radius circle
    const ring = L.circle([p.lat, p.lng], { radius: 1200, color:'#ff2200', weight:1.5, dashArray:'4 4', fillOpacity:0.10, interactive:false }).addTo(map);
    _addScenarioMarker(ring);
    // Register in mine registry for the destroyer-transit sweep system
    window._activeMines.push({ lat: p.lat, lng: p.lng, label: p.label, marker: m, ring });
  }
}

function startExercise(scenarioId) {
  activeExercise = new ExerciseState(scenarioId);
  document.getElementById('exercise-scenario-list').style.display = 'none';
  const active = document.getElementById('exercise-active');
  active.style.display = 'flex';
  active.style.flexDirection = 'column';
  document.getElementById('exercise-overlay').style.display = 'block';
  renderActiveExercise();
  if (typeof dimNonKeyVessels === 'function' && activeExercise.scenario.keyVesselCategories) {
    dimNonKeyVessels(activeExercise.scenario.keyVesselCategories);
  }
  renderIndicators();

  // Scenario-specific map dressings
  _clearScenarioMarkers();
  if (scenarioId === 'mining') {
    // Drop mine markers at the historical pattern + the fictional ALPINE CONFIDENCE strike point
    dropMineMarkers([
      { lat: 25.20, lng: 56.40, label: 'LIMPET STRIKE — ALPINE CONFIDENCE', note: 'Detonated. Vessel taking on water. (T0)' },
      { lat: 25.18, lng: 56.42, label: 'INERT LIMPET RECOVERED', note: 'Found on Greek-flagged tanker. Forensic match: IRGC.' },
      { lat: 26.55, lng: 52.20, label: 'HISTORICAL: USS S.B. ROBERTS', note: 'Iranian M-08 mine, 1988. Hull breach + 10 injured.' },
      { lat: 27.80, lng: 50.30, label: 'HISTORICAL: SS BRIDGETON', note: 'First Tanker War mine strike, 1987.' },
    ]);
    // Zoom to show the mine field
    if (window.game && window.game.map) {
      window.game.map.flyToBounds(L.latLngBounds([[25.10,50.00],[28.00,57.00]]), { padding:[60,60], maxZoom:7, duration:1.2 });
    }
  }
}

function endExercise() {
  activeExercise = null;
  document.getElementById('exercise-scenario-list').style.display = 'block';
  document.getElementById('exercise-active').style.display = 'none';
  document.getElementById('exercise-overlay').style.display = 'none';
  if (typeof restoreAllVessels === 'function') restoreAllVessels();
  _clearScenarioMarkers();
  syncLegacyStateStrip();
  renderIndicators();
}

// Escalation rung descriptions — shown on click for each ladder cell
const _RUNG_INFO = [
  { name:'HARASS', color:'#cccc44', desc:'IRGC fast-attack craft probes, harassment, bridge-to-bridge intimidation. No kinetic action against vessels. War-risk premiums tick up modestly. Most strait-of-Hormuz incidents historically sit here.' },
  { name:'SEIZURE', color:'#ffaa00', desc:'IRGC boards and detains a tanker. Crew held. Trigger for joint diplomatic attribution. Examples: Stena Impero (2019), GULF MERIDIAN (this exercise). Insurance +30-100 bps.' },
  { name:'MINING', color:'#ff7700', desc:'Limpet mines or contact mines deployed in shipping lanes. Plausibly deniable. Examples: USS Samuel B. Roberts (1988), Fujairah (2019), Front Altair (2019). Insurance doubles within 72h.' },
  { name:'STRIKE', color:'#cc2222', desc:'Anti-ship missile or cruise-missile attack on a vessel. Attribution unambiguous. Triggers UNSC emergency session. Insurance +400 bps or suspended. Examples: 2024 Houthi attacks on Red Sea shipping, 1987 USS Stark.' },
  { name:'CLOSURE', color:'#ff2200', desc:'Iran formally declares closure or imposes blockade. ~21% of global oil flow halted. Brent +$15-25/bbl. Lloyd\'s suspends all new war-risk writes. Strait of Hormuz is bilaterally closed in this state.' },
  { name:'WAR', color:'#990000', desc:'Open kinetic exchange between Blue and Iranian forces. Air strikes, naval engagements, possible escalation to Iranian missile barrages on Gulf bases. Strait shut. War-risk insurance market collapses entirely.' },
];

let _rungWired = false;
function _wireRungClicks() {
  if (_rungWired) return;
  document.querySelectorAll('#ladder-rungs .rung').forEach((rung, idx) => {
    rung.style.cursor = 'pointer';
    rung.addEventListener('click', (ev) => {
      ev.stopPropagation();
      _showRungPopover(rung, idx);
    });
  });
  _rungWired = true;
}

function _showRungPopover(rungEl, idx) {
  document.querySelectorAll('.rung-popover').forEach(p => p.remove());
  const info = _RUNG_INFO[idx];
  if (!info) return;
  const rect = rungEl.getBoundingClientRect();
  const popover = document.createElement('div');
  popover.className = 'rung-popover';
  popover.style.cssText = `position:fixed;top:${rect.bottom + 8}px;right:20px;width:340px;background:rgba(0,8,16,0.97);border:1px solid ${info.color};border-left:4px solid ${info.color};padding:10px 12px;z-index:9000;font-family:Courier New,monospace;font-size:11px;color:#cce0ff;line-height:1.5;box-shadow:0 4px 16px rgba(0,0,0,0.6)`;
  popover.innerHTML = `<div style="color:${info.color};font-size:11px;letter-spacing:2px;font-weight:bold;margin-bottom:5px">RUNG ${idx} — ${info.name}</div>${info.desc}`;
  document.body.appendChild(popover);
  setTimeout(() => {
    document.addEventListener('click', function once(ev) {
      if (!popover.contains(ev.target)) { popover.remove(); document.removeEventListener('click', once, true); }
    }, true);
  }, 50);
}

// Per-scenario coalition positions. Each entry: { flagId: 'description shown on click' }.
// Hostile = frames the flag in red. Defaults applied if scenario doesn't override.
const _COALITION_POSITIONS_DEFAULT = {
  'cf-uk': { hostile:false, note:'Royal Navy escort assets available. Strong attribution-statement co-signer; cautious on kinetic.' },
  'cf-fr': { hostile:false, note:'Marine Nationale FREMM available. Will co-sign attribution; prefers UN process.' },
  'cf-sa': { hostile:false, note:'Aramco export protection is the priority. Wants U.S. military commitment to strait.' },
  'cf-un': { hostile:false, note:'UNSC emergency session can be triggered. Russia/China veto blocks binding action; non-binding statements possible.' },
  'cf-cn': { hostile:true,  note:'Beijing prefers ambiguity. Will not co-sign attribution. Pulls Iran toward off-ramp only when own crude flow is at risk.' },
};
const _COALITION_POSITIONS_BY_SCENARIO = {
  seizure: {
    'cf-cn': { hostile:true,  note:'China declines to co-sign attribution against Iran in this scenario. Beijing\'s ambiguity is part of the IRGC information strategy.' },
    'cf-sa': { hostile:false, note:'Riyadh wants visible Blue military presence — Aramco shipments are vulnerable while GULF MERIDIAN crisis continues.' },
  },
  mining: {
    'cf-sa': { hostile:false, note:'Riyadh independently moves a destroyer toward the strait by Turn 2. Demands U.S. action; weighing unilateral options if Blue hesitates.' },
    'cf-cn': { hostile:true,  note:'Beijing endorses Tehran\'s Turn 3 dialogue offer. Indicates Chinese willingness to provide Iran diplomatic cover.' },
  },
  strike: {
    'cf-uk': { hostile:false, note:'UK explicitly wants deterrent strike (Turn 3 split). Strongest co-signer on attribution.' },
    'cf-cn': { hostile:true,  note:'China calls for "restraint on all sides" — equivocates between Blue and Tehran on the missile attack.' },
    'cf-sa': { hostile:false, note:'Riyadh wants strikes AND continued convoy operations indefinitely. Most aggressive Blue partner this scenario.' },
  },
  airbase: {
    'cf-cn': { hostile:true,  note:'Beijing publicly denied the joint-exercise cover story (Turn 1 demarche). Privately constrained the China-flagged operator.' },
    'cf-sa': { hostile:false, note:'Saudi ISR contributions accelerate after VLM reveals the strike package. Riyadh wants pre-emptive action.' },
  },
};

function _coalitionPositionFor(flagId) {
  const ex = window.activeExercise;
  const sc = ex && ex.scenario && _COALITION_POSITIONS_BY_SCENARIO[ex.scenario.id];
  return (sc && sc[flagId]) || _COALITION_POSITIONS_DEFAULT[flagId];
}

function _hostileFromCohesion(flagId) {
  const ex = window.activeExercise;
  if (!ex) return false;
  const cohesion = ex.indicators.allianceCohesion ?? 100;
  // Below 50, alliance partners (UK, France, Saudi) start tipping hostile
  if (cohesion < 50 && ['cf-uk','cf-fr','cf-sa'].includes(flagId)) return true;
  return false;
}

function _showCoalitionPopover(flagEl, flagId) {
  document.querySelectorAll('.coalition-popover').forEach(p => p.remove());
  const pos = _coalitionPositionFor(flagId);
  if (!pos) return;
  const rect = flagEl.getBoundingClientRect();
  const isHostile = pos.hostile || _hostileFromCohesion(flagId);
  const color = isHostile ? '#ff6666' : '#66ff99';
  const popover = document.createElement('div');
  popover.className = 'coalition-popover';
  popover.style.cssText = `position:fixed;top:${rect.bottom + 8}px;left:${Math.max(8, rect.left - 80)}px;width:280px;background:rgba(0,8,16,0.97);border:1px solid ${color};border-left:4px solid ${color};padding:10px 12px;z-index:9000;font-family:Courier New,monospace;font-size:11px;color:#cce0ff;line-height:1.5;box-shadow:0 4px 16px rgba(0,0,0,0.6)`;
  popover.innerHTML = `<div style="color:${color};font-size:10px;letter-spacing:2px;margin-bottom:4px">${flagEl.title.toUpperCase()} · ${isHostile ? 'NOT WITH BLUE' : 'WITH BLUE'}</div>${pos.note}`;
  document.body.appendChild(popover);
  setTimeout(() => {
    document.addEventListener('click', function once(ev) {
      if (!popover.contains(ev.target)) { popover.remove(); document.removeEventListener('click', once, true); }
    }, true);
  }, 50);
}

// Wire flag clicks once
let _coalitionWired = false;
function _wireCoalitionFlags() {
  if (_coalitionWired) return;
  document.querySelectorAll('#coalition-bar .cflag').forEach(flag => {
    flag.style.cursor = 'pointer';
    flag.addEventListener('click', (ev) => {
      ev.stopPropagation();
      _showCoalitionPopover(flag, flag.id);
    });
  });
  _coalitionWired = true;
}

// Sync the legacy state strip (escalation ladder + econ bar + coalition) to
// activeExercise.indicators. Called from startExercise / renderActiveExercise / endExercise.
function syncLegacyStateStrip() {
  // Wire coalition + rung click handlers ALWAYS — even when idle (no exercise active),
  // judges should be able to click a flag/rung and read what it means.
  _wireCoalitionFlags();
  _wireRungClicks();
  // Update hostile state on each flag based on scenario + indicator state
  document.querySelectorAll('#coalition-bar .cflag').forEach(flag => {
    const pos = _coalitionPositionFor(flag.id);
    const isHostile = (pos && pos.hostile) || _hostileFromCohesion(flag.id);
    flag.classList.toggle('hostile', isHostile);
  });
  const ladder = document.querySelectorAll('#ladder-rungs .rung');
  const oil  = document.getElementById('econ-oil');
  const bpd  = document.getElementById('econ-bpd');
  const ins  = document.getElementById('econ-insurance');
  const clos = document.getElementById('econ-closure');

  // % of world oil supply held up by strait disruption, indexed by escalation rung.
  // Strait of Hormuz baseline through-flow ≈ 21% of global oil + 28% of LNG.
  // ATRISK_BY_RUNG = how much of that flow is held up at each rung.
  const ATRISK_BY_RUNG = [0, 3, 7, 12, 18, 21]; // HARASS → WAR
  const BPD_BY_RUNG    = [0.0, 0.6, 1.3, 2.2, 3.4, 3.9]; // M BPD held up
  if (!activeExercise) {
    // Idle = current real-world conditions (April 2026): Brent $106, strait
    // "largely closed" per Reuters/Fortune. War-risk shown as an extreme
    // numeric (rather than SUSPENDED) so demo can show live up/down deltas
    // when the user picks decisions.
    ladder.forEach(r => r.classList.remove('current'));
    if (ladder[0]) ladder[0].classList.add('current');
    if (oil)  oil.textContent  = '0% world supply';
    if (bpd)  bpd.textContent  = '$106 Brent · baseline';
    if (ins)  ins.textContent  = '120 bps';
    if (clos) clos.textContent = 'OPEN';
    return;
  }
  const ind = activeExercise.indicators;
  const rung = Math.max(0, Math.min(5, ind.escalationRung || 0));
  ladder.forEach((r, idx) => {
    const wasCurrent = r.classList.contains('current');
    const isCurrent = idx === rung;
    r.classList.toggle('current', isCurrent);
    if (isCurrent) {
      const info = (typeof _RUNG_INFO !== 'undefined' && _RUNG_INFO[idx]) ? _RUNG_INFO[idx] : null;
      if (info) {
        r.style.borderColor = info.color;
        r.style.color       = info.color;
        r.style.background  = info.color + '22';
      }
      if (!wasCurrent) {
        r.style.animation = 'rungFlash 1.0s ease-out';
        setTimeout(() => { r.style.animation = ''; }, 1100);
      }
    } else {
      r.style.borderColor = '';
      r.style.color       = '';
      r.style.background  = '';
    }
  });
  // OIL AT RISK card: % of world supply held up by strait disruption
  const atRiskPct = ATRISK_BY_RUNG[rung] ?? 0;
  const bpdHeld   = BPD_BY_RUNG[rung] ?? 0;
  if (oil)  oil.textContent  = atRiskPct + '% world supply';
  if (bpd)  bpd.textContent  = '$' + ind.oilPrice + ' Brent · ' + bpdHeld.toFixed(1) + 'M BPD held up';
  if (ins)  ins.textContent  = ind.warRiskInsurance + ' bps';
  // Map rung → strait closure status
  const closure = rung >= 4 ? 'CLOSED' : rung >= 2 ? 'CONTESTED' : 'OPEN';
  if (clos) clos.textContent = closure;
}

function renderActiveExercise() {
  if (!activeExercise) return;
  const ex = activeExercise;
  const turn = ex.currentTurn();
  syncLegacyStateStrip();
  const aiBadge = turn._aiGenerated
    ? `<span style="display:inline-block;background:rgba(102,255,153,0.16);color:#66ff99;font-size:9px;letter-spacing:2px;padding:2px 6px;border:1px solid #66ff9966;margin-left:8px">⟳ AI-ADJUDICATED</span>`
    : turn._branched
    ? `<span style="display:inline-block;background:rgba(255,170,68,0.16);color:#ffaa44;font-size:9px;letter-spacing:2px;padding:2px 6px;border:1px solid #ffaa4466;margin-left:8px">⤴ BRANCH: ${turn._branched.toUpperCase()}</span>`
    : `<span style="display:inline-block;background:rgba(170,170,170,0.10);color:#aabbcc;font-size:9px;letter-spacing:2px;padding:2px 6px;border:1px solid #aabbcc44;margin-left:8px">SCRIPTED</span>`;

  document.getElementById('exercise-brief').innerHTML = `
    <div style="color:${ex.scenario.rungColor};font-size:11px;letter-spacing:2px;margin-bottom:6px">${ex.scenario.rung} — ${ex.scenario.threat}${aiBadge}</div>
    <div style="color:#e0e8f0;font-size:13px;margin-bottom:8px;font-weight:bold">${ex.scenario.title}</div>
    <div style="color:#a0b0c0;font-size:11px;line-height:1.5;margin-bottom:8px">${turn.inject}</div>
  `;

  const decContainer = document.getElementById('exercise-decisions');
  decContainer.innerHTML = `<div style="color:#ff8800;font-size:10px;letter-spacing:2px;margin:8px 0 6px">// CHOOSE ONE — TURN ${ex.turn} OF ${ex.scenario.turns.length} //</div>`;
  const laneColors = { DIPLOMATIC:'#ffcc66', INFORMATION:'#cc66ff', MILITARY:'#ff6666', ECONOMIC:'#66ccff', INTELLIGENCE:'#66ff99' };
  for (const dec of ex.currentTurnDecisions()) {
    const card = document.createElement('div');
    const c = laneColors[dec.lane] || '#cccccc';
    card.style.cssText = `border:1px solid ${c}55; padding:8px 10px; margin-bottom:6px; cursor:pointer; transition:background 0.1s;`;
    card.innerHTML = `
      <div style="color:${c};font-size:9px;letter-spacing:2px;font-weight:bold">${dec.lane}</div>
      <div style="color:#e0e8f0;font-size:12px;margin-top:3px">${dec.title}</div>
    `;
    card.addEventListener('mouseenter', () => card.style.background = `${c}15`);
    card.addEventListener('mouseleave', () => card.style.background = 'transparent');
    card.addEventListener('click', () => onDecisionPicked(dec));
    decContainer.appendChild(card);
  }

  renderOverlay();
  renderIndicators();
}

async function onDecisionPicked(dec) {
  if (!activeExercise) return;
  // VLM target — pan map; if interactive, also enter draw-to-select VLM mode
  if (dec.vlmTarget) {
    const map = (window.game && window.game.map) || (window.gameInstance && window.gameInstance._map);
    if (map && typeof map.flyTo === 'function') {
      try { map.flyTo([dec.vlmTarget.lat, dec.vlmTarget.lng], 13, { duration: 1.0 }); } catch (e) {}
    }
    if (dec.vlmTarget.interactive && typeof window._startIntelDraw === 'function') {
      setTimeout(() => {
        try { window._startIntelDraw(window._runIntelAnalysis, '#aa66ff'); } catch (e) {}
      }, 1100);
    }
  }
  if (dec.mapEffect && typeof animateVesselImpact === 'function') {
    animateVesselImpact(dec.mapEffect.mmsi, dec.mapEffect.type);
  }
  // Snapshot the just-picked decision BEFORE applyDecision mutates state
  const pick = { lane: dec.lane, title: dec.title, assessment: dec.assessment };
  activeExercise.applyDecision(dec);
  if (activeExercise.complete) {
    renderAAR();
    return;
  }
  // Hand-authored branching: if the picked decision has a branch and the scenario
  // defines an alternate Turn 2 for that branch, swap it in.
  if (dec.branch && activeExercise.scenario.branches && activeExercise.scenario.branches[dec.branch]) {
    const altTurn = activeExercise.scenario.branches[dec.branch];
    activeExercise.scenario.turns[1] = { ...altTurn, _branched: dec.branch };
  }
  renderActiveExercise();

  // Map visualization for ANY pick (scripted or branched) — pulse + zoom mentioned entities
  if (typeof highlightAffectedParties === 'function') {
    const upcomingTurn = activeExercise.currentTurn();
    const text = (pick.assessment || '') + ' ' + (upcomingTurn.inject || '') + ' ' +
      (upcomingTurn.decisions || []).map(d => d.title + ' ' + (d.assessment || '')).join(' ');
    highlightAffectedParties(text);
  }

  // ── AI-adjudicated branching: DISABLED for demo speed. Local Ollama is too slow
  // for an interactive demo. Re-enable by setting window.AI_ADJUDICATE = true in console
  // (only useful when Main Desktop's faster Ollama is reachable).
  const ex = activeExercise;
  if (window.AI_ADJUDICATE && ex.turn >= 2 && ex.turn <= ex.scenario.turns.length) {
    const turnIdx = ex.turn - 1; // index of the upcoming turn
    // Show inline AI-thinking indicator in BOTH the brief AND the bottom overlay
    const aiBlock = `<div class="ai-thinking-blk" style="margin-top:8px;padding:8px 12px;background:rgba(102,255,153,0.10);border:1px solid #66ff9966;border-left:3px solid #66ff99;font-size:11px;color:#66ff99;letter-spacing:1.5px;display:flex;align-items:center;gap:8px">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#66ff99;animation:aiPulse 0.9s infinite ease-in-out"></span>
        <span>RED CELL ADJUDICATING — llama3.1:8b · ~10-30s</span>
      </div>
      <style>@keyframes aiPulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }</style>`;
    const briefEl = document.getElementById('exercise-brief');
    if (briefEl) briefEl.insertAdjacentHTML('beforeend', aiBlock);
    const overlayBody = document.getElementById('exercise-overlay-body');
    if (overlayBody) overlayBody.insertAdjacentHTML('afterbegin', aiBlock);
    showAIAdjudicating(true);
    const t0 = performance.now();
    try {
      const resp = await fetch('http://localhost:8000/scenario/next_turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_id: ex.scenario.id,
          scenario_title: ex.scenario.title,
          rung: ex.scenario.rung,
          turn_number: ex.turn - 1,
          total_turns: ex.scenario.turns.length,
          blue_pick: pick,
          indicators: ex.indicators,
          decision_history: ex.sitrep.map(s => ({ turn: s.turn, lane: s.lane, title: s.title, assessment: s.assessment })),
        }),
      });
      const data = await resp.json();
      const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
      if (data && data.ok && data.turn && Array.isArray(data.turn.decisions)) {
        ex.scenario.turns[turnIdx] = {
          inject: data.turn.inject,
          decisions: data.turn.decisions,
          _aiGenerated: true,
          _aiElapsed: elapsed,
        };
        // Big visible reveal so the user can SEE the AI-generated content land
        showAIRevealOverlay(data.turn.inject, data.turn.decisions, elapsed, pick);
        renderActiveExercise();
      } else {
        console.warn(`AI adjudicate failed in ${elapsed}s, using scripted:`, data && data.error);
        document.querySelectorAll('.ai-thinking-blk').forEach(el => {
          el.outerHTML = `<div style="margin-top:8px;padding:6px 10px;background:rgba(255,160,80,0.10);border:1px solid #ffaa4466;font-size:10px;color:#ffaa44">⚠ AI adjudication failed in ${elapsed}s (${(data && data.error) || 'unknown'}) — scripted fallback</div>`;
        });
      }
    } catch (e) {
      console.warn('AI adjudicate error, using scripted next turn:', e.message);
      document.querySelectorAll('.ai-thinking-blk').forEach(el => {
        el.outerHTML = `<div style="margin-top:8px;padding:6px 10px;background:rgba(255,80,80,0.10);border:1px solid #ff666666;font-size:10px;color:#ff8888">⚠ AI fetch error: ${e.message} — scripted fallback</div>`;
      });
    } finally {
      showAIAdjudicating(false);
    }
  }
}

// Big visible reveal when AI adjudication completes
function showAIRevealOverlay(inject, decisions, elapsed, pick) {
  const existing = document.getElementById('ai-reveal-overlay');
  if (existing) existing.remove();

  const decsHtml = decisions.map(d => {
    const colors = { DIPLOMATIC:'#ffcc66', INFORMATION:'#cc66ff', MILITARY:'#ff6666', ECONOMIC:'#66ccff', INTELLIGENCE:'#66ff99' };
    const c = colors[d.lane] || '#cccccc';
    return `<div style="border-left:3px solid ${c};padding:6px 10px;margin-bottom:6px;background:${c}11">
      <div style="color:${c};font-size:9px;letter-spacing:2px;font-weight:bold">${d.lane}</div>
      <div style="color:#e0e8f0;font-size:12px;margin-top:2px">${d.title}</div>
    </div>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.id = 'ai-reveal-overlay';
  overlay.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(720px,92vw);max-height:85vh;overflow-y:auto;background:rgba(0,12,20,0.97);border:2px solid #66ff99;box-shadow:0 0 60px rgba(102,255,153,0.4);z-index:9000;padding:20px 24px;color:#cce0ff;font-family:Courier New,monospace;animation:aiRevealIn 0.5s ease-out;backdrop-filter:blur(8px)';
  overlay.innerHTML = `
    <style>
      @keyframes aiRevealIn { from { opacity:0; transform:translate(-50%,-40%) scale(0.95); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }
    </style>
    <div style="color:#66ff99;font-size:11px;letter-spacing:3px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
      <span>⟳ AI ADJUDICATION COMPLETE — llama3.1:8b · ${elapsed}s</span>
      <button id="ai-reveal-close" style="background:none;border:1px solid #66ff9966;color:#66ff99;cursor:pointer;font-family:inherit;padding:3px 10px">CONTINUE ▶</button>
    </div>
    <div style="color:#aabbcc;font-size:10px;letter-spacing:2px;margin-bottom:12px">
      Your pick: <span style="color:#ffaa44;font-weight:bold">${pick.lane} — ${pick.title}</span>
    </div>
    <div style="border-left:4px solid #ff8800;padding:10px 14px;background:rgba(255,136,0,0.06);margin-bottom:14px">
      <div style="color:#ff8800;font-size:10px;letter-spacing:2px;margin-bottom:4px">RED CELL RESPONSE</div>
      <div style="color:#ffe0c0;font-size:14px;line-height:1.6">${inject}</div>
    </div>
    <div style="color:#66ff99;font-size:10px;letter-spacing:2px;margin-bottom:8px">YOUR NEXT 5 OPTIONS (AI-GENERATED)</div>
    ${decsHtml}
  `;
  document.body.appendChild(overlay);
  document.getElementById('ai-reveal-close')?.addEventListener('click', () => overlay.remove());
  // Auto-dismiss after 12s
  setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 12000);

  // Trigger map pulses on affected parties mentioned in the inject + decisions
  highlightAffectedParties(inject + ' ' + decisions.map(d => d.title + ' ' + d.assessment).join(' '));
}

// Scan free-form text for known entities and pulse them on the map
function highlightAffectedParties(text) {
  if (!window.game || !window.game.map) return;
  const map = window.game.map;
  const lower = (text || '').toLowerCase();
  const entities = [];
  // Known location anchors. `noZoom: true` means: still pulse if mentioned, but DON'T
  // drag the camera there (Tehran is 1500 km north of the theater — mentions are usually
  // shorthand for "the regime", not a literal location worth flying to).
  const places = [
    { keys:['bandar abbas','bandar-abbas','oikb'],   lat:27.218, lng:56.378, label:'Bandar Abbas' },
    { keys:['fujairah'],                              lat:25.123, lng:56.348, label:'Fujairah' },
    { keys:['hormuz','strait of hormuz'],             lat:26.50,  lng:56.25,  label:'Strait of Hormuz' },
    { keys:['larak'],                                 lat:26.85,  lng:56.37,  label:'Larak Island' },
    { keys:['qeshm'],                                 lat:26.60,  lng:55.95,  label:'Qeshm' },
    { keys:['ras tanura'],                            lat:26.71,  lng:50.16,  label:'Ras Tanura' },
    { keys:['jebel ali'],                             lat:25.00,  lng:55.05,  label:'Jebel Ali' },
    { keys:['kish'],                                  lat:26.53,  lng:53.98,  label:'Kish Island' },
    { keys:['tehran'],                                lat:35.69,  lng:51.42,  label:'Tehran', noZoom:true },
  ];
  for (const p of places) {
    if (p.keys.some(k => lower.includes(k))) entities.push(p);
  }
  // Known SIM_VESSELS by name
  if (typeof SIM_VESSELS !== 'undefined' && Array.isArray(SIM_VESSELS)) {
    for (const v of SIM_VESSELS) {
      if (lower.includes((v.name || '').toLowerCase())) {
        entities.push({ lat: v.lat, lng: v.lng, label: v.name });
      }
    }
  }
  // Known game units (USS NITZE, DDG-102, etc.)
  if (window.game && window.game._units) {
    for (const u of window.game._units) {
      const nm = (u.name || '').toLowerCase();
      if (nm && lower.includes(nm.toLowerCase())) {
        if (u.marker) {
          const ll = u.marker.getLatLng();
          entities.push({ lat: ll.lat, lng: ll.lng, label: u.name });
        }
      }
    }
  }
  if (entities.length === 0) return;

  // Pulse each
  for (const e of entities) {
    pulseAt(map, e.lat, e.lng, e.label);
  }

  // Zoom map only on entities that aren't flagged noZoom (e.g. Tehran). Pulse still
  // happens for everyone above; this just controls camera bounds.
  const zoomable = entities.filter(e => !e.noZoom);
  if (zoomable.length >= 2) {
    const bounds = L.latLngBounds(zoomable.map(e => [e.lat, e.lng]));
    map.flyToBounds(bounds, { padding: [80, 80], maxZoom: 9, duration: 1.2 });
  } else if (zoomable.length === 1) {
    // Single zoomable entity — fly to it
    map.flyTo([zoomable[0].lat, zoomable[0].lng], 9, { duration: 1.0 });
  }

  // Connect with a faint line if 2+ entities (shows the relationship)
  if (entities.length >= 2) {
    const line = L.polyline(entities.map(e => [e.lat, e.lng]), {
      color: '#66ff99', weight: 2, opacity: 0.55, dashArray: '6 5', interactive: false,
    }).addTo(map);
    setTimeout(() => map.removeLayer(line), 8000);
  }

  // Dim every other map entity for 8s — SDA-style isolation
  const dimmed = [];
  if (typeof _aisVessels !== 'undefined' && _aisVessels) {
    _aisVessels.forEach(({ marker, label, v }) => {
      const isMentioned = entities.some(e => e.label && (e.label.toLowerCase() === (v.name || '').toLowerCase()));
      if (!isMentioned) {
        dimmed.push({ marker, label, prevOp: 1.0 });
        marker.setOpacity(0.18);
        if (label) label.setOpacity(0);
      }
    });
  }
  if (window.game && window.game._units) {
    window.game._units.forEach(u => {
      if (!u.marker) return;
      const isMentioned = entities.some(e => e.label && e.label.toLowerCase() === (u.name || '').toLowerCase());
      if (!isMentioned) {
        dimmed.push({ marker: u.marker, prevOp: 1.0 });
        u.marker.setOpacity(0.18);
      }
    });
  }
  setTimeout(() => {
    dimmed.forEach(({ marker, label, prevOp }) => {
      marker.setOpacity(prevOp);
      if (label) label.setOpacity(prevOp);
    });
  }, 8000);
}

function pulseAt(map, lat, lng, label) {
  // Pulse ring
  const ring = L.circle([lat, lng], { radius: 800, color: '#66ff99', weight: 3, fillOpacity: 0.18, interactive: false }).addTo(map);
  let r = 800;
  const pulse = setInterval(() => {
    r += 1500;
    ring.setRadius(r);
    ring.setStyle({ opacity: Math.max(0, 1 - (r - 800) / 16000), fillOpacity: Math.max(0, 0.18 - (r - 800) / 90000) });
    if (r >= 16000) { clearInterval(pulse); map.removeLayer(ring); }
  }, 100);
  // Mini label tooltip
  const tt = L.tooltip({ permanent: true, direction: 'top', offset: [0, -8], className: 'ai-affected-tt' })
    .setLatLng([lat, lng])
    .setContent(`<span style="color:#66ff99;font-family:Courier New,monospace;font-size:10px;font-weight:bold;text-shadow:0 0 4px #000">⟳ ${label}</span>`)
    .addTo(map);
  setTimeout(() => map.removeLayer(tt), 6000);
}

function showAIAdjudicating(on) {
  let el = document.getElementById('ai-adjudicating');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ai-adjudicating';
    el.style.cssText = 'position:fixed;bottom:130px;left:20px;background:rgba(0,8,16,0.95);color:#66ff99;padding:8px 18px;border:1px solid #66ff9966;border-left:4px solid #66ff99;z-index:550;font-family:Courier New,monospace;font-size:11px;letter-spacing:1.5px;box-shadow:0 4px 16px rgba(0,0,0,0.6)';
    el.innerHTML = '⟳ AI ADJUDICATING NEXT TURN — llama3.1:8b';
    document.body.appendChild(el);
  }
  el.style.display = on ? 'block' : 'none';
}

function formatAssessment(text) {
  if (!text) return '';
  // Detect "VLM output:" prefix and style the VLM block separately
  const vlmMatch = text.match(/^([\s\S]*?VLM output[^"]*"[\s\S]*?")\s*\n\n([\s\S]*)$/);
  if (vlmMatch) {
    const vlmBlock = vlmMatch[1];
    const rest = vlmMatch[2];
    return `
      <div style="border:1px solid #66ff9966;background:rgba(102,255,153,0.06);padding:6px 10px;margin:4px 0;font-family:'Courier New',monospace;font-size:11px;line-height:1.5;color:#ccffd9">
        <div style="color:#66ff99;font-size:9px;letter-spacing:2px;margin-bottom:4px">// LLAMA 3.2 VISION — VLM ANALYSIS //</div>
        ${vlmBlock.replace(/^VLM output:?\s*/, '')}
      </div>
      <div style="margin-top:6px">${rest}</div>`;
  }
  return text;
}

function renderOverlay() {
  if (!activeExercise) return;
  const ex = activeExercise;
  document.getElementById('exercise-overlay-turn').textContent = ex.complete
    ? 'EXERCISE COMPLETE'
    : `TURN ${ex.turn} OF ${ex.scenario.turns.length}`;
  document.getElementById('exercise-overlay-title').textContent = `EXERCISE — ${ex.scenario.rung}`;

  const body = document.getElementById('exercise-overlay-body');
  if (ex.sitrep.length === 0) {
    body.innerHTML = '<div style="color:#7a8896;font-size:11px">No decisions logged yet. Pick one from the side panel.</div>';
    return;
  }
  body.innerHTML = ex.sitrep.map(s => `
    <div style="border-left:2px solid #ff660055;padding:6px 10px;margin-bottom:6px">
      <div style="color:#ff8800;font-size:10px;letter-spacing:2px">T${s.turn} · ${s.lane}</div>
      <div style="color:#e0e8f0;font-size:12px;margin:3px 0">${s.title}</div>
      <div style="color:#a0b0c0;font-size:11px;line-height:1.5">${formatAssessment(s.assessment)}</div>
    </div>
  `).join('');
  // Only auto-scroll when a NEW sitrep entry has been added (not on every render).
  // Without this guard the panel jumps to the bottom on every AI-adjudicated re-render too.
  const overlay = document.getElementById('exercise-overlay');
  if (overlay) {
    const prev = overlay.dataset.lastSitrepLen ? parseInt(overlay.dataset.lastSitrepLen, 10) : 0;
    if (ex.sitrep.length > prev) {
      requestAnimationFrame(() => { overlay.scrollTop = overlay.scrollHeight; });
    }
    overlay.dataset.lastSitrepLen = String(ex.sitrep.length);
  }
}

function renderAAR() {
  if (!activeExercise) return;
  syncLegacyStateStrip();
  const ex = activeExercise;
  const ind0 = ex.scenario.initialIndicators;
  const indN = ex.indicators;
  const indKeys = Object.keys(ind0);
  const rungs = ['—','HARASS','SEIZURE','MINING','STRIKE','CLOSURE','WAR'];

  document.getElementById('exercise-decisions').innerHTML = '';
  document.getElementById('exercise-brief').innerHTML = `
    <div style="color:#00ff88;font-size:14px;letter-spacing:2px;margin-bottom:6px">✓ EXERCISE COMPLETE</div>
    <div style="color:#a0b0c0;font-size:11px;line-height:1.4">${ex.scenario.title}</div>`;

  const laneColors = { DIPLOMATIC:'#ffcc66', INFORMATION:'#cc66ff', MILITARY:'#ff6666', ECONOMIC:'#66ccff', INTELLIGENCE:'#66ff99' };

  const timelineHtml = ex.sitrep.map(s => {
    const c = laneColors[s.lane] || '#cccccc';
    return `
      <div style="border-left:2px solid ${c}88;padding:6px 10px;margin-bottom:4px">
        <div style="color:${c};font-size:9px;letter-spacing:2px;font-weight:bold">T${s.turn} · ${s.lane}</div>
        <div style="color:#e0e8f0;font-size:11px;margin-top:2px">${s.title}</div>
      </div>`;
  }).join('');

  const fmtVal = (k, v) => {
    if (k === 'escalationRung') return rungs[v] || String(v);
    if (k === 'oilPrice') return '$' + v + '/bbl';
    if (k === 'warRiskInsurance') return v + ' bps';
    return v + '/100';
  };
  const indicatorHtml = indKeys.map(k => {
    const before = ind0[k];
    const after = indN[k];
    const delta = after - before;
    const sign = delta > 0 ? '+' : '';
    let deltaColor = '#888';
    if (k === 'allianceCohesion' || k === 'attributionConfidence') deltaColor = delta > 0 ? '#88ff88' : delta < 0 ? '#ff8888' : '#888';
    else if (k === 'iranCoercion' || k === 'oilPrice' || k === 'warRiskInsurance' || k === 'escalationRung') deltaColor = delta > 0 ? '#ff8888' : delta < 0 ? '#88ff88' : '#888';
    const label = k.replace(/([A-Z])/g, ' $1').toUpperCase().trim();
    return `
      <div style="display:flex;justify-content:space-between;font-size:11px;padding:5px 0;border-bottom:1px solid rgba(0,255,136,0.08)">
        <span style="color:#a0b0c0">${label}</span>
        <span style="color:#e0e8f0;font-family:'Courier New',monospace">${fmtVal(k, before)} → ${fmtVal(k, after)} <span style="color:${deltaColor};margin-left:6px">(${sign}${delta})</span></span>
      </div>`;
  }).join('');

  const body = document.getElementById('exercise-overlay-body');
  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div>
        <div style="color:#00ff88;font-size:10px;letter-spacing:2px;margin-bottom:6px">// DECISION TIMELINE //</div>
        ${timelineHtml}
      </div>
      <div>
        <div style="color:#00ff88;font-size:10px;letter-spacing:2px;margin-bottom:6px">// INDICATOR DELTAS //</div>
        <div style="border:1px solid #00ff8833;padding:8px 12px;background:rgba(0,30,15,0.4)">${indicatorHtml}</div>
        <button id="aar-restart-btn" style="margin-top:14px;width:100%;padding:10px;background:rgba(0,255,136,0.1);color:#00ff88;border:1px solid #00ff8866;cursor:pointer;font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px">▶ NEW EXERCISE</button>
      </div>
    </div>`;

  const restartBtn = document.getElementById('aar-restart-btn');
  if (restartBtn) restartBtn.addEventListener('click', endExercise);

  // Update overlay title
  document.getElementById('exercise-overlay-title').textContent = `EXERCISE COMPLETE — ${ex.scenario.rung}`;
  document.getElementById('exercise-overlay-turn').textContent = 'AFTER-ACTION REVIEW';

  if (typeof renderIndicators === 'function') renderIndicators();
}

function renderIndicators() {
  const strip = document.getElementById('exercise-indicators-strip');
  if (!strip) return;
  if (!activeExercise) {
    strip.style.display = 'none';
    return;
  }
  strip.style.display = 'block';
  const ind = activeExercise.indicators;
  const rungs = ['—','HARASS','SEIZURE','MINING','STRIKE','CLOSURE','WAR'];
  strip.innerHTML = `
    <div style="color:#ff8800;font-size:10px;letter-spacing:2px;margin-bottom:8px">// EXERCISE INDICATORS //</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${indicatorTile('ESCALATION', rungs[ind.escalationRung] || '—', '#ff6666')}
      ${indicatorTile('OIL PRICE', '$' + ind.oilPrice + '/bbl', '#66ccff')}
      ${indicatorTile('WAR-RISK INS', ind.warRiskInsurance + ' bps', '#cc66ff')}
      ${indicatorTile('ALLIANCE COHESION', ind.allianceCohesion + '/100', '#66ff99')}
      ${indicatorTile('ATTRIBUTION CONF', ind.attributionConfidence + '/100', '#ffcc66')}
      ${indicatorTile('IRAN COERCION', ind.iranCoercion + '/100', '#ff8888')}
    </div>
  `;
}

function indicatorTile(label, value, color) {
  return `
    <div style="border:1px solid ${color}33;padding:8px 10px;background:rgba(0,0,0,0.3)">
      <div style="color:${color};font-size:9px;letter-spacing:1.5px">${label}</div>
      <div style="color:#e0e8f0;font-size:14px;margin-top:3px;font-family:'Courier New',monospace">${value}</div>
    </div>`;
}

window.renderIndicators = renderIndicators;
window.renderScenarioCards = renderScenarioCards;
window.startExercise = startExercise;
window.endExercise = endExercise;
window.renderActiveExercise = renderActiveExercise;
window.syncLegacyStateStrip = syncLegacyStateStrip;
Object.defineProperty(window, 'activeExercise', { get: () => activeExercise });
