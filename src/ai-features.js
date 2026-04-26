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
          // Re-render scenario cards on the right panel
          if (typeof window.renderScenarioCards === 'function') {
            window.renderScenarioCards();
          } else if (typeof window.renderScenarios === 'function') {
            window.renderScenarios();
          }
          modal.style.display = 'none';
          alert('Scenario injected. Open the EXERCISE tab on the right panel — the new AI-generated scenario is at the bottom of the list.');
        });
      } catch (e) {
        status.innerHTML = `<div style="color:#ff5566">✗ Network error: ${e.message}<br>Check that the backend is running on :8020 and Ollama is up.</div>`;
      } finally {
        goBtn.disabled = false;
      }
    });
  }

  // ── Map LLM type strings ("Aircraft Carrier", "Frigate", "Boghammar FAC", etc.)
  // to canonical makeIcon types so OOB units get real ship SVG icons.
  function _normalizeOobType(t) {
    const s = String(t || '').toLowerCase();
    if (s.includes('carrier')) return 'carrier';
    if (s.includes('cruiser')) return 'cruiser';
    if (s.includes('destroyer') || s.includes('frigate') || s.includes('ddg') || s.includes('ffg')) return 'destroyer';
    if (s.includes('sub')) return 'submarine';
    if (s.includes('fac') || s.includes('fast') || s.includes('boghammar') || s.includes('peykaap') || s.includes('attack craft') || s.includes('patrol')) return 'fac';
    if (s.includes('mine') || s.includes('layer')) return 'minelayer';
    if (s.includes('tanker') || s.includes('vlcc') || s.includes('cargo')) return 'tanker';
    if (s.includes('battery') || s.includes('missile') || s.includes('sam') || s.includes('coastal') || s.includes('radar')) return 'coastal_battery';
    return null; // unknown → fall back to circle marker
  }

  // Water bounding boxes for the major theaters the OOB generator supports.
  // A position counts as water ONLY if it's inside one of these. Used for
  // snap-to-water on AI-generated unit positions (LLM often puts ships
  // slightly inland near naval bases / coast).
  // Tight water-only bboxes (avoid Taiwan island, peninsulas, etc.)
  const WATER_BBOXES = [
    // Persian Gulf / Strait of Hormuz / Gulf of Oman
    { name: 'Persian Gulf',      latLo: 24.5, latHi: 27.0, lngLo: 50.6, lngHi: 56.4 },
    { name: 'Hormuz Strait',     latLo: 25.5, latHi: 26.7, lngLo: 56.4, lngHi: 57.5 },
    { name: 'Gulf of Oman',      latLo: 22.5, latHi: 26.0, lngLo: 56.6, lngHi: 64.5 },
    // Taiwan Strait — Taiwan island STARTS at ~120°E, so cap water at 119.9
    { name: 'Taiwan Strait',     latLo: 22.5, latHi: 26.0, lngLo: 118.5, lngHi: 119.9 },
    // East China Sea — east of Taiwan island (Taiwan east coast ~122°E)
    { name: 'East China Sea',    latLo: 25.5, latHi: 32.0, lngLo: 122.3, lngHi: 128.5 },
    // Bashi Channel — south of Taiwan island (Taiwan southern tip ~21.9°N)
    { name: 'Bashi Channel',     latLo: 19.5, latHi: 21.5, lngLo: 120.5, lngHi: 122.5 },
    // South China Sea — west of Philippines (Luzon ~120°E), south of China
    { name: 'South China Sea',   latLo: 8.0,  latHi: 21.0, lngLo: 110.0, lngHi: 117.5 },
    // Red Sea — between Egypt/Sudan/Saudi/Eritrea
    { name: 'Red Sea',           latLo: 13.0, latHi: 27.5, lngLo: 33.0, lngHi: 42.5 },
    { name: 'Bab el-Mandeb',     latLo: 11.5, latHi: 13.0, lngLo: 43.0, lngHi: 44.5 },
    { name: 'Gulf of Aden',      latLo: 11.0, latHi: 13.5, lngLo: 43.5, lngHi: 51.0 },
    // Black Sea
    { name: 'Black Sea',         latLo: 41.5, latHi: 45.5, lngLo: 28.5, lngHi: 41.0 },
    // Mediterranean (rough, mostly water)
    { name: 'Mediterranean',     latLo: 31.5, latHi: 44.0, lngLo: -4.5, lngHi: 35.0 },
    // English Channel + North Sea
    { name: 'English Channel',   latLo: 49.5, latHi: 56.0, lngLo: -5.0, lngHi: 8.0 },
    // Caribbean / Gulf of Mexico
    { name: 'Caribbean',         latLo: 9.0,  latHi: 27.0, lngLo: -88.0, lngHi: -60.0 },
  ];
  function _isWater(lat, lng) {
    return WATER_BBOXES.some(b => lat >= b.latLo && lat <= b.latHi && lng >= b.lngLo && lng <= b.lngHi);
  }
  function _nearestWaterAnchor(lat, lng) {
    let best = null, bestD = Infinity;
    for (const b of WATER_BBOXES) {
      const cLat = (b.latLo + b.latHi) / 2, cLng = (b.lngLo + b.lngHi) / 2;
      const d = Math.hypot(lat - cLat, lng - cLng);
      if (d < bestD) { bestD = d; best = [cLat, cLng]; }
    }
    return best;
  }

  // ── Snap any AI-generated lat/lng to water if it's on land.
  // Land/coastal units that belong on land (airbases, missile sites, ports) skip.
  function _snapToWater(lat, lng, type) {
    const landOk = ['airport', 'aerodrome', 'air_base', 'missile_battery', 'missile_site', 'airbase', 'sam_battery', 'radar', 'port', 'harbour', 'airfield'];
    if (type && landOk.some(t => String(type).toLowerCase().includes(t))) return [lat, lng];
    if (_isWater(lat, lng)) return [lat, lng];
    // Spiral outward from the LLM's intended position looking for water
    for (let r = 0.1; r <= 3.0; r += 0.1) {
      for (const [dy, dx] of [[0,r],[0,-r],[r,0],[-r,0],[r,r],[-r,-r],[r,-r],[-r,r]]) {
        if (_isWater(lat + dy, lng + dx)) return [lat + dy, lng + dx];
      }
    }
    // Last resort: nearest water bbox center
    return _nearestWaterAnchor(lat, lng) || [lat, lng];
  }

  // ── 2. AI Order-of-Battle Generator ───────────────────────────────────────
  let _oobMarkers = [];
  let _oobModeActive = false;
  let _oobHiddenLayers = []; // markers we hid when entering OOB mode (for restore)

  function _enterOobMode(map, theater) {
    if (_oobModeActive) return;
    _oobModeActive = true;
    _oobHiddenLayers = [];
    // Iterate every layer currently on the map. If it's a marker / circleMarker /
    // polyline / circle / polygon, hide it by removing — store a reference so
    // _exitOobMode can re-add it.
    map.eachLayer(layer => {
      // Don't hide the base tile layer
      if (layer instanceof L.TileLayer) return;
      _oobHiddenLayers.push(layer);
    });
    _oobHiddenLayers.forEach(l => map.removeLayer(l));

    // Drop a banner at top of viewport explaining the mode + exit button
    let banner = document.getElementById('oob-mode-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'oob-mode-banner';
      banner.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:9000;background:rgba(8,16,28,0.95);border:2px solid #66ddff;border-left:6px solid #66ddff;padding:10px 18px;color:#66ddff;font-family:Courier New,monospace;font-size:12px;letter-spacing:2px;display:flex;gap:14px;align-items:center;box-shadow:0 4px 20px rgba(102,221,255,0.35)';
      document.body.appendChild(banner);
    }
    banner.innerHTML = `
      <span>🛰 OOB MODE · <span style="color:#fff">${theater}</span></span>
      <button id="oob-mode-exit" style="background:rgba(255,85,102,0.15);border:1px solid #ff5566;color:#ff5566;padding:4px 12px;cursor:pointer;font-family:Courier New,monospace;font-size:11px;letter-spacing:1.5px">✕ EXIT OOB MODE</button>`;
    banner.style.display = 'flex';
    document.getElementById('oob-mode-exit').addEventListener('click', () => _exitOobMode(map));
  }

  function _exitOobMode(map) {
    if (!_oobModeActive) return;
    _oobModeActive = false;
    // Remove OOB markers
    _oobMarkers.forEach(m => { try { map.removeLayer(m); } catch(e){} });
    _oobMarkers = [];
    // Restore all the markers we hid
    _oobHiddenLayers.forEach(l => { try { map.addLayer(l); } catch(e){} });
    _oobHiddenLayers = [];
    // Hide the banner
    const banner = document.getElementById('oob-mode-banner');
    if (banner) banner.style.display = 'none';
  }
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
          // Enter OOB Mode — hide all existing map markers so the OOB shows clean
          _enterOobMode(map, theater);
          // Drop big, prominent markers — much more visible than the old subtle dots
          const drop = (item, color, prefix, side) => {
            if (typeof item.lat !== 'number' || typeof item.lng !== 'number') return;
            const [snapLat, snapLng] = _snapToWater(item.lat, item.lng, item.type);
            const wasSnapped = (snapLat !== item.lat || snapLng !== item.lng);
            const canonType = _normalizeOobType(item.type);
            const useShipIcon = canonType && typeof window.makeIcon === 'function' && side !== 'terrain';

            let mainMarker;
            if (useShipIcon) {
              // Real ship SVG icon (matches existing game units visually)
              mainMarker = L.marker([snapLat, snapLng], {
                icon: window.makeIcon(canonType, side === 'red' ? 'red' : 'blue', false, Math.random() * 360),
                zIndexOffset: 600,
              }).addTo(map);
            } else {
              // Fall back to colored circle for terrain / unknown types
              mainMarker = L.circleMarker([snapLat, snapLng], {
                radius: 11, color, weight: 3, fillColor: color, fillOpacity: 0.6,
              }).addTo(map);
            }
            // Always-visible label below the icon
            const label = L.marker([snapLat, snapLng], {
              icon: L.divIcon({
                className: '',
                html: `<div style="background:rgba(8,16,28,0.92);border:1px solid ${color}99;border-left:3px solid ${color};color:${color};font-family:Courier New,monospace;font-size:9px;letter-spacing:1px;padding:1px 5px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.6);text-shadow:0 0 3px #000">${(item.unit || item.name || '?').toString().slice(0, 24)}</div>`,
                iconSize: [120, 16], iconAnchor: [-12, -4],
              }),
              zIndexOffset: 700,
              interactive: false,
            }).addTo(map);
            // Pulse ring (visual emphasis)
            const ring = L.circle([snapLat, snapLng], {
              radius: 8000, color, weight: 1, fillOpacity: 0.04, opacity: 0.35, interactive: false,
            }).addTo(map);

            const snapNote = wasSnapped ? `<div style="margin-top:3px;color:#ffaa44;font-size:10px;font-style:italic">⚓ Snapped to water (LLM put it on land at ${item.lat?.toFixed(3)}°, ${item.lng?.toFixed(3)}°)</div>` : '';
            mainMarker.bindPopup(`<div style="font-family:Courier New,monospace;font-size:11px;color:#222;background:#fff;padding:10px;min-width:260px;max-width:340px"><div style="color:${color};letter-spacing:2px;font-size:10px;font-weight:bold">${prefix} · ${item.type || ''}</div><div style="font-weight:bold;margin-top:3px;font-size:13px">${item.unit || item.name || '(unnamed)'}</div><div style="margin-top:5px;color:#444;line-height:1.4">${item.capability || item.significance || ''}</div><div style="margin-top:5px;color:#888;font-size:10px">📍 ${snapLat.toFixed(3)}°, ${snapLng.toFixed(3)}°</div>${snapNote}<div style="margin-top:6px;font-size:9px;color:#999">SOURCE: AI-generated OOB · Llama 3.1 8B</div></div>`, { autoPan: false, maxWidth: 360 });
            // Tooltip on hover so user sees info before clicking
            mainMarker.bindTooltip(`<b>${item.unit || item.name || '?'}</b><br><span style="color:${color}">${item.type || ''}</span>`, {
              permanent: false, direction: 'top', offset: [0, -10], opacity: 0.92,
            });
            _oobMarkers.push(mainMarker, label, ring);
          };
          (o.blue_force || []).forEach(u => drop(u, '#44aaff', 'BLUE'));
          (o.red_force || []).forEach(u => drop(u, '#ff5566', 'RED'));
          (o.key_terrain || []).forEach(t => drop(t, '#ffaa44', 'TERRAIN'));
          // Auto-pan/zoom to fit the new OOB markers (especially important
          // for Taiwan / Red Sea / other non-Hormuz theaters)
          const allLatLngs = [
            ...(o.blue_force || []),
            ...(o.red_force || []),
            ...(o.key_terrain || []),
          ].filter(x => typeof x.lat === 'number' && typeof x.lng === 'number')
           .map(x => [x.lat, x.lng]);
          if (allLatLngs.length >= 2) {
            try { map.fitBounds(L.latLngBounds(allLatLngs), { padding: [60, 60], maxZoom: 7 }); } catch (e) {}
          } else if (allLatLngs.length === 1) {
            try { map.setView(allLatLngs[0], 7); } catch (e) {}
          }
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
