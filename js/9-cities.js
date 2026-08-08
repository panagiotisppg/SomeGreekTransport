// ─── other greek cities (citybus.gr) ────────────────────────────────────────
// names/coords derived from each city's stop centroid, theres no name field
const CITY_REGISTRY = [
  { id: 'corfu', name: 'Corfu', lat: 39.6129, lng: 19.8782, source: 'citybus', cityId: 101 },
  { id: 'larisa', name: 'Larisa', lat: 39.6383, lng: 22.4233, source: 'citybus', cityId: 102 },
  { id: 'volos', name: 'Volos', lat: 39.3631, lng: 22.9567, source: 'citybus', cityId: 103 },
  { id: 'xanthi', name: 'Xanthi', lat: 41.1198, lng: 24.8998, source: 'citybus', cityId: 104 },
  { id: 'komotini', name: 'Komotini', lat: 41.1066, lng: 25.3989, source: 'citybus', cityId: 105 },
  { id: 'ioannina', name: 'Ioannina', lat: 39.6495, lng: 20.8486, source: 'citybus', cityId: 106 },
  { id: 'alexandroupoli', name: 'Alexandroupoli', lat: 40.8638, lng: 25.8790, source: 'citybus', cityId: 107 },
  { id: 'messolonghi', name: 'Messolonghi', lat: 38.4045, lng: 21.3893, source: 'citybus', cityId: 109 },
  { id: 'heraklion', name: 'Heraklion', lat: 35.3184, lng: 25.1283, source: 'citybus', cityId: 110 },
  { id: 'patras', name: 'Patras', lat: 38.2290, lng: 21.7429, source: 'citybus', cityId: 112 },
  { id: 'salamina', name: 'Salamina', lat: 37.9485, lng: 23.4843, source: 'citybus', cityId: 113 },
  { id: 'lamia', name: 'Lamia', lat: 38.8896, lng: 22.4312, source: 'citybus', cityId: 114 },
  { id: 'kastoria', name: 'Kastoria', lat: 40.5134, lng: 21.2499, source: 'citybus', cityId: 115 },
  { id: 'naousa', name: 'Naousa', lat: 40.6454, lng: 22.1176, source: 'citybus', cityId: 116 },
  { id: 'serres', name: 'Serres', lat: 41.0746, lng: 23.5521, source: 'citybus', cityId: 117 },
  { id: 'katerini', name: 'Katerini', lat: 40.2627, lng: 22.5017, source: 'citybus', cityId: 118 },
  { id: 'chania', name: 'Chania', lat: 35.5055, lng: 24.0256, source: 'citybus', cityId: 120 },
  { id: 'kozani', name: 'Kozani', lat: 40.2824, lng: 21.7936, source: 'citybus', cityId: 121 },
  { id: 'mytilene', name: 'Mytilene', lat: 39.1051, lng: 26.5353, source: 'citybus', cityId: 122 },
  { id: 'kavala', name: 'Kavala', lat: 40.9372, lng: 24.4037, source: 'citybus', cityId: 123 },
  { id: 'arta', name: 'Arta', lat: 39.1265, lng: 20.9834, source: 'citybus', cityId: 125 },
  { id: 'chios', name: 'Chios', lat: 38.3563, lng: 26.1282, source: 'citybus', cityId: 127 },
  { id: 'ptolemaida', name: 'Ptolemaida', lat: 40.5192, lng: 21.6696, source: 'citybus', cityId: 128 },
  { id: 'veroia', name: 'Veroia', lat: 40.5354, lng: 22.2190, source: 'citybus', cityId: 129 },
  { id: 'agrinio', name: 'Agrinio', lat: 38.5991, lng: 21.4254, source: 'citybus', cityId: 130 },
  { id: 'chalkida', name: 'Chalkida', lat: 38.4542, lng: 23.6260, source: 'citybus', cityId: 133 },
  { id: 'drama', name: 'Drama', lat: 41.1440, lng: 24.1436, source: 'citybus', cityId: 134 },
  // skiathos stops have real live/schedule data on citybus.gr, skopelos
  // stops dont (never onboarded there) - no fallback for those, nothing to fall back to
  { id: 'sporades', name: 'Sporades', lat: 39.1356, lng: 23.5777, source: 'citybus', cityId: 135 },
  { id: 'aigio', name: 'Aigio', lat: 38.2469, lng: 22.0841, source: 'citybus', cityId: 'aigio', liveSubdomain: 'aigio' },
];

// a bit further out than expected so theres room to zoom back out and
// still see the whole city before it collapses back to a pill
const CITY_EXPAND_ZOOM = 11;
const CITY_MYBUS_BASE = (subdomain) => `https://${subdomain}.mybus.gr`;
const CITY_REST_BASE = 'https://rest.citybus.gr';
const CITY_STOP_RADIUS_EXPR = ['interpolate', ['linear'], ['zoom'], 12, 2, 14, 3, 16, 5, 18, 7];
const CITY_STOP_RADIUS_HIGHLIGHT_EXPR = ['interpolate', ['linear'], ['zoom'], 12, 3, 14, 4.5, 16, 7, 18, 9];

CITY_REGISTRY.forEach((entry) => {
  entry.pillMarker = null;
  entry.pillOnMap = false;
  entry.expanded = false;
  entry.loading = false;
  entry.data = null;
  entry.stopsByCode = null;
  entry.stopsSourceId = null;
  entry.stopsLayerId = null;
  entry.routeSourceId = null;
  entry.routeLayerId = null;
  entry.liveVehicleMarkers = new Map(); // vehicleCode -> {marker, animationId}
  // bumped on every expand so a fading-out layer never collides with a fresh one
  entry.generation = 0;
});

let activeCityEntry = null;
let activeCityStop = null;
let cityLiveTimerId = null;
// bigger dot on top of the tapped stop, same idea as athens' selectedStopMarker
// but colored with the stop's own line color, not a plotted-route palette
let citySelectedStopMarker = null;

function setCitySelectedStopMarker(stop) {
  if (citySelectedStopMarker) { citySelectedStopMarker.remove(); citySelectedStopMarker = null; }
  const color = stop.lines[0] ? stop.lines[0].color : '#888';
  citySelectedStopMarker = new maplibregl.Marker({ element: createDotMarkerElement(22, color, { strokeWidth: 2 }) })
    .setLngLat([stop.lng, stop.lat])
    .addTo(map);
}

function clearCitySelectedStopMarker() {
  if (citySelectedStopMarker) { citySelectedStopMarker.remove(); citySelectedStopMarker = null; }
}

// citybus sometimes bakes the serving lines into the stop name itself
// (eg "central square lines 3,4,b14") - strips that, leaves real words alone
function stripCityStopLinesSuffix(name) {
  return name.replace(/\s+LINES\s+((?:[A-Za-zΑ-Ω]?\d+[A-Za-zΑ-Ω]?)(?:\s*[,.]\s*(?:[A-Za-zΑ-Ω]?\d+[A-Za-zΑ-Ω]?))*)\s*$/i, '').trim();
}

function createCityPillIcon(name) {
  return `<div class="city-pill">${name}</div>`;
}

// same rounded-box treatment as createBusTextIcon (js/5-bus-logic.js), just
// with the line's own color instead of the fixed cyan/green route palette
function createCityBusIcon(label, color) {
  const html = `<div class="bus-icon-body" style="background-color: ${color}"><span class="bus-icon-lineid">${label}</span><div class="bus-icon-tire tire-left"></div><div class="bus-icon-tire tire-right"></div></div>`;
  return elFromHTML(`<div class="bus-text-icon">${html}</div>`);
}

// ─── pill markers ───────────────────────────────────────────────────────────
// plain geo-anchored marker, same onMap show/hide idiom as every station marker
function initCityPills() {
  CITY_REGISTRY.forEach((entry) => {
    const el = elFromHTML(createCityPillIcon(entry.name));
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      map.flyTo({ center: [entry.lng, entry.lat], zoom: CITY_EXPAND_ZOOM + 0.5, duration: 1200 });
    });
    entry.pillMarker = new maplibregl.Marker({ element: el }).setLngLat([entry.lng, entry.lat]);
    entry.pillMarker.addTo(map);
    entry.pillOnMap = true;
  });
}

function updateCityPillsVisibility() {
  CITY_REGISTRY.forEach((entry) => {
    const show = toggleOtherCities.checked && !entry.expanded;
    if (show && !entry.pillOnMap) {
      entry.pillMarker.addTo(map);
      entry.pillOnMap = true;
      // fades back in instead of popping - the marker element is the .city-pill
      // div itself (maplibregl uses it as its root, not a wrapper), not a child
      const el = entry.pillMarker.getElement();
      el.style.opacity = '0';
      setTimeout(() => { el.style.opacity = '1'; }, 0);
    } else if (!show && entry.pillOnMap) {
      entry.pillMarker.remove();
      entry.pillOnMap = false;
    }
  });
  updateCityPillSizes();
}

// scales the pill continuously between thin (far out) and full size (about
// to expand) instead of snapping between fixed steps
const CITY_PILL_MIN_ZOOM = 5;
function updateCityPillSizes() {
  const zoom = map.getZoom();
  const t = Math.max(0, Math.min(1, (zoom - CITY_PILL_MIN_ZOOM) / (CITY_EXPAND_ZOOM - CITY_PILL_MIN_ZOOM)));
  const fontSize = 7 + t * 3;
  const padY = 1.5 + t * 1.5;
  const padX = 5 + t * 4;
  CITY_REGISTRY.forEach((entry) => {
    if (!entry.pillMarker) return;
    const el = entry.pillMarker.getElement();
    el.style.fontSize = `${fontSize.toFixed(1)}px`;
    el.style.padding = `${padY.toFixed(1)}px ${padX.toFixed(1)}px`;
  });
}

function boundsOverlap(a, b) {
  return a.getWest() <= b.getEast() && a.getEast() >= b.getWest()
    && a.getSouth() <= b.getNorth() && a.getNorth() >= b.getSouth();
}

// only known once stops have loaded - used instead of the single registry
// point so flying in tight on one stop doesnt read as "left the city"
function computeStopBounds(entry) {
  const b = new maplibregl.LngLatBounds();
  entry.data.stops.forEach((s) => { if (s.latitude && s.longitude) b.extend([s.longitude, s.latitude]); });
  entry.stopBounds = b.isEmpty() ? null : b;
}

// rough spread of a city before we know its real bounds (~15-20km) - lets
// zooming into any part of a city trigger expand, not just its exact center
const CITY_TRIGGER_RADIUS_DEG = 0.15;
function cityApproxBounds(entry) {
  return new maplibregl.LngLatBounds(
    [entry.lng - CITY_TRIGGER_RADIUS_DEG, entry.lat - CITY_TRIGGER_RADIUS_DEG],
    [entry.lng + CITY_TRIGGER_RADIUS_DEG, entry.lat + CITY_TRIGGER_RADIUS_DEG]
  );
}

function updateCityExpansion() {
  if (!toggleOtherCities.checked) {
    CITY_REGISTRY.forEach((entry) => { if (entry.expanded) collapseCity(entry); });
    updateCityPillsVisibility();
    return;
  }
  const zoom = map.getZoom();
  const bounds = map.getBounds();
  CITY_REGISTRY.forEach((entry) => {
    if (!entry.expanded) {
      const shouldExpand = zoom >= CITY_EXPAND_ZOOM && !entry.loading && boundsOverlap(bounds, cityApproxBounds(entry));
      if (shouldExpand) expandCity(entry);
      return;
    }
    const cityBounds = entry.stopBounds || cityApproxBounds(entry);
    const stillInCity = zoom >= CITY_EXPAND_ZOOM && boundsOverlap(bounds, cityBounds);
    if (!stillInCity) collapseCity(entry);
  });
  updateCityPillsVisibility();
}

async function fetchCityData(entry) {
  if (entry.source === 'citybus') {
    const base = `data/cities/${entry.cityId}/`;
    const [stops, lines, routes] = await Promise.all([
      fetch(`${base}stops.json`).then((r) => r.json()),
      fetch(`${base}lines.json`).then((r) => r.json()),
      // not every city has route polyline data (eg skiathos has no routes.json
      // at all) - missing just means no route-network layer, stops still load
      fetch(`${base}routes.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);
    return { stops, lines, lineByCode: new Map(lines.map((l) => [l.code, l])), routes };
  }
  const url = `${PROXY_URL}${encodeURIComponent(`${CITY_MYBUS_BASE(entry.subdomain)}/api/stops-with-routes`)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`mybus stops fetch failed: ${res.status}`);
  const stops = await res.json();
  return { stops, lines: null, lineByCode: null, routes: null };
}

// normalizes citybus and mybus stop shapes into one {code,name,lat,lng,lines} shape
function normalizeCityStop(entry, rawStop) {
  let lines;
  if (entry.source === 'citybus') {
    lines = (rawStop.lineCodes || []).map((code) => {
      const l = entry.data.lineByCode.get(code);
      return { code, color: (l && l.color) || '#888', name: l ? l.name : code };
    });
  } else {
    lines = (rawStop.lineCodes || []).map((l) => ({ code: l.number, color: l.color || '#888', name: l.name || l.number }));
  }
  return { code: rawStop.code, name: stripCityStopLinesSuffix(rawStop.name || ''), lat: rawStop.latitude, lng: rawStop.longitude, lines, raw: rawStop };
}

// bulk stop dots as a gl circle layer, not dom markers, a few hundred of those
// gets heavy - multi-line stops just get their first line's color
function buildCityStopsLayer(entry) {
  entry.stopsByCode = new Map();
  const features = [];
  entry.data.stops.forEach((rawStop) => {
    const stop = normalizeCityStop(entry, rawStop);
    if (!stop.lat || !stop.lng) return;
    entry.stopsByCode.set(stop.code, stop);
    features.push({
      type: 'Feature',
      properties: {
        code: stop.code,
        color: (stop.lines[0] && stop.lines[0].color) || '#888',
        lineCodesArr: stop.lines.map((l) => l.code),
      },
      geometry: { type: 'Point', coordinates: [stop.lng, stop.lat] },
    });
  });
  entry.stopsSourceId = `city-stops-${entry.id}-${entry.generation}`;
  entry.stopsLayerId = `city-stops-layer-${entry.id}-${entry.generation}`;
  map.addSource(entry.stopsSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features } });
  map.addLayer({
    id: entry.stopsLayerId,
    type: 'circle',
    source: entry.stopsSourceId,
    paint: {
      'circle-radius': CITY_STOP_RADIUS_EXPR,
      'circle-color': ['get', 'color'],
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1,
      'circle-opacity': 0,
      'circle-opacity-transition': { duration: 800 },
      'circle-stroke-opacity': 0,
      'circle-stroke-opacity-transition': { duration: 800 },
    },
  });
  // added at opacity 0, bumped here so the transition has something to animate -
  // setTimeout not rAF, which never fires in a backgrounded tab and would stick
  setTimeout(() => {
    if (!map.getLayer(entry.stopsLayerId)) return;
    map.setPaintProperty(entry.stopsLayerId, 'circle-opacity', 0.9);
    map.setPaintProperty(entry.stopsLayerId, 'circle-stroke-opacity', 1);
  }, 0);
}

// background "all routes" layer for this city - only citybus cities have
// polyline data at all (routes.json), mybus has no such endpoint
function buildCityRouteLayer(entry) {
  if (entry.source !== 'citybus' || !entry.data.routes) return;
  const features = [];
  Object.keys(entry.data.routes).forEach((lineCode) => {
    const line = entry.data.lineByCode.get(lineCode);
    const color = line ? line.color : '#888';
    (entry.data.routes[lineCode] || []).forEach((route) => {
      const coords = (route.routePoints || [])
        .slice()
        .sort((a, b) => a.sequence - b.sequence)
        .map((p) => [parseFloat(p.longitude), parseFloat(p.latitude)]);
      if (coords.length < 2) return;
      features.push({ type: 'Feature', properties: { lineCode, routeCode: route.routeCode, color }, geometry: { type: 'LineString', coordinates: coords } });
    });
  });
  entry.routeSourceId = `city-routes-${entry.id}-${entry.generation}`;
  entry.routeLayerId = `city-routes-layer-${entry.id}-${entry.generation}`;
  map.addSource(entry.routeSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features } });
  map.addLayer({
    id: entry.routeLayerId,
    type: 'line',
    source: entry.routeSourceId,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-opacity': 0, 'line-opacity-transition': { duration: 800 } },
  }, entry.stopsLayerId && map.getLayer(entry.stopsLayerId) ? entry.stopsLayerId : undefined);
  setTimeout(() => {
    if (!map.getLayer(entry.routeLayerId)) return;
    map.setPaintProperty(entry.routeLayerId, 'line-opacity', 0.55);
  }, 0);
}

async function expandCity(entry) {
  entry.loading = true;
  try {
    entry.data = await fetchCityData(entry);
    computeStopBounds(entry);
    entry.generation += 1;
    buildCityRouteLayer(entry);
    buildCityStopsLayer(entry);
    entry.expanded = true;
  } catch (err) {
    console.error(`Failed to load city data for ${entry.name}:`, err);
    entry.data = null;
  } finally {
    entry.loading = false;
    updateCityPillsVisibility();
  }
}

// mirrors the fade-in - fades to 0 first, removes the layer once that
// finishes. ids are generation-scoped so a fresh re-expand never collides
function collapseCity(entry) {
  entry.expanded = false;
  if (activeCityEntry === entry) {
    stopCityLiveTimer();
    cityStopPanel.classList.remove('visible');
    clearCitySelectedStopMarker();
    activeCityEntry = null;
    activeCityStop = null;
  }
  clearCityLiveMarkers(entry);

  const stopsLayerId = entry.stopsLayerId, stopsSourceId = entry.stopsSourceId;
  const routeLayerId = entry.routeLayerId, routeSourceId = entry.routeSourceId;
  if (stopsLayerId && map.getLayer(stopsLayerId)) {
    map.setPaintProperty(stopsLayerId, 'circle-opacity', 0);
    map.setPaintProperty(stopsLayerId, 'circle-stroke-opacity', 0);
  }
  if (routeLayerId && map.getLayer(routeLayerId)) {
    map.setPaintProperty(routeLayerId, 'line-opacity', 0);
  }
  setTimeout(() => {
    if (stopsLayerId && map.getLayer(stopsLayerId)) map.removeLayer(stopsLayerId);
    if (stopsSourceId && map.getSource(stopsSourceId)) map.removeSource(stopsSourceId);
    if (routeLayerId && map.getLayer(routeLayerId)) map.removeLayer(routeLayerId);
    if (routeSourceId && map.getSource(routeSourceId)) map.removeSource(routeSourceId);
  }, 850);

  entry.stopsLayerId = null;
  entry.stopsSourceId = null;
  entry.stopsByCode = null;
  entry.routeSourceId = null;
  entry.routeLayerId = null;
  entry.stopBounds = null;
  entry.data = null;
}

// ─── stop hit-testing ───────────────────────────────────────────────────────
// same padded-box technique as queryStopAt in js/7-main.js, just against city layers
const CITY_STOP_HIT_PADDING = 5;
function queryCityStopAt(point) {
  const layers = CITY_REGISTRY.filter((e) => e.stopsLayerId && map.getLayer(e.stopsLayerId)).map((e) => e.stopsLayerId);
  if (!layers.length) return null;
  const box = [[point.x - CITY_STOP_HIT_PADDING, point.y - CITY_STOP_HIT_PADDING], [point.x + CITY_STOP_HIT_PADDING, point.y + CITY_STOP_HIT_PADDING]];
  const feats = map.queryRenderedFeatures(box, { layers });
  if (!feats.length) return null;
  const entry = CITY_REGISTRY.find((e) => e.stopsLayerId === feats[0].layer.id);
  const stop = entry.stopsByCode.get(feats[0].properties.code);
  return stop ? { entry, stop } : null;
}

// ─── route/sibling-stop highlighting on stop tap ───────────────────────────
function highlightRoutesForStop(entry, stop) {
  if (entry.source === 'citybus') {
    if (!entry.routeLayerId || !map.getLayer(entry.routeLayerId)) return;
    const routeCodes = stop.raw.routeCodes || [];
    if (!routeCodes.length) return;
    map.setPaintProperty(entry.routeLayerId, 'line-opacity', ['case', ['in', ['get', 'routeCode'], ['literal', routeCodes]], 0.9, 0.12]);
    map.setPaintProperty(entry.routeLayerId, 'line-width', ['case', ['in', ['get', 'routeCode'], ['literal', routeCodes]], 3.5, 2]);
  } else {
    // no polyline data for mybus cities - emphasize sibling stops sharing a
    // line instead, as a paint expression on the stops layer itself
    if (!entry.stopsLayerId || !map.getLayer(entry.stopsLayerId)) return;
    const codes = stop.lines.map((l) => l.code);
    const matchExpr = ['any', ['==', ['get', 'code'], stop.code], ...codes.map((c) => ['in', c, ['get', 'lineCodesArr']])];
    map.setPaintProperty(entry.stopsLayerId, 'circle-opacity', ['case', matchExpr, 0.95, 0.25]);
    map.setPaintProperty(entry.stopsLayerId, 'circle-radius', ['case', matchExpr, CITY_STOP_RADIUS_HIGHLIGHT_EXPR, CITY_STOP_RADIUS_EXPR]);
  }
}

function clearRouteHighlightForEntry(entry) {
  if (entry.source === 'citybus') {
    if (entry.routeLayerId && map.getLayer(entry.routeLayerId)) {
      map.setPaintProperty(entry.routeLayerId, 'line-opacity', 0.55);
      map.setPaintProperty(entry.routeLayerId, 'line-width', 2);
    }
  } else if (entry.stopsLayerId && map.getLayer(entry.stopsLayerId)) {
    map.setPaintProperty(entry.stopsLayerId, 'circle-opacity', 0.9);
    map.setPaintProperty(entry.stopsLayerId, 'circle-radius', CITY_STOP_RADIUS_EXPR);
  }
}

// ─── live vehicles ──────────────────────────────────────────────────────────
// citybus sends lat/lng as strings, "0"/"0" means no gps fix yet - drop those
function parseVehicleCoord(lat, lng) {
  const flat = parseFloat(lat), flng = parseFloat(lng);
  if (!flat || !flng || isNaN(flat) || isNaN(flng)) return { lat: null, lng: null };
  return { lat: flat, lng: flng };
}

// /api/eta/{code} on these liveSubdomain-backed cities returns live+scheduled
// trips together, tagged by lat/lng presence just like citybus - split it the
// same way so it can flow through the same mergeCityArrivals path as every city
async function fetchLiveSubdomainEta(entry, stop) {
  const url = `${PROXY_URL}${encodeURIComponent(`${CITY_MYBUS_BASE(entry.liveSubdomain)}/api/eta/${stop.code}`)}`;
  const res = await fetch(url);
  if (!res.ok) return { vehicles: [], trips: [] };
  const data = await res.json();
  const vehicles = [];
  const trips = [];
  (data.vehicles || []).forEach((v) => {
    const { lat, lng } = parseVehicleCoord(v.latitude, v.longitude);
    if (lat != null && lng != null) {
      vehicles.push({ lineCode: v.lineCode, vehicleCode: v.vehicleCode, routeName: v.routeName || '', lat, lng, etaMinutes: v.departureMins, etaText: `${v.departureMins}'` });
    } else {
      trips.push({ lineCode: v.lineCode, routeName: v.routeName || '', lineColor: v.lineColor, minutesFromNow: v.departureMins });
    }
  });
  return { vehicles, trips };
}

async function fetchCityLiveVehicles(entry, stop) {
  if (entry.liveSubdomain) return (await fetchLiveSubdomainEta(entry, stop)).vehicles;
  if (entry.source === 'citybus') {
    const url = `${PROXY_URL}${encodeURIComponent(`${CITY_REST_BASE}/api/v1/el/${entry.cityId}/stops/live/${stop.code}`)}`;
    const res = await fetch(url);
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`live fetch failed: ${res.status}`);
    const data = await res.json();
    return (data.vehicles || []).map((v) => {
      const { lat, lng } = parseVehicleCoord(v.latitude, v.longitude);
      return {
        lineCode: v.lineCode, vehicleCode: v.vehicleCode, routeName: v.routeName || '', lat, lng,
        etaMinutes: v.departureMins != null ? v.departureMins : null,
        etaText: v.departureMins != null ? `${v.departureMins}'` : '',
      };
    });
  }
  const url = `${PROXY_URL}${encodeURIComponent(`${CITY_MYBUS_BASE(entry.subdomain)}/api/eta/${stop.code}`)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`eta fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.vehicles || []).map((v) => {
    const { lat, lng } = parseVehicleCoord(v.latitude, v.longitude);
    return { lineCode: v.lineCode, vehicleCode: v.vehicleCode, routeName: '', lat, lng, etaMinutes: null, etaText: '' };
  });
}

// today's remaining scheduled departures at this stop - citybus only, mybus
// has no per-stop schedule endpoint. this is the base arrivals list itself
const CITY_UPCOMING_TRIPS_LIMIT = 8;
function tripMinutesFromNow(trip) {
  const now = new Date();
  return (trip.tripTimeHour * 60 + trip.tripTimeMinute) - (now.getHours() * 60 + now.getMinutes());
}
async function fetchCityScheduledUpcoming(entry, stop) {
  if (entry.source !== 'citybus') return [];
  const day = (new Date().getDay() + 6) % 7;
  const url = `${PROXY_URL}${encodeURIComponent(`${CITY_REST_BASE}/api/v1/el/${entry.cityId}/trips/stop/${stop.code}/day/${day}`)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const trips = await res.json();
    return (Array.isArray(trips) ? trips : [])
      .map((t) => ({ ...t, minutesFromNow: tripMinutesFromNow(t) }))
      .filter((t) => t.minutesFromNow >= 0)
      .sort((a, b) => a.minutesFromNow - b.minutesFromNow);
  } catch (err) {
    return [];
  }
}

function clearCityLiveMarkers(entry) {
  entry.liveVehicleMarkers.forEach((info) => {
    if (info.animationId) cancelAnimationFrame(info.animationId);
    info.marker.remove();
  });
  entry.liveVehicleMarkers.clear();
}

// no shared id between a live vehicle and a scheduled trip - walk the
// schedule in order, claim the earliest live gps-fixed bus still free per line
function mergeCityArrivals(vehicles, scheduledTrips) {
  const mappableVehicles = vehicles.filter((v) => v.lat != null && v.lng != null);
  const liveByLine = new Map();
  mappableVehicles.forEach((v) => {
    if (!liveByLine.has(v.lineCode)) liveByLine.set(v.lineCode, []);
    liveByLine.get(v.lineCode).push(v);
  });
  liveByLine.forEach((arr) => arr.sort((a, b) => (a.etaMinutes ?? 999) - (b.etaMinutes ?? 999)));

  const rows = (scheduledTrips || []).slice(0, CITY_UPCOMING_TRIPS_LIMIT).map((t) => {
    const pool = liveByLine.get(t.lineCode);
    const liveVehicle = pool && pool.length ? pool.shift() : null;
    if (liveVehicle) {
      return {
        isLive: true, lineCode: t.lineCode, routeName: liveVehicle.routeName || t.routeName, color: t.lineColor,
        minutesFromNow: liveVehicle.etaMinutes != null ? liveVehicle.etaMinutes : t.minutesFromNow,
        etaText: liveVehicle.etaText || `${t.minutesFromNow}'`,
        vehicleCode: liveVehicle.vehicleCode, lat: liveVehicle.lat, lng: liveVehicle.lng,
      };
    }
    return {
      isLive: false, lineCode: t.lineCode, routeName: t.routeName, color: t.lineColor,
      minutesFromNow: t.minutesFromNow, etaText: `${t.minutesFromNow}'`, vehicleCode: null, lat: null, lng: null,
    };
  });

  // any live vehicle never claimed above (its line had no fetched scheduled
  // trip to match against) still gets shown as its own live row
  liveByLine.forEach((pool, lineCode) => {
    pool.forEach((v) => {
      rows.push({
        isLive: true, lineCode, routeName: v.routeName, color: null,
        minutesFromNow: v.etaMinutes != null ? v.etaMinutes : 999, etaText: v.etaText,
        vehicleCode: v.vehicleCode, lat: v.lat, lng: v.lng,
      });
    });
  });

  return rows.sort((a, b) => a.minutesFromNow - b.minutesFromNow);
}

function animateCityBusMarker(marker, from, to, busInfo) {
  const duration = 8500;
  let startTime = null;
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = (timestamp - startTime) / duration;
    if (progress > 1) {
      marker.setLngLat([to.lng, to.lat]);
      busInfo.animationId = null;
      return;
    }
    const lat = from.lat + (to.lat - from.lat) * progress;
    const lng = from.lng + (to.lng - from.lng) * progress;
    marker.setLngLat([lng, lat]);
    busInfo.animationId = requestAnimationFrame(step);
  }
  busInfo.animationId = requestAnimationFrame(step);
}

// diffs against markers already on the map by vehicleCode instead of wiping
// and recreating - mirrors refreshBusLocations in js/5-bus-logic.js
function updateCityLiveMarkers(entry, liveRows) {
  const seen = new Set();
  liveRows.forEach((r) => {
    if (!r.vehicleCode) return;
    seen.add(r.vehicleCode);
    const newPos = { lat: r.lat, lng: r.lng };
    if (entry.liveVehicleMarkers.has(r.vehicleCode)) {
      const info = entry.liveVehicleMarkers.get(r.vehicleCode);
      const ll = info.marker.getLngLat();
      const oldPos = { lat: ll.lat, lng: ll.lng };
      if (oldPos.lat !== newPos.lat || oldPos.lng !== newPos.lng) {
        if (info.animationId) cancelAnimationFrame(info.animationId);
        animateCityBusMarker(info.marker, oldPos, newPos, info);
      }
    } else {
      const el = createCityBusIcon(r.lineCode, r.color);
      el.style.opacity = 0;
      const marker = new maplibregl.Marker({ element: el }).setLngLat([newPos.lng, newPos.lat]).addTo(map);
      setTimeout(() => { el.style.opacity = 1; }, 0);
      entry.liveVehicleMarkers.set(r.vehicleCode, { marker, animationId: null });
    }
  });
  entry.liveVehicleMarkers.forEach((info, vehicleCode) => {
    if (!seen.has(vehicleCode)) {
      if (info.animationId) cancelAnimationFrame(info.animationId);
      info.marker.remove();
      entry.liveVehicleMarkers.delete(vehicleCode);
    }
  });
}

function renderCityArrivals(entry, stop, vehicles, scheduledTrips) {
  const rows = mergeCityArrivals(vehicles, scheduledTrips).map((r) => {
    const line = stop.lines.find((l) => l.code === r.lineCode);
    return { ...r, color: r.color || (line ? line.color : '#888'), lineName: r.routeName || (line ? line.name : '') };
  });

  updateCityLiveMarkers(entry, rows.filter((r) => r.isLive && r.lat != null && r.lng != null));

  if (!rows.length) {
    showNoArrivalsUI(cityStopArrivals, 'No arrivals right now.');
    return;
  }

  cityStopArrivals.innerHTML = '';
  rows.forEach((r) => {
    const row = document.createElement('div');
    row.className = 'arrival-row';
    row.innerHTML = `<div class="arrival-lineid" style="background-color:${r.color}"><span class="arrival-status-dot ${r.isLive ? 'live' : 'scheduled'}" title="${r.isLive ? 'Live' : 'Scheduled'}"></span><span class="lineid-text">${r.lineCode}</span></div><div class="arrival-descr">${r.lineName}</div><div class="arrival-right-content"><div class="arrival-time"><span class="arrival-time-min">${r.etaText}</span></div></div>`;
    cityStopArrivals.appendChild(row);
  });
}

async function refreshCityLiveArrivals() {
  if (!activeCityEntry || !activeCityStop) return;
  try {
    // sporades bundles live+scheduled in one call - fetch it once instead of
    // hitting fetchCityLiveVehicles/fetchCityScheduledUpcoming separately
    const [vehicles, scheduled] = activeCityEntry.liveSubdomain
      ? await fetchLiveSubdomainEta(activeCityEntry, activeCityStop).then((r) => [r.vehicles, r.trips])
      : await Promise.all([
          fetchCityLiveVehicles(activeCityEntry, activeCityStop),
          fetchCityScheduledUpcoming(activeCityEntry, activeCityStop),
        ]);
    if (activeCityEntry && activeCityStop) renderCityArrivals(activeCityEntry, activeCityStop, vehicles, scheduled);
  } catch (err) {
    console.error('Failed to load city live vehicles:', err);
    showNoArrivalsUI(cityStopArrivals, 'Could not get live arrivals.');
  }
}

// faster than athens' 30s refresh - a smaller per-stop endpoint and the
// ~8.5s marker animation both suit a tighter 10s cadence
const CITY_LIVE_REFRESH_SECONDS = 10;
function startCityLiveTimer() {
  stopCityLiveTimer();
  cityStopAutoRefreshContainer.classList.add('visible');
  let timeLeft = CITY_LIVE_REFRESH_SECONDS;
  function tick() {
    const progress = timeLeft / CITY_LIVE_REFRESH_SECONDS;
    cityStopTimerProgress.style.strokeDashoffset = circumference * (1 - progress);
    cityStopTimerText.textContent = timeLeft;
  }
  cityLiveTimerId = setInterval(() => {
    tick();
    if (timeLeft <= 0) { refreshCityLiveArrivals(); timeLeft = CITY_LIVE_REFRESH_SECONDS; return; }
    timeLeft--;
  }, 1000);
  tick();
}

function stopCityLiveTimer() {
  cityStopAutoRefreshContainer.classList.remove('visible');
  if (cityLiveTimerId) {
    clearInterval(cityLiveTimerId);
    cityLiveTimerId = null;
  }
}

// ─── stop panel ─────────────────────────────────────────────────────────────
function switchCityTab(tabName) {
  if (tabName === 'arrivals') {
    cityTabArrivals.classList.add('active');
    cityStopArrivals.classList.add('active');
    cityTabLines.classList.remove('active');
    cityStopLinesContent.classList.remove('active');
  } else {
    cityTabLines.classList.add('active');
    cityStopLinesContent.classList.add('active');
    cityTabArrivals.classList.remove('active');
    cityStopArrivals.classList.remove('active');
  }
}

async function showCityStopInfo(entry, stop) {
  clearDemotedPanels();
  stopTimer();
  stopSuburbanTimer();
  stopFerryCountdownTicker();
  stopInfoPanel.classList.remove('visible');
  metroStationPanel.classList.remove('visible');
  suburbanStationPanel.classList.remove('visible');
  tramStationPanel.classList.remove('visible');
  ferryStationPanel.classList.remove('visible');
  schedulePanel.classList.remove('visible');
  if (selectedStopMarker) { selectedStopMarker.remove(); selectedStopMarker = null; }
  if (selectedHeadingMarker) { selectedHeadingMarker.remove(); selectedHeadingMarker = null; }

  stopCityLiveTimer();
  if (activeCityEntry && activeCityEntry !== entry) clearRouteHighlightForEntry(activeCityEntry);
  if (activeCityEntry) clearCityLiveMarkers(activeCityEntry);

  activeCityEntry = entry;
  activeCityStop = stop;
  switchCityTab('arrivals');
  setCitySelectedStopMarker(stop);

  cityStopTitle.textContent = stop.name;
  cityStopPanel.classList.add('visible');

  cityStopLinesContent.innerHTML = '';
  stop.lines.forEach((line) => {
    const row = document.createElement('div');
    row.className = 'line-row';
    row.innerHTML = `<div class="line-id-pill" style="background-color:${line.color}">${line.code}</div><div class="line-descr">${line.name}</div>`;
    row.addEventListener('click', () => showCitySchedule(entry, line));
    cityStopLinesContent.appendChild(row);
  });

  highlightRoutesForStop(entry, stop);

  showLoadingUI(cityStopArrivals, 'Getting Live Arrivals...', true);
  await refreshCityLiveArrivals();
  startCityLiveTimer();
}

cityStopClose.addEventListener('click', () => {
  cityStopPanel.classList.remove('visible');
  stopCityLiveTimer();
  if (activeCityEntry) {
    clearRouteHighlightForEntry(activeCityEntry);
    clearCityLiveMarkers(activeCityEntry);
  }
  clearCitySelectedStopMarker();
  activeCityEntry = null;
  activeCityStop = null;
});

cityStopRefresh.addEventListener('click', () => {
  if (!activeCityEntry) return;
  stopCityLiveTimer();
  refreshCityLiveArrivals().then(startCityLiveTimer);
});

cityTabArrivals.addEventListener('click', () => switchCityTab('arrivals'));
cityTabLines.addEventListener('click', () => switchCityTab('lines'));

// ─── schedule (reuses the shared #schedule-panel) ──────────────────────────
function extractCityTripTime(t) {
  return t.tripTime || t.time || t.departureTime || null;
}

function renderCityScheduleTimes(trips) {
  scheduleGoTimes.innerHTML = '';
  if (!Array.isArray(trips) || trips.length === 0) {
    scheduleGoTimes.innerHTML = `<div class="info-message">No departures scheduled.</div>`;
    return;
  }
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let nextEl = null;
  trips
    .map((t) => extractCityTripTime(t))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .forEach((time) => {
      const pill = document.createElement('div');
      pill.className = 'time-pill';
      pill.textContent = time.slice(0, 5);
      scheduleGoTimes.appendChild(pill);
      const [h, m] = time.split(':').map(Number);
      if (!nextEl && h * 60 + m >= nowMinutes) nextEl = pill;
    });
  if (!nextEl && scheduleGoTimes.firstChild) nextEl = scheduleGoTimes.firstChild;
  if (nextEl) {
    nextEl.classList.add('highlighted');
    setTimeout(() => nextEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }), 300);
  }
}

// citybus's schedule endpoint is keyed by stop (returns every line passing
// it, filtered down to the tapped line); mybus's is keyed by line directly
async function showCitySchedule(entry, line) {
  if (cityStopPanel.classList.contains('visible')) cityStopPanel.classList.add('panel-demoted');
  schedulePanel.classList.add('visible');
  scheduleLoadingOverlay.classList.add('visible');
  scheduleProgressBar.style.width = '0%';
  scheduleTitle.innerHTML = `<div class="line-id-pill" style="background-color:${line.color}">${line.code}</div><span>${line.name}</span>`;
  scheduleRoutesTitle.textContent = '';
  scheduleRoutesList.innerHTML = '';
  goTimesSection.style.display = 'block';
  comeTimesSection.style.display = 'none';

  const day = (new Date().getDay() + 6) % 7;
  try {
    let trips;
    if (entry.liveSubdomain) {
      // schedule here is keyed by routeCode (not lineCode) - fetch every route
      // code serving this stop, then keep just this lines departures here.
      // works even without a local routes.json (eg aigio has none)
      const stopRouteCodes = activeCityStop.raw.routeCodes || [];
      const results = await Promise.all(stopRouteCodes.map(async (rc) => {
        const url = `${PROXY_URL}${encodeURIComponent(`${CITY_MYBUS_BASE(entry.liveSubdomain)}/api/schedule/${rc}?day=${day}`)}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return data.schedules || [];
      }));
      trips = results.flat().filter((t) => t.stopCode === activeCityStop.code && t.lineCode === line.code);
    } else if (entry.source === 'citybus') {
      const url = `${PROXY_URL}${encodeURIComponent(`${CITY_REST_BASE}/api/v1/el/${entry.cityId}/trips/stop/${activeCityStop.code}/day/${day}`)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`schedule fetch failed: ${res.status}`);
      const all = await res.json();
      trips = all.filter((t) => t.lineCode === line.code);
    } else {
      const url = `${PROXY_URL}${encodeURIComponent(`${CITY_MYBUS_BASE(entry.subdomain)}/api/schedule/${line.code}?day=${day}`)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`schedule fetch failed: ${res.status}`);
      trips = await res.json();
    }
    scheduleProgressBar.style.width = '100%';
    setTimeout(() => scheduleLoadingOverlay.classList.remove('visible'), 400);
    renderCityScheduleTimes(trips);
  } catch (err) {
    console.error('Failed to load city schedule:', err);
    scheduleLoadingOverlay.classList.remove('visible');
    scheduleGoTimes.innerHTML = `<div class="info-message">Could not load schedule.</div>`;
  }
}

toggleOtherCities.addEventListener('change', updateCityExpansion);

mapLoadPromise.then(() => {
  initCityPills();
  updateCityPillSizes();
  map.on('zoomend', updateCityExpansion);
  map.on('moveend', updateCityExpansion);
  map.on('click', (e) => {
    const hit = queryCityStopAt(e.point);
    if (!hit) return;
    map.flyTo({ center: [hit.stop.lng, hit.stop.lat], zoom: 16, duration: 600 });
    showCityStopInfo(hit.entry, hit.stop);
  });
});
