const dataPath = 'data/';

// cached so rebuildMapLayersAfterStyleChange can rebuild after a theme
// swap without refetching or reprocessing anything
let mapDataCache = null;
let mapSuburbanLinesGeoJSON = null;

// everything rebuildMapLayersAfterStyleChange needs to restore after a
// style swap wipes the old style's runtime layers - station markers are
// plain dom markers and survive on their own, so not part of this
function buildGLLayers(dataCache, suburbanLinesGeoJSON) {
  ensureHeadingArrowImages();

  // maplibre paint expressions can't index into a plain js object like
  // metroLineColors/tramColors by a dynamic key, so the per-feature color
  // is precomputed into the geojson itself instead of expressed in gl
  dataCache.metroLinesData.features.forEach(f => {
    f.properties.lineColor = metroLineColors[f.properties.LINE] || '#000000';
  });
  map.addSource(SOURCE_IDS.metroLines, { type: 'geojson', data: dataCache.metroLinesData });
  map.addLayer({
    id: LAYER_IDS.metroLines,
    type: 'line',
    source: SOURCE_IDS.metroLines,
    paint: {
      'line-color': ['get', 'lineColor'],
      'line-width': 4,
      'line-opacity': 0.8,
    },
  });

  suburbanLinesGeoJSON.features.forEach(f => {
    f.properties.color = f.properties.color || '#A9A9A9';
  });
  map.addSource(SOURCE_IDS.suburbanLines, { type: 'geojson', data: suburbanLinesGeoJSON });
  map.addLayer({
    id: LAYER_IDS.suburbanLines,
    type: 'line',
    source: SOURCE_IDS.suburbanLines,
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 3.5,
      'line-opacity': 0.75,
    },
  });

  map.addSource(SOURCE_IDS.busStops, { type: 'geojson', data: mergedStopsGeoJSON });

  // added above metro/suburban lines (gl draws bottom-to-top in add order) so
  // stops sit on top of those lines; heading arrow still precedes the dot so it stacks underneath it
  map.addLayer({
    id: LAYER_IDS.stopHeading,
    type: 'symbol',
    source: SOURCE_IDS.busStops,
    filter: ['!=', ['get', 'heading'], null],
    minzoom: clickableStopZoomThreshold,
    layout: {
      'icon-image': headingArrowImageId(),
      'icon-size': HEADING_ARROW_SIZE_EXPR,
      'icon-rotate': ['get', 'heading'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: {
      'icon-opacity-transition': { duration: 1000 },
    },
  });

  map.addLayer({
    id: LAYER_IDS.stops,
    type: 'circle',
    source: SOURCE_IDS.busStops,
    paint: {
      'circle-radius': stopRadiusExpr(),
      'circle-color': '#003366',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': stopStrokeWeightExpr(),
      'circle-opacity': stopFillOpacityExpr(),
      'circle-opacity-transition': { duration: 1000 },
    },
  });

  map.addLayer({
    id: LAYER_IDS.stopsLabel,
    type: 'symbol',
    source: SOURCE_IDS.busStops,
    layout: {
      'text-field': ['get', 'stop_descr'],
      'text-size': 11,
      'text-font': ['Noto Sans Regular'],
      'text-anchor': 'top',
      'text-offset': [0, 1.2],
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#1e3a5f',
      'text-halo-color': '#fff',
      'text-halo-width': 1.3,
      'text-opacity-transition': { duration: 1000 },
    },
  });
  applyStopLabelZoomRange();

  dataCache.tramLinesData.features.forEach(f => {
    f.properties.lineColor = tramColors[f.properties.LINET] || '#c078aa';
  });
  map.addSource(SOURCE_IDS.tramLines, { type: 'geojson', data: dataCache.tramLinesData });
  map.addLayer({
    id: LAYER_IDS.tramLines,
    type: 'line',
    source: SOURCE_IDS.tramLines,
    paint: {
      'line-color': ['get', 'lineColor'],
      'line-width': 3,
      'line-opacity': 0.8,
    },
  });

  addBusNetworkLayer(dataCache);
}

// separate from buildGLLayers since this data arrives later on its own
// slower fetch - also called from buildGLLayers so a style-swap rebuild
// restores it immediately from cache instead of re-fetching
function addBusNetworkLayer(dataCache) {
  if (!dataCache.allRoutesData || map.getSource(SOURCE_IDS.busNetwork)) return;
  map.addSource(SOURCE_IDS.busNetwork, { type: 'geojson', data: dataCache.allRoutesData });
  map.addLayer({
    id: LAYER_IDS.busNetwork,
    type: 'line',
    source: SOURCE_IDS.busNetwork,
    minzoom: routeZoomThreshold,
    paint: {
      'line-color': '#007BFF',
      'line-width': 2.5,
      'line-opacity': routeLineOpacityExpr(),
      'line-opacity-transition': { duration: 1000 },
    },
  });
}

// hover label below the always-on label zoom threshold + click to open the
// stop info panel - registered once ever, not on every rebuild. uses plain
// map.on(event, ...) + queryRenderedFeatures against LAYER_IDS.stops
// (rather than a layer-scoped listener) so a small pixel box can be padded
// around the point, giving taps a bit of slack beyond the rendered dot
const STOP_HIT_PADDING = 5;
function queryStopAt(point) {
  const box = [[point.x - STOP_HIT_PADDING, point.y - STOP_HIT_PADDING], [point.x + STOP_HIT_PADDING, point.y + STOP_HIT_PADDING]];
  return map.queryRenderedFeatures(box, { layers: [LAYER_IDS.stops] })[0] || null;
}

function registerStopLayerInteractions() {
  const stopHoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'stop-label-popup' });
  map.on('mousemove', (e) => {
    const zoom = map.getZoom();
    if (zoom < clickableStopZoomThreshold || zoom >= getLabelZoomThreshold()) { stopHoverPopup.remove(); return; }
    const feature = queryStopAt(e.point);
    if (!feature) { map.getCanvas().style.cursor = ''; stopHoverPopup.remove(); return; }
    map.getCanvas().style.cursor = 'pointer';
    stopHoverPopup.setLngLat(e.lngLat).setHTML(`<span class="stop-label">${feature.properties.stop_descr}</span>`).addTo(map);
  });
  map.on('click', (e) => {
    if (map.getZoom() < clickableStopZoomThreshold) return;
    const feature = queryStopAt(e.point);
    if (!feature) return;
    stopHoverPopup.remove();
    map.flyTo({ center: e.lngLat, zoom: 17, duration: 750 });
    if (selectedStopMarker) selectedStopMarker.remove();
    const style = getSelectedStopStyle();
    selectedStopMarker = new maplibregl.Marker({ element: createDotMarkerElement(style.radius * 2, style.fillColor, { strokeWidth: style.weight }) })
      .setLngLat(e.lngLat)
      .addTo(map);
    const stopProps = { ...feature.properties };
    if (stopStreetmap.has(stopProps.StopCode)) {
      stopProps.stop_street = stopStreetmap.get(stopProps.StopCode);
    }
    currentStopProperties = stopProps;
    showStopInfo(currentStopProperties);
  });
}

// station markers stay as bounded-count dom markers (see js/3-map-engine.js) -
// created once, never rebuilt: unlike gl layers they aren't touched by a
// style swap at all
function createStationMarkers(dataCache) {
  dataCache.metroStationsData.features.forEach((feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    const size = getMetroIconSize(map.getZoom());
    const el = document.createElement('div');
    el.className = 'metro-station-icon';
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.innerHTML = createMetroIcon(feature.properties.MSYM);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      showMetroInfo(feature.properties);
      map.flyTo({ center: [lng, lat], zoom: 16 });
    });
    const marker = new maplibregl.Marker({ element: el });
    marker.setLngLat([lng, lat]);
    metroStationMarkers.push({ marker, msym: feature.properties.MSYM, onMap: false });
  });
  lastMetroIconSize = getMetroIconSize(map.getZoom());

  suburbanStopsGeoJSON.features.forEach((feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    const size = getSuburbanIconSize(map.getZoom());
    const el = document.createElement('div');
    el.className = 'suburban-station-icon';
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.innerHTML = createSuburbanIcon(feature.properties.groups);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      showSuburbanInfo(feature.properties);
      map.flyTo({ center: [lng, lat], zoom: 16 });
    });
    const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]);

    const labelEl = document.createElement('span');
    labelEl.className = 'train-station-label';
    labelEl.textContent = feature.properties.name;
    const labelMarker = new maplibregl.Marker({ element: labelEl, anchor: 'top', offset: [0, 6] }).setLngLat([lng, lat]);

    suburbanStationMarkers.push({ marker, labelMarker, groups: feature.properties.groups, onMap: false });
  });
  lastSuburbanIconSize = getSuburbanIconSize(map.getZoom());

  dataCache.tramStopsData.features.forEach((feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    const el = document.createElement('div');
    el.className = 'tram-station-icon';
    el.style.width = '18px';
    el.style.height = '18px';
    el.innerHTML = createTramIcon(feature.properties.LINE_T);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      showTramInfo(feature.properties);
      map.flyTo({ center: [lng, lat], zoom: 16 });
    });
    const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]);
    tramStationMarkers.push({ marker, onMap: false });
  });

  // ferry gates - same dot styling as the metro stations but a bit bigger
  // (createFerryIcon mirrors createMetroIcon), fixed coordinates rather
  // than a fetched dataset since there's only nine of them
  ferryStops.forEach((stop) => {
    const size = getFerryIconSize(map.getZoom());
    const el = document.createElement('div');
    el.className = 'ferry-station-icon';
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.innerHTML = createFerryIcon(stop.gate);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      showFerryInfo(stop.gate);
      map.flyTo({ center: [stop.lng, stop.lat], zoom: 16 });
    });
    const marker = new maplibregl.Marker({ element: el }).setLngLat([stop.lng, stop.lat]);
    ferryStationMarkers.push({ marker, gate: stop.gate, onMap: false });
  });
}

// called by js/3-map-engine.js's onThemeChange once the newly-swapped style
// has finished loading
function rebuildMapLayersAfterStyleChange() {
  if (!mapDataCache) return;
  buildGLLayers(mapDataCache, mapSuburbanLinesGeoJSON);
}

function buildMapLayers(dataCache, suburbanLinesGeoJSON) {
  mapDataCache = dataCache;
  mapSuburbanLinesGeoJSON = suburbanLinesGeoJSON;

  buildGLLayers(dataCache, suburbanLinesGeoJSON);
  registerStopLayerInteractions();
  createStationMarkers(dataCache);

  updateAllMapView();
  hideLoader();
  updateButtonPosition();
  applyMapTheme();

  return fetchAndDecompressGzip(`${dataPath}BasicRoutes_pg.json.gz`)
    .then(allRoutes => {
      dataCache.allRoutesData = allRoutes;
      addBusNetworkLayer(dataCache);
      updateAllLayers();
    })
    .catch(err => console.warn('Bus network background load failed:', err));
}

document.addEventListener("DOMContentLoaded", () => {
  const dataCache = {};

  const schedulePanelObserver = new MutationObserver(() => {
    updateButtonPosition();
  });
  schedulePanelObserver.observe(schedulePanel, {
    attributes: true,
    attributeFilter: ['class']
  });

  loadingText.innerText = "Loading Local Data...";
  updateProgressBar(5);

  const fetchAndMergeGzippedGeoJSON = async (filePaths) => {
    const promises = filePaths.map(path => fetchAndDecompressGzip(`${dataPath}${path}.gz`));
    const geojsonParts = await Promise.all(promises);
    let mergedFeatures = [];
    geojsonParts.forEach(part => {
      if (part.features) {
        mergedFeatures = mergedFeatures.concat(part.features);
      }
    });
    return { type: "FeatureCollection", features: mergedFeatures };
  };

  // file5 also carries 60 stops (e.g. the whole oropos/afidnes area) that
  // exist in the route/schedule system per BasicRouteStops_pg but were
  // missing from oasa's own curated "stops for site" export
  const allStopsFiles = [
    'oasa_db_public_v_mat_latest_stops_forsite1.json',
    'oasa_db_public_v_mat_latest_stops_forsite2.json',
    'oasa_db_public_v_mat_latest_stops_forsite3.json',
    'oasa_db_public_v_mat_latest_stops_forsite4.json',
    'oasa_db_public_v_mat_latest_stops_forsite5.json'
  ];

  const basicRouteStopsFiles = [
    'BasicRouteStops_pg1.json',
    'BasicRouteStops_pg2.json',
    'BasicRouteStops_pg3.json',
    'BasicRouteStops_pg4.json',
    'BasicRouteStops_pg5.json',
    'BasicRouteStops_pg6.json',
    'BasicRouteStops_pg7.json',
    'BasicRouteStops_pg8.json',
    'BasicRouteStops_pg9.json',
    'BasicRouteStops_pg10.json'
  ];

  fetchAndMergeGzippedGeoJSON(allStopsFiles)
    .then(busStops => {
      dataCache.allStopsData = busStops;
      updateProgressBar(15);
      loadingText.innerText = "Loading Accessibility Data...";
      return fetchAndDecompressGzip(`${dataPath}Amea_accessibility1.json.gz`);
    })
    .then(liveBoard => {
      dataCache.liveBoardData = liveBoard;
      updateProgressBar(25);
      loadingText.innerText = "Loading Line Info...";
      return fetchAndDecompressGzip(`${dataPath}webGetLines.json.gz`);
    })
    .then(lines => {
      dataCache.linesData = lines;
      updateProgressBar(35);
      loadingText.innerText = "Loading Route Stop Details...";
      return fetchAndMergeGzippedGeoJSON(basicRouteStopsFiles);
    })
    .then(routeStops => {
      dataCache.basicRouteStopsData = routeStops;
      updateProgressBar(45);
      loadingText.innerText = "Loading Metro Data...";
      return Promise.all([
        fetchAndDecompressGzip(`${dataPath}Metro_Lines_AM_CoR.json.gz`),
        fetchAndDecompressGzip(`${dataPath}Metro_Stns_AM_CoR.json.gz`)
      ]);
    })
    .then(([metroLines, metroStations]) => {
      dataCache.metroLinesData = metroLines;
      dataCache.metroStationsData = metroStations;
      updateProgressBar(65);
      loadingText.innerText = "Loading Rail & Tram Data...";
      return Promise.all([
        fetchAndDecompressGzip(`${dataPath}all_trains_suburbans.json.gz`),
        fetchAndDecompressGzip(`${dataPath}tram_lines.json.gz`),
        fetchAndDecompressGzip(`${dataPath}tram_stops.json.gz`)
      ]);
    })
    .then(([trainsData, tramLines, tramStops]) => {
      dataCache.trainsData = trainsData;
      dataCache.tramLinesData = tramLines;
      dataCache.tramStopsData = tramStops;
      loadingText.innerText = "Processing Data...";
      updateProgressBar(95);

      allLinesData = dataCache.linesData;
      const stopExtraDataMap = new Map();

      dataCache.basicRouteStopsData.features.forEach((f) => {
        const code = f.properties.stop_code;
        if (!stopExtraDataMap.has(code)) {
            stopExtraDataMap.set(code, { street: "", heading: null });
        }
        const entry = stopExtraDataMap.get(code);
        if (!entry.street && f.properties.stop_street) {
            entry.street = f.properties.stop_street;
        }
        if (entry.heading === null) {
            let rawHeading = f.properties.StopHeading;
            if (rawHeading === undefined) rawHeading = f.properties.stop_heading;
            if (rawHeading !== undefined && rawHeading !== null) {
                let h = parseInt(rawHeading, 10);
                if (!isNaN(h)) {
                    if (h === -1) h = 0;
                    entry.heading = h;
                }
            }
        }
        if (!stopStreetmap.has(code)) {
             stopStreetmap.set(code, f.properties.stop_street);
        }
      });

      const liveBoardCodes = new Set(
        dataCache.liveBoardData.features.map((f) => f.properties.StopCode)
      );

      mergedStopsGeoJSON = {
        type: "FeatureCollection",
        features: dataCache.allStopsData.features.map((f) => {
          const extra = stopExtraDataMap.get(f.properties.stop_code) || { street: "", heading: null };
          return {
            type: "Feature",
            geometry: f.geometry,
            properties: {
              StopCode: f.properties.stop_code,
              StopCodeStr: String(f.properties.stop_code),
              stop_descr: f.properties.stop_descr,
              ramp: f.properties.ramp || "OXI",
              stop_type_code: f.properties.stoptyp_code || null,
              live_board: liveBoardCodes.has(f.properties.stop_code) ? "NAI" : "OXI",
              heading: extra.heading
            },
          };
        }),
      };

      suburbanGroupColors = new Map(dataCache.trainsData.groups.map(g => [g.name, g.color]));
      suburbanStopGroupsByGovId = new Map();
      suburbanStopCoordsByGovId = new Map();
      dataCache.trainsData.stops.forEach(s => {
        (s.govIds || []).forEach(govId => {
          suburbanStopGroupsByGovId.set(govId, s.groups || []);
          // lat/lng stored in that order since the live streams own coords come that way too
          if (Array.isArray(s.coords)) suburbanStopCoordsByGovId.set(govId, { name: s.name, lat: s.coords[1], lng: s.coords[0] });
        });
      });
      const suburbanLinesGeoJSON = {
        type: "FeatureCollection",
        features: dataCache.trainsData.groups.flatMap(g =>
          g.segments.map(seg => ({
            type: "Feature",
            properties: { group: g.name, description: g.description, color: g.color },
            geometry: { type: "LineString", coordinates: seg.coords },
          }))
        ),
      };
      suburbanStopsGeoJSON = {
        type: "FeatureCollection",
        features: dataCache.trainsData.stops.map(s => ({
          type: "Feature",
          properties: { id: s.id, name: s.name, groups: s.groups, stopCode: s.stopCode, govIds: s.govIds, customFields: s.customFields },
          geometry: { type: "Point", coordinates: s.coords },
        })),
      };
      // this local dataset only ever stores the stops transliterated/english
      // name - backfills the real greek spelling for search by cross
      // referencing the same corridor-stations endpoint (and the same
      // government station ids) the train timetable board already uses,
      // caching it into timetableCorridors too so opening the board later
      // skips its own now-redundant fetch. non-blocking since this only
      // improves search, nothing here needs to hold up the rest of the app
      fetch(`${PROXY_URL}${encodeURIComponent('https://railway.gov.gr/api/public/corridor-stations')}`)
        .then(res => res.json())
        .then(data => {
          timetableCorridors = data.corridors || [];
          const govIdToGreekName = new Map();
          timetableCorridors.forEach(corridor => {
            (corridor.stations || []).forEach(s => {
              const ids = (s.stationIds && s.stationIds.length) ? s.stationIds : [s.stationId];
              ids.forEach(id => { if (id && s.nameGreek) govIdToGreekName.set(id, s.nameGreek); });
            });
          });
          suburbanStopsGeoJSON.features.forEach(feature => {
            const greekName = (feature.properties.govIds || []).map(id => govIdToGreekName.get(id)).find(Boolean);
            if (greekName) feature.properties.nameGreek = greekName;
          });
        })
        .catch(err => console.error('Failed to load greek station names for search:', err));

      // everything below touches the map, so it waits for the style to finish loading
      return mapLoadPromise.then(() => buildMapLayers(dataCache, suburbanLinesGeoJSON));
    })
    .catch((error) => {
      console.error("Error during initial data load:", error);
      loadingText.innerText = "Error loading local data!";
      const spinner = document.getElementById('loading-spinner');
      if (spinner) spinner.style.display = 'none';
    });
});

window.addEventListener('click', (e) => {
  if (!e.target.closest('.delay-info-icon') && !e.target.closest('.tooltip-trigger')) {
    delayTooltip.style.opacity = '0';
    delayTooltip.style.pointerEvents = 'none';
  }
});

window.addEventListener("contextmenu", (e) => {
  if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    e.preventDefault();
    return false;
  }
}, { passive: false });
