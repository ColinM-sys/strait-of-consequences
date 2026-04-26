// ── Leaflet Wargame Engine ────────────────────────────────────────────────────
// Real satellite map, click-to-control ships, WASD/arrow movement,
// threat zones as shrinkable circles.

export const UNIT_ACTIONS = {
  carrier:   ['air_cover', 'airstrike'],
  destroyer: ['ciws', 'airstrike', 'sigint'],
  ddg102:    ['ciws', 'mine_sweep', 'airstrike', 'sigint'], // MCM ship only
  cruiser:   ['ciws', 'ew_jam', 'sigint'],
  tanker:    [],
};

// Per-turn step budget (each keypress / click = 1 step of MOVE_STEP degrees)
export const MOVE_STEPS = {
  carrier: 5, destroyer: 7, cruiser: 6,
  tanker: 4, fac: 10, submarine: 6,
  minelayer: 4, coastal_battery: 0,
};
const MOVE_STEP = 0.028; // degrees per step ≈ 3km — about 1 ship-length on screen

// Keep for backwards compat (ui.js speed display)
export const MOVE_SPEED_DEG = Object.fromEntries(
  Object.entries(MOVE_STEPS).map(([k, v]) => [k, v * MOVE_STEP])
);

// Real lat/lng starting positions
const UNIT_DEFS = [
  // US Navy — eastern Gulf of Oman, approaching strait from east
  { id:'cvn76',   name:'CVN-76 REAGAN',     side:'blue', type:'carrier',          lat:23.40, lng:61.85 },
  { id:'ddg102',  name:'DDG-102 SAMPSON',   side:'blue', type:'destroyer',        lat:23.70, lng:61.55 },
  { id:'ddg119',  name:'DDG-119 D.BLACK',   side:'blue', type:'destroyer',        lat:23.10, lng:61.60 },
  { id:'cg62',    name:'CG-62 CHANCELLORS', side:'blue', type:'cruiser',          lat:23.55, lng:62.20 },
  { id:'tanker1', name:'MV PACIFIC LION',   side:'blue', type:'tanker',           lat:23.20, lng:62.40 },
  // IRGC — spread west→east: some from Persian Gulf (will intercept from the rear),
  // some at the chokepoint (front line defense). Creates two-layer trap.
  { id:'fac1',  name:'IRGC FAC-1',      side:'red', type:'fac',             lat:26.36, lng:52.10 },  // wp9 — western Persian Gulf
  { id:'fac2',  name:'IRGC FAC-2',      side:'red', type:'fac',             lat:26.50, lng:51.90 },  // deep western Persian Gulf
  { id:'fac3',  name:'IRGC FAC-3',      side:'red', type:'fac',             lat:26.45, lng:55.30 },  // chokepoint forward screen
  { id:'fac4',  name:'IRGC FAC-4',      side:'red', type:'fac',             lat:25.14, lng:53.81 },  // wp7 — mid-strait ambush
  { id:'sub1',  name:'IRS GHADIR-881',  side:'red', type:'submarine',       lat:25.58, lng:54.92 },  // wp6 — silent mid-strait
  { id:'mine1', name:'IRGC MINELAYER',  side:'red', type:'minelayer',       lat:26.45, lng:56.25 },  // TSS entry minefield
];

// Threat zones (real geography)
const THREAT_ZONES_DEF = [
];

// Invisible trigger zones — when blue units enter, IRGC FAC reinforcements spawn
const SPAWN_ZONES = [
  { id:'abumusa',    lat:25.87, lng:55.03, radiusKm:55, name:'ABU MUSA STAGING',  spawnLat:25.90, spawnLng:55.05 },
  { id:'chokepoint', lat:26.40, lng:56.50, radiusKm:42, name:'CHOKEPOINT SECTOR', spawnLat:26.38, spawnLng:56.45 },
];

// Civilian ships transiting the strait (real AIS-style positions, April 2026)
const CIVILIAN_SHIPS = [
  { id:'civ1',  name:'MT GULF STAR',      flag:'🇸🇦', lat:26.10, lng:56.90 },
  { id:'civ2',  name:'MV ASIA PIONEER',   flag:'🇸🇬', lat:26.00, lng:57.20 },
  { id:'civ3',  name:'MT HORMUZ SPIRIT',  flag:'🇬🇷', lat:26.05, lng:55.90 },
  { id:'civ4',  name:'MV DUBAI BRIDGE',   flag:'🇦🇪', lat:25.90, lng:57.70 },
  { id:'civ5',  name:'MT QESHM TRADER',   flag:'🇵🇦', lat:26.08, lng:56.20 },
  { id:'civ6',  name:'MV PEARL HIGHWAY',  flag:'🇲🇾', lat:25.95, lng:58.00 },
];

// Navigable waypoints — user-traced water path through the strait
const STRAIT_NAV = [
  [23.453, 61.084],
  [24.026, 58.843],
  [24.956, 57.327],
  [25.741, 56.744],
  [26.44, 56.459],
  [26.323, 55.536],
  [25.582, 54.921],
  [25.135, 53.811],
  [25.770, 52.910],
  [26.362, 52.097],
  [27.030, 50.988],
];

// TSS Safe corridor polygon (Oman/south side of strait)
const SAFE_CORRIDOR_POLY = [
  [25.75,58.60],[26.10,57.50],[26.15,56.50],[25.95,55.50],[25.40,55.50],
  [25.30,56.50],[25.25,57.60],[25.40,58.60],
];

// ── SVG icons (top-down view) ─────────────────────────────────────────────────
function shipSVG(type, side, selected) {
  const f  = side === 'blue' ? '#1a4fa0' : '#991111';
  const f2 = side === 'blue' ? '#2d6ed4' : '#cc2222';
  const hi = side === 'blue' ? '#6aabff' : '#ff8888';
  const wk = 'rgba(180,220,255,0.15)';
  // glow ring in square viewBox
  const glow = selected
    ? `<circle r="33" fill="none" stroke="#ffee00" stroke-width="2" stroke-dasharray="5 3" opacity="0.9"/>`
    : '';

  let body;
  switch (type) {

    case 'carrier':
      // Massive flat-top — very long, wide, unmistakable flight deck shape
      body = `
        <ellipse cx="-28" cy="0" rx="9" ry="5" fill="${wk}"/>
        <!-- outer hull -->
        <polygon points="33,5 28,10 -30,10 -33,0 -30,-10 28,-10 33,-5"
          fill="${f}" stroke="${hi}" stroke-width="1"/>
        <!-- flight deck surface — offset to port -->
        <polygon points="31,4 25,9 -28,9 -31,0 -28,-9 0,-9 18,-9 25,-5"
          fill="${f2}" opacity="0.9"/>
        <!-- angled deck line -->
        <line x1="0" y1="-9" x2="20" y2="-5" stroke="${hi}" stroke-width="1" opacity="0.7"/>
        <!-- island superstructure (starboard side) -->
        <rect x="6" y="-9" width="12" height="6" rx="1" fill="${hi}" opacity="0.8"/>
        <rect x="8" y="-11" width="3" height="3" rx="0.5" fill="${hi}" opacity="0.6"/>
        <!-- runway lines -->
        <line x1="-24" y1="3" x2="28" y2="3" stroke="${hi}" stroke-width="0.5" stroke-dasharray="5 4" opacity="0.4"/>
        <line x1="-20" y1="6" x2="26" y2="6" stroke="${hi}" stroke-width="0.3" opacity="0.2"/>`;
      break;

    case 'destroyer':
      // Sleek narrow warship — pointed bow, small profile
      body = `
        <ellipse cx="-22" cy="0" rx="7" ry="3" fill="${wk}"/>
        <!-- narrow hull -->
        <polygon points="30,0 22,5 -20,6 -22,0 -20,-6 22,-5"
          fill="${f}" stroke="${hi}" stroke-width="1"/>
        <!-- deck -->
        <polygon points="27,0 20,4 -17,4 -19,0 -17,-4 20,-4"
          fill="${f2}" opacity="0.75"/>
        <!-- fwd gun turret -->
        <circle cx="20" cy="0" r="3.5" fill="${f}" stroke="${hi}" stroke-width="1"/>
        <rect x="20" y="-1" width="10" height="2" rx="1" fill="${hi}" opacity="0.9"/>
        <!-- bridge -->
        <rect x="3" y="-4" width="9" height="8" rx="1" fill="${hi}" opacity="0.6"/>
        <circle cx="7" cy="0" r="1.5" fill="${hi}"/>
        <!-- aft mount -->
        <circle cx="-11" cy="0" r="2.5" fill="${f}" stroke="${hi}" stroke-width="0.8"/>`;
      break;

    case 'cruiser':
      // Wider than destroyer, more guns, beefier
      body = `
        <ellipse cx="-24" cy="0" rx="8" ry="4" fill="${wk}"/>
        <!-- wider hull -->
        <polygon points="29,0 22,8 -21,8 -24,0 -21,-8 22,-8"
          fill="${f}" stroke="${hi}" stroke-width="1"/>
        <polygon points="26,0 20,6 -18,6 -21,0 -18,-6 20,-6"
          fill="${f2}" opacity="0.75"/>
        <!-- fwd twin guns -->
        <circle cx="19" cy="-3" r="3" fill="${f}" stroke="${hi}" stroke-width="0.8"/>
        <rect x="19" y="-4" width="9" height="2" rx="1" fill="${hi}" opacity="0.85"/>
        <circle cx="19" cy="3" r="3" fill="${f}" stroke="${hi}" stroke-width="0.8"/>
        <rect x="19" y="2" width="9" height="2" rx="1" fill="${hi}" opacity="0.85"/>
        <!-- wide superstructure -->
        <rect x="-2" y="-5" width="14" height="10" rx="1.5" fill="${hi}" opacity="0.55"/>
        <circle cx="5" cy="0" r="2" fill="${hi}"/>
        <!-- VLS boxes each side -->
        <rect x="7" y="-8" width="5" height="3" rx="0.5" fill="${hi}" opacity="0.35"/>
        <rect x="7" y="5" width="5" height="3" rx="0.5" fill="${hi}" opacity="0.35"/>`;
      break;

    case 'tanker':
      // Very wide, boxy, slow-looking — obviously civilian
      body = `
        <ellipse cx="-30" cy="0" rx="10" ry="7" fill="${wk}"/>
        <!-- boxy hull — much wider than warships -->
        <polygon points="30,0 24,14 -28,14 -30,0 -28,-14 24,-14"
          fill="${f}" stroke="${hi}" stroke-width="1"/>
        <!-- flat cargo deck -->
        <rect x="-24" y="-11" width="46" height="22" fill="${f2}" opacity="0.5"/>
        <!-- 3 large tank domes -->
        <circle cx="-14" cy="0" r="6" fill="none" stroke="${hi}" stroke-width="1.2" opacity="0.7"/>
        <circle cx="0"   cy="0" r="6" fill="none" stroke="${hi}" stroke-width="1.2" opacity="0.7"/>
        <circle cx="14"  cy="0" r="6" fill="none" stroke="${hi}" stroke-width="1.2" opacity="0.7"/>
        <!-- bridge house aft -->
        <rect x="20" y="-5" width="8" height="10" rx="1" fill="${hi}" opacity="0.7"/>
        <!-- pipeline spine -->
        <line x1="-22" y1="0" x2="18" y2="0" stroke="${hi}" stroke-width="1.5" opacity="0.4"/>`;
      break;

    case 'fac':
      // Tiny aggressive dart — much smaller and more pointed than anything else
      body = `
        <ellipse cx="-12" cy="0" rx="5" ry="2" fill="${wk}"/>
        <!-- very pointed dart hull -->
        <polygon points="18,0 12,4 -10,4 -12,0 -10,-4 12,-4"
          fill="${f}" stroke="${hi}" stroke-width="1"/>
        <!-- deck -->
        <polygon points="16,0 10,3 -8,3 -10,0 -8,-3 10,-3"
          fill="${f2}" opacity="0.8"/>
        <!-- dual rocket tubes -->
        <rect x="1" y="-3.5" width="10" height="2" rx="0.5" fill="${hi}" opacity="0.9"/>
        <rect x="1" y="1.5"  width="10" height="2" rx="0.5" fill="${hi}" opacity="0.9"/>
        <!-- cockpit dot -->
        <circle cx="-2" cy="0" r="2" fill="${hi}"/>`;
      break;

    case 'submarine':
      // Pure cigar — no surface detail, just the hull shape and sail
      body = `
        <ellipse cx="-20" cy="0" rx="6" ry="2.5" fill="${wk}"/>
        <!-- cigar pressure hull -->
        <ellipse rx="26" ry="10" fill="${f}" stroke="${hi}" stroke-width="1"/>
        <!-- inner hull line -->
        <ellipse rx="23" ry="7" fill="${f2}" opacity="0.45"/>
        <!-- conning tower sail — tall rectangle above hull -->
        <rect x="-3" y="-16" width="10" height="12" rx="2" fill="${f}" stroke="${hi}" stroke-width="1"/>
        <rect x="-1" y="-14" width="6" height="8" rx="1" fill="${hi}" opacity="0.3"/>
        <!-- dive planes — wide fins -->
        <polygon points="-10,-10 -20,-18 -20,-10" fill="${f2}" stroke="${hi}" stroke-width="0.7"/>
        <polygon points="-10,10 -20,18 -20,10"  fill="${f2}" stroke="${hi}" stroke-width="0.7"/>
        <!-- prop -->
        <circle cx="-24" cy="0" r="3" fill="${f}" stroke="${hi}" stroke-width="0.7"/>`;
      break;

    case 'minelayer':
      body = `
        <ellipse cx="-18" cy="0" rx="7" ry="3" fill="${wk}"/>
        <polygon points="22,0 16,7 -16,7 -18,0 -16,-7 16,-7"
          fill="${f}" stroke="${hi}" stroke-width="1"/>
        <polygon points="19,0 14,5 -13,5 -15,0 -13,-5 14,-5"
          fill="${f2}" opacity="0.7"/>
        <!-- 6 mines on deck in 2 rows -->
        <circle cx="-8" cy="-2.5" r="2.8" fill="#ff8800" stroke="#cc6600" stroke-width="0.8"/>
        <circle cx="0"  cy="-2.5" r="2.8" fill="#ff8800" stroke="#cc6600" stroke-width="0.8"/>
        <circle cx="8"  cy="-2.5" r="2.8" fill="#ff8800" stroke="#cc6600" stroke-width="0.8"/>
        <circle cx="-8" cy="2.5"  r="2.8" fill="#ff8800" stroke="#cc6600" stroke-width="0.8"/>
        <circle cx="0"  cy="2.5"  r="2.8" fill="#ff8800" stroke="#cc6600" stroke-width="0.8"/>
        <circle cx="8"  cy="2.5"  r="2.8" fill="#ff8800" stroke="#cc6600" stroke-width="0.8"/>`;
      break;

    case 'coastal_battery':
      body = `
        <!-- earthwork berm -->
        <polygon points="0,-28 20,-20 28,0 20,20 0,28 -20,20 -28,0 -20,-20"
          fill="${f}" stroke="${hi}" stroke-width="1"/>
        <polygon points="0,-22 16,-16 22,0 16,16 0,22 -16,16 -22,0 -16,-16"
          fill="${f2}" opacity="0.6"/>
        <!-- turret ring -->
        <circle r="9" fill="${f}" stroke="${hi}" stroke-width="1.2"/>
        <!-- gun barrel — long and obvious -->
        <rect x="6" y="-2.5" width="26" height="5" rx="2" fill="${hi}" opacity="0.95"/>
        <!-- blast deflector -->
        <polygon points="6,-5 6,5 2,6 2,-6" fill="${hi}" opacity="0.6"/>`;
      break;

    default:
      body = `<circle r="12" fill="${f}" stroke="${hi}" stroke-width="1.5"/>`;
  }

  const size = type === 'carrier' ? 96 : type === 'tanker' ? 80 : type === 'fac' ? 48 : type === 'coastal_battery' ? 64 : 72;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-36 -36 72 72">
    ${body}${glow}
  </svg>`;
}

function makeIcon(type, side, selected=false, headingDeg=0) {
  const svg  = shipSVG(type, side, selected);
  // Blue fleet drawn at half-size for less visual congestion in the strait.
  // Red units keep original size so they remain readable as threats.
  const baseSize = type==='carrier' ? 48 : type==='tanker' ? 42 : type==='fac' ? 26 : type==='coastal_battery' ? 34 : 36;
  const size = side === 'blue' ? Math.round(baseSize / 2) : baseSize;
  return L.divIcon({
    html: `<div class="ship-marker${selected?' ship-selected':''}" title="${type}"
              style="transform:rotate(${headingDeg}deg);transform-origin:center">${svg}</div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    className: '',
  });
}

function _pointInPoly(lat, lng, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j];
    if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
}

function _isLand(lat, lng) {
  if (lat > 27.10) return true;                                               // Iran mainland
  if (lat > 26.60 && lat < 26.88 && lng > 55.60 && lng < 57.00) return true; // Qeshm Island body
  if (lat > 25.90 && lat < 26.08 && lng > 56.05 && lng < 56.42) return true; // Musandam tip (nav channel is lat>26.1)
  if (lng > 66.00) return true;
  if (lng < 50.50) return true;
  if (lat < 21.50) return true;
  return false;
}

function _hasLineOfSight(from, to) {
  const steps = 18;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const lat = from.lat + (to.lat - from.lat) * t;
    const lng = from.lng + (to.lng - from.lng) * t;
    if (_isLand(lat, lng)) return false;
  }
  return true;
}

// ── LeafletGame class ─────────────────────────────────────────────────────────
export class LeafletGame {
  constructor(containerId) {
    this._map          = null;
    this._units        = [];
    this._civilians    = [];
    this._threats      = [];
    this._controlled   = null;   // currently controlled blue unit
    this._pendingMoves = [];
    this._pendingActions = [];
    this._turn         = 1;
    this._phase        = 'player';
    this._callbacks    = {};
    this._keyState     = {};
    this._moveInterval = null;
    this._airstrikeMode  = false;
    this._airstrikeUnit  = null;
    this._airstrikeRangeKm = 165;
    this._strikeRangeCircle = null;
    this._spawnCooldown = {}; // zone id → turn number when it last spawned
    this._spawnCounter  = 0;  // for unique IDs
    this._escalation    = 0;  // 0–100: rises with kinetic blue actions; red goes hot above 40
    // Mine array must be initialized before _layMine is called
    this._mines        = [];   // { lat, lng, marker, hiddenIcon, visibleIcon, visible, cleared }
    this._demoRunning  = false;
    this._demoTimeouts = [];

    this._initMap(containerId);
    this._initUnits();
    this._initCivilians();
    this._initThreats();
    this._initSafeCorridor();
    this._initWinZone();
    this._initKeyboard();
    // Pre-seed IRGC mines in the shipping lanes (hidden until MCM selects)
    // Mines placed dead-center in the main channel — between Iran coast and Qeshm, clear of all land
    // Mines placed along the STRAIT_NAV path where blue ships actually travel
    [[25.74, 56.74],[26.10, 56.60],[25.10, 57.30],[24.50, 58.40]].forEach(([lat, lng]) => this._layMine(lat, lng));
  }

  // ── Map ───────────────────────────────────────────────────────────────────

  _initMap(id) {
    this._map = L.map(id, {
      center: [24.50, 59.00],
      zoom: 7,
      zoomControl: true,
      attributionControl: true,
      keyboard: false, // we handle arrow keys ourselves
    });

    // Satellite imagery base
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Esri World Imagery', maxZoom: 17 }
    ).addTo(this._map);

    // Dark military labels on top
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
      { attribution: '', subdomains: 'abcd', maxZoom: 17, opacity: 0.8 }
    ).addTo(this._map);

    // Click on map → move controlled ship
    this._map.on('click', (e) => this._onMapClick(e));

    // Right-click cancels airstrike mode
    this._map.on('contextmenu', () => {
      if (this._airstrikeMode) {
        this._airstrikeMode = false;
        this._airstrikeUnit = null;
        document.getElementById('map').classList.remove('airstrike-mode');
        if (this._strikeRangeCircle) { this._map.removeLayer(this._strikeRangeCircle); this._strikeRangeCircle = null; }
        this._emit('info', 'Airstrike cancelled.');
      }
    });

    this._initPaintTool();
  }

  _initPaintTool() {
    this._paintMode   = null; // 'path' | 'boundary' | 'battery' | null
    this._paintLines  = [];   // all drawn lines
    this._paintPoints = [];
    this._activeLine  = null;
    this._painting    = false;
    this._batteryPins = []; // temp markers placed in battery mode

    const btnPath     = document.getElementById('btn-paint');
    const btnBoundary = document.getElementById('btn-paint-boundary');
    const btnBattery  = document.getElementById('btn-paint-battery');
    const btnClear    = document.getElementById('btn-paint-clear');
    const coordEl     = document.getElementById('paint-coords');
    const mapEl       = document.getElementById('map');

    const setMode = (mode) => {
      this._paintMode = this._paintMode === mode ? null : mode;
      if (btnPath)     btnPath.classList.toggle('active',     this._paintMode === 'path');
      if (btnBoundary) btnBoundary.classList.toggle('active', this._paintMode === 'boundary');
      if (btnBattery)  btnBattery.classList.toggle('active',  this._paintMode === 'battery');
      if (this._paintMode) {
        this._map.dragging.disable();
        mapEl.style.cursor = 'crosshair';
      } else {
        this._map.dragging.enable();
        mapEl.style.cursor = '';
      }
    };

    if (btnPath)     btnPath.addEventListener('click',     () => setMode('path'));
    if (btnBoundary) btnBoundary.addEventListener('click', () => setMode('boundary'));
    if (btnBattery)  btnBattery.addEventListener('click',  () => setMode('battery'));

    if (btnClear) btnClear.addEventListener('click', () => {
      this._paintLines.forEach(l => this._map.removeLayer(l));
      this._paintLines = [];
      this._activeLine = null;
      this._paintPoints = [];
      this._batteryPins.forEach(m => this._map.removeLayer(m));
      this._batteryPins = [];
      if (coordEl)  coordEl.style.display = 'none';
      if (btnClear) btnClear.style.display = 'none';
    });

    coordEl.addEventListener('click', () => {
      const text = coordEl.dataset.coords;
      if (text) navigator.clipboard.writeText(text).then(() => {
        coordEl.textContent = '✓ COPIED!';
        setTimeout(() => { coordEl.textContent = coordEl.dataset.coordsLabel; }, 1200);
      });
    });

    const onDown = () => {
      if (!this._paintMode || this._paintMode === 'battery') return;
      this._painting = true;
      this._paintPoints = [];
      this._activeLine = null;
    };

    const onMove = (e) => {
      if (!this._paintMode || !this._painting || this._paintMode === 'battery') return;
      const rect = mapEl.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const ll = this._map.containerPointToLatLng([clientX - rect.left, clientY - rect.top]);
      this._paintPoints.push([ll.lat, ll.lng]);
      const color = this._paintMode === 'boundary' ? '#cc4444' : '#ffdd44';
      if (this._activeLine) {
        this._activeLine.setLatLngs(this._paintPoints);
      } else {
        this._activeLine = L.polyline(this._paintPoints, { color, weight: 3, opacity: 0.9, interactive: false }).addTo(this._map);
        this._paintLines.push(this._activeLine);
      }
    };

    const onUp = (e) => {
      if (!this._paintMode) return;

      // Battery pin mode — single click drops a numbered marker and reports coords
      if (this._paintMode === 'battery') {
        const rect = mapEl.getBoundingClientRect();
        const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
        const ll = this._map.containerPointToLatLng([clientX - rect.left, clientY - rect.top]);
        const n = this._batteryPins.length + 1;
        const pinIcon = L.divIcon({
          html: `<div style="background:#ff4400;color:#fff;font-family:Courier New;font-size:11px;font-weight:bold;padding:2px 6px;border:2px solid #ff6600;white-space:nowrap;text-shadow:0 0 4px #000">🔴 BATT ${n}</div>`,
          className: '', iconAnchor: [20, 10],
        });
        const pin = L.marker([ll.lat, ll.lng], { icon: pinIcon, interactive: false }).addTo(this._map);
        this._batteryPins.push(pin);
        // Build full list of all pins so far
        const allCoords = this._batteryPins.map((m, i) => {
          const p = m.getLatLng();
          return `[${p.lat.toFixed(3)},${p.lng.toFixed(3)}]`;
        }).join(', ');
        const text = `BATTERIES: ${allCoords}`;
        coordEl.dataset.coords = text;
        coordEl.dataset.coordsLabel = `TAP TO COPY BATTERY LOCATIONS (${this._batteryPins.length} pts)`;
        coordEl.style.borderColor = '#ff6600';
        coordEl.style.color = '#ff6600';
        coordEl.textContent = coordEl.dataset.coordsLabel;
        coordEl.style.display = 'block';
        btnClear.style.display = 'block';
        return;
      }

      if (!this._painting) return;
      this._painting = false;
      if (this._paintPoints.length < 2) return;
      const step = Math.max(1, Math.floor(this._paintPoints.length / 10));
      const sampled = this._paintPoints.filter((_, i) => i % step === 0);
      const label = this._paintMode === 'boundary' ? 'LAND BOUNDARY' : 'PATH';
      const text = `${label}: ` + sampled.map(([a, b]) => `[${a.toFixed(3)},${b.toFixed(3)}]`).join(', ');
      coordEl.dataset.coords = text;
      coordEl.dataset.coordsLabel = `TAP TO COPY ${label} (${sampled.length} pts)`;
      coordEl.style.borderColor = this._paintMode === 'boundary' ? '#cc4444' : '#ffdd44';
      coordEl.style.color       = this._paintMode === 'boundary' ? '#cc4444' : '#ffdd44';
      coordEl.textContent = coordEl.dataset.coordsLabel;
      coordEl.style.display = 'block';
      btnClear.style.display = 'block';
    };

    mapEl.addEventListener('mousedown',  onDown);
    mapEl.addEventListener('mousemove',  onMove);
    mapEl.addEventListener('mouseup',    onUp);
    // Expose the latest painted path on the instance so external code can use it
    this._lastPaintedPath = null;
    const origUp = onUp;
    // (onUp already runs above; we just stash the result after it finishes)
    mapEl.addEventListener('mouseup', () => {
      if (this._paintMode === 'path' && this._paintPoints && this._paintPoints.length >= 2) {
        this._lastPaintedPath = this._paintPoints.slice();
      }
    });
    mapEl.addEventListener('touchstart', onDown,  { passive: true });
    mapEl.addEventListener('touchmove',  onMove,  { passive: true });
    mapEl.addEventListener('touchend',   onUp);
  }

  // ── Units ─────────────────────────────────────────────────────────────────

  _initUnits() {
    this._units = UNIT_DEFS.map(def => {
      // Build the unit object first so the click closure can reference it directly
      const unit = {
        ...def,
        marker: null,
        health: { carrier: 300, tanker: 200, cruiser: 150, destroyer: 100, fac: 80, submarine: 100, minelayer: 80, coastal_battery: 150 }[def.type] ?? 100,
        actionsLeft: 6,
        destroyed: false,
        heading: def.side === 'blue' ? 212 : 0,
        _heading: def.side === 'blue' ? 212 : 0,
        _origLat: def.lat,
        _origLng: def.lng,
        _origType: def.type,
        _origSide: def.side,
        _origHeading: def.side === 'blue' ? 212 : 0,
      };

      const marker = L.marker([def.lat, def.lng], {
        icon: makeIcon(def.type, def.side, false, unit.heading),
        zIndexOffset: def.side === 'blue' ? 100 : 50,
      }).addTo(this._map);

      // Closure captures `unit` directly — no fragile index lookup
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (this._airstrikeMode) {
          this._resolveAirstrike(e.latlng);
          return;
        }
        this._selectUnit(unit);
      });

      unit.marker = marker;
      return unit;
    });
  }

  // ── Civilians ─────────────────────────────────────────────────────────────

  _initCivilians() {
    this._civilians = CIVILIAN_SHIPS.map(def => {
      const icon = L.divIcon({
        html: `<div style="font-size:11px;font-family:Courier New;color:#ffcc44;white-space:nowrap;text-shadow:0 0 4px #000;cursor:default" title="${def.name}">${def.flag}⬥</div>`,
        className: '', iconAnchor: [6, 6],
      });
      const marker = L.marker([def.lat, def.lng], { icon, interactive: false, zIndexOffset: 10 }).addTo(this._map);

      // Label below icon
      const labelIcon = L.divIcon({
        html: `<div style="font-size:9px;font-family:Courier New;color:#aa8822;white-space:nowrap;text-shadow:0 0 3px #000">${def.name}</div>`,
        className: '', iconAnchor: [-4, -8],
      });
      L.marker([def.lat, def.lng], { icon: labelIcon, interactive: false, zIndexOffset: 9 }).addTo(this._map);

      return { ...def, marker };
    });
  }

  _checkCivilianCollision(latlng) {
    for (const civ of this._civilians) {
      if (!civ.marker) continue;
      const distKm = this._map.distance(latlng, civ.marker.getLatLng()) / 1000;
      if (distKm < 12) return civ;
    }
    return null;
  }

  // ── Mine system ───────────────────────────────────────────────────────────

  _layMine(lat, lng) {
    // Mines are hidden — only visible to MCM destroyer (DDG-102 SAMPSON)
    const hiddenIcon = L.divIcon({
      html: `<div style="font-size:14px;opacity:0;cursor:default" title="MINE (hidden)">💣</div>`,
      className: '', iconAnchor: [7, 7],
    });
    const visibleIcon = L.divIcon({
      html: `<div style="font-size:16px;text-shadow:0 0 6px #ff8800;cursor:default;animation:pulse 1s infinite" title="MINE DETECTED">💣</div>`,
      className: '', iconAnchor: [8, 8],
    });
    const marker = L.marker([lat, lng], { icon: hiddenIcon, interactive: false, zIndexOffset: 5 }).addTo(this._map);
    const mine = { lat, lng, marker, hiddenIcon, visibleIcon, visible: false, cleared: false };
    this._mines.push(mine);
    return mine;
  }

  _showMinesForMCM(show) {
    this._mines.filter(m => !m.cleared).forEach(m => {
      m.visible = show;
      m.marker.setIcon(show ? m.visibleIcon : m.hiddenIcon);
    });
  }

  _sweepMinesNear(lat, lng, radiusKm) {
    let cleared = 0;
    this._mines.forEach(m => {
      if (m.cleared) return;
      const distKm = this._map.distance([lat, lng], [m.lat, m.lng]) / 1000;
      if (distKm < radiusKm) {
        m.cleared = true;
        if (this._map.hasLayer(m.marker)) this._map.removeLayer(m.marker);
        this._explode({ lat: m.lat, lng: m.lng }, '#44ff88');
        cleared++;
      }
    });
    return cleared;
  }

  _checkMineDamage(unit) {
    if (unit.side === 'red') return; // IRGC knows where their mines are
    if (unit.id === 'ddg102') return; // MCM ship can see mines and won't trigger them
    const ll = unit.marker.getLatLng();
    this._mines.forEach(m => {
      if (m.cleared) return;
      const distKm = this._map.distance(ll, [m.lat, m.lng]) / 1000;
      if (distKm < 14) {
        m.cleared = true;
        this._explode(ll, '#ff6600');
        setTimeout(() => { if (this._map.hasLayer(m.marker)) this._map.removeLayer(m.marker); }, 500);
        this._damageUnit(unit, 100); // mine = instant kill
        this._emit('info', `💥 MINE STRIKE: ${unit.name} hit a mine and sank!`);
        if (unit === this._controlled) this._selectUnit(null);
      }
    });
  }

  _checkShipCollisions() {
    const blueAlive = this._units.filter(u => !u.destroyed && u.side === 'blue');
    const redAlive  = this._units.filter(u => !u.destroyed && u.side === 'red');

    // Aggro: FACs within 12km of a blue ship lock on and chase; escape at 20km
    const AGGRO_KM = 12, ESCAPE_KM = 20;
    redAlive.forEach(red => {
      if (red.type !== 'fac' && red.type !== 'submarine') return;
      const rll = red.marker.getLatLng();
      // Check if current target escaped
      if (red._aggroTarget) {
        if (red._aggroTarget.destroyed) { red._aggroTarget = null; return; }
        const dEsc = this._map.distance(rll, red._aggroTarget.marker.getLatLng()) / 1000;
        if (dEsc > ESCAPE_KM) {
          this._emit('info', `🟢 ${red.name} lost contact — target escaped`);
          red._aggroTarget = null;
        }
        return; // already aggroed, don't re-scan
      }
      // Scan for new target
      for (const blue of blueAlive) {
        const d = this._map.distance(rll, blue.marker.getLatLng()) / 1000;
        if (d < AGGRO_KM) {
          red._aggroTarget = blue;
          this._emit('info', `🔴 ${red.name} has spotted ${blue.name} — giving chase!`);
          break;
        }
      }
    });

    // Ram: only trigger at very close range (0.8km), deal partial damage so you can survive if health is up
    blueAlive.forEach(blue => {
      if (blue.destroyed) return;
      const bll = blue.marker.getLatLng();
      redAlive.forEach(red => {
        if (red.destroyed || blue.destroyed) return;
        const distKm = this._map.distance(bll, red.marker.getLatLng()) / 1000;
        if (distKm < 0.8) {
          this._explode(bll, '#ff2200');
          this._damageUnit(blue, 60);
          this._damageUnit(red, 40);
          this._emit('info', `💥 ${red.name} rammed ${blue.name}!`);
          // Knock the FAC back so it doesn't keep colliding this tick
          if (!red.destroyed) {
            const rll2 = red.marker.getLatLng();
            const dx = rll2.lat - bll.lat, dy = rll2.lng - bll.lng;
            const mag = Math.hypot(dx, dy) || 0.001;
            red.marker.setLatLng([rll2.lat + (dx / mag) * 0.02, rll2.lng + (dy / mag) * 0.02]);
            red._aggroTarget = null; // brief cooldown — will re-aggro next scan
          }
          if (blue === this._controlled) this._selectUnit(null);
        }
      });
    });
  }

  // ── Threats ───────────────────────────────────────────────────────────────

  _initThreats() {
    this._threats = THREAT_ZONES_DEF.map(def => {
      const circle = L.circle([def.lat, def.lng], {
        radius: def.radiusKm * 1000,
        color: def.color,
        fillColor: def.color,
        fillOpacity: 0.12,
        weight: 2,
        opacity: 0.7,
        dashArray: '6 4',
        interactive: false,
      }).addTo(this._map);

      const label = L.divIcon({
        html: `<div style="color:${def.color};font-family:Courier New;font-size:10px;font-weight:bold;letter-spacing:2px;white-space:nowrap;text-shadow:0 0 4px #000">⚠ ${def.label}</div>`,
        className: '', iconAnchor: [0, 0],
      });
      L.marker([def.lat - def.radiusKm * 0.009, def.lng], { icon: label, interactive: false }).addTo(this._map);

      return { ...def, circle, currentRadius: def.radiusKm * 1000 };
    });
  }

  _initSafeCorridor() {
    this._corridorPoly = L.polygon(SAFE_CORRIDOR_POLY, {
      color: '#44cc88', fillColor: '#44cc88',
      fillOpacity: 0.08, weight: 2, opacity: 0.5, dashArray: '8 5',
      interactive: false,
    }).addTo(this._map);

    const label = L.divIcon({
      html: `<div style="color:#44cc88;font-family:Courier New;font-size:10px;font-weight:bold;letter-spacing:2px;white-space:nowrap;text-shadow:0 0 4px #000">✓ TSS SAFE CORRIDOR</div>`,
      className: '',
    });
    L.marker([25.5, 57.0], { icon: label, interactive: false }).addTo(this._map);
  }

  _updateCorridorColor() {
    if (!this._corridorPoly) return;
    const redInCorridor = this._units.some(u =>
      !u.destroyed && u.side === 'red' &&
      _pointInPoly(u.marker.getLatLng().lat, u.marker.getLatLng().lng, SAFE_CORRIDOR_POLY)
    );
    const c = redInCorridor ? '#ff4444' : '#44cc88';
    this._corridorPoly.setStyle({ color: c, fillColor: c });
    if (redInCorridor && !this._corridorAlerted) {
      this._corridorAlerted = true;
      this._emit('info', '⚠ IRGC UNITS IN TSS CORRIDOR — safe passage compromised. Corridor shown RED.');
    }
    if (!redInCorridor) this._corridorAlerted = false;
  }

  _initWinZone() {
    // Extraction zone near Qatar — all surviving blue ships must reach here to win
    this._WIN_ZONE = { lat: 26.577, lng: 52.299, radiusDeg: 0.55 }; // ~60km radius
    L.circle([this._WIN_ZONE.lat, this._WIN_ZONE.lng], {
      radius: this._WIN_ZONE.radiusDeg * 111000,
      color: '#00ffcc', fillColor: '#00ffcc',
      fillOpacity: 0.10, weight: 2, opacity: 0.8, dashArray: '6 4',
      interactive: false,
    }).addTo(this._map);

    const wzLabel = L.divIcon({
      html: `<div style="color:#00ffcc;font-family:Courier New;font-size:11px;font-weight:bold;letter-spacing:2px;white-space:nowrap;text-shadow:0 0 6px #000;text-align:center">🏁 EXTRACTION ZONE<br><span style="font-size:9px;letter-spacing:1px">TRANSIT ALL SHIPS HERE TO WIN</span></div>`,
      className: '',
      iconAnchor: [90, 0],
    });
    L.marker([this._WIN_ZONE.lat + 0.55, this._WIN_ZONE.lng], { icon: wzLabel, interactive: false }).addTo(this._map);
  }

  // ── Escalation ────────────────────────────────────────────────────────────

  _raiseEscalation(delta, reason) {
    this._escalation = Math.min(100, this._escalation + delta);
    this._emit('escalation', { level: this._escalation, reason });
  }

  _checkVictory() {
    if (this._gameOver) return;
    const blueAlive = this._units.filter(u => u.side === 'blue' && !u.destroyed);
    if (blueAlive.length === 0) return;
    const wz = this._WIN_ZONE;
    const allIn = blueAlive.every(u => {
      const ll = u.marker.getLatLng();
      return Math.hypot(ll.lat - wz.lat, ll.lng - wz.lng) <= wz.radiusDeg;
    });
    if (!allIn) return;
    this._gameOver = true;
    this._emit('victory', { blueAlive: blueAlive.length });
  }

  // ── Keyboard control ──────────────────────────────────────────────────────

  _initKeyboard() {
    const _doMove = (dlat, dlng) => {
      // Cancel airstrike mode when player moves
      if (this._airstrikeMode) {
        this._airstrikeMode = false;
        this._airstrikeUnit = null;
        document.getElementById('map').classList.remove('airstrike-mode');
        if (this._strikeRangeCircle) { this._map.removeLayer(this._strikeRangeCircle); this._strikeRangeCircle = null; }
      }

      if (!this._controlled) return;
      const unit = this._controlled;
      if (unit.side !== 'blue' || unit.destroyed) return;

      // Normalize diagonal so distance = MOVE_STEP regardless of direction
      const mag = Math.hypot(dlat, dlng);
      const scale = MOVE_STEP / mag;
      dlat *= scale;
      dlng *= scale;

      const ll = unit.marker.getLatLng();
      const newLat = ll.lat + dlat;
      const newLng = ll.lng + dlng;
      if (_isLand(newLat, newLng)) return;

      unit._heading = Math.atan2(dlng, dlat) * 180 / Math.PI - 90;
      unit.marker.setLatLng([newLat, newLng]);
      unit.marker.setIcon(makeIcon(unit.type, unit.side, true, unit._heading));
      this._pendingMoves.push({ unitId: unit.id, to: { lat: newLat, lng: newLng } });
      this._checkMineDamage(unit);
      this._updateCoordReadout(unit);

      this._leadMoveCount = (this._leadMoveCount ?? 0) + 1;
      if (this._leadMoveCount < 10) { this._emit('moved', { unit }); this._autoMoveRed(); return; }

      // Followers navigate STRAIT_NAV waypoints — always track lead's progress, never overshoot
      const followers = this._units.filter(u => !u.destroyed && u.side === 'blue' && u !== unit);
      const offsets = [[0.03, 0.05], [0.03, -0.05], [0.06, 0.02], [-0.03, 0.03]];

      // Which waypoint is the lead ship nearest to right now?
      const leadLL = unit.marker.getLatLng();
      let leadWpIdx = 0, leadWpDist = Infinity;
      STRAIT_NAV.forEach(([wlat, wlng], i) => {
        const d = Math.hypot(wlat - leadLL.lat, wlng - leadLL.lng);
        if (d < leadWpDist) { leadWpDist = d; leadWpIdx = i; }
      });

      followers.forEach((other, i) => {
        const oll = other.marker.getLatLng();
        const [oLat, oLng] = offsets[i % offsets.length];

        // Hang back — don't rush up on the lead ship (3 ship-lengths minimum)
        const gapToLead = Math.hypot(leadLL.lat - oll.lat, leadLL.lng - oll.lng);
        if (gapToLead < MOVE_STEP * 3) return;

        // Keep spacing from other followers already processed this tick
        const crowded = followers.slice(0, i).some(prev => {
          const pll = prev.marker.getLatLng();
          return Math.hypot(pll.lat - oll.lat, pll.lng - oll.lng) < MOVE_STEP * 2;
        });
        if (crowded) return;

        // Find which waypoint this follower is nearest to (recomputed every move — no stale state)
        let followerWpIdx = 0, followerWpDist = Infinity;
        STRAIT_NAV.forEach(([wlat, wlng], wi) => {
          const d = Math.hypot(wlat - oll.lat, wlng - oll.lng);
          if (d < followerWpDist) { followerWpDist = d; followerWpIdx = wi; }
        });

        // Never advance past the lead's current waypoint (allow up to same index when lead is at 0)
        const maxIdx = leadWpIdx;
        if (followerWpIdx > maxIdx) return; // already past lead
        const targetIdx = Math.min(maxIdx, followerWpIdx + 1);

        const twp = STRAIT_NAV[targetIdx];
        const dx = (twp[0] + oLat) - oll.lat;
        const dy = (twp[1] + oLng) - oll.lng;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.001) return;
        const r = Math.min(1.0, MOVE_STEP / dist); // snap when close, never overshoot
        const nLat = oll.lat + dx * r;
        const nLng = oll.lng + dy * r;
        if (!_isLand(nLat, nLng)) {
          other._heading = Math.atan2(dy, dx) * 180 / Math.PI - 90;
          other.marker.setLatLng([nLat, nLng]);
          other.marker.setIcon(makeIcon(other.type, other.side, false, other._heading));
          this._pendingMoves.push({ unitId: other.id, to: { lat: nLat, lng: nLng } });
          this._checkMineDamage(other);
        }
      });

      this._emit('moved', { unit });
      this._checkSpawnZones();
      this._autoMoveRed();
      this._checkVictory();
    };

    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        if (this._airstrikeMode) {
          this._airstrikeMode = false;
          this._airstrikeUnit = null;
          document.getElementById('map').classList.remove('airstrike-mode');
          if (this._strikeRangeCircle) { this._map.removeLayer(this._strikeRangeCircle); this._strikeRangeCircle = null; }
          this._emit('info', 'Airstrike cancelled.');
        } else {
          this._selectUnit(null);
        }
        return;
      }

      const k = e.key.toLowerCase();
      let dlat = 0, dlng = 0;
      if (k === 'w' || k === 'arrowup')    dlat =  1;
      if (k === 's' || k === 'arrowdown')  dlat = -1;
      if (k === 'a' || k === 'arrowleft')  dlng = -1;
      if (k === 'd' || k === 'arrowright') dlng =  1;
      if (dlat === 0 && dlng === 0) return;
      e.preventDefault();
      _doMove(dlat, dlng);
    }, true); // window-level capture — fires before any element handler

    // Dpad buttons (cardinal)
    const dpadMap = {
      'dp-up':    [ 1,  0], 'dp-down':  [-1,  0],
      'dp-left':  [ 0, -1], 'dp-right': [ 0,  1],
      'dp-ul':    [ 1, -1], 'dp-ur':    [ 1,  1],
      'dp-dl':    [-1, -1], 'dp-dr':    [-1,  1],
    };
    Object.entries(dpadMap).forEach(([id, [dlat, dlng]]) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', () => _doMove(dlat, dlng));
    });
  }

  // ── Spawn zones ──────────────────────────────────────────────────────────

  _checkSpawnZones() {
    const blueAlive = this._units.filter(u => !u.destroyed && u.side === 'blue');
    SPAWN_ZONES.forEach(zone => {
      const cooldownTurns = 3;
      const lastSpawn = this._spawnCooldown[zone.id] ?? -99;
      if (this._turn - lastSpawn < cooldownTurns) return;

      const triggered = blueAlive.some(u => {
        const ll = u.marker.getLatLng();
        const distKm = Math.hypot(ll.lat - zone.lat, ll.lng - zone.lng) * 111;
        return distKm < zone.radiusKm;
      });

      if (triggered) {
        this._spawnCooldown[zone.id] = this._turn;
        this._spawnFAC(zone);
      }
    });
  }

  _spawnFAC(zone) {
    this._spawnCounter++;
    const id   = `fac_s${this._spawnCounter}`;
    const name = `IRGC FAC-R${this._spawnCounter}`;
    // Scatter within zone, guaranteed in water
    let lat, lng, tries = 0;
    const maxScatterDeg = (zone.radiusKm * 0.4) / 111; // 40% of radius → well inside
    do {
      lat = zone.spawnLat + (Math.random() - 0.5) * maxScatterDeg * 2;
      lng = zone.spawnLng + (Math.random() - 0.5) * maxScatterDeg * 2;
    } while (_isLand(lat, lng) && ++tries < 20);
    if (tries >= 20) { lat = zone.spawnLat; lng = zone.spawnLng; } // fallback to center

    const unit = {
      id, name, side: 'red', type: 'fac',
      health: 80, actionsLeft: 6, destroyed: false,
      _heading: 90, _wpIdx: undefined, _moving: false,
    };

    const marker = L.marker([lat, lng], {
      icon: makeIcon('fac', 'red', false, 0),
      zIndexOffset: 50,
    }).addTo(this._map);

    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      if (this._airstrikeMode) { this._resolveAirstrike(e.latlng); return; }
      this._selectUnit(unit);
    });

    unit.marker = marker;
    this._units.push(unit);

    this._emit('info', `⚠ IRGC REINFORCEMENT — ${name} scrambled from ${zone.name}. New contact on scope.`);
    this._explode({ lat, lng }, '#cc2222', false);
  }

  // ── Auto red response ─────────────────────────────────────────────────────

  _autoMoveRed() {
    if (this._redMoveDebounce) return;
    this._redMoveDebounce = setTimeout(() => {
      this._redMoveDebounce = null;
      const aggressive = this._escalation >= 40;

      this._units.filter(u => !u.destroyed && u.side === 'red' && u.type !== 'coastal_battery').forEach(red => {
        if (red._moving) return;
        const redLL = (red._logLat !== undefined)
          ? { lat: red._logLat, lng: red._logLng }
          : red.marker.getLatLng();

        // Aggro chase — overrides patrol/escalation logic for FACs that have a target
        if (red._aggroTarget && !red._aggroTarget.destroyed) {
          const tLL = red._aggroTarget.marker.getLatLng();
          const dx = tLL.lat - redLL.lat, dy = tLL.lng - redLL.lng;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.001) {
            const ratio = MOVE_STEP * 1.2 / dist; // FACs are faster when aggroed
            const nLat = redLL.lat + dx * ratio, nLng = redLL.lng + dy * ratio;
            if (!_isLand(nLat, nLng)) {
              this._animateMove(red, [nLat, nLng], () => this._checkShipCollisions());
            }
          }
          return;
        }

        if (aggressive) {
          // Escalation ≥ 40 — intercept blue fleet
          const blueAlive = this._units.filter(u => !u.destroyed && u.side === 'blue');
          if (!blueAlive.length) return;
          const tanker = blueAlive.find(u => u.type === 'tanker') ?? blueAlive[0];
          const tLL = tanker.marker.getLatLng();
          const distToTarget = Math.hypot(tLL.lat - redLL.lat, tLL.lng - redLL.lng);
          if (distToTarget < 0.04) return;

          if (red._wpIdx === undefined) {
            let bestIdx = 0, bestD = Infinity;
            STRAIT_NAV.forEach(([wlat, wlng], i) => {
              const d = Math.hypot(wlat - redLL.lat, wlng - redLL.lng);
              if (d < bestD) { bestD = d; bestIdx = i; }
            });
            red._wpIdx = bestIdx;
          }
          let targetWpIdx = 0, minDist = Infinity;
          STRAIT_NAV.forEach(([wlat, wlng], i) => {
            const d = Math.hypot(wlat - tLL.lat, wlng - tLL.lng);
            if (d < minDist) { minDist = d; targetWpIdx = i; }
          });

          if (distToTarget < 0.25) {
            const dxD = tLL.lat - redLL.lat, dyD = tLL.lng - redLL.lng;
            const r0 = MOVE_STEP / distToTarget;
            const nLat = redLL.lat + dxD * r0, nLng = redLL.lng + dyD * r0;
            if (!_isLand(nLat, nLng)) { this._animateMove(red, [nLat, nLng], () => this._checkShipCollisions()); return; }
          }
          const wp = STRAIT_NAV[red._wpIdx];
          const distToWp = Math.hypot(wp[0] - redLL.lat, wp[1] - redLL.lng);
          if (distToWp < MOVE_STEP * 2.5 && red._wpIdx !== targetWpIdx) {
            const dir = targetWpIdx > red._wpIdx ? 1 : -1;
            red._wpIdx = Math.max(0, Math.min(STRAIT_NAV.length - 1, red._wpIdx + dir));
          }
          const cwp = STRAIT_NAV[red._wpIdx];
          const dx = cwp[0] - redLL.lat, dy = cwp[1] - redLL.lng;
          const dist = Math.hypot(dx, dy);
          if (dist < 0.001) return;
          const ratio = MOVE_STEP / dist;
          const nLat = redLL.lat + dx * ratio, nLng = redLL.lng + dy * ratio;
          if (!_isLand(nLat, nLng)) {
            this._animateMove(red, [nLat, nLng], () => this._checkShipCollisions());
          }
        } else {
          // Escalation < 40 — patrol home zone: drift randomly within ~0.25° of start position
          if (red._patrolHome === undefined) {
            red._patrolHome = { lat: red.lat ?? redLL.lat, lng: red.lng ?? redLL.lng };
          }
          // Pick a new drift target occasionally
          if (!red._patrolTarget || Math.random() < 0.25) {
            const R = 0.20;
            let tries = 0, pLat, pLng;
            do {
              pLat = red._patrolHome.lat + (Math.random() - 0.5) * R * 2;
              pLng = red._patrolHome.lng + (Math.random() - 0.5) * R * 2;
            } while (_isLand(pLat, pLng) && ++tries < 10);
            red._patrolTarget = { lat: pLat, lng: pLng };
          }
          const pt = red._patrolTarget;
          const dx = pt.lat - redLL.lat, dy = pt.lng - redLL.lng;
          const dist = Math.hypot(dx, dy);
          if (dist < MOVE_STEP * 0.5) { red._patrolTarget = null; return; }
          const ratio = MOVE_STEP / dist;
          const nLat = redLL.lat + dx * ratio, nLng = redLL.lng + dy * ratio;
          if (!_isLand(nLat, nLng)) {
            this._animateMove(red, [nLat, nLng], () => {});
          } else {
            red._patrolTarget = null;
          }
        }
      });
      this._updateCorridorColor();
    }, 350);
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  _selectUnit(unit) {
    // Deselect old
    if (this._controlled) {
      const old = this._controlled;
      old.marker.setIcon(makeIcon(old.type, old.side, false, old._heading ?? 0));
    }
    if (!unit || unit.destroyed) {
      this._controlled = null;
      this._showMinesForMCM(false);
      this._emit('select', null);
      this._updateCoordReadout(null);
      return;
    }
    this._controlled = unit;
    this._leadMoveCount = 0;
    unit.marker.setIcon(makeIcon(unit.type, unit.side, true, unit._heading ?? 0));
    document.getElementById('map')?.focus();

    // MCM ship (DDG-102) reveals mine locations on selection
    this._showMinesForMCM(unit.id === 'ddg102');

    this._emit('select', unit);
    this._map.panTo(unit.marker.getLatLng(), { animate: true, duration: 0.4 });
    this._updateCoordReadout(unit);
  }

  _updateCoordReadout(unit) {
    const el = document.getElementById('coord-readout');
    if (!el) return;
    if (!unit) { el.style.display = 'none'; return; }
    const ll = unit.marker.getLatLng();
    el.style.display = 'block';
    el.style.color = unit.side === 'red' ? '#cc4444' : '#44cc88';
    el._coordText = `lat:${ll.lat.toFixed(3)}, lng:${ll.lng.toFixed(3)}`;
    el.textContent = `📍 ${unit.name}  ${el._coordText}`;
    if (!el._hasListener) {
      el._hasListener = true;
      el.addEventListener('click', () => {
        navigator.clipboard.writeText(el._coordText).then(() => {
          const copied = document.getElementById('coord-copied');
          if (copied) { copied.style.display = 'block'; setTimeout(() => copied.style.display = 'none', 1500); }
        });
      });
    }
  }

  // ── Map click ─────────────────────────────────────────────────────────────

  _onMapClick(e) {
    if (this._airstrikeMode) {
      // Right-click or click with no controlled unit cancels airstrike
      if (!this._controlled) {
        this._airstrikeMode = false;
        this._airstrikeUnit = null;
        document.getElementById('map').classList.remove('airstrike-mode');
        if (this._strikeRangeCircle) { this._map.removeLayer(this._strikeRangeCircle); this._strikeRangeCircle = null; }
        this._emit('info', 'Airstrike cancelled.');
        return;
      }
      this._resolveAirstrike(e.latlng);
      return;
    }

    // Movement is arrows/dpad only — map clicks just pan, not move
    return;

    const targetLat = e.latlng.lat;
    const targetLng = e.latlng.lng;
    const dist = Math.hypot(targetLat - unit.marker.getLatLng().lat, targetLng - unit.marker.getLatLng().lng);
    if (dist < 0.001) return;

    if (_isLand(targetLat, targetLng)) {
      this._emit('info', `${unit.name}: land mass blocks that position.`);
      return;
    }

    this._animateMove(unit, [targetLat, targetLng], () => {
      this._pendingMoves.push({ unitId: unit.id, to: { lat: targetLat, lng: targetLng } });
      this._checkMineDamage(unit);
      this._checkShipCollisions();
      this._emit('moved', { unit });
      if (!unit.destroyed) this._selectUnit(unit);
      this._autoMoveRed();
    });
  }

  // ── Move animation ────────────────────────────────────────────────────────

  _animateMove(unit, [toLat, toLng], onDone) {
    // Track logical destination so _autoMoveRed never reads a mid-animation position
    unit._logLat = toLat;
    unit._logLng = toLng;
    unit._moving = true;

    const from = unit.marker.getLatLng();

    // Rotate ship to face direction of travel
    const dLng = toLng - from.lng;
    const dLat = toLat - from.lat;
    const headingDeg = Math.atan2(dLng, dLat) * (180 / Math.PI) - 90;
    unit._heading = headingDeg;
    unit.marker.setIcon(makeIcon(unit.type, unit.side, unit === this._controlled, headingDeg));

    // Scale steps to distance so every move feels like the same "speed"
    // 0.20° normal move → 10 steps; longer demo moves get more steps proportionally
    const distDeg = Math.hypot(dLat, dLng);
    const STEPS = Math.max(8, Math.min(24, Math.round(distDeg / 0.022)));
    const PAUSE = 85; // ms per step

    let step = 0;
    const iv = setInterval(() => {
      if (unit.destroyed) { clearInterval(iv); return; }
      step++;
      const t    = step / STEPS;
      const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
      unit.marker.setLatLng([
        from.lat + dLat * ease,
        from.lng + dLng * ease,
      ]);
      // Check mine and collision contact at every frame
      if (unit.side === 'blue' && unit.id !== 'ddg102') this._checkMineDamage(unit);
      this._checkShipCollisions();
      if (unit === this._controlled) this._updateCoordReadout(unit);
      if (step >= STEPS) {
        clearInterval(iv);
        unit._moving = false;
        if (!unit.destroyed) {
          unit.marker.setLatLng([toLat, toLng]);
          if (onDone) onDone();
        }
      }
    }, PAUSE);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  triggerAction(actionId) {
    const unit = this._controlled;
    if (!unit || unit.actionsLeft <= 0 || unit.destroyed) return;

    const ll = unit.marker.getLatLng();

    if (actionId === 'airstrike') {
      const rangeKm = unit.type === 'carrier' ? 165 : 80;
      // Always enter crosshair mode — player picks the target inside the circle
      if (this._strikeRangeCircle) { this._map.removeLayer(this._strikeRangeCircle); this._strikeRangeCircle = null; }
      this._strikeRangeCircle = L.circle([ll.lat, ll.lng], {
        radius: rangeKm * 1000, color: '#ffdd00', fillColor: '#ffdd00',
        fillOpacity: 0.07, weight: 2, dashArray: '5 4', interactive: false,
      }).addTo(this._map);
      this._airstrikeMode    = true;
      this._airstrikeUnit    = unit;
      this._airstrikeRangeKm = rangeKm;
      this._emit('info', `${unit.name}: WEAPONS FREE — click any target inside the yellow circle (${rangeKm}km). ESC to cancel.`);
      document.getElementById('map').classList.add('airstrike-mode');
      return;
    }

    if (actionId === 'mine_sweep') {
      if (unit.id !== 'ddg102') {
        this._emit('info', '⚠ Only DDG-102 SAMPSON has MCM equipment. Switch to that ship.');
        return;
      }
      const SWEEP_KM = 45;
      // Flash a green sweep circle so the player sees exactly what gets cleared
      const sweepCircle = L.circle([ll.lat, ll.lng], {
        radius: SWEEP_KM * 1000, color: '#44ff88', fillColor: '#44ff88',
        fillOpacity: 0.18, weight: 2, dashArray: '5 3', interactive: false,
      }).addTo(this._map);
      setTimeout(() => { if (this._map.hasLayer(sweepCircle)) this._map.removeLayer(sweepCircle); }, 1400);

      const cleared = this._sweepMinesNear(ll.lat, ll.lng, SWEEP_KM);
      this._pendingActions.push({ unitId: unit.id, type: 'mine_sweep', lat: ll.lat, lng: ll.lng });
      this._emit('info', cleared > 0
        ? `MCM SWEEP: ${cleared} mine(s) cleared within ${SWEEP_KM}km.`
        : `MCM SWEEP: No mines in sweep radius (${SWEEP_KM}km). Move closer.`);
      unit.actionsLeft = Math.max(0, unit.actionsLeft - 1);
      this._selectUnit(unit);
      return;
    }

    if (actionId === 'sigint') {
      // Target nearest active battery within ~1.5° (SIGINT range)
      const batteries = this._units.filter(x => !x.destroyed && x.type === 'coastal_battery');
      const battery = batteries.reduce((nearest, b) => {
        const d = Math.hypot(b.marker.getLatLng().lat - ll.lat, b.marker.getLatLng().lng - ll.lng);
        return (!nearest || d < nearest.d) ? { unit: b, d } : nearest;
      }, null);
      const threatIdMap = { batt1: 'noor', batt2: 'qeshm', batt3: 'bandar', batt4: 'musandam' };
      if (battery && battery.d < 1.5) {
        const b = battery.unit;
        this._damageUnit(b, 80);
        this._shrinkThreat(threatIdMap[b.id] ?? 'noor', 0.35);
        const hp = b.health;
        const status = hp <= 0 ? 'DESTROYED' : `${hp}% integrity remaining`;
        this._emit('info', `SIGINT: ${b.name} radar hit — ${status}. Threat zone reduced.`);
        this._pendingActions.push({ unitId: unit.id, type: 'sigint', target: b.id });
      } else {
        this._emit('info', 'SIGINT: No active radar target in range.');
      }
    } else {
      const radiusMap = { air_cover: 65, ciws: 35, ew_jam: 95, mine_sweep: 35 };
      const rad = radiusMap[actionId] ?? 0;

      if (actionId === 'ciws') {
        const hit = Math.random() < 0.55;
        if (hit) {
          this._shrinkThreatsNear(ll.lat, ll.lng, rad, 0.5);
          this._emit('info', '⚡ CIWS: missile intercepted — action recharged.');
          unit.actionsLeft = Math.min(6, unit.actionsLeft + 1); // refund on success
        } else {
          this._emit('info', '⚡ CIWS: missed — missile got through!');
          this._damageUnit(unit, 35);
          this._explode(ll, '#ff4400');
        }
      } else {
        this._shrinkThreatsNear(ll.lat, ll.lng, rad, 0.5);
        const labels = {
          air_cover:  'Air cover active — threats suppressed.',
          ew_jam:     'EW jamming — IRGC targeting degraded.',
          mine_sweep: 'MCM sweep complete.',
        };
        this._emit('info', labels[actionId] ?? 'Action complete.');
      }
      this._pendingActions.push({ unitId: unit.id, type: actionId, lat: ll.lat, lng: ll.lng });
    }

    unit.actionsLeft = Math.max(0, unit.actionsLeft - 1);
    this._selectUnit(unit);
  }

  // ── Airstrike resolution ──────────────────────────────────────────────────

  _resolveAirstrike(latlng) {
    this._airstrikeMode = false;
    document.getElementById('map').classList.remove('airstrike-mode');
    if (this._strikeRangeCircle) {
      this._map.removeLayer(this._strikeRangeCircle);
      this._strikeRangeCircle = null;
    }

    // Enforce range — must be within strike radius
    const striker = this._airstrikeUnit || this._controlled;
    const rangeKm = this._airstrikeRangeKm || 165;

    if (striker) {
      const distKm = this._map.distance(striker.marker.getLatLng(), latlng) / 1000;
      if (distKm > rangeKm) {
        this._emit('info', `⚠ Target out of strike range (${Math.round(distKm)}km > ${rangeKm}km). Move closer.`);
        this._airstrikeUnit = null;
        return;
      }
    }

    const unit = this._controlled;
    if (!unit) return;

    // Civilian collision check
    const civHit = this._checkCivilianCollision(latlng);
    if (civHit) {
      this._explode(latlng, '#ff8800');
      if (civHit.marker && this._map.hasLayer(civHit.marker)) this._map.removeLayer(civHit.marker);
      civHit.marker = null;
      this._emit('civilianStrike', civHit);
      unit.actionsLeft = Math.max(0, unit.actionsLeft - 1);
      this._selectUnit(unit);
      return;
    }

    // Line-of-sight check — can't shoot through Iran or Musandam
    if (!_hasLineOfSight(unit.marker.getLatLng(), latlng)) {
      this._emit('info', '⚠ No line of sight — land mass blocks strike. Reposition or choose different target.');
      return;
    }

    this._pendingActions.push({ unitId: unit.id, type: 'airstrike', lat: latlng.lat, lng: latlng.lng });

    // Missile animation to target
    this._raiseEscalation(8, `${unit.name} fired airstrike`);

    this._animateMissile(unit.marker.getLatLng(), latlng, '#ffdd00', () => {
      this._explode(latlng, '#ff8800', true);

      // Check for direct hit on any ship within ~15km (0.14°)
      const directHitRadius = 0.14;
      let hitCount = 0;
      this._units.filter(x => !x.destroyed).forEach(x => {
        const xll = x.marker.getLatLng();
        const d = Math.hypot(xll.lat - latlng.lat, xll.lng - latlng.lng);
        if (d < directHitRadius) {
          // Civilians are friendly fire, already handled above — skip here
          if (x.side === 'blue') return;
          this._damageUnit(x, 100); // destroy on direct hit
          hitCount++;
          this._emit('info', `💥 DIRECT HIT: ${x.name} destroyed!`);
          if (x.side === 'red') this._raiseEscalation(15, `${x.name} destroyed by airstrike`);
        } else if (d < 0.4) {
          this._damageUnit(x, 45);
        }
      });
      this._shrinkThreatsNear(latlng.lat, latlng.lng, 50, 0.6);
      if (!hitCount) this._emit('info', `Air strike on ${latlng.lat.toFixed(2)}°N ${latlng.lng.toFixed(2)}°E`);
    });

    unit.actionsLeft = Math.max(0, unit.actionsLeft - 1);
    this._airstrikeUnit = null;
    this._selectUnit(unit);
  }

  // ── Threat zone helpers ────────────────────────────────────────────────────

  _shrinkThreat(id, factor) {
    const t = this._threats.find(x => x.id === id);
    if (!t) return;
    t.currentRadius = Math.max(t.currentRadius * factor, 10000);
    t.circle.setRadius(t.currentRadius);
    const suppressRatio = 1 - (t.currentRadius / (t.radiusKm * 1000));
    t.circle.setStyle({
      opacity:     Math.max(0.2, 0.7  - suppressRatio * 0.5),
      fillOpacity: Math.max(0.03, 0.12 - suppressRatio * 0.09),
      color: suppressRatio > 0.4 ? '#44cc88' : t.color,
    });
  }

  _shrinkThreatsNear(lat, lng, rangeKm, factor) {
    this._threats.forEach(t => {
      const distKm = this._map.distance([lat, lng], [t.lat, t.lng]) / 1000;
      if (distKm < rangeKm + t.currentRadius / 1000) {
        this._shrinkThreat(t.id, factor);
      }
    });
  }

  _getThreatLevel(lat, lng) {
    let max = 0;
    const inCorridor = this._inSafeCorridor(lat, lng);
    this._threats.forEach(t => {
      const distKm = this._map.distance([lat, lng], [t.lat, t.lng]) / 1000;
      if (distKm < t.currentRadius / 1000) {
        const falloff = 1 - distKm / (t.currentRadius / 1000);
        max = Math.max(max, t.level * falloff);
      }
    });
    return inCorridor ? max * 0.35 : max;
  }

  _inSafeCorridor(lat, lng) {
    return lat > 25.25 && lat < 26.2 && lng > 55.4 && lng < 58.7;
  }

  // ── Animations ────────────────────────────────────────────────────────────

  _animateMissile(fromLL, toLL, color='#ff4400', onDone) {
    const steps = 30;
    const pts   = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push([
        fromLL.lat + (toLL.lat - fromLL.lat) * t,
        fromLL.lng + (toLL.lng - fromLL.lng) * t,
      ]);
    }
    const line = L.polyline(pts, { color, weight: 2, opacity: 0.7, dashArray: '4 3' }).addTo(this._map);

    let idx = 0;
    const dot = L.circleMarker(pts[0], { radius: 5, color, fillColor: color, fillOpacity: 1, weight: 1 }).addTo(this._map);
    const interval = setInterval(() => {
      idx++;
      if (idx >= pts.length) {
        clearInterval(interval);
        this._map.removeLayer(line);
        this._map.removeLayer(dot);
        if (onDone) onDone();
      } else {
        dot.setLatLng(pts[idx]);
      }
    }, 35);
  }

  _explode(latlng, color='#ff6600', isAirstrike=false) {
    if (isAirstrike) this._airstrikeFlash(latlng);

    // Primary blast ring
    const c = L.circle(latlng, { radius: 3000, color, fillColor: color, fillOpacity: 0.75, weight: 3 }).addTo(this._map);
    let r = 3000, step = 0;
    const iv = setInterval(() => {
      r += 5500; step++;
      c.setRadius(r);
      c.setStyle({ fillOpacity: Math.max(0, 0.75 - step * 0.09), opacity: Math.max(0, 1.0 - step * 0.11) });
      if (step > 8) { clearInterval(iv); this._map.removeLayer(c); }
    }, 55);

    // Secondary shockwave ring (delayed, white)
    setTimeout(() => {
      const shock = L.circle(latlng, { radius: 2000, color: '#ffffff', fillColor: '#ffffff', fillOpacity: 0.4, weight: 2 }).addTo(this._map);
      let sr = 2000, ss = 0;
      const siv = setInterval(() => {
        sr += 8000; ss++;
        shock.setRadius(sr);
        shock.setStyle({ fillOpacity: Math.max(0, 0.4 - ss * 0.07), opacity: Math.max(0, 0.7 - ss * 0.1) });
        if (ss > 6) { clearInterval(siv); this._map.removeLayer(shock); }
      }, 65);
    }, 120);

    // Sparks: 4 small fast rings in random directions (airstrike only)
    if (isAirstrike) {
      for (let i = 0; i < 4; i++) {
        const angle  = (i / 4) * Math.PI * 2;
        const offLat = latlng.lat + Math.sin(angle) * 0.03;
        const offLng = latlng.lng + Math.cos(angle) * 0.05;
        setTimeout(() => {
          const spark = L.circle([offLat, offLng], { radius: 1500, color: '#ffff44', fillColor: '#ffdd00', fillOpacity: 0.8, weight: 1 }).addTo(this._map);
          let sp = 0;
          const spiv = setInterval(() => {
            sp++;
            spark.setStyle({ fillOpacity: Math.max(0, 0.8 - sp * 0.25) });
            if (sp > 3) { clearInterval(spiv); this._map.removeLayer(spark); }
          }, 70);
        }, 80 + i * 40);
      }
    }
  }

  _airstrikeFlash(latlng) { // eslint-disable-line no-unused-vars
    const flash = document.createElement('div');
    flash.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:200',
      'pointer-events:none', 'background:rgba(255,220,80,0.55)',
      'transition:opacity 0.08s ease-in',
    ].join(';');
    document.body.appendChild(flash);

    requestAnimationFrame(() => {
      flash.style.opacity = '1';
      setTimeout(() => {
        flash.style.transition = 'opacity 0.55s ease-out';
        flash.style.opacity = '0';
        setTimeout(() => flash.remove(), 600);
      }, 80);
    });

    const mapEl = document.getElementById('map');
    mapEl.style.transition = 'none';
    const shakes = [[4,-3],[-6,2],[5,-4],[-3,3],[2,-1],[0,0]];
    shakes.forEach(([x, y], i) => {
      setTimeout(() => {
        mapEl.style.transform = i < shakes.length - 1 ? `translate(${x}px,${y}px)` : '';
      }, i * 55);
    });
  }

  // ── Damage / health ───────────────────────────────────────────────────────

  _damageUnit(unit, amount) {
    if (!unit || unit.destroyed) return;
    unit.health = Math.max(0, unit.health - amount);
    if (unit.health <= 0) {
      unit.destroyed = true;
      unit._moving = false;
      unit._logLat = undefined;
      unit._logLng = undefined;
      if (this._map.hasLayer(unit.marker)) this._map.removeLayer(unit.marker);
    }
  }

  // ── Turn engine ───────────────────────────────────────────────────────────

  async endTurn(adjFn, redCellFn) {
    if (this._phase !== 'player') return;
    this._phase = 'ai';
    this._emit('phaseChange', 'ai');

    this._units.filter(u => u.side === 'blue' && u.actionsLeft < 2 && u._moveStart).forEach(u => {
      const ll = u.marker.getLatLng();
      this._pendingMoves.push({ unitId: u.id, to: { lat: ll.lat, lng: ll.lng } });
      u._moveStart = null;
    });

    const state    = this._buildState();
    const threatCtx = this._buildThreatContext();

    const adjResult = await adjFn(state, this._pendingMoves, threatCtx, this._buildThreatLevels());
    this._applyAdjudication(adjResult);
    this._emit('adjudicated', adjResult);

    await _sleep(700);

    const redResult = await redCellFn(this._buildState(), threatCtx);
    this._applyRedCell(redResult);
    this._emit('redCellMoved', redResult);

    this._turn++;
    this._pendingMoves   = [];
    this._pendingActions = [];
    this._units.filter(u => !u.destroyed).forEach(u => {
      u.actionsLeft = 6;
      u._stepsLeft  = MOVE_STEPS[u.type] ?? 0;
      u._moveStart  = null;
    });
    this._phase = 'player';
    this._selectUnit(null);
    this._emit('phaseChange', 'player');
    this._emit('turnStart', this._turn);
  }

  _applyAdjudication(result) {
    const dmg = { sunk: 100, damaged: 35, suppressed: 15, miss: 0 };
    (result?.outcomes ?? []).forEach(o => {
      const target = this._findUnit(o.unit_id);
      if (!target) return;
      const d = dmg[o.effect] ?? 0;
      if (d > 0) {
        const tll = target.marker.getLatLng();
        this._animateMissile(
          { lat: tll.lat + 0.2, lng: tll.lng + 0.2 },
          tll, '#ff4400', () => this._explode(tll)
        );
        setTimeout(() => this._damageUnit(target, d), 600);
      }
    });
  }

  _applyRedCell(result) {
    (result?.moves ?? []).forEach(m => {
      const unit = this._findUnit(m.unit_id);
      if (!unit || unit.destroyed) return;
      if (m.action === 'attack') {
        const target = this._findUnit(m.target);
        if (target && _hasLineOfSight(unit.marker.getLatLng(), target.marker.getLatLng())) {
          this._animateMissile(unit.marker.getLatLng(), target.marker.getLatLng(), '#ff2200', () => {
            this._explode(target.marker.getLatLng());
          });
        }
      } else if (m.action === 'mine') {
        const ll = unit.marker.getLatLng();
        this._layMine(ll.lat, ll.lng);
      } else if (m.position && m.action === 'move') {
        this._animateMove(unit, [m.position.lat, m.position.lng]);
        setTimeout(() => this._checkMineDamage(unit), 950);
      }
    });
  }

  // ── State serialization ────────────────────────────────────────────────────

  _buildState() {
    return {
      turn: this._turn,
      units: this._units.filter(u => !u.destroyed).map(u => ({
        id: u.id, name: u.name, side: u.side, type: u.type, health: u.health,
        position: {
          lat: parseFloat(u.marker.getLatLng().lat.toFixed(4)),
          lng: parseFloat(u.marker.getLatLng().lng.toFixed(4)),
        },
      })),
    };
  }

  _buildThreatContext() {
    return {
      threat_zones: this._threats.map(t => ({
        id: t.id, label: t.label,
        center: { lat: t.lat, lng: t.lng },
        radius_km: Math.round(t.currentRadius / 1000),
        level: t.level,
      })),
      safe_corridor: { description: 'TSS inbound lane, Oman coast side. 65% hit reduction inside.' },
    };
  }

  _buildThreatLevels() {
    return this._units.filter(u => !u.destroyed).map(u => ({
      id: u.id, name: u.name,
      threat_level: parseFloat(this._getThreatLevel(
        u.marker.getLatLng().lat, u.marker.getLatLng().lng
      ).toFixed(2)),
      in_safe_corridor: this._inSafeCorridor(
        u.marker.getLatLng().lat, u.marker.getLatLng().lng
      ),
    }));
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _findUnit(idOrName) {
    return this._units.find(u =>
      u.id === idOrName ||
      u.name?.toLowerCase() === (idOrName ?? '').toLowerCase()
    );
  }

  on(evt, fn)       { this._callbacks[evt] = fn; }
  _emit(evt, data)  { if (this._callbacks[evt]) this._callbacks[evt](data); }

  get phase()      { return this._phase; }
  get turn()       { return this._turn; }
  get controlled() { return this._controlled; }
  get map()        { return this._map; }

  // ── Demo system ────────────────────────────────────────────────────────────

  _demoWait(ms) {
    return new Promise(resolve => {
      const id = setTimeout(resolve, ms);
      this._demoTimeouts.push(id);
    });
  }

  // Route around Musandam by going NORTH first along eastern longitudes (≥57.5°E),
  // then west across the strait at lat 26.50 (above Musandam tip, below Qeshm/Iran).
  async _demoMove(unit, toLat, toLng) {
    if (!unit || unit.destroyed || !this._demoRunning) return;
    const from = unit.marker.getLatLng();

    const pathClear = (aLat, aLng, bLat, bLng) => {
      for (let i = 1; i <= 14; i++) {
        const t = i / 14;
        if (_isLand(aLat + (bLat - aLat) * t, aLng + (bLng - aLng) * t)) return false;
      }
      return true;
    };

    if (pathClear(from.lat, from.lng, toLat, toLng)) {
      await new Promise(r => this._animateMove(unit, [toLat, toLng], r));
      return;
    }

    // Step 1 — go north to lat 26.50 along the unit's current longitude.
    //   At lng ≥ 57.5 this stays east of ALL Musandam blocks (which end at lng 57.40).
    const HUB_LAT = 26.50;
    if (from.lat < HUB_LAT) {
      if (!this._demoRunning) return;
      await new Promise(r => this._animateMove(unit, [HUB_LAT, from.lng], r));
    }
    // Step 2 — go west (or east) along lat 26.50 to target longitude.
    //   Musandam tip is lat < 26.45 so we clear it from above; Qeshm is lat > 26.52 so below us.
    if (!this._demoRunning) return;
    if (Math.abs((unit.marker.getLatLng().lng) - toLng) > 0.02) {
      await new Promise(r => this._animateMove(unit, [HUB_LAT, toLng], r));
    }
    // Step 3 — drop/rise to final latitude.
    if (!this._demoRunning) return;
    await new Promise(r => this._animateMove(unit, [toLat, toLng], r));
  }

  _demoLog(source, text, type='info') {
    const msg = `[${source}] ${text}`;
    this._emit('info', msg);
    // Also emit as a typed log entry if listeners exist
    this._emit('log', { source, text, type });
  }

  async startDemo() {
    if (this._demoRunning) return;
    this._demoRunning = true;
    this._demoTimeouts = [];

    const ddg102 = this._findUnit('ddg102');
    const ddg119 = this._findUnit('ddg119');
    const cg62   = this._findUnit('cg62');
    const cvn76  = this._findUnit('cvn76');
    const tanker = this._findUnit('tanker1');
    const fac1   = this._findUnit('fac1');
    const fac2   = this._findUnit('fac2');
    const fac3   = this._findUnit('fac3');
    const fac4   = this._findUnit('fac4');
    const batt1  = this._findUnit('batt1');

    // Ships start at their real eastern positions.
    // _demoMove() routes around Musandam via southern bypass when needed.

    // ── Step 0: Overview pan ─────────────────────────────────────────────────
    this._emit('demoStep', { step: 0, text: 'OPERATION HORMUZ PASSAGE — full capabilities demo' });
    this._demoLog('OPCON', 'OPERATION HORMUZ PASSAGE — all US Navy capabilities will be demonstrated', 'system');
    this._map.setView([26.35, 56.80], 8, { animate: true, duration: 1.2 });
    await this._demoWait(2500);
    if (!this._demoRunning) return;

    // ── Step 1: Mine reveal — only DDG-102 can see them ──────────────────────
    this._emit('demoStep', { step: 1, text: 'DDG-102 MCM sonar — only this ship sees mines' });
    this._demoLog('DDG-102', 'MCM sonar active — mine locations visible to THIS SHIP ONLY', 'blue');
    if (ddg102 && !ddg102.destroyed) {
      this._selectUnit(ddg102);
      this._showMinesForMCM(true);
    }
    await this._demoWait(2000);
    if (!this._demoRunning) return;

    // Demonstrate mine immunity — DDG-102 sails straight through a mine
    this._demoLog('DDG-102', 'Advancing through minefield — MCM ship is IMMUNE to mine detonation', 'blue');
    if (ddg102 && !ddg102.destroyed) {
      // Mine is at [26.50, 56.55] — sail directly through it
      await this._demoMove(ddg102, 26.62, 57.00); // mine is at [26.62,57.00] in main channel
    }
    this._demoLog('DDG-102', 'MINE CONTACT — NO DAMAGE. MCM equipment prevents detonation', 'blue');
    await this._demoWait(1800);
    if (!this._demoRunning) return;

    // ── Step 2: Mine sweep — visual circle + instant clear ───────────────────
    this._emit('demoStep', { step: 2, text: 'DDG-102 mine sweep — 20km radius sweep circle' });
    this._demoLog('DDG-102', 'Activating sonar sweep array — 20km radius, clearing all mines inside', 'blue');
    if (ddg102 && !ddg102.destroyed) {
      const ll = ddg102.marker.getLatLng(); // now at [26.50, 56.55] — mine is here
      const SWEEP_KM = 20;
      const sweepCircle = L.circle([ll.lat, ll.lng], {
        radius: SWEEP_KM * 1000, color: '#44ff88', fillColor: '#44ff88',
        fillOpacity: 0.18, weight: 2, dashArray: '5 3', interactive: false,
      }).addTo(this._map);
      await this._demoWait(800);
      if (!this._demoRunning) { this._map.removeLayer(sweepCircle); return; }
      const cleared = this._sweepMinesNear(ll.lat, ll.lng, SWEEP_KM);
      setTimeout(() => { if (this._map.hasLayer(sweepCircle)) this._map.removeLayer(sweepCircle); }, 1400);
      this._demoLog('DDG-102', `MCM SWEEP COMPLETE — ${cleared} mine(s) removed from corridor`, 'blue');
    }
    await this._demoWait(2500);
    if (!this._demoRunning) return;

    // ── Step 3: Red auto-response — move CG-62, IRGC reacts ─────────────────
    this._emit('demoStep', { step: 3, text: 'CG-62 advances — IRGC auto-responds to every blue move' });
    this._demoLog('CG-62', 'Moving into strait — watch IRGC units react automatically', 'blue');
    if (cg62 && !cg62.destroyed) {
      await this._demoMove(cg62, 26.58, 56.90);
    }
    this._demoLog('IRGC', 'RED CELL AUTO-RESPONSE — every blue move triggers IRGC repositioning', 'red');
    // Show red units reacting
    const blueTarget = tanker ?? cvn76;
    if (blueTarget) {
      [fac1, fac2, fac3].filter(f => f && !f.destroyed).forEach(red => {
        const rLL = red.marker.getLatLng();
        const tLL = blueTarget.marker.getLatLng();
        const dx = tLL.lat - rLL.lat, dy = tLL.lng - rLL.lng;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.05) {
          const ratio = MOVE_STEP * 2 / dist;
          const nl = rLL.lat + dx * ratio + (Math.random()-0.5)*0.01;
          const ng = rLL.lng + dy * ratio + (Math.random()-0.5)*0.01;
          if (!_isLand(nl, ng)) this._animateMove(red, [nl, ng]);
        }
      });
    }
    await this._demoWait(2500);
    if (!this._demoRunning) return;

    // ── Step 4: EW jamming shrinks threat circles ────────────────────────────
    this._emit('demoStep', { step: 4, text: 'CG-62 EW jamming — threat circles visibly shrink' });
    this._demoLog('CG-62', 'EW jamming package deployed — IRGC targeting degraded in 95km radius', 'blue');
    if (cg62 && !cg62.destroyed) {
      const ll = cg62.marker.getLatLng();
      this._shrinkThreatsNear(ll.lat, ll.lng, 160, 0.52);
    }
    await this._demoWait(2500);
    if (!this._demoRunning) return;

    // ── Step 5: Ship collision — FAC rams destroyer, both sink ───────────────
    this._emit('demoStep', { step: 5, text: 'IRGC FAC rams destroyer — collision sinks both ships' });
    this._demoLog('IRGC', 'FAC at ramming speed — breaking through screen!', 'red');
    // Use FAC-2 for collision — it can reach the main channel directly
    const collider = fac2 && !fac2.destroyed ? fac2 : fac4;
    const victim   = ddg119 && !ddg119.destroyed ? ddg119 : ddg102;
    if (collider && !collider.destroyed && victim && !victim.destroyed) {
      const targetLL = victim.marker.getLatLng();
      await this._demoMove(collider, targetLL.lat + 0.012, targetLL.lng + 0.010);
      await this._demoWait(300);
      if (!this._demoRunning) return;
      this._explode(targetLL, '#ff2200');
      await this._demoWait(200);
      this._damageUnit(collider, 100);
      this._damageUnit(victim, 100);
      this._demoLog('COLLISION', `DIRECT INTERCEPT — ${collider.name} and ${victim.name} both sunk on contact`, 'red');
    } else {
      this._demoLog('SYSTEM', '(collision demo skipped — ships already destroyed)', 'system');
    }
    await this._demoWait(2500);
    if (!this._demoRunning) return;

    // ── Step 6: CIWS intercepts incoming rocket ──────────────────────────────
    this._emit('demoStep', { step: 6, text: 'CG-62 CIWS — incoming rocket intercepted mid-flight' });
    this._demoLog('CG-62', 'IRGC rocket inbound — CIWS acquiring', 'blue');
    if (fac1 && !fac1.destroyed && cg62 && !cg62.destroyed) {
      const fac1LL = fac1.marker.getLatLng();
      const cg62LL = cg62.marker.getLatLng();
      await new Promise(r => this._animateMissile(fac1LL, cg62LL, '#ff2200', r));
      // Intercept at midpoint
      const midLL = { lat: (fac1LL.lat + cg62LL.lat) / 2, lng: (fac1LL.lng + cg62LL.lng) / 2 };
      this._explode(midLL, '#44ffee', false);
      this._demoLog('CG-62', 'CIWS SPLASH — rocket destroyed in flight. Ship and convoy safe.', 'blue');
    }
    await this._demoWait(2500);
    if (!this._demoRunning) return;

    // ── Step 7: SIGINT kills Noor Battery ────────────────────────────────────
    this._emit('demoStep', { step: 7, text: 'DDG-102 SIGINT — Noor Battery radar permanently destroyed' });
    this._demoLog('DDG-102', 'SIGINT targeting Noor Battery — 65km coastal missile threat', 'blue');
    const batteryPos = { lat: 27.18, lng: 56.40 };
    if (ddg102 && !ddg102.destroyed) {
      this._shrinkThreat('noor', 0.25);
      await new Promise(r => this._animateMissile(ddg102.marker.getLatLng(), batteryPos, '#cc44ff', r));
      this._explode(batteryPos, '#cc44ff', false);
      if (batt1) this._damageUnit(batt1, 100);
      this._demoLog('DDG-102', 'NOOR BATTERY DESTROYED — coastal missile threat eliminated permanently', 'blue');
    }
    await this._demoWait(2500);
    if (!this._demoRunning) return;

    // ── Step 8: Airstrike — crosshair + direct hit destroys ship ─────────────
    this._emit('demoStep', { step: 8, text: 'CVN-76 airstrike — crosshair direct hit destroys FAC-2' });
    this._demoLog('CVN-76', 'F/A-18 weapons free — crosshair locked on FAC-2. Direct hit = destroyed.', 'blue');
    if (cvn76 && !cvn76.destroyed) {
      await this._demoMove(cvn76, 26.58, 56.80);
      await this._demoWait(500);
      if (!this._demoRunning) return;
      if (fac2 && !fac2.destroyed) {
        const fac2LL = fac2.marker.getLatLng();
        await new Promise(r => this._animateMissile(cvn76.marker.getLatLng(), fac2LL, '#ffdd00', r));
        this._explode(fac2LL, '#ff8800', true);
        this._damageUnit(fac2, 100);
        if (fac3 && !fac3.destroyed) { this._explode(fac3.marker.getLatLng(), '#ff6600'); this._damageUnit(fac3, 100); }
        this._shrinkThreatsNear(fac2LL.lat, fac2LL.lng, 80, 0.4);
        this._demoLog('CVN-76', 'DIRECT HIT — FAC-2 destroyed. Splash eliminates FAC-3. Chokepoint clear.', 'blue');
      }
    }
    await this._demoWait(3000);
    if (!this._demoRunning) return;

    // ── Step 9: CVN-76 air cover — threats suppressed ─────────────────────────
    this._emit('demoStep', { step: 9, text: 'CVN-76 launches CAP — air cover over tanker route' });
    this._demoLog('CVN-76', 'Launching F/A-18 Combat Air Patrol over TSS corridor — all threats suppressed', 'blue');
    if (cvn76 && !cvn76.destroyed) {
      this._shrinkThreatsNear(cvn76.marker.getLatLng().lat, cvn76.marker.getLatLng().lng, 220, 0.45);
    }
    await this._demoWait(2000);
    if (!this._demoRunning) return;

    // ── Step 10: Tanker transits — multi-leg westward ─────────────────────────
    this._emit('demoStep', { step: 10, text: 'MV PACIFIC LION — strait transit, all threats cleared' });
    this._demoLog('TANKER', 'Pacific Lion entering TSS corridor — US Navy screen holding position', 'blue');
    if (tanker && !tanker.destroyed) {
      // All waypoints in north strait channel — lat 26.42-26.50, lng 57.35→56.20
      await this._demoMove(tanker, 26.46, 57.00);
      await this._demoWait(600);
      if (!this._demoRunning) return;
      await this._demoMove(tanker, 26.50, 56.60);
      await this._demoWait(600);
      if (!this._demoRunning) return;
      await this._demoMove(tanker, 26.48, 56.20);
    }
    this._demoLog('TANKER', 'STRAIT TRANSITED — MV Pacific Lion clear of all threat zones. Mission success.', 'blue');
    await this._demoWait(1500);
    if (!this._demoRunning) return;

    // ── Mission complete ───────────────────────────────────────────────────────
    this._emit('demoStep', { step: 11, text: 'MISSION COMPLETE — all capabilities demonstrated' });
    this._demoLog('OPCON', 'OPERATION COMPLETE — All capabilities demonstrated. Tanker transited safely.', 'victory');
    this._emit('demoComplete', { success: true, turn: this._turn });
    this._demoRunning = false;
  }

  stopDemo() {
    this._demoRunning = false;
    // Clear all pending demo timeouts
    this._demoTimeouts.forEach(id => clearTimeout(id));
    this._demoTimeouts = [];
    this._emit('info', '[DEMO] Demo stopped.');
  }
}

// ── Module-level sleep ────────────────────────────────────────────────────────
function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Stacking transit-log: single container so banners don't overlap ──────────
function _transitLog(html, accent = '#44ccff', dwellMs = 3500) {
  let log = document.getElementById('transit-log');
  if (!log) {
    log = document.createElement('div');
    log.id = 'transit-log';
    log.style.cssText = 'position:fixed;bottom:140px;left:20px;z-index:600;display:flex;flex-direction:column-reverse;gap:6px;max-width:540px;pointer-events:none';
    document.body.appendChild(log);
  }
  const row = document.createElement('div');
  row.style.cssText = `background:rgba(0,8,16,0.94);color:${accent};padding:7px 16px;border:1px solid ${accent}88;border-left:4px solid ${accent};font-family:Courier New,monospace;font-size:11px;letter-spacing:1.3px;box-shadow:0 4px 14px rgba(0,0,0,0.6);transition:opacity 0.5s ease;opacity:1;line-height:1.4`;
  row.innerHTML = html;
  log.appendChild(row);
  // Cap concurrent rows to 6 — oldest gets removed when 7th arrives
  while (log.children.length > 6) log.firstChild.remove();
  setTimeout(() => { row.style.opacity = '0'; }, dwellMs);
  setTimeout(() => { row.remove(); }, dwellMs + 600);
}

// ── Destroyer sweep + engagement helpers (used by executePaintedRoute) ───────
LeafletGame.prototype._sweepMine = function (mine) {
  const map = this._map;
  // Detonation flash
  const flashIcon = L.divIcon({ className:'fx-explosion', html:'<div style="font-size:30px;animation:fxBoom 1.2s ease-out forwards;text-shadow:0 0 20px #44ccff">💥</div>', iconSize:[30,30] });
  const fx = L.marker([mine.lat, mine.lng], { icon: flashIcon, interactive: false, zIndexOffset: 800 }).addTo(map);
  setTimeout(() => map.removeLayer(fx), 1500);
  // Remove the mine marker + its kill-radius ring
  if (mine.marker) map.removeLayer(mine.marker);
  if (mine.ring)   map.removeLayer(mine.ring);
  _transitLog(`<span style="color:#44ccff">⚓ MINE NEUTRALIZED</span> · ${mine.label || 'IRGC LIMPET'} · MCM sweep complete`, '#44ccff', 3000);
};

LeafletGame.prototype._engageFac = function (fac) {
  if (fac.destroyed) return;
  fac.destroyed = true;
  const map = this._map;
  const ll = fac.marker ? fac.marker.getLatLng() : null;
  if (!ll) return;
  // Explosion at FAC location
  const flashIcon = L.divIcon({ className:'fx-explosion', html:'<div style="font-size:42px;animation:fxBoom 1.5s ease-out forwards;text-shadow:0 0 22px #ff3300">💥</div>', iconSize:[42,42] });
  const fx = L.marker([ll.lat, ll.lng], { icon: flashIcon, interactive: false, zIndexOffset: 800 }).addTo(map);
  setTimeout(() => map.removeLayer(fx), 1800);
  // Wreck icon
  const wreck = L.divIcon({ className:'fx-wreck', html:'<div style="font-size:18px;color:#444;text-shadow:0 0 4px #000">⊗</div>', iconSize:[20,20] });
  L.marker([ll.lat, ll.lng], { icon: wreck, interactive: false }).addTo(map);
  // Remove FAC marker
  if (fac.marker) map.removeLayer(fac.marker);
  _transitLog(`<span style="color:#ff8844">⚔ ${fac.name} NEUTRALIZED</span> · DDG engaged with naval gunfire / ESSM`, '#ff8844', 3500);
};

// ── Land bounding boxes — units must not enter these. Conservative coverage of
// Iranian islands + Iranian/Omani/UAE/Qatar coastlines bordering the strait.
const LAND_BBOXES = [
  // Iranian coast strip (north of strait)
  { latLo: 27.05, latHi: 30.0,  lngLo: 49.0,  lngHi: 60.0 },
  // Qeshm Island
  { latLo: 26.55, latHi: 27.05, lngLo: 55.55, lngHi: 56.40 },
  // Larak Island
  { latLo: 26.78, latHi: 26.92, lngLo: 56.30, lngHi: 56.46 },
  // Hengam
  { latLo: 26.62, latHi: 26.72, lngLo: 55.83, lngHi: 55.95 },
  // Greater Tunb
  { latLo: 26.23, latHi: 26.32, lngLo: 55.27, lngHi: 55.36 },
  // Lesser Tunb
  { latLo: 26.21, latHi: 26.27, lngLo: 55.10, lngHi: 55.18 },
  // Abu Musa
  { latLo: 25.83, latHi: 25.92, lngLo: 54.99, lngHi: 55.07 },
  // Omani Musandam Peninsula
  { latLo: 25.85, latHi: 26.55, lngLo: 56.42, lngHi: 56.85 },
  // UAE coast
  { latLo: 22.6, latHi: 25.85, lngLo: 51.5,  lngHi: 56.40 },
  // Qatar / Saudi / Bahrain (north-west Gulf)
  { latLo: 24.5, latHi: 30.0,  lngLo: 49.5,  lngHi: 51.5 },
];
function _isOnLand(lat, lng) {
  for (const b of LAND_BBOXES) {
    if (lat >= b.latLo && lat <= b.latHi && lng >= b.lngLo && lng <= b.lngHi) return true;
  }
  return false;
}

// ── Spawn adversaries: drop a randomized cohort of red units (Monte-Carlo roll)
// All spawned units integrate with _redCombatStep so they pursue + fire during
// painted-route execution. Each click = a fresh probabilistic roll.
LeafletGame.prototype.spawnAdversaries = function (opts = {}) {
  // Water-only anchor points (verified — all in open water, away from islands & coast).
  // Spawn position = anchor + small random jitter (±0.07° ≈ ±8km), so spawns can't
  // drift onto Qeshm, Larak, Abu Musa, the Tunbs, or the Iranian/Omani coasts.
  const SPAWN_ANCHORS = [
    [25.50, 57.50],  // Gulf of Oman entry
    [26.20, 56.40],  // TSS westbound lane south of Larak
    [25.80, 56.20],  // mid-strait open water
    [25.65, 55.30],  // south of Abu Musa
    [25.50, 54.50],  // south Persian Gulf approach
    [26.25, 53.80],  // central Persian Gulf
    [26.30, 53.00],  // western Persian Gulf
    [26.40, 52.20],  // far west, clear water
  ];
  const JITTER = 0.07;  // ~8km variance — enough to scatter, never enough to hit land
  const cohortSize = opts.size || (3 + Math.floor(Math.random() * 4));  // 3-6
  const types = ['fac', 'fac', 'fac', 'fac', 'submarine', 'minelayer'];  // FACs weighted high
  const rollNum = (this._spawnRolls || 0) + 1;
  this._spawnRolls = rollNum;

  for (let i = 0; i < cohortSize; i++) {
    const anchor = SPAWN_ANCHORS[Math.floor(Math.random() * SPAWN_ANCHORS.length)];
    const lat = anchor[0] + (Math.random() * 2 - 1) * JITTER;
    const lng = anchor[1] + (Math.random() * 2 - 1) * JITTER;
    const type = types[Math.floor(Math.random() * types.length)];
    const id = `spawn-${rollNum}-${i}-${Date.now()}`;
    const namePrefix = type === 'submarine' ? 'IRS' : type === 'minelayer' ? 'IRGC ML' : 'IRGC FAC';
    const unit = {
      id, name: `${namePrefix}-${rollNum}.${i+1}`, side:'red', type,
      lat, lng,
      marker: null,
      health: { fac: 80, submarine: 100, minelayer: 80 }[type] ?? 80,
      actionsLeft: 6,
      destroyed: false,
      heading: 0,
      _heading: 0,
      _origLat: lat,
      _origLng: lng,
      _origType: type,
      _origSide: 'red',
      _origHeading: 0,
      _spawned: true,
    };
    const marker = L.marker([lat, lng], {
      icon: makeIcon(type, 'red', false, 0),
      zIndexOffset: 50,
    }).addTo(this._map);
    marker.on('click', (e) => { L.DomEvent.stopPropagation(e); this._selectUnit(unit); });
    unit.marker = marker;
    this._units.push(unit);
  }
  if (typeof _transitLog === 'function') {
    _transitLog(`<span style="color:#ff5566">🎲 ROLL #${rollNum} · ${cohortSize} ADVERSARIES SPAWNED</span> · Monte-Carlo cohort active — they will pursue & engage during transit`, '#ff5566', 4500);
  }
};

LeafletGame.prototype.clearSpawnedAdversaries = function () {
  const before = this._units.length;
  this._units = this._units.filter(u => {
    if (u._spawned) { if (u.marker) this._map.removeLayer(u.marker); return false; }
    return true;
  });
  const removed = before - this._units.length;
  if (typeof _transitLog === 'function' && removed > 0) {
    _transitLog(`<span style="color:#88ddff">✕ CLEARED ${removed} SPAWNED ADVERSARIES</span> · Map reset to baseline IRGC order of battle`, '#88ddff', 3000);
  }
};

// ── Red AI: FACs + sub pursue and engage Blue during painted-route transit ──
LeafletGame.prototype._redCombatStep = function (bluePositions) {
  if (!this._combatState) this._combatState = { shotsFiredBy: {}, turnsSinceShot: {}, totalShots: 0 };
  const state = this._combatState;
  // Global shot budget: realistic IRGC engagement against a CSG is 2-3 missile/torpedo
  // launches max before Blue counter-fire neutralizes the threat.
  const MAX_TOTAL_SHOTS = 3;
  const haver = (a, b) => {
    const R = 6371, dLat = (b.lat-a.lat)*Math.PI/180, dLng = (b.lng-a.lng)*Math.PI/180;
    const lat1 = a.lat*Math.PI/180, lat2 = b.lat*Math.PI/180;
    const x = Math.sin(dLat/2)**2 + Math.sin(dLng/2)**2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.sqrt(x));
  };
  const reds = this._units.filter(u => !u.destroyed && u.side === 'red' && u.marker);
  for (const r of reds) {
    const rLL = r.marker.getLatLng();
    let nearest = null, ndist = Infinity;
    for (const bp of bluePositions) {
      const d = haver(rLL, bp.ll);
      if (d < ndist) { ndist = d; nearest = bp; }
    }
    if (!nearest) continue;

    if (r.type === 'fac') {
      // Pursue Blue from far out — FACs will sortie when Blue is within 250km
      if (ndist < 250 && ndist > 6) {
        const dLat = nearest.ll.lat - rLL.lat;
        const dLng = nearest.ll.lng - rLL.lng;
        const mag = Math.hypot(dLat, dLng) || 1;
        const stepDeg = 0.022;  // ~2.4km/step at 100ms — fast attack craft sprint
        let nLat = rLL.lat + dLat/mag * stepDeg;
        let nLng = rLL.lng + dLng/mag * stepDeg;
        // Land-avoidance: if direct step hits land, try sliding 90° port then 90° stbd
        // along the coastline to navigate around islands.
        if (_isOnLand(nLat, nLng)) {
          const perpLat = -dLng/mag * stepDeg;
          const perpLng =  dLat/mag * stepDeg;
          const portLat = rLL.lat + perpLat, portLng = rLL.lng + perpLng;
          const stbdLat = rLL.lat - perpLat, stbdLng = rLL.lng - perpLng;
          if (!_isOnLand(portLat, portLng))      { nLat = portLat; nLng = portLng; }
          else if (!_isOnLand(stbdLat, stbdLng)) { nLat = stbdLat; nLng = stbdLng; }
          else { nLat = rLL.lat; nLng = rLL.lng; }  // both blocked, hold
        }
        r.marker.setLatLng([nLat, nLng]);
        const heading = ((Math.atan2(nLng - rLL.lng, nLat - rLL.lat) * 180/Math.PI) - 90 + 720) % 360;
        r.marker.setIcon(makeIcon(r.type, 'red', false, heading));
      }
      // Fire ONLY if global budget remains, this FAC hasn't shot yet, and we win
      // a 25% per-step roll — keeps total launches realistic (typically 1-2).
      const alreadyShot = !!state.shotsFiredBy[r.id];
      if (state.totalShots < MAX_TOTAL_SHOTS && !alreadyShot && ndist <= 40 && Math.random() < 0.25) {
        state.shotsFiredBy[r.id] = 1;
        state.totalShots += 1;
        this._fireRedShot(r, nearest, 0.45, 'C-802 ASCM');
      }
    }

    if (r.type === 'submarine') {
      // One torpedo max per sub per transit, on a probabilistic per-step roll.
      const alreadyShot = !!state.shotsFiredBy[r.id];
      if (state.totalShots < MAX_TOTAL_SHOTS && !alreadyShot && ndist <= 80 && Math.random() < 0.18) {
        state.shotsFiredBy[r.id] = 1;
        state.totalShots += 1;
        this._fireRedShot(r, nearest, 0.30, 'TYPE-53 TORPEDO');
      }
    }
  }
};

LeafletGame.prototype._fireRedShot = function (attacker, target, hitChance, weapon) {
  const map = this._map;
  const aLL = attacker.marker.getLatLng();
  const tLL = target.ll;
  const tracer = L.polyline([[aLL.lat, aLL.lng], [tLL.lat, tLL.lng]], {
    color: '#ff3344', weight: 2, opacity: 0.85, dashArray: '4 4', interactive: false
  }).addTo(map);
  setTimeout(() => map.removeLayer(tracer), 1200);

  _transitLog(`<span style="color:#ff5566">⚠ ${attacker.name} FIRING</span> · ${weapon} INBOUND ON ${target.unit.name}`, '#ff5566', 4000);

  const hit = Math.random() < hitChance;
  setTimeout(() => {
    if (hit) {
      const flash = L.divIcon({ className:'fx-explosion', html:'<div style="font-size:30px;animation:fxBoom 1.4s ease-out forwards;text-shadow:0 0 20px #ff3300">💥</div>', iconSize:[30,30] });
      const fx = L.marker([tLL.lat, tLL.lng], { icon: flash, interactive: false, zIndexOffset: 800 }).addTo(map);
      setTimeout(() => map.removeLayer(fx), 1600);
      _transitLog(`<span style="color:#ffaa44">⊠ ${target.unit.name} HIT</span> · ${weapon} from ${attacker.name} · superficial damage, vessel underway`, '#ffaa44', 4500);
    } else {
      _transitLog(`<span style="color:#88ddff">⛒ CIWS INTERCEPT</span> · ${weapon} from ${attacker.name} defeated · ${target.unit.name} unharmed`, '#88ddff', 3500);
    }
  }, 1100);
};

// ── Painted-route execution: tanker + 2 escort DDGs follow the painted path ──
// Accepts opts.path to override (caller can pass a default route if no painted path exists)
LeafletGame.prototype.executePaintedRoute = async function (opts = {}) {
  const path = (opts && opts.path && opts.path.length >= 2)
    ? opts.path
    : ((this._lastPaintedPath && this._lastPaintedPath.length >= 2) ? this._lastPaintedPath : null);
  if (!path) {
    if (this._emit) this._emit('info', 'No painted path. Use the PATH paint tool first.');
    return;
  }
  if (this._routeRunning) return;
  this._routeRunning = true;
  this._combatState = { shotsFiredBy: {}, turnsSinceShot: {}, totalShots: 0 };

  const tanker = this._units.find(u => u.id === 'tanker1');
  const ddgL   = this._units.find(u => u.id === 'ddg102');
  const ddgR   = this._units.find(u => u.id === 'ddg119');
  const cruiser= this._units.find(u => u.id === 'cg62');
  const carrier= this._units.find(u => u.id === 'cvn76');
  if (!tanker || !ddgL || !ddgR) { this._routeRunning = false; return; }

  const offsetDeg = 0.40; // ~44km lateral spacing — visibly separated at zoom 7-8

  // Diamond formation, no overlapping units:
  //          ddgL (port fwd, -20km perp, -11km astern)
  //                                ╲
  //   carrier (center deep aft     ╲   TANKER (lead, 0,0)
  //          0 perp, -45km astern)  ╲
  //                                ╱
  //          cruiser (stbd aft, +12km perp, -28km astern)
  //                                ╲
  //          ddgR (stbd fwd, +20km perp, -11km astern)
  const seg0 = [path[1][0] - path[0][0], path[1][1] - path[0][1]];
  const seg0mag = Math.hypot(seg0[0], seg0[1]) || 1;
  const perp0Lat = -seg0[1] / seg0mag * offsetDeg;        // ±20km lateral (DDGs)
  const perp0Lng =  seg0[0] / seg0mag * offsetDeg;
  const perpHalfLat = -seg0[1] / seg0mag * 0.25;           // ±28km lateral (cruiser)
  const perpHalfLng =  seg0[0] / seg0mag * 0.25;
  const trailLat = -seg0[0] / seg0mag * 0.20;              // -22km astern (DDGs)
  const trailLng = -seg0[1] / seg0mag * 0.20;
  const aftLat   = -seg0[0] / seg0mag * 0.45;              // -50km astern (cruiser)
  const aftLng   = -seg0[1] / seg0mag * 0.45;
  const deepLat  = -seg0[0] / seg0mag * 0.70;              // -78km astern (carrier)
  const deepLng  = -seg0[1] / seg0mag * 0.70;
  const start = path[0];
  if (tanker.marker)  tanker.marker.setLatLng(start);
  if (ddgL.marker)    ddgL.marker.setLatLng([start[0] - perp0Lat + trailLat, start[1] - perp0Lng + trailLng]);
  if (ddgR.marker)    ddgR.marker.setLatLng([start[0] + perp0Lat + trailLat, start[1] + perp0Lng + trailLng]);
  if (cruiser && cruiser.marker) cruiser.marker.setLatLng([start[0] + perpHalfLat + aftLat, start[1] + perpHalfLng + aftLng]);
  if (carrier && carrier.marker) carrier.marker.setLatLng([start[0] + deepLat, start[1] + deepLng]);

  // Fit map to the entire route so everything is visible from the start
  const bounds = L.latLngBounds(path);
  this._map.fitBounds(bounds, { padding: [80, 80], maxZoom: 7 });
  await _sleep(1000);

  // Draw the planned route line in cyan + a moving trail behind tanker in green
  const plannedLine = L.polyline(path, { color: '#88ccff', weight: 2, opacity: 0.6, dashArray: '5 6', interactive: false }).addTo(this._map);
  const trail = L.polyline([], { color: '#44cc88', weight: 3, opacity: 0.85, interactive: false }).addTo(this._map);
  let trailPts = [start];

  const triggered = new Set();
  const incidents = (typeof window !== 'undefined' && window.HISTORICAL_INCIDENTS) || [];
  const haversineKm = (a, b) => {
    const R = 6371, dLat = (b[0]-a[0])*Math.PI/180, dLng = (b[1]-a[1])*Math.PI/180;
    const lat1 = a[0]*Math.PI/180, lat2 = b[0]*Math.PI/180;
    const x = Math.sin(dLat/2)**2 + Math.sin(dLng/2)**2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.sqrt(x));
  };

  // Compute escort offset perpendicular to current segment direction
  const PROX_KM = 90;
  for (let i = 1; i < path.length; i++) {
    const from = path[i-1], to = path[i];
    const dLat = to[0] - from[0], dLng = to[1] - from[1];
    const mag = Math.hypot(dLat, dLng) || 1;
    const perpLat = -dLng / mag * offsetDeg;
    const perpLng =  dLat / mag * offsetDeg;
    // Trail offset (escorts ride 10km astern of the tanker)
    const trailLatSeg = -dLat / mag * 0.20;
    const trailLngSeg = -dLng / mag * 0.20;
    // Ship SVGs are drawn with bow pointing EAST (x=+30 hull tip). Navigation bearing
    // is from north. So CSS-rotate by (bearing - 90) to align bow with direction of travel.
    const headingDeg = ((Math.atan2(dLng, dLat) * 180 / Math.PI) - 90 + 720) % 360;
    if (tanker.marker)              tanker.marker.setIcon(makeIcon(tanker.type, 'blue', false, headingDeg));
    if (ddgL.marker)                ddgL.marker.setIcon(makeIcon(ddgL.type,    'blue', false, headingDeg));
    if (ddgR.marker)                ddgR.marker.setIcon(makeIcon(ddgR.type,    'blue', false, headingDeg));
    if (cruiser && cruiser.marker)  cruiser.marker.setIcon(makeIcon(cruiser.type,'blue', false, headingDeg));
    if (carrier && carrier.marker)  carrier.marker.setIcon(makeIcon(carrier.type,'blue', false, headingDeg));
    const STEPS = 60;
    for (let s = 1; s <= STEPS; s++) {
      const t = s / STEPS;
      const lat = from[0] + dLat * t;
      const lng = from[1] + dLng * t;
      // Per-segment offsets — match diamond formation from initial layout
      const perpHalfLatSeg = -dLng / mag * 0.25;        // ±28km lateral (cruiser)
      const perpHalfLngSeg =  dLat / mag * 0.25;
      const aftLatSeg  = -dLat / mag * 0.45;            // -50km astern (cruiser)
      const aftLngSeg  = -dLng / mag * 0.45;
      const deepLatSeg = -dLat / mag * 0.70;            // -78km astern (carrier)
      const deepLngSeg = -dLng / mag * 0.70;
      if (tanker.marker)              tanker.marker.setLatLng([lat, lng]);
      if (ddgL.marker)                ddgL.marker.setLatLng([lat - perpLat + trailLatSeg, lng - perpLng + trailLngSeg]);
      if (ddgR.marker)                ddgR.marker.setLatLng([lat + perpLat + trailLatSeg, lng + perpLng + trailLngSeg]);
      if (cruiser && cruiser.marker)  cruiser.marker.setLatLng([lat + perpHalfLatSeg + aftLatSeg, lng + perpHalfLngSeg + aftLngSeg]);
      if (carrier && carrier.marker)  carrier.marker.setLatLng([lat + deepLatSeg, lng + deepLngSeg]);

      // ── Mine sweep + FAC engagement: destroyers kill mines (≤5km) and IRGC FACs (≤15km)
      const ddgPositions = [ddgL, ddgR].filter(d => d && d.marker).map(d => d.marker.getLatLng());
      // Sweep mines
      if (window._activeMines && window._activeMines.length > 0) {
        for (let mi = window._activeMines.length - 1; mi >= 0; mi--) {
          const mine = window._activeMines[mi];
          const closest = Math.min(...ddgPositions.map(p => haversineKm([p.lat, p.lng], [mine.lat, mine.lng])));
          if (closest <= 5) {
            this._sweepMine(mine);
            window._activeMines.splice(mi, 1);
          }
        }
      }
      // Red AI: FACs pursue and fire ASCMs at Blue, sub fires torpedoes
      const blueUnitsLive = [tanker, ddgL, ddgR, cruiser, carrier].filter(u => u && u.marker);
      const bluePositions = blueUnitsLive.map(u => ({ unit: u, ll: u.marker.getLatLng() }));
      this._redCombatStep(bluePositions);

      // DDG counter-engagement: kill FACs that close to ≤15km
      const facs = this._units.filter(u => !u.destroyed && u.side === 'red' && u.type === 'fac' && u.marker);
      for (const fac of facs) {
        const fll = fac.marker.getLatLng();
        const closest = Math.min(...ddgPositions.map(p => haversineKm([p.lat, p.lng], [fll.lat, fll.lng])));
        if (closest <= 15) {
          this._engageFac(fac);
        }
      }

      // Append to green trail (every 3rd step to keep it light)
      if (s % 3 === 0) { trailPts.push([lat, lng]); trail.setLatLngs(trailPts); }

      // Drift civilian SIM_VESSELS along their nav direction so they progress
      // through the strait + the OIL AT RISK number drops as they exit.
      if (window.SIM_VESSELS) {
        for (const sv of window.SIM_VESSELS) {
          if (sv._cleared) continue;
          const navDir = sv._navDir || 1;  // +1 inbound (westward), -1 outbound (eastward)
          const driftLng = -0.012 * navDir; // ~1.3km/step westward for inbound
          const driftLat = 0;
          const newLat = (sv._currentLat ?? sv.lat) + driftLat;
          const newLng = (sv._currentLng ?? sv.lng) + driftLng;
          sv._currentLat = newLat;
          sv._currentLng = newLng;
          if (sv._marker) sv._marker.setLatLng([newLat, newLng]);
          if (sv._label)  sv._label.setLatLng([newLat, newLng]);
        }
      }
      // Recompute OIL AT RISK from updated vessel positions every 10 steps
      if (s % 10 === 0 && typeof window.syncLegacyStateStrip === 'function') {
        window.syncLegacyStateStrip();
      }
      await _sleep(50);
    }
  }
  this._routeRunning = false;
  if (this._emit) this._emit('info', 'Blue formation transit complete.');
};
