// OSM Infrastructure layer: loads osm_infra.json (cached Overpass API result)
// and renders categorized strategic-asset markers across the Persian Gulf.
// Toggle on/off via the 🌐 INFRASTRUCTURE button in the action bar.
(function () {
  const CATEGORY_STYLE = {
    refinery:      { color: '#ff7733', radius: 5,   label: '🏭 REFINERY' },
    oil_terminal:  { color: '#ffcc44', radius: 3.5, label: '⛽ OIL TERMINAL' },
    airport:       { color: '#44ddff', radius: 4,   label: '✈ AIRPORT' },
    port:          { color: '#66aaff', radius: 4,   label: '⚓ PORT / HARBOR' },
    military_base: { color: '#ff4466', radius: 4.5, label: '⚔ MILITARY BASE' },
    naval_base:    { color: '#ff2244', radius: 5.5, label: '🚢 NAVAL BASE' },
    power_plant:   { color: '#bb66ff', radius: 3.5, label: '⚡ POWER PLANT' },
  };

  let _layer = null;
  let _shown = false;
  let _features = null;

  async function _ensureLoaded() {
    if (_features) return _features;
    try {
      const res = await fetch('osm_infra.json', { cache: 'force-cache' });
      const json = await res.json();
      _features = json.features || [];
      console.log(`[OSM] loaded ${_features.length} infrastructure features (source: ${json.source})`);
      return _features;
    } catch (e) {
      console.error('[OSM] failed to load osm_infra.json', e);
      return [];
    }
  }

  function _build(map) {
    if (_layer) return _layer;
    _layer = L.layerGroup();
    for (const f of _features) {
      const style = CATEGORY_STYLE[f.category] || { color: '#888', radius: 3, label: f.category.toUpperCase() };
      const m = L.circleMarker([f.lat, f.lng], {
        radius: style.radius,
        color: style.color,
        weight: 1.5,
        fillColor: style.color,
        fillOpacity: 0.55,
        opacity: 0.85,
        interactive: true,
      });
      const tagPairs = Object.entries(f.tags || {})
        .filter(([k]) => !['name', 'name:en'].includes(k))
        .map(([k, v]) => `<span style="color:#6a8aaa">${k}=</span>${v}`)
        .join(' · ');
      const popup = `
        <div style="font-family:Courier New,monospace;font-size:12px;color:#cce0ff;background:#060c12;padding:10px 12px;min-width:240px;border:1px solid ${style.color}66">
          <div style="color:${style.color};font-size:10px;letter-spacing:2px;margin-bottom:4px">${style.label}</div>
          <div style="color:#fff;font-weight:bold;margin-bottom:4px">${f.name || '(unnamed)'}</div>
          <div style="font-size:10px;color:#8aa">${tagPairs || '—'}</div>
          <div style="font-size:9px;color:#446;margin-top:6px;letter-spacing:1px">SOURCE: OPENSTREETMAP / OVERPASS API</div>
        </div>`;
      m.bindPopup(popup, { autoPan: false, maxWidth: 320 });
      _layer.addLayer(m);
    }
    return _layer;
  }

  async function toggle() {
    const map = window.game && window.game._map;
    if (!map) return;
    if (_shown) {
      if (_layer) map.removeLayer(_layer);
      _shown = false;
      return;
    }
    await _ensureLoaded();
    if (!_features.length) return;
    _build(map);
    _layer.addTo(map);
    _shown = true;
  }

  window.addEventListener('load', () => {
    const tryWire = () => {
      const btn = document.getElementById('btn-osm-infra');
      if (!btn) return setTimeout(tryWire, 400);
      btn.addEventListener('click', toggle);
    };
    tryWire();
  });

  window.OsmInfraLayer = { toggle };
})();
