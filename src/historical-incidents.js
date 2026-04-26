// Real-world Iranian mining + tanker attacks in/near the Strait of Hormuz.
// Coordinates are public-record; descriptions sourced from open journalism + DoD statements.

const HISTORICAL_INCIDENTS = [
  {
    id: 'sbr-1988',
    type: 'MINE',
    date: '1988-04-14',
    name: 'USS SAMUEL B. ROBERTS',
    lat: 26.55, lng: 52.20,
    desc: 'USS Samuel B. Roberts (FFG-58) struck an Iranian M-08 contact mine in the central Persian Gulf. Hull breached; 10 crew injured. Triggered Operation Praying Mantis 4 days later — the largest U.S. surface engagement since WWII.',
    color: '#ff2200',
  },
  {
    id: 'bridgeton-1987',
    type: 'MINE',
    date: '1987-07-24',
    name: 'SS BRIDGETON',
    lat: 27.80, lng: 50.30,
    desc: 'Reflagged Kuwaiti tanker SS Bridgeton struck an Iranian mine northwest of Farsi Island during Operation Earnest Will. First mine strike of the Tanker War. No casualties; vessel made port.',
    color: '#ff2200',
  },
  {
    id: 'fujairah-2019',
    type: 'LIMPET',
    date: '2019-05-12',
    name: 'FUJAIRAH 4-TANKER ATTACK',
    lat: 25.20, lng: 56.40,
    desc: 'Four oil tankers (Saudi, UAE, Norwegian) hit by limpet mines off Fujairah, UAE. CENTCOM attribution: IRGC. No casualties. War-risk insurance for strait transits doubled within 72 hours.',
    color: '#ff7700',
  },
  {
    id: 'gulf-oman-2019',
    type: 'LIMPET',
    date: '2019-06-13',
    name: 'FRONT ALTAIR / KOKUKA COURAGEOUS',
    lat: 25.50, lng: 57.30,
    desc: 'Norwegian-owned Front Altair and Japanese-owned Kokuka Courageous attacked with limpet mines in the Gulf of Oman just outside the strait. CENTCOM released video of IRGC craft removing an unexploded limpet. Brent +4.5% intraday.',
    color: '#ff7700',
  },
  {
    id: 'stena-impero-2019',
    type: 'SEIZURE',
    date: '2019-07-19',
    name: 'STENA IMPERO SEIZURE',
    lat: 26.85, lng: 55.95,
    desc: 'IRGC fast-attack craft and a Mil Mi-17 boarded the UK-flagged Stena Impero near Larak Island. Crew held 65 days. Iranian retaliation for UK seizure of Grace 1 off Gibraltar two weeks earlier.',
    color: '#ffaa00',
  },
  {
    id: 'm-star-2010',
    type: 'IED',
    date: '2010-07-28',
    name: 'M. STAR (JAPANESE TANKER)',
    lat: 26.40, lng: 56.55,
    desc: 'Japanese-flagged crude tanker M. Star struck near Musandam by what was assessed as an explosive-laden small craft. Brigades of the Abdullah Azzam claimed responsibility. Hull damage; one crewman injured. Demonstrated asymmetric attack vector pre-2019.',
    color: '#ff7700',
  },
];

// Blue destroyer transit route — east-to-west, following the real TSS lanes.
// All waypoints stay in international navigable water (verified against OSM coastlines).
const BLUE_TRANSIT_ROUTE = [
  [24.50, 60.00],   // Gulf of Oman start (east of UAE)
  [25.20, 58.20],   // approaching strait
  [25.80, 57.20],   // strait entry, south of Iranian islands
  [26.20, 56.60],   // TSS westbound lane entry
  [26.45, 56.20],   // chokepoint apex (south of Larak Island)
  [26.50, 55.30],   // past Hengam / Greater Tunb
  [26.40, 54.20],   // northwest transit, central gulf
  [26.20, 53.20],   // central Persian Gulf
  [26.30, 52.40],   // approaching western basin
];

let _histMarkers = [];
let _transitMarker = null;
let _transitInProgress = false;
const PROXIMITY_KM = 90; // 50 nm

function _haversineKm(a, b) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
  const x = Math.sin(dLat/2) ** 2 + Math.sin(dLng/2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

function renderHistoricalIncidents() {
  if (!window.game || !window.game.map) { setTimeout(renderHistoricalIncidents, 500); return; }
  const map = window.game.map;
  _histMarkers.forEach(m => map.removeLayer(m));
  _histMarkers = [];
  for (const inc of HISTORICAL_INCIDENTS) {
    const icon = L.divIcon({
      className: 'hist-marker',
      html: `<div style="width:18px;height:18px;border-radius:9px;background:${inc.color};border:2px solid #000;box-shadow:0 0 8px ${inc.color}aa;display:flex;align-items:center;justify-content:center;font-size:9px;color:#000;font-weight:bold;font-family:monospace">${inc.type[0]}</div>`,
      iconSize: [22, 22], iconAnchor: [11, 11],
    });
    const m = L.marker([inc.lat, inc.lng], { icon, zIndexOffset: 200 }).addTo(map);
    m.bindPopup(`
      <div style="font-family:'Courier New',monospace;font-size:11px;color:#222;max-width:280px">
        <div style="color:${inc.color};font-weight:bold;letter-spacing:2px;font-size:10px">${inc.type} · ${inc.date}</div>
        <div style="font-size:13px;font-weight:bold;margin:3px 0">${inc.name}</div>
        <div style="font-size:11px;line-height:1.5">${inc.desc}</div>
      </div>`);
    _histMarkers.push(m);
  }
}

function hideHistoricalIncidents() {
  if (!window.game || !window.game.map) return;
  _histMarkers.forEach(m => window.game.map.removeLayer(m));
  _histMarkers = [];
}

async function simulateBlueTransit() {
  // Show historical markers if hidden (judges should see them during the demo)
  if (_histMarkers.length === 0) renderHistoricalIncidents();
  if (!window.game || typeof window.game.executePaintedRoute !== 'function') return;
  // Use painted path if user drew one, else fallback to default route
  const painted = window.game._lastPaintedPath;
  const path = (painted && painted.length >= 2) ? painted : BLUE_TRANSIT_ROUTE;
  window.game.executePaintedRoute({ path });
}

function _flashIncident(inc, distKm) {
  const map = window.game.map;
  // Pulse circle
  const ring = L.circle([inc.lat, inc.lng], {
    radius: 1500, color: inc.color, weight: 4, fillOpacity: 0.18,
    interactive: false,
  }).addTo(map);
  let r = 1500;
  const pulse = setInterval(() => {
    r += 700;
    ring.setRadius(r);
    ring.setStyle({ opacity: Math.max(0, 1 - (r - 1500) / 12000) });
    if (r >= 14000) { clearInterval(pulse); map.removeLayer(ring); }
  }, 90);

  // Sitrep banner
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:90px;left:50%;transform:translateX(-50%);background:rgba(0,8,16,0.94);color:#ffaa44;padding:10px 20px;border:1px solid ' + inc.color + ';border-left:5px solid ' + inc.color + ';z-index:600;font-family:Courier New,monospace;font-size:12px;letter-spacing:1px;max-width:520px;box-shadow:0 4px 16px rgba(0,0,0,0.6)';
  banner.innerHTML = `
    <div style="color:${inc.color};font-size:10px;letter-spacing:2px;margin-bottom:2px">⚠ PROXIMITY ALERT — ${inc.type} · ${distKm.toFixed(0)} KM</div>
    <div style="color:#fff;font-weight:bold;margin-bottom:4px">${inc.name} · ${inc.date}</div>
    <div style="color:#ccddee;line-height:1.5">${inc.desc}</div>`;
  document.body.appendChild(banner);
  setTimeout(() => banner.style.opacity = '0', 5500);
  setTimeout(() => banner.remove(), 6200);
}

window.HISTORICAL_INCIDENTS    = HISTORICAL_INCIDENTS;
window.renderHistoricalIncidents = renderHistoricalIncidents;
window.hideHistoricalIncidents   = hideHistoricalIncidents;
window.simulateBlueTransit       = simulateBlueTransit;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HISTORICAL_INCIDENTS, BLUE_TRANSIT_ROUTE };
}
