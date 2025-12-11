document.addEventListener("DOMContentLoaded", () => {
  const dataCache = {}; 
  const dataPath = 'data/'; 

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

  const allStopsFiles = [
    'oasa_db_public_v_mat_latest_stops_forsite1.json',
    'oasa_db_public_v_mat_latest_stops_forsite2.json',
    'oasa_db_public_v_mat_latest_stops_forsite3.json',
    'oasa_db_public_v_mat_latest_stops_forsite4.json',
    'oasa_db_public_v_mat_latest_stops_forsite5.json'
  ];

  const basicRouteStopsFiles = [
    'BasicRouteStops_pg1.json', 'BasicRouteStops_pg2.json', 'BasicRouteStops_pg3.json',
    'BasicRouteStops_pg4.json', 'BasicRouteStops_pg5.json', 'BasicRouteStops_pg6.json',
    'BasicRouteStops_pg7.json', 'BasicRouteStops_pg8.json', 'BasicRouteStops_pg9.json',
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
      loadingText.innerText = "Loading Suburban Rail Data...";
      return Promise.all([
        fetchAndDecompressGzip(`${dataPath}Proastiakos_AM_CoR.json.gz`),
        fetchAndDecompressGzip(`${dataPath}Proastiakos_Stops_AM_CoR.json.gz`)
      ]);
    })
    .then(([suburbanLines, suburbanStations]) => {
      dataCache.suburbanLinesData = suburbanLines;
      dataCache.suburbanStationsData = suburbanStations;
      updateProgressBar(85);
      loadingText.innerText = "Loading Bus Network...";
      return fetchAndDecompressGzip(`${dataPath}BasicRoutes_pg.json.gz`);
    })
    .then(allRoutes => {
      dataCache.allRoutesData = allRoutes;
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
              stop_descr: f.properties.stop_descr,
              ramp: f.properties.ramp || "OXI",
              stop_type_code: f.properties.stoptyp_code || null,
              live_board: liveBoardCodes.has(f.properties.stop_code) ? "NAI" : "OXI",
              heading: extra.heading 
            },
          };
        }),
      };

      const initialRadius = getStopRadius(map.getZoom());
      const initialStyle = { ...baseStopStyle, radius: initialRadius };

      stopsLayerNotInteractive = L.geoJSON(mergedStopsGeoJSON, {
        renderer: myCanvasRenderer,
        pointToLayer: (f, l) => L.circleMarker(l, { ...initialStyle, interactive: false }),
      });

      stopsLayerInteractive = L.geoJSON(mergedStopsGeoJSON, {
        pointToLayer: (feature, latlng) => L.circleMarker(latlng, { ...initialStyle, className: "interactive-stop-dot" }),
        onEachFeature: (feature, layer) => {
          layer.bindTooltip(feature.properties.stop_descr, { permanent: false, direction: "bottom", offset: [0, 8], className: "stop-label" });
          layer.on('mouseover', function () { this.openTooltip(); });
          layer.on('mouseout', function () {
            if (map.getZoom() < getLabelZoomThreshold()) { this.closeTooltip(); }
          });
          layer.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            map.flyTo(e.latlng, 17, { duration: 0.75 });
            if (selectedStopMarker) map.removeLayer(selectedStopMarker);
            selectedStopMarker = L.circleMarker(e.latlng, { ...getSelectedStopStyle(), pane: "selectedStopPane" }).addTo(map);
            const stopProps = e.target.feature.properties;
            if (stopStreetmap.has(stopProps.StopCode)) {
              stopProps.stop_street = stopStreetmap.get(stopProps.StopCode);
            }
            currentStopProperties = stopProps;
            showStopInfo(currentStopProperties);
          });
        },
      });

      stopsHeadingLayer = L.layerGroup(); 
      stopsHeadingLayer = L.geoJSON(mergedStopsGeoJSON, {
        pointToLayer: (feature, latlng) => {
            const icon = createHeadingIcon(feature.properties.heading);
            if (!icon) return null;
            return L.marker(latlng, { icon: icon, pane: 'headingPane', interactive: false });
        }
      });

      routesLayer = L.geoJSON(dataCache.allRoutesData, {
        renderer: myCanvasRenderer,
        style: getRouteStyle(map.getZoom()),
      });
      metroLayer = L.geoJSON(dataCache.metroLinesData, {
        style: (feature) => ({ color: metroLineColors[feature.properties.LINE] || '#000000', weight: 4, opacity: 0.8 }),
        pane: 'metroPane'
      }).addTo(map);
      suburbanLayer = L.geoJSON(dataCache.suburbanLinesData, {
        style: (feature) => ({ color: suburbanLineColors[feature.properties.LINE] || '#A9A9A9', weight: 3.5, opacity: 0.75 }),
        pane: 'suburbanPane'
      }).addTo(map);
      metroStationsLayer = L.geoJSON(dataCache.metroStationsData, {
        pointToLayer: (feature, latlng) => L.marker(latlng, { icon: L.divIcon({ html: createMetroIcon(feature.properties.MSYM), className: 'metro-station-icon', iconSize: [24, 24], iconAnchor: [12, 12] }), pane: 'metroStationPane' }),
        onEachFeature: (feature, layer) => { layer.on('click', (e) => { L.DomEvent.stopPropagation(e); showMetroInfo(feature.properties); map.flyTo(e.latlng, 16); }); }
      });
      suburbanStationsLayer = L.geoJSON(dataCache.suburbanStationsData, {
        pointToLayer: (feature, latlng) => L.marker(latlng, { icon: L.divIcon({ html: createSuburbanIcon(), className: 'suburban-station-icon', iconSize: [16, 16], iconAnchor: [8, 8] }), pane: 'suburbanStationPane' }),
        onEachFeature: (feature, layer) => { layer.on('click', (e) => { L.DomEvent.stopPropagation(e); showSuburbanInfo(feature.properties); map.flyTo(e.latlng, 16); }); }
      });

      plottedStopsLayer = L.featureGroup().addTo(map);
      updateAllMapView();
      hideLoader();
      updateButtonPosition();
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