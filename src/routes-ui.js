function renderRouteCards() {
  const container = document.getElementById('route-cards');
  if (!container) return;
  const routes = (typeof TRANSIT_ROUTES !== 'undefined' && Array.isArray(TRANSIT_ROUTES))
    ? TRANSIT_ROUTES
    : (window.TRANSIT_ROUTES || []);
  if (!routes.length) {
    setTimeout(renderRouteCards, 200);
    return;
  }
  container.innerHTML = '';
  for (const r of routes) {
    const card = document.createElement('div');
    card.style.cssText = `border:1px solid ${r.color}88; padding:10px 12px; margin-bottom:8px; background:rgba(255,255,255,0.02); transition:background 0.15s`;
    const profile = r.redProfile || {};
    const tags = [];
    if (profile.swarmSpawn) tags.push('FAC SWARM');
    if (profile.facEngagementKm > 0) tags.push(`ENG @ ${profile.facEngagementKm}km`);
    if ((profile.missileChance ?? 0) > 0) tags.push(`MISSILE ${Math.round(profile.missileChance*100)}%`);
    if (profile.rearIntercept) tags.push('REAR INTERCEPT');
    if ((profile.mineHitChance ?? 0) > 0) tags.push(`MINE HIT ${Math.round(profile.mineHitChance*100)}%`);
    card.style.cursor = 'pointer';
    card.dataset.route = r.id;
    card.innerHTML = `
      <div style="color:${r.color};font-size:11px;letter-spacing:2px;font-weight:bold;margin-bottom:3px">${r.name}</div>
      <div style="color:#a0b0c0;font-size:10px;line-height:1.5;margin-bottom:6px">${r.summary}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
        ${tags.map(t => `<span style="background:rgba(255,255,255,0.06);color:${r.color};font-size:9px;letter-spacing:1px;padding:2px 6px;border:1px solid ${r.color}55">${t}</span>`).join('')}
      </div>
      <div style="display:flex;gap:6px">
        <button class="route-preview-btn" data-route="${r.id}" style="flex:1;padding:6px 10px;background:transparent;color:${r.color};border:1px solid ${r.color}66;cursor:pointer;font-family:'Courier New',monospace;font-size:10px;letter-spacing:1.5px">👁 PREVIEW</button>
        <button class="route-exec-btn" data-route="${r.id}" style="flex:1;padding:6px 10px;background:rgba(${parseInt(r.color.slice(1,3),16)},${parseInt(r.color.slice(3,5),16)},${parseInt(r.color.slice(5,7),16)},0.12);color:${r.color};border:1px solid ${r.color}99;cursor:pointer;font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px">&#9654; EXECUTE</button>
      </div>
    `;
    container.appendChild(card);
  }
  // Helper: draw route polyline + zoom map without executing
  function _previewRoute(route) {
    if (!route || !window.game || !window.game.map) return;
    try { if (window._lastRouteOverlay) window.game.map.removeLayer(window._lastRouteOverlay); } catch(e) {}
    window._lastRouteOverlay = L.polyline(route.path, { color: route.color, weight: 4, opacity: 0.85, dashArray: '6 6' }).addTo(window.game.map);
    // Zoom to fit the route
    try { window.game.map.fitBounds(L.latLngBounds(route.path), { padding: [60, 60], maxZoom: 7 }); } catch(e) {}
  }
  // Card-click anywhere previews; PREVIEW button does the same (explicit)
  container.querySelectorAll('[data-route]').forEach(el => {
    if (el.classList.contains('route-exec-btn')) return; // handled below
    el.addEventListener('click', (ev) => {
      // If click was on the EXECUTE button inside, ignore — its handler runs
      if (ev.target.closest && ev.target.closest('.route-exec-btn')) return;
      const rid = el.dataset.route;
      const route = TRANSIT_ROUTES.find(r => r.id === rid);
      _previewRoute(route);
      // Highlight the active card briefly
      container.querySelectorAll('[data-route]').forEach(c => { if (!c.classList.contains('route-exec-btn') && !c.classList.contains('route-preview-btn')) c.style.background = 'rgba(255,255,255,0.02)'; });
      el.style.background = 'rgba(255,255,255,0.06)';
    });
  });
  // Wire each EXECUTE button
  container.querySelectorAll('.route-exec-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const rid = btn.dataset.route;
      const route = TRANSIT_ROUTES.find(r => r.id === rid);
      if (!route || !window.game) return;
      // Apply red profile deltas if exercise active
      if (window.activeExercise && route.redProfile && route.redProfile.deltas) {
        if (typeof window.activeExercise.applyDelta === 'function') {
          window.activeExercise.applyDelta(route.redProfile.deltas);
        }
        if (typeof window.syncLegacyStateStrip === 'function') window.syncLegacyStateStrip();
        if (typeof window.renderIndicators === 'function') window.renderIndicators();
      }
      // Stash the active red profile so executePaintedRoute / engagement code can read it
      window._activeRouteProfile = route.redProfile || {};
      // Paint the route as an overlay polyline (visual cue)
      try {
        if (window._lastRouteOverlay) window.game.map.removeLayer(window._lastRouteOverlay);
      } catch(e) {}
      window._lastRouteOverlay = L.polyline(route.path, { color: route.color, weight: 3, opacity: 0.7, dashArray: '6 6' }).addTo(window.game.map);
      // Run the formation
      window.game.executePaintedRoute({ path: route.path });
    });
  });
}

if (typeof window !== 'undefined') {
  window.renderRouteCards = renderRouteCards;
}
