// AI-powered features for the v2 build:
//   1. AI Scenario Generator (POST /scenario/generate)
//   2. AI Order-of-Battle Generator (POST /scenario/oob)
//   3. AI After-Action Review observations (POST /aar/observations)
//   4. AI-Driven Adaptive Red Cell (POST /redcell/decide) — wired into engagement modal
//   5. Gulf Events Feed (GET /gdelt/feed) — cached ACLED-style events
// All call the local FastAPI backend on :8020 which talks to local Ollama llama3.1:8b.
(function () {
  const API = 'http://localhost:8000';

  // ── 1. AI Scenario Generator ──────────────────────────────────────────────
  function _wireScenarioGenerator() {
    const btn = document.getElementById('btn-ai-scenario');
    const modal = document.getElementById('ai-scenario-modal');
    const closeBtn = document.getElementById('ai-scenario-close');
    const goBtn = document.getElementById('ai-scenario-generate');
    if (!btn || !modal || !goBtn) return;

    btn.addEventListener('click', () => { modal.style.display = 'flex'; });
    closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });

    goBtn.addEventListener('click', async () => {
      const premise = document.getElementById('ai-scenario-input').value.trim();
      if (!premise) return;
      const status = document.getElementById('ai-scenario-status');
      const output = document.getElementById('ai-scenario-output');
      status.innerHTML = `<div style="color:#44cc88;display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#44cc88;animation:aiPulse 0.9s infinite"></span> Llama 3.1 8B generating scenario from premise...</div>`;
      output.innerHTML = '';
      goBtn.disabled = true;
      const t0 = performance.now();
      try {
        const r = await fetch(API + '/scenario/generate', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ premise })
        });
        const d = await r.json();
        const dt = ((performance.now() - t0) / 1000).toFixed(1);
        if (!d.ok) {
          status.innerHTML = `<div style="color:#ff5566">✗ ERROR: ${d.error}<br>Raw: <pre style="max-height:200px;overflow:auto;background:#000;padding:6px;font-size:10px">${(d.raw || '').slice(0, 500)}</pre></div>`;
          return;
        }
        const s = d.scenario;
        status.innerHTML = `<div style="color:#44cc88">✓ Generated in ${dt}s · ${s.turns.length} turns · ${s.turns.reduce((acc, t) => acc + (t.decisions || []).length, 0)} decisions</div>`;
        // Render preview + injection control
        const preview = `
          <div style="background:rgba(68,204,136,0.06);border-left:3px solid #44cc88;padding:10px 14px;margin-bottom:10px">
            <div style="color:#44cc88;font-size:11px;letter-spacing:2px;margin-bottom:4px">${s.rung || 'UNKNOWN'} RUNG</div>
            <div style="color:#fff;font-size:15px;font-weight:bold;margin-bottom:6px">${s.title}</div>
            <div style="color:#cce0ff;font-size:11px;line-height:1.5">${s.summary || ''}</div>
            ${s.threat ? `<div style="color:#ffaa44;font-size:11px;margin-top:8px;font-style:italic">Threat: ${s.threat}</div>` : ''}
          </div>
          ${s.turns.map((t, i) => `
            <div style="border-left:2px solid #66ddff66;padding:8px 12px;margin-bottom:8px">
              <div style="color:#66ddff;font-size:10px;letter-spacing:2px;margin-bottom:4px">TURN ${i+1} INJECT</div>
              <div style="color:#cce0ff;font-size:11px;line-height:1.5;margin-bottom:6px">${t.inject || ''}</div>
              <div style="font-size:9px;color:#88a">${(t.decisions || []).length} DIME+ decisions: ${(t.decisions || []).map(d => d.lane).join(' · ')}</div>
            </div>
          `).join('')}
          <button id="ai-scenario-inject" style="width:100%;background:#44cc8822;border:1px solid #44cc88;color:#44cc88;padding:10px 14px;cursor:pointer;font-family:'Courier New',monospace;font-size:12px;letter-spacing:1.5px;margin-top:6px">▶ INJECT SCENARIO INTO RIGHT PANEL — make playable</button>`;
        output.innerHTML = preview;
        const inject = document.getElementById('ai-scenario-inject');
        if (inject) inject.addEventListener('click', () => {
          // Add to ACTOR_CATEGORIES-aware scenarios array on window
          if (typeof window.SCENARIOS === 'object' && Array.isArray(window.SCENARIOS)) {
            window.SCENARIOS.push(s);
          } else if (typeof window.SCENARIOS === 'object') {
            window.SCENARIOS[s.id || ('ai-' + Date.now())] = s;
          }
          // Re-render scenario cards if possible
          if (typeof window.renderScenarios === 'function') window.renderScenarios();
          modal.style.display = 'none';
          alert('Scenario injected. It now appears on the right-side EXERCISE tab.');
        });
      } catch (e) {
        status.innerHTML = `<div style="color:#ff5566">✗ Network error: ${e.message}<br>Check that the backend is running on :8020 and Ollama is up.</div>`;
      } finally {
        goBtn.disabled = false;
      }
    });
  }

  // ── 2. AI Order-of-Battle Generator ───────────────────────────────────────
  let _oobMarkers = [];
  function _wireOobGenerator() {
    const btn = document.getElementById('btn-ai-oob');
    const modal = document.getElementById('ai-oob-modal');
    const closeBtn = document.getElementById('ai-oob-close');
    const goBtn = document.getElementById('ai-oob-generate');
    if (!btn || !modal || !goBtn) return;

    btn.addEventListener('click', () => { modal.style.display = 'flex'; });
    closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });

    goBtn.addEventListener('click', async () => {
      const theater = document.getElementById('ai-oob-input').value.trim() || 'Strait of Hormuz';
      const status = document.getElementById('ai-oob-status');
      const output = document.getElementById('ai-oob-output');
      status.innerHTML = `<div style="color:#66ddff">🛰 Llama 3.1 8B generating Order of Battle for ${theater}...</div>`;
      output.innerHTML = '';
      goBtn.disabled = true;
      const t0 = performance.now();
      try {
        const r = await fetch(API + '/scenario/oob', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ theater })
        });
        const d = await r.json();
        const dt = ((performance.now() - t0) / 1000).toFixed(1);
        if (!d.ok) {
          status.innerHTML = `<div style="color:#ff5566">✗ ${d.error}: <pre style="font-size:10px;max-height:200px;overflow:auto">${(d.raw || '').slice(0, 400)}</pre></div>`;
          return;
        }
        const o = d.oob;
        status.innerHTML = `<div style="color:#66ddff">✓ Generated in ${dt}s · ${(o.blue_force || []).length} Blue · ${(o.red_force || []).length} Red · ${(o.key_terrain || []).length} terrain</div>`;
        const renderRow = (item, color) => `<tr><td style="color:${color};padding:3px 12px 3px 0">${item.unit || item.name || '—'}</td><td style="color:#aac;padding:3px 12px 3px 0">${item.type || '—'}</td><td style="color:#88a;padding:3px 12px 3px 0">${item.lat?.toFixed(3) || '—'}, ${item.lng?.toFixed(3) || '—'}</td><td style="color:#cce0ff;padding:3px 0">${item.capability || item.significance || '—'}</td></tr>`;
        output.innerHTML = `
          <div style="color:#88a0b8;font-size:10px;letter-spacing:2px;margin:8px 0 4px 0">═════ BLUE FORCE ═════</div>
          <table style="width:100%;font-size:11px"><tbody>${(o.blue_force || []).map(u => renderRow(u, '#88ddff')).join('')}</tbody></table>
          <div style="color:#88a0b8;font-size:10px;letter-spacing:2px;margin:14px 0 4px 0">═════ RED FORCE ═════</div>
          <table style="width:100%;font-size:11px"><tbody>${(o.red_force || []).map(u => renderRow(u, '#ff8866')).join('')}</tbody></table>
          <div style="color:#88a0b8;font-size:10px;letter-spacing:2px;margin:14px 0 4px 0">═════ KEY TERRAIN ═════</div>
          <table style="width:100%;font-size:11px"><tbody>${(o.key_terrain || []).map(t => renderRow(t, '#ffaa44')).join('')}</tbody></table>
          <button id="ai-oob-render" style="width:100%;background:#66ddff22;border:1px solid #66ddff;color:#66ddff;padding:10px 14px;cursor:pointer;font-family:'Courier New',monospace;font-size:12px;letter-spacing:1.5px;margin-top:14px">📍 RENDER ON MAP — drop markers</button>`;
        const renderBtn = document.getElementById('ai-oob-render');
        if (renderBtn) renderBtn.addEventListener('click', () => {
          const map = window.game && window.game._map;
          if (!map) return;
          // Clear prior OOB markers
          _oobMarkers.forEach(m => map.removeLayer(m));
          _oobMarkers = [];
          const drop = (item, color, prefix) => {
            if (typeof item.lat !== 'number' || typeof item.lng !== 'number') return;
            const m = L.circleMarker([item.lat, item.lng], {
              radius: 7, color, weight: 2, fillColor: color, fillOpacity: 0.4,
            }).addTo(map);
            m.bindPopup(`<div style="font-family:Courier New,monospace;font-size:11px;color:#222;background:#fff;padding:8px;min-width:220px"><div style="color:${color};letter-spacing:2px;font-size:10px;font-weight:bold">${prefix} · ${item.type || ''}</div><div style="font-weight:bold;margin-top:3px">${item.unit || item.name || '(unnamed)'}</div><div style="margin-top:3px;color:#666">${item.capability || item.significance || ''}</div><div style="margin-top:6px;font-size:9px;color:#999">SOURCE: AI-generated OOB · Llama 3.1 8B</div></div>`);
            _oobMarkers.push(m);
          };
          (o.blue_force || []).forEach(u => drop(u, '#44aaff', 'BLUE'));
          (o.red_force || []).forEach(u => drop(u, '#ff5566', 'RED'));
          (o.key_terrain || []).forEach(t => drop(t, '#ffaa44', 'TERRAIN'));
          modal.style.display = 'none';
        });
      } catch (e) {
        status.innerHTML = `<div style="color:#ff5566">✗ Network error: ${e.message}</div>`;
      } finally {
        goBtn.disabled = false;
      }
    });
  }

  // ── 3. AI AAR Observations ─────────────────────────────────────────────────
  // Replaces hand-coded observations in _renderAAR by calling the AI endpoint.
  // Hooks into `window._renderAAR` after it runs by patching it.
  async function _aiAarObservations(state, opts) {
    if (!state || !state.aar) return null;
    const events = state.aar.events.map(e => ({ ...e })); // copy for transport
    const blueChoice = (events.find(e => e.type === 'choice') || {}).choice || null;
    const hits = events.filter(e => e.type === 'hit').length;
    const fired = events.filter(e => e.type === 'fire').length;
    const aborted = !!opts.aborted;
    const outcome = aborted ? 'aborted' : hits > 0 ? 'hit' : fired > 0 ? 'complete' : 'uncontested';
    const liveDelta = window._liveInsuranceDelta || 0;
    try {
      const r = await fetch(API + '/aar/observations', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          outcome,
          duration_sec: Math.round((Date.now() - state.aar.startTime) / 1000),
          blue_choice: blueChoice,
          events,
          indicators_before: { warRiskInsurance: 720, escalationRung: 1 },
          indicators_after: { warRiskInsurance: 720 + liveDelta, escalationRung: 2 },
        })
      });
      const d = await r.json();
      if (!d.ok) return null;
      return d.observations;
    } catch { return null; }
  }

  // Patch _renderAAR to fetch AI observations after the initial render
  function _hookAarPatch() {
    if (typeof window._renderAAR !== 'function' && !window.LeafletGame) return setTimeout(_hookAarPatch, 500);
    // We attach the AI observations to the DOM after the AAR modal renders
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.target.id === 'aar-modal' && m.target.style.display === 'flex') {
          const game = window.game;
          if (!game || !game._combatState) return;
          _injectAiObservations(game._combatState, { aborted: !!game._abortRoute });
        }
      }
    });
    const target = document.getElementById('aar-modal');
    if (target) obs.observe(target, { attributes: true, attributeFilter: ['style'] });
  }

  async function _injectAiObservations(state, opts) {
    const body = document.getElementById('aar-modal-body');
    if (!body) return;
    // Add a placeholder AI section right after the existing observations
    let aiSection = document.getElementById('ai-aar-section');
    if (!aiSection) {
      aiSection = document.createElement('div');
      aiSection.id = 'ai-aar-section';
      aiSection.innerHTML = `
        <div style="color:#88a0b8;font-size:10px;letter-spacing:2px;margin:14px 0 6px 0">═════ AI-GENERATED OBSERVATIONS · LLAMA 3.1 8B ═════</div>
        <div id="ai-aar-content" style="background:rgba(68,204,136,0.04);border-left:3px solid #44cc88;padding:10px 14px"><div style="color:#44cc88;font-size:11px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#44cc88;animation:aiPulse 0.9s infinite"></span> &nbsp;Llama 3.1 8B analyzing transit events...</div></div>
        <style>@keyframes aiPulse{0%,100%{opacity:1}50%{opacity:0.3}}</style>`;
      body.appendChild(aiSection);
    }
    const obs = await _aiAarObservations(state, opts);
    const target = document.getElementById('ai-aar-content');
    if (!target) return;
    if (!obs) {
      target.innerHTML = `<div style="color:#ff8866;font-size:11px">AI observations unavailable (backend offline or LLM error). Using deterministic observations above.</div>`;
      return;
    }
    target.innerHTML = obs.map(o => `<div style="padding:4px 0;color:#cce0ff"><span style="color:#44cc88">${o.icon || '▸'}</span> &nbsp; ${o.text}</div>`).join('');
  }

  // ── 4. AI-Driven Adaptive Red Cell ────────────────────────────────────────
  // Public function: window.OllamaRedCell.decide(scenarioState, blueAction, indicators, priorActions)
  // Returns {choice, rationale, next_action, indicator_deltas}.
  window.OllamaRedCell = {
    async decide(scenarioTitle, rung, blueAction, indicators, priorActions) {
      const r = await fetch(API + '/redcell/decide', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          scenario_title: scenarioTitle || 'Hormuz transit',
          rung: rung || 'HARASS',
          blue_action: blueAction,
          current_indicators: indicators || {},
          prior_red_actions: priorActions || [],
        })
      });
      const d = await r.json();
      return d.ok ? d.decision : null;
    }
  };

  // ── 5. Gulf Events Feed ────────────────────────────────────────────────────
  let _gulfMarkers = [];
  function _wireGulfFeed() {
    const btn = document.getElementById('btn-gulf-feed');
    const modal = document.getElementById('gulf-feed-modal');
    const closeBtn = document.getElementById('gulf-feed-close');
    if (!btn || !modal) return;

    btn.addEventListener('click', async () => {
      modal.style.display = 'flex';
      const out = document.getElementById('gulf-feed-output');
      out.innerHTML = '<div style="color:#44ddff">📡 Fetching cached Gulf events...</div>';
      try {
        const r = await fetch(API + '/gdelt/feed');
        const d = await r.json();
        if (!d.ok) {
          out.innerHTML = `<div style="color:#ff5566">✗ ${d.error}</div>`;
          return;
        }
        const events = d.events || [];
        const map = window.game && window.game._map;
        // Drop pin for each event on the map
        if (map) {
          _gulfMarkers.forEach(m => map.removeLayer(m));
          _gulfMarkers = [];
          for (const e of events) {
            if (typeof e.lat !== 'number' || typeof e.lng !== 'number') continue;
            const colors = { MARITIME_INCIDENT:'#ff5566', MILITARY_POSTURE:'#44aaff', DIPLOMATIC:'#44cc88', ECONOMIC:'#ffaa44', INTELLIGENCE:'#bb66ff' };
            const c = colors[e.type] || '#88ddff';
            const m = L.circleMarker([e.lat, e.lng], { radius: 6, color: c, weight: 2, fillColor: c, fillOpacity: 0.5 }).addTo(map);
            m.bindPopup(`<div style="font-family:Courier New,monospace;font-size:11px;color:#222;background:#fff;padding:8px;min-width:280px"><div style="color:${c};letter-spacing:2px;font-size:10px;font-weight:bold">${e.type} · ${e.date}</div><div style="font-weight:bold;margin-top:3px">${e.title}</div><div style="margin-top:4px;color:#444">${e.summary}</div><div style="margin-top:6px;font-size:9px;color:#999">SOURCE: ${d.source}</div></div>`);
            _gulfMarkers.push(m);
          }
        }
        const html = events.map(e => `
          <div style="border-left:3px solid #44ddff66;padding:8px 12px;margin-bottom:6px;background:rgba(68,221,255,0.04)">
            <div style="color:#44ddff;font-size:9px;letter-spacing:2px">${e.type} · ${e.date} · ${e.lat?.toFixed(2)}°N ${e.lng?.toFixed(2)}°E</div>
            <div style="color:#fff;font-size:12px;font-weight:bold;margin-top:2px">${e.title}</div>
            <div style="color:#cce0ff;font-size:11px;margin-top:3px">${e.summary}</div>
          </div>`).join('');
        out.innerHTML = `
          <div style="color:#44ddff;font-size:11px;margin-bottom:10px;padding:6px 10px;background:rgba(68,221,255,0.08);border-left:3px solid #44ddff">
            ✓ ${events.length} events · source: ${d.source} · pins dropped on map
          </div>
          ${html}`;
      } catch (e) {
        out.innerHTML = `<div style="color:#ff5566">✗ Network error: ${e.message}</div>`;
      }
    });
    closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
  }

  // ── boot ──
  window.addEventListener('load', () => {
    _wireScenarioGenerator();
    _wireOobGenerator();
    _wireGulfFeed();
    _hookAarPatch();
    console.log('[ai-features] wired: scenario gen, OOB gen, Gulf feed, AI AAR observations, OllamaRedCell');
  });
})();
