// Auto-Loop Demo: hands-free walkthrough of every major feature.
// Click ▶ AUTO DEMO in action bar → narration overlay walks through 8 steps,
// auto-clicking buttons + filling inputs at each. ESC or ✕ aborts.
(function () {
  let _demoActive = false;
  let _demoAborted = false;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const click = (sel) => { const el = typeof sel === 'string' ? document.querySelector(sel) : sel; if (el) el.click(); };

  // Narration overlay — fixed banner at top of screen
  function _ensureBanner() {
    let b = $('auto-demo-banner');
    if (b) return b;
    b = document.createElement('div');
    b.id = 'auto-demo-banner';
    b.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:9700;background:rgba(8,16,28,0.95);border:2px solid #44cc88;border-left:6px solid #44cc88;padding:14px 24px;color:#fff;font-family:Courier New,monospace;max-width:720px;width:90%;box-shadow:0 8px 30px rgba(68,204,136,0.4);display:none';
    b.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px">
        <div style="flex:1">
          <div id="auto-demo-step" style="color:#44cc88;font-size:11px;letter-spacing:3px;margin-bottom:4px"></div>
          <div id="auto-demo-text" style="font-size:13px;line-height:1.5"></div>
        </div>
        <button id="auto-demo-abort" style="background:rgba(255,85,102,0.15);border:1px solid #ff5566;color:#ff5566;padding:4px 10px;cursor:pointer;font-family:Courier New,monospace;font-size:10px;letter-spacing:1.5px">✕ ABORT</button>
      </div>
      <div id="auto-demo-progress" style="margin-top:10px;height:3px;background:rgba(68,204,136,0.15);position:relative;overflow:hidden">
        <div id="auto-demo-bar" style="position:absolute;top:0;left:0;height:100%;background:#44cc88;width:0%;transition:width 0.3s ease"></div>
      </div>`;
    document.body.appendChild(b);
    $('auto-demo-abort').addEventListener('click', () => { _demoAborted = true; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && _demoActive) _demoAborted = true; });
    return b;
  }

  function _say(stepLabel, narrationText, progressPct) {
    const b = _ensureBanner();
    b.style.display = 'block';
    $('auto-demo-step').textContent = stepLabel;
    $('auto-demo-text').textContent = narrationText;
    $('auto-demo-bar').style.width = progressPct + '%';
  }

  function _hide() {
    const b = $('auto-demo-banner');
    if (b) b.style.display = 'none';
  }

  async function _wait(ms) {
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (_demoAborted) throw new Error('aborted');
      await sleep(50);
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // The demo sequence
  // ─────────────────────────────────────────────────────────────────────
  async function runDemo() {
    if (_demoActive) return;
    _demoActive = true;
    _demoAborted = false;

    try {
      // ── STEP 1 — Intro ───────────────────────────────────────────
      _say('STEP 1 / 11 · INTRODUCTION',
        'Strait of Consequences — a fully air-gapped AI wargame for the Strait of Hormuz. ' +
        'Local Llama 3.1 8B + Llama 3.2 Vision 11B. Zero cloud calls, zero API keys.',
        10);
      await _wait(11000);

      // ── STEP 2 — Pick a scenario ────────────────────────────────
      _say('STEP 2 / 11 · DECISION-DRIVEN EXERCISE',
        'Four hand-authored scenarios on the escalation ladder — HARASS to STRIKE. ' +
        'Switching to the EXERCISE tab now.',
        18);
      const exTab = document.querySelector('.panel-tab[data-tab="exercise"]')
        || document.querySelector('[data-tab="exercise"]')
        || document.getElementById('tab-exercise');
      if (exTab) exTab.click();
      await _wait(5000);

      _say('STEP 2 / 11 · DECISION-DRIVEN EXERCISE',
        'Clicking SEIZURE — IRGC has boarded a UAE-flagged tanker. Bottom overlay opens with ' +
        'scenario brief, Turn 1 inject, and 5 inline DIME+ decision cards.',
        22);
      const firstScenarioCard = document.querySelector('.scenario-card')
        || document.querySelector('[data-scenario-id]');
      if (firstScenarioCard) firstScenarioCard.click();
      await _wait(13000);

      // ── STEP 3 — Pick a decision ───────────────────────────────
      _say('STEP 3 / 11 · DIME+ DECISION + LIVE MAP',
        'Picking a decision applies indicator deltas, runs branching logic, and fires live map ' +
        'visualization — entity pulse, key-vessel isolation, dim non-relevant ships.',
        30);
      await _wait(3500);
      const firstDecCard = document.querySelector('.overlay-dec-card');
      if (firstDecCard) firstDecCard.click();
      await _wait(15000);

      // ── STEP 4 — OSM Infrastructure ────────────────────────────
      _say('STEP 4 / 11 · OSM INFRASTRUCTURE LAYER',
        '840 real-world strategic assets pulled from OpenStreetMap via Overpass API: ' +
        'refineries, oil terminals, airports, ports, military bases, naval bases, power plants.',
        38);
      if (typeof window.endExercise === 'function') window.endExercise();
      await _wait(800);
      click('#btn-osm-infra');
      await _wait(11000);
      click('#btn-osm-infra'); // toggle off

      // ── STEP 5 — Gulf events feed ──────────────────────────────
      _say('STEP 5 / 11 · GULF EVENTS FEED',
        '16 ACLED-style cached April 2026 incidents — color-coded by event type. ' +
        'Maritime, military posture, diplomatic, economic, intelligence.',
        46);
      click('#btn-gulf-feed');
      await _wait(11000);
      click('#gulf-feed-close');
      await _wait(800);

      // ── STEP 6 — VLM tools (INTEL / SURVEY) ────────────────────
      _say('STEP 6 / 11 · LIVE VLM TOOLS · INTEL + SURVEY',
        'Three vision-language tools all using Llama 3.2 Vision 11B locally. INTEL — draw a box, ' +
        '4 parallel queries (aircraft, vessels, infra, position) in ~10 seconds. SURVEY — 3×3 grid, ' +
        '36 queries across nine sub-tiles for high-density target areas like airbases.',
        50);
      // Briefly highlight the INTEL button (visual cue without triggering draw mode)
      const intelBtn = $('intel-btn');
      if (intelBtn) {
        const orig = intelBtn.style.boxShadow;
        intelBtn.style.boxShadow = '0 0 0 4px #aa66ff, 0 0 24px #aa66ff';
        intelBtn.style.transition = 'box-shadow 0.4s';
        setTimeout(() => { intelBtn.style.boxShadow = orig; }, 4000);
      }
      const surveyBtn = $('survey-btn');
      if (surveyBtn) {
        const orig = surveyBtn.style.boxShadow;
        surveyBtn.style.boxShadow = '0 0 0 4px #ffaa44, 0 0 24px #ffaa44';
        surveyBtn.style.transition = 'box-shadow 0.4s';
        setTimeout(() => { surveyBtn.style.boxShadow = orig; }, 4000);
      }
      await _wait(10000);

      // ── STEP 7 — Sentinel-2 satellite imagery (Kish Island airport) ──
      _say('STEP 7 / 11 · SENTINEL-2 — KISH ISLAND AIRPORT',
        'Zooming the map to Kish Island International — Iranian civilian airport, IRGC-controlled. ' +
        'Drawing the AOI box and pulling real ESA Sentinel-2 passes for the last 10 days.',
        58);
      const KISH_LAT = 26.526, KISH_LNG = 53.98;
      const map = window.game && window.game._map;
      let kishBox = null;
      if (map) {
        // Pan + zoom to Kish
        map.setView([KISH_LAT, KISH_LNG], 12, { animate: true });
        await _wait(2500);
        // Draw a visible AOI rectangle showing the Sentinel bbox (glowing cyan)
        const PAD = 0.05; // ~5.5km box
        kishBox = L.rectangle(
          [[KISH_LAT - PAD, KISH_LNG - PAD], [KISH_LAT + PAD, KISH_LNG + PAD]],
          { color: '#33aaff', weight: 3, fillColor: '#33aaff', fillOpacity: 0.08, dashArray: '6 4' }
        ).addTo(map);
        // Pulsing label on the box
        const aoiLabel = L.marker([KISH_LAT + PAD + 0.01, KISH_LNG], {
          icon: L.divIcon({
            html: `<div style="background:rgba(8,16,28,0.95);border:1px solid #33aaff;color:#33aaff;font-family:Courier New,monospace;font-size:10px;padding:3px 8px;letter-spacing:1.5px;white-space:nowrap;box-shadow:0 0 8px #33aaff">📡 SENTINEL AOI · KISH AIRPORT</div>`,
            className: '', iconAnchor: [-40, 0],
          }),
          interactive: false,
        }).addTo(map);
        kishBox._label = aoiLabel;
        await _wait(2000);
      }
      // Highlight the SENTINEL button briefly
      const sentinelBtn = $('sentinel-btn');
      if (sentinelBtn) {
        const orig = sentinelBtn.style.boxShadow;
        sentinelBtn.style.boxShadow = '0 0 0 4px #33aaff, 0 0 28px #33aaff';
        sentinelBtn.style.transition = 'box-shadow 0.4s';
        setTimeout(() => { sentinelBtn.style.boxShadow = orig; }, 5000);
      }
      click('#sentinel-btn');
      // Wait for thumbnails to populate (real ESA fetch takes 5-15s)
      for (let i = 0; i < 50; i++) {
        if (_demoAborted) break;
        const strip = document.getElementById('sentinel-filmstrip');
        if (strip && strip.children.length >= 2) break;
        await sleep(500);
      }
      await _wait(2000);

      _say('STEP 7 / 11 · SENTINEL-2 COMPARE MODE',
        'Switching to COMPARE mode — drag-slider before/after split-screen. Operator picks two dates ' +
        'from the filmstrip; VLM analyzes the diff for ship presence shifts, infrastructure changes.',
        62);
      click('#sentinel-btn-compare');
      await _wait(8000);

      // Close panel + remove the AOI box
      click('#sentinel-panel-close');
      if (kishBox && map) {
        try { map.removeLayer(kishBox); } catch (e) {}
        try { if (kishBox._label) map.removeLayer(kishBox._label); } catch (e) {}
      }
      await _wait(1500);

      // ── STEP 8 — AI Scenario Generator ─────────────────────────
      _say('STEP 8 / 11 · AI SCENARIO GENERATOR',
        'Type a one-line premise — Llama 3.1 8B writes a complete 4-turn scenario with ' +
        '20 hand-tagged DIME+ decisions. Generation runs ~30-50 seconds on local GPU.',
        62);
      click('#btn-ai-scenario');
      await _wait(1500);
      const scenInput = $('ai-scenario-input');
      if (scenInput) {
        scenInput.value = 'IRGC mines a Saudi VLCC near Kharg Island, Brent jumps to 118';
        scenInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await _wait(3500);
      click('#ai-scenario-generate');
      for (let i = 0; i < 180; i++) {
        if (_demoAborted) throw new Error('aborted');
        const out = $('ai-scenario-output');
        if (out && out.innerHTML.includes('TURN 1 INJECT')) break;
        await sleep(500);
      }
      await _wait(7000);
      click('#ai-scenario-close');
      await _wait(1500);

      // ── STEP 6.5 — Spawn adversaries + Simulate Blue Transit ──
      _say('STEP 9 / 11 · MONTE-CARLO COMBAT SIM',
        'Spawning adversaries — randomized red unit drops at water-only anchors. Then ' +
        'simulating Blue formation transit. When Iran fires, watch the engagement modal pop.',
        70);
      // Spawn twice for drama
      click('#btn-spawn-adv');
      await _wait(1500);
      click('#btn-spawn-adv');
      await _wait(2500);
      // Simulate Blue Transit
      click('#btn-sim-transit');
      // Wait up to 60s for the engagement modal, watching every 200ms
      let modalSeen = false;
      for (let i = 0; i < 300; i++) {
        if (_demoAborted) throw new Error('aborted');
        const mod = $('response-modal');
        if (mod && mod.style.display !== 'none' && getComputedStyle(mod).display !== 'none') {
          modalSeen = true;
          break;
        }
        await sleep(200);
      }
      if (modalSeen) {
        _say('STEP 9 / 11 · BLUE COMMAND DECISION',
          'IRGC fired. The transit pauses for a Blue ROE decision. Auto-picking ACTIVE DEFENSE — ' +
          'CIWS engaged, no return fire. Iran reads resolve; no further escalation.',
          74);
        await _wait(4500);
        // Click the ACTIVE_DEFENSE button (second option in the modal)
        const opts = document.querySelectorAll('#response-modal-options button');
        if (opts && opts[1]) opts[1].click();
        // Wait for AAR modal to appear (transit completes)
        for (let i = 0; i < 240; i++) {
          if (_demoAborted) throw new Error('aborted');
          const aar = $('aar-modal');
          if (aar && aar.style.display === 'flex') break;
          await sleep(250);
        }
        _say('STEP 9 / 11 · AFTER-ACTION REVIEW',
          'Transit complete. AAR opens with the structured debrief — outcome, engagements, Blue ' +
          'command decision, indicator deltas. AI-generated observations stream in below.',
          78);
        await _wait(8000);
        // Close AAR
        click('#aar-close');
        await _wait(800);
      } else {
        // No engagement happened (probabilistic) — just wait a bit then move on
        _say('STEP 9 / 11 · UNCONTESTED TRANSIT',
          'No IRGC fire this run — Monte-Carlo probabilistic combat doesn\'t fire every transit. ' +
          'Run it again, get a different distribution.',
          78);
        await _wait(5000);
      }
      // RESET to clear spawned adversaries before next OOB step
      click('#btn-reset-all');
      await _wait(2000);

      // ── STEP 8 — AI OOB Generator (Taiwan) ─────────────────────
      _say('STEP 10 / 11 · AI ORDER-OF-BATTLE',
        'Same engine works in any theater. Watch the platform pivot to East Asia — ' +
        'PLA Navy, ROC frigates, US 7th Fleet, key terrain. Map auto-flies + OOB Mode hides clutter.',
        87);
      click('#btn-ai-oob');
      await _wait(800);
      const oobInput = $('ai-oob-input');
      if (oobInput) {
        oobInput.value = 'Taiwan Strait';
        oobInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await _wait(1500);
      click('#ai-oob-generate');
      // Wait for OOB to come back, then click render
      for (let i = 0; i < 80; i++) {
        if (_demoAborted) throw new Error('aborted');
        const renderBtn = $('ai-oob-render');
        if (renderBtn) break;
        await sleep(500);
      }
      await _wait(2000);
      click('#ai-oob-render');
      await _wait(8000);
      // Exit OOB mode
      const exitBtn = $('oob-mode-exit');
      if (exitBtn) exitBtn.click();
      await _wait(1500);

      // ── STEP 9 — Wrap-up ───────────────────────────────────────
      _say('STEP 11 / 11 · COMPLETE · LOOPING IN 8 SEC',
        'Air-gapped. Local LLMs. Zero cloud. Six AI agent features. 863-doc RAG corpus. ' +
        'Decision-driven wargaming the way RAND, CSIS, and NWC Newport actually run it.',
        100);
      await _wait(6000);

    } catch (e) {
      if (e.message === 'aborted') {
        _say('DEMO ABORTED', 'Auto-demo stopped by user. Click ▶ AUTO DEMO again to restart.', 0);
        await _wait(2500);
      } else {
        console.error('[auto-demo]', e);
      }
    } finally {
      _hide();
      _demoActive = false;
      _demoAborted = false;
    }

    // Loop after 1 sec unless aborted
    if (!_demoAborted) {
      await sleep(1000);
      runDemo();
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Wire button
  // ─────────────────────────────────────────────────────────────────────
  window.addEventListener('load', () => {
    const tryWire = () => {
      const btn = $('btn-auto-demo');
      if (!btn) return setTimeout(tryWire, 400);
      btn.addEventListener('click', () => {
        if (_demoActive) {
          _demoAborted = true;
        } else {
          runDemo();
        }
      });
    };
    tryWire();
  });

  window.AutoDemo = { run: runDemo, abort: () => { _demoAborted = true; } };
})();
