// Demo narrative system — guided tour overlay for hackathon demos
// Slides in from the bottom, explains each feature as it demonstrates it.

const SLIDES = [
  {
    label: 'INTRODUCTION',
    title: 'HORMUZ // AI WARGAME',
    body: 'Set in the real Strait of Hormuz, April 2026. 21% of global oil — 18.5 million barrels per day — transits this 33-mile chokepoint. The Iran ceasefire expired 3 days ago. This is what a near-future crisis looks like.',
    color: '#4488cc',
    mapTarget: [26.0, 56.5, 7],
  },
  {
    label: 'THE STAKES',
    title: 'LIVE ECONOMIC ESCALATION ENGINE',
    body: 'The right panel tracks real consequences in real time: oil price risk percentage, war-risk insurance status (Lloyd\'s suspended coverage Apr 18), strait closure, and a 6-rung escalation ladder from HARASS → SEIZURE → MINING → STRIKE → CLOSURE → WAR. Every ship movement changes these numbers.',
    color: '#ffaa33',
    mapTarget: null,
    highlightEl: 'econ-bar',
  },
  {
    label: 'YOUR FORCES',
    title: 'US NAVY BLUE CELL — YOUR COMMAND',
    body: 'You command 4 blue units: USS Spruance (destroyer), USS Monterey (cruiser), USS Bataan (amphibious assault), and MV Pacific Lion (tanker). MISSION: escort the tanker through the Traffic Separation Scheme before IRGC forces close the strait permanently.',
    color: '#44cc88',
    mapTarget: [26.35, 56.1, 9],
  },
  {
    label: 'AI RED CELL',
    title: 'IRGC COMMANDER — PLAYED BY LOCAL AI',
    body: 'Red units are controlled by a local AI model (Llama 3.1 8B running on the GPU — no cloud, no latency). Each turn it reasons out loud about your moves and formulates a tactical response. Speedboats reposition. Mines deploy. The reasoning appears live in the log panel.',
    color: '#cc4444',
    mapTarget: [26.6, 55.05, 10],
  },
  {
    label: 'WEAPONS & COUNTERMEASURES',
    title: 'ACTION BAR — FULL CAPABILITY SET',
    body: 'Select a blue unit to unlock its actions: CIWS (60% missile intercept), EW JAMMING (degrades radar lock for 2 turns), AIR COVER (F/A-18 CAP — −70% threat), AIR STRIKE (click any target to destroy it), MINE SWEEP (clears 10nm corridor), KILL RADAR (neutralizes Noor anti-ship battery).',
    color: '#44ffee',
    highlightEl: 'action-bar',
  },
  {
    label: 'AIS SHIP TRAFFIC',
    title: 'LIVE-SIMULATED VESSEL TRAFFIC',
    body: '15 civilian vessels move through the strait in real time — tankers, container ships, bulk carriers. Each has a real vessel name, flag, MMSI, course, and speed. They trigger the transit counter at chokepoint longitude 56.4°E. Click any ship for its full AIS record.',
    color: '#aaddff',
    mapTarget: [25.8, 57.2, 8],
  },
  {
    label: 'VLM INTEL — FEATURE 1',
    title: '🔭 INTEL — VISION LANGUAGE MODEL ANALYSIS',
    body: 'Click INTEL, then draw a box anywhere on the map. Llama 3.2 Vision 11B — running entirely on the local GPU, fully air-gapped, no API calls — analyzes the ArcGIS satellite image. Output: aircraft count, vessel count, infrastructure classification, and fractional grid positions for each detected asset.',
    color: '#aa66ff',
    mapTarget: [27.21, 56.38, 11],
    pulse: 'intel-btn',
  },
  {
    label: 'VLM INTEL — FEATURE 2',
    title: '🗺 SURVEY — PARALLEL 3×3 TILE ANALYSIS',
    body: 'SURVEY splits your selection into a 3×3 grid. Pass 1: all 9 tiles classified simultaneously for military relevance. Pass 2: POI tiles broken into 2×2 sub-tiles, aircraft counted in parallel via Promise.all. Pass 3: AI synthesizes a single consolidated intelligence report. Average time: ~45 seconds.',
    color: '#ffaa44',
    mapTarget: [27.21, 56.38, 10],
    pulse: 'survey-btn',
  },
  {
    label: 'VLM INTEL — FEATURE 3',
    title: '✈ AIR INTEL — 91 AIRPORTS SCANNED',
    body: 'Every count was obtained by directly analyzing ArcGIS satellite imagery — Egypt to India, 91 airports. Color scale: gray = 0, green < 30, yellow < 80, orange < 150, red ≥ 150. Dubai had 38, Hamad (Doha) had 47, Bengaluru had 24. The full regional air order of battle in one click.',
    color: '#44ffcc',
    mapTarget: [26.5, 51.0, 5],
    action: 'show-air-intel',
    pulse: 'airport-intel-btn',
  },
  {
    label: 'VLM INTEL — FEATURE 4',
    title: '🛰 SENTINEL-2 MULTISPECTRAL IMAGERY',
    body: 'Pull ESA Sentinel-2 satellite passes (last 10 days) for any area of the map. Switch between acquisition dates and use the drag-slider to compare before vs. after imagery side-by-side. AI analysis detects ship presence, construction activity, and military buildup across time.',
    color: '#33aaff',
    mapTarget: [26.55, 55.35, 9],
    pulse: 'sentinel-btn',
  },
  {
    label: 'SCENARIO ENGINE',
    title: '↺ DYNAMIC AI SCENARIO GENERATION',
    body: 'Hit NEW SCENARIO for a fresh crisis built by the local LLM. Every scenario generates: strategic situation briefing, blue cell intelligence report, rules of engagement, IRGC starting posture, and special conditions. Civilian vessels can be hostages. Mines can be pre-seeded. No two games play the same.',
    color: '#4488cc',
    mapTarget: [26.0, 56.5, 7],
    pulse: 'btn-new-scenario',
  },
  {
    label: 'RUN THE DEMO',
    title: '▶▶ WATCH FULL OPERATION — AI VS AI',
    body: 'Hit the DEMO button to watch a full automated engagement: ship movements, IRGC ambush, EW jamming, airstrike on Noor battery, mine sweep, and final strait transit. Every turn adjudicated by the local AI. Takes about 3 minutes. The ships you see moving are making real tactical decisions.',
    color: '#ffdd44',
    mapTarget: [26.2, 56.3, 8],
    pulse: 'btn-demo',
  },
];

let _currentSlide = 0;
let _active = false;
let _autoTimer = null;
let _mapRef = null;
let _airIntelShown = false;

function _getEl(id) { return document.getElementById(id); }

function _pulseBtn(id, durationMs = 2000) {
  const el = _getEl(id);
  if (!el) return;
  el.style.transition = 'box-shadow 0.3s';
  el.style.boxShadow = '0 0 18px 4px currentColor';
  setTimeout(() => { el.style.boxShadow = ''; }, durationMs);
}

function _highlightEl(id) {
  const el = _getEl(id);
  if (!el) return;
  const orig = el.style.outline;
  el.style.outline = '2px solid #ffdd44';
  el.style.outlineOffset = '3px';
  setTimeout(() => { el.style.outline = orig; el.style.outlineOffset = ''; }, 3000);
}

function _renderDots() {
  const container = _getEl('tour-dots');
  if (!container) return;
  const color = SLIDES[_currentSlide]?.color ?? '#4488cc';
  container.style.color = color;
  container.innerHTML = SLIDES.map((_, i) =>
    `<span class="tour-dot${i === _currentSlide ? ' active' : ''}" data-i="${i}" style="${i === _currentSlide ? `background:${color}` : ''}"></span>`
  ).join('');
  container.querySelectorAll('.tour-dot').forEach(d =>
    d.addEventListener('click', () => _goTo(parseInt(d.dataset.i)))
  );
}

function _applySlide(idx) {
  const slide = SLIDES[idx];
  if (!slide) return;

  const bar = _getEl('tour-bar');
  if (!bar) return;

  bar.style.borderTopColor = slide.color;

  const label = _getEl('tour-slide-label');
  const title = _getEl('tour-slide-title');
  const body  = _getEl('tour-slide-body');
  const step  = _getEl('tour-step-num');

  if (label) { label.textContent = slide.label; label.style.color = slide.color; }
  if (title) title.textContent = slide.title;
  if (body)  body.textContent  = slide.body;
  if (step)  step.textContent  = `${idx + 1} / ${SLIDES.length}`;

  _renderDots();

  // Map navigation
  if (slide.mapTarget && _mapRef) {
    const [lat, lng, zoom] = slide.mapTarget;
    _mapRef.flyTo([lat, lng], zoom, { duration: 1.8 });
  }

  // Pulse a button
  if (slide.pulse) setTimeout(() => _pulseBtn(slide.pulse, 2500), 600);

  // Highlight a panel element
  if (slide.highlightEl) setTimeout(() => _highlightEl(slide.highlightEl), 400);

  // Special actions
  if (slide.action === 'show-air-intel' && !_airIntelShown) {
    _airIntelShown = true;
    setTimeout(() => { _getEl('airport-intel-btn')?.click(); }, 1800);
  }
}

function _goTo(idx) {
  clearTimeout(_autoTimer);
  _currentSlide = Math.max(0, Math.min(SLIDES.length - 1, idx));
  _applySlide(_currentSlide);
}

function _next() {
  if (_currentSlide >= SLIDES.length - 1) { stop(); return; }
  _goTo(_currentSlide + 1);
}

function _prev() {
  _goTo(_currentSlide - 1);
}

function start(map) {
  _mapRef = map;
  _active = true;
  _currentSlide = 0;
  _airIntelShown = false;

  const bar = _getEl('tour-bar');
  if (bar) {
    bar.classList.add('visible');
    bar.style.animation = 'none';
  }

  _applySlide(0);

  const tourBtn = _getEl('btn-tour');
  if (tourBtn) tourBtn.textContent = '✕ EXIT TOUR';

  _getEl('tour-next')?.addEventListener('click', _next);
  _getEl('tour-prev')?.addEventListener('click', _prev);
  _getEl('tour-exit')?.addEventListener('click', stop);
}

function stop() {
  _active = false;
  clearTimeout(_autoTimer);

  const bar = _getEl('tour-bar');
  if (bar) bar.classList.remove('visible');

  const tourBtn = _getEl('btn-tour');
  if (tourBtn) tourBtn.textContent = '▶ GUIDED TOUR';

  _getEl('tour-next')?.removeEventListener('click', _next);
  _getEl('tour-prev')?.removeEventListener('click', _prev);
  _getEl('tour-exit')?.removeEventListener('click', stop);
}

function isActive() { return _active; }

export { start, stop, isActive };
