const createBusTextIcon = (lineID, vehNo, color) => {
  const html = `<div class="bus-icon-body" style="background-color: ${colorHex[color]}"><span class="bus-icon-lineid">${lineID}</span><span class="bus-icon-vehno">${vehNo}</span><div class="bus-icon-tire tire-left"></div><div class="bus-icon-tire tire-right"></div></div>`;
  return elFromHTML(`<div class="bus-text-icon">${html}</div>`);
};

// raw svg string, reused directly by the search results row (js/6-search-schedule.js)
const createSharedStopIconSvg = () =>
  `<svg width="14" height="14" viewBox="0 0 14 14" style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5));"><path d="M7 0 A7 7 0 0 1 7 14" fill="${colorHex.cyan}" /><path d="M7 0 A7 7 0 0 0 7 14" fill="${colorHex.green}" /><circle cx="7" cy="7" r="6.5" fill="transparent" stroke="white" stroke-width="1"/></svg>`;

const createSharedStopIconElement = () => elFromHTML(`<div class="shared-stop-icon">${createSharedStopIconSvg()}</div>`);

const getSelectedStopStyle = () => {
  const fillColor = plottedRoutes.length === 1 ? colorHex.green : colorHex.cyan;
  return { radius: 11, fillColor: fillColor, weight: 2 };
};

const createRouteTimerUI = (routeCode, lineID, color) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'active-route-timer';
    wrapper.id = `route-timer-${routeCode}`;
    wrapper.style.cursor = 'pointer';

    const strokeColor = colorHex[color] || '#333';

    wrapper.innerHTML = `
        <svg class="route-timer-svg" viewBox="0 0 36 36">
            <path class="route-timer-track" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path>
            <path class="route-timer-progress"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  style="stroke: ${strokeColor}; stroke-dasharray: 100 100; stroke-dashoffset: 0;">
            </path>
        </svg>
        <div class="route-timer-text">${lineID}</div>
    `;

    // click listener for the popup
    wrapper.addEventListener('click', (e) => {
        e.stopPropagation(); // stop map from clicking

        // find the route data
        const route = plottedRoutes.find(r => r.routeCode === routeCode);
        if (!route) return;

        // close other panels
        manageOpenPanels('timer');

        // populate popup text
        if (timerPopupRouteName) {
            timerPopupRouteName.innerHTML = `<span style="color:${colorHex[route.color]}">${route.lineID}</span> ${route.routeDescr}`;
        }

        // handle delete button
        if (timerPopupDeleteBtn) {
            timerPopupDeleteBtn.onclick = (ev) => {
                ev.stopPropagation();
                timerOptionsPopup.classList.remove('visible');
                clearRoutes([route]);
            };
        }

        // position and show the popup
        const rect = wrapper.getBoundingClientRect();
        if (timerOptionsPopup) {
            timerOptionsPopup.style.top = `${rect.top}px`;
            timerOptionsPopup.style.left = `${rect.right + 10}px`;
            timerOptionsPopup.classList.add('visible');
        }
    });

    return wrapper;
};

function clearPlottedStopMarkers() {
  plottedStopMarkers.forEach(({ marker }) => marker.remove());
  plottedStopMarkers = [];
}

// plotted-route stop markers need their own click handler - the bulk stops
// layer underneath is filtered out for these exact stops (updatePlottedStopsFilter)
// so a tap would otherwise go nowhere. route.stops uses different property
// casing than the bulk geojson (StopDescr vs stop_descr) so this looks the
// stop up in mergedStopsGeoJSON by StopCode first to get the canonical shape
function openStopInfoFromPlottedMarker(stopData, lng, lat) {
  map.flyTo({ center: [lng, lat], zoom: 17, duration: 750 });
  if (selectedStopMarker) selectedStopMarker.remove();
  const style = getSelectedStopStyle();
  selectedStopMarker = new maplibregl.Marker({ element: createDotMarkerElement(style.radius * 2, style.fillColor, { strokeWidth: style.weight }) })
    .setLngLat([lng, lat])
    .addTo(map);

  const globalFeature = mergedStopsGeoJSON.features.find(f => f.properties.StopCode == stopData.StopCode);
  const stopProps = globalFeature
    ? { ...globalFeature.properties }
    : { StopCode: stopData.StopCode, stop_descr: stopData.StopDescr, heading: stopData.StopHeading };
  if (stopStreetmap.has(stopProps.StopCode)) {
    stopProps.stop_street = stopStreetmap.get(stopProps.StopCode);
  }
  currentStopProperties = stopProps;
  showStopInfo(currentStopProperties);
}

// shared by the draw-in reveal (plotAnimatedRoute) and the reverse deletion
// animation (animateRouteDeletion) - rebuilds the visible stop subset fresh
// each frame, cheap since routes only ever have tens of stops
function renderHighlightedStopsSubset(stopsSubset, color) {
  clearPlottedStopMarkers();
  plottedStopCodes.clear();
  const style = highlightedStopStyles[color];
  stopsSubset.forEach((stopData) => {
    plottedStopCodes.add(stopData.StopCode);
    // the currently open stop already has its own bigger selectedStopMarker
    // on the map - still excluded from the bulk layer above (that's what
    // plottedStopCodes.add just did) but skips getting a second, smaller
    // dot of its own stacked underneath that one
    if (currentStopProperties && stopData.StopCode == currentStopProperties.StopCode) return;
    const lat = parseFloat(stopData.StopLat), lng = parseFloat(stopData.StopLng);
    const el = createDotMarkerElement(style.radius * 2, style.fillColor, { strokeWidth: style.weight });
    const labelEl = document.createElement('span');
    labelEl.className = 'stop-label plotted-stop-label';
    labelEl.textContent = stopData.StopDescr;
    el.appendChild(labelEl);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openStopInfoFromPlottedMarker(stopData, lng, lat);
    });
    const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
    plottedStopMarkers.push({ marker, isArrow: false, labelEl });
  });
  updatePlottedStopsFilter();
}

function updateHighlightedStops() {
  clearPlottedStopMarkers();
  plottedStopCodes.clear();
  const stopColorMap = new Map();
  plottedRoutes.forEach((route) => {
    route.stops.forEach((stop) => {
      const stopCode = stop.StopCode;
      if (!stopColorMap.has(stopCode)) {
        stopColorMap.set(stopCode, { stopData: stop, colors: new Set() });
      }
      stopColorMap.get(stopCode).colors.add(route.color);
    });
  });
  stopColorMap.forEach(({ stopData, colors }) => {
    const lat = parseFloat(stopData.StopLat), lng = parseFloat(stopData.StopLng);
    const stopCode = stopData.StopCode;
    plottedStopCodes.add(stopCode);
    // the currently open stop already has its own bigger selectedStopMarker
    // (+ selectedHeadingMarker) on the map - still excluded from the bulk
    // layer above but skips a second, smaller dot/arrow of its own stacked
    // right underneath
    if (currentStopProperties && stopCode == currentStopProperties.StopCode) return;
    let el;
    if (colors.size > 1) {
      el = createSharedStopIconElement();
    } else {
      const color = colors.values().next().value;
      const style = highlightedStopStyles[color];
      el = createDotMarkerElement(style.radius * 2, style.fillColor, { strokeWidth: style.weight });
    }
    const labelEl = document.createElement('span');
    labelEl.className = 'stop-label plotted-stop-label';
    labelEl.textContent = stopData.StopDescr;
    el.appendChild(labelEl);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openStopInfoFromPlottedMarker(stopData, lng, lat);
    });
    const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
    plottedStopMarkers.push({ marker, isArrow: false, labelEl });

    let heading = stopData.StopHeading;
    if (heading === undefined || heading === null || heading === "") {
        if (typeof mergedStopsGeoJSON !== 'undefined' && mergedStopsGeoJSON.features) {
            const globalFeature = mergedStopsGeoJSON.features.find(f => f.properties.StopCode == stopCode);
            if (globalFeature && globalFeature.properties.heading !== null && globalFeature.properties.heading !== undefined) {
                heading = globalFeature.properties.heading;
            }
        }
    }
    if (heading !== undefined && heading !== null && heading !== "") {
        let h = parseInt(heading, 10);
        if (!isNaN(h)) {
             if (h === -1) h = 0;
             const arrowEl = createHeadingIcon(h);
             if (arrowEl) {
                 const arrowMarker = new maplibregl.Marker({ element: arrowEl }).setLngLat([lng, lat]).addTo(map);
                 plottedStopMarkers.push({ marker: arrowMarker, isArrow: true });
             }
        }
    }
  });
  updatePlottedStopsFilter();
  updatePlottedStopLabels();
}

function updateArrivalsUIState() {
  const limitReached = plottedRoutes.length >= 2;
  document.querySelectorAll('.arrival-row').forEach(row => {
    const routeCode = row.dataset.routeCode;
    const plotBtn = row.querySelector('.plot-route-icon-btn');
    const timerWrapper = row.querySelector('.btime-timer-wrapper');
    if (!plotBtn || !timerWrapper) return;
    const isPlotted = plottedRoutes.some(r => r.routeCode === routeCode);
    if (isPlotted) {
      plotBtn.classList.remove('visible');
      timerWrapper.classList.add('visible');
    } else {
      plotBtn.classList.add('visible');
      timerWrapper.classList.remove('visible');
      if (limitReached) {
        plotBtn.classList.add('disabled');
        plotBtn.disabled = true;
      } else {
        plotBtn.classList.remove('disabled');
        plotBtn.disabled = false;
      }
    }
  });

  document.querySelectorAll('.schedule-plot-btn').forEach(btn => {
      const routeCode = btn.dataset.routeCode;
      const isPlotted = plottedRoutes.some(r => r.routeCode === routeCode);

      if (isPlotted || limitReached) {
          btn.classList.add('disabled');
          btn.disabled = true;
      } else {
          btn.classList.remove('disabled');
          btn.disabled = false;
      }
  });
}

// called from onThemeChange once a style swap finishes - setStyle() wipes
// any plotted route's source/layers, so this rebuilds them from route.points
// (a route mid-draw-animation during the toggle just snaps to fully drawn)
function rebuildPlottedRouteLayers() {
  plottedRoutes.forEach((route) => {
    const lineStyle = routeStyles[route.color];
    map.addSource(route.sourceId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: route.points } } });
    map.addLayer({
      id: route.lineLayerId,
      type: 'line',
      source: route.sourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': lineStyle.color, 'line-width': lineStyle.weight, 'line-opacity': lineStyle.opacity },
    });
    const arrowColor = route.color === 'cyan' ? colorHex.darkCyan : colorHex.darkGreen;
    map.addLayer({
      id: route.arrowLayerId,
      type: 'symbol',
      source: route.sourceId,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 65,
        'icon-image': ensureRouteArrowImage(route.color, arrowColor),
        'icon-size': 0.55,
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
  });
}

// route plotting
async function plotAnimatedRoute(routeCode, lineID, routeDescr) {
  if (!dataFeaturesEnabled.buses) {
    showPlotNotification(dataOffMessage('Bus data'), 'notif-cyan');
    return;
  }
  if (plottedRoutes.find((r) => r.routeCode === routeCode)) return;
  if (plottedRoutes.length >= 2) return;
  let color;
  if (plottedRoutes.length === 0) {
    color = 'cyan';
  } else {
    const existingColor = plottedRoutes[0].color;
    color = (existingColor === 'cyan') ? 'green' : 'cyan';
  }
  if (plottedRoutes.length === 0) {
    setDimState(true);
  }
  const lineStyle = routeStyles[color];

  // start the timer immediately so logic works
  // the visual element gets added in the rendering phase below
  startBusLocationTimer(routeCode, color);

  const detailsUrl = `${PROXY_URL}${encodeURIComponent(`https://telematics.oasa.gr/api/?act=webGetRoutesDetailsAndStops&p1=${routeCode}&t=${Date.now()}`)}`;
  try {
    const response = await fetch(detailsUrl);
    const data = await response.json();
    if (!data.details || !data.stops || data.details.length === 0) throw new Error("Invalid route data");
    const routePoints = data.details.map((p) => [parseFloat(p.routed_x), parseFloat(p.routed_y)]);
    const routeStopsGeoJSON = { type: "FeatureCollection", features: data.stops.map((s) => ({ type: "Feature", properties: s, geometry: { type: "Point", coordinates: [parseFloat(s.StopLng), parseFloat(s.StopLat)] }, })), };

    const sourceId = `route-line-${routeCode}`;
    const lineLayerId = `route-line-layer-${routeCode}`;
    const arrowLayerId = `route-arrow-layer-${routeCode}`;
    const arrowColor = color === "cyan" ? colorHex.darkCyan : colorHex.darkGreen;
    const arrowImageId = ensureRouteArrowImage(color, arrowColor);

    map.addSource(sourceId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } });
    map.addLayer({
      id: lineLayerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': lineStyle.color, 'line-width': lineStyle.weight, 'line-opacity': lineStyle.opacity },
    });
    map.addLayer({
      id: arrowLayerId,
      type: 'symbol',
      source: sourceId,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 65,
        'icon-image': arrowImageId,
        'icon-size': 0.55,
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });

    const routeData = { routeCode, color, sourceId, lineLayerId, arrowLayerId, animationId: null, stops: data.stops, busMarkers: new Map(), points: routePoints, lineID: lineID, routeDescr: routeDescr || '', routeStopsGeoJSON: routeStopsGeoJSON };
    plottedRoutes.push(routeData);

    const startRouteVisuals = async () => {
        clearRouteButton.style.display = "flex";

        // add the floating timer to the ui
        const timerUI = createRouteTimerUI(routeCode, lineID, color);
        if (activeTimersContainer) {
            activeTimersContainer.appendChild(timerUI);
        }

        updateArrivalsUIState();
        if (plottedRoutes.length > 1) { updateHighlightedStops(); }
        await refreshBusLocations(routeCode);
        const notifClass = color === 'cyan' ? 'notif-cyan' : 'notif-green';
        showPlotNotification(`${lineID}: ${routeDescr} Plotted!`, notifClass);
        let startTime = null;
        const animationDuration = 1500;
        const lineSource = map.getSource(sourceId);
        function animateStep(timestamp) {
          if (!startTime) startTime = timestamp;
          const elapsed = timestamp - startTime;
          const progress = Math.min(elapsed / animationDuration, 1);
          const currentPoints = routePoints.slice(0, Math.floor(routePoints.length * progress));
          lineSource.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: currentPoints } });
          if (plottedRoutes.length === 1) {
            const targetStopIndex = Math.floor(data.stops.length * progress);
            renderHighlightedStopsSubset(data.stops.slice(0, targetStopIndex), color);
          }
          if (progress < 1) {
            routeData.animationId = requestAnimationFrame(animateStep);
          } else {
            updateHighlightedStops();
            updatePlottedStopLabels();
          }
        }
        routeData.animationId = requestAnimationFrame(animateStep);
    };

    const bounds = new maplibregl.LngLatBounds();
    plottedRoutes.forEach(r => {
        if (r.points) r.points.forEach(p => bounds.extend(p));
    });

    if (toggleZoomOnRoute && toggleZoomOnRoute.checked && !bounds.isEmpty()) {
        let fitOptions = { padding: 50, duration: 1500 };
        if (window.innerWidth <= 768) {
            const bottomPadding = window.innerHeight * 0.45;
            fitOptions = { padding: { top: 50, left: 50, right: 50, bottom: bottomPadding }, duration: 1500 };
        }
        map.fitBounds(bounds, fitOptions);
        map.once('moveend', startRouteVisuals);
    } else {
        startRouteVisuals();
    }

  } catch (error) {
    console.error("Failed to fetch or plot route details:", error);
  }
}

function animateRouteDeletion(route) {
  let startTime = null;
  const duration = 1000;
  const totalPoints = route.points.length;
  const totalStops = route.stops.length;
  const lineSource = map.getSource(route.sourceId);
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const keptPoints = Math.floor(totalPoints * (1 - progress));
    if (lineSource) lineSource.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: route.points.slice(0, keptPoints) } });
    if (plottedRoutes.length === 0) {
      const keptStops = Math.floor(totalStops * (1 - progress));
      renderHighlightedStopsSubset(route.stops.slice(0, keptStops), route.color);
    }
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }
  requestAnimationFrame(step);
}

function clearRoutes(routesToDelete) {
  if (isClearing || routesToDelete.length === 0) return;
  isClearing = true;
  if (plottedRoutes.length === routesToDelete.length) {
    clearRouteButton.classList.add("clearing");
  }
  if (timerOptionsPopup && timerOptionsPopup.classList.contains('visible')) {
      timerOptionsPopup.classList.remove('visible');
  }

  routesToDelete.forEach((route) => {
    // stop the data logic
    stopBusLocationTimer(route.routeCode);

    // animate and remove the visual timer
    const timerEl = document.getElementById(`route-timer-${route.routeCode}`);
    if (timerEl) {
        timerEl.classList.add('fade-out'); // triggers opacity/scale/height animation
        setTimeout(() => {
            if(timerEl.parentNode) timerEl.parentNode.removeChild(timerEl);
        }, 350); // wait for css transition
    }
  });

  const remainingRoutes = plottedRoutes.filter(r => !routesToDelete.includes(r));
  plottedRoutes = remainingRoutes;
  updateArrivalsUIState();
  routesToDelete.forEach((route) => {
    animateRouteDeletion(route);
    route.busMarkers.forEach((busInfo) => busInfo.marker.getElement().classList.add("layer-fade-out"));
  });
  if (remainingRoutes.length === 0) {
    setDimState(false);
    clearRouteButton.style.display = "none";
  }
  setTimeout(() => {
    routesToDelete.forEach((route) => {
      if (route.animationId) cancelAnimationFrame(route.animationId);
      route.busMarkers.forEach((busInfo) => { if (busInfo.popup) busInfo.popup.remove(); busInfo.marker.remove(); });
      if (map.getLayer(route.arrowLayerId)) map.removeLayer(route.arrowLayerId);
      if (map.getLayer(route.lineLayerId)) map.removeLayer(route.lineLayerId);
      if (map.getSource(route.sourceId)) map.removeSource(route.sourceId);
    });
    updateHighlightedStops();
    updatePlottedStopLabels();
    if (remainingRoutes.length > 0) {
      clearRouteButton.classList.remove("clearing");
    }
    isClearing = false;
    updateAllLayers();
  }, 1000);
}

function startBusLocationTimer(routeCode, color) {
  stopBusLocationTimer(routeCode);
  const busRefreshDuration = 7;
  let timeLeft = busRefreshDuration;
  let isRefreshing = false;
  const intervalId = setInterval(async () => {
    if (isRefreshing) return;
    timeLeft -= 1;
    if (timeLeft < 0) {
      isRefreshing = true;
      try {
        await refreshBusLocations(routeCode);
      } catch (error) {
        console.error(`Error refreshing bus locations for route ${routeCode}:`, error);
      } finally {
        timeLeft = busRefreshDuration;
        isRefreshing = false;
      }
    }

    const displayTime = Math.max(0, timeLeft);
    const progress = displayTime / busRefreshDuration;
    const offset = circumference * (1 - progress);

    const panelTimers = document.querySelectorAll(`.arrival-row[data-route-code="${routeCode}"] .btime-timer-wrapper`);
    panelTimers.forEach((wrapper) => {
        wrapper.classList.add("visible");
        const textElement = wrapper.querySelector(".btime-timer-text");
        if (textElement) textElement.textContent = Math.round(displayTime);
        const progressCircle = wrapper.querySelector(".btime-timer-progress");
        if (progressCircle) {
          const strokeColor = colorHex[color] || '#333';
          if (!progressCircle.style.stroke) {
              progressCircle.style.stroke = strokeColor;
              progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
          }
          progressCircle.style.strokeDashoffset = offset;
        }
    });

    // update the floating route timer
    const floatingTimer = document.getElementById(`route-timer-${routeCode}`);
    if (floatingTimer) {
        const progressCircle = floatingTimer.querySelector(".route-timer-progress");
        if (progressCircle) {
            progressCircle.style.strokeDashoffset = offset;
        }
    }

  }, 1000);
  busRefreshTimers.set(routeCode, intervalId);
}

function stopBusLocationTimer(routeCode) {
  if (busRefreshTimers.has(routeCode)) {
    clearInterval(busRefreshTimers.get(routeCode));
    busRefreshTimers.delete(routeCode);
  }
}

function animateBusMarker(marker, from, to, busInfo) {
  const duration = 6500;
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

async function refreshBusLocations(routeCode) {
    const plottedRoute = plottedRoutes.find((r) => r.routeCode === routeCode);
    if (!plottedRoute) return;
    const uniqueUrl = `https://telematics.oasa.gr/api/?act=getBusLocation&p1=${routeCode}&t=${Date.now()}`;
    const busUrl = `${PROXY_URL}${encodeURIComponent(uniqueUrl)}`;
    try {
        const response = await fetch(busUrl);
        const busData = await response.json();
        const receivedBusNumbers = new Set();
        const currentBusMarkers = plottedRoute.busMarkers;
        if (Array.isArray(busData) && currentBusMarkers) {
            busData.forEach((bus) => {
                const vehNo = bus.VEH_NO;
                receivedBusNumbers.add(vehNo);
                const newLatLng = { lat: parseFloat(bus.CS_LAT), lng: parseFloat(bus.CS_LNG) };
                let timeText = "N/A";
                if (bus.CS_DATE) {
                    const match = bus.CS_DATE.match(/(\d{1,2}):(\d{2}):(\d{2}).*?(AM|PM)/);
                    if (match) {
                        let hour = parseInt(match[1], 10);
                        const minute = match[2];
                        const second = match[3];
                        const ampm = match[4];
                        if (ampm === "PM" && hour < 12) hour += 12;
                        if (ampm === "AM" && hour === 12) hour = 0;
                        const hourStr = hour.toString().padStart(2, '0');
                        timeText = `${hourStr}:${minute}:${second}`;
                    } else {
                        timeText = bus.CS_DATE;
                    }
                }
                const popupContent = `Last updated:<br>${timeText}`;
                if (currentBusMarkers.has(vehNo)) {
                    const busInfo = currentBusMarkers.get(vehNo);
                    const ll = busInfo.marker.getLngLat();
                    const oldLatLng = { lat: ll.lat, lng: ll.lng };
                    busInfo.popup.setHTML(popupContent);
                    if (oldLatLng.lat !== newLatLng.lat || oldLatLng.lng !== newLatLng.lng) {
                        if (busInfo.animationId) cancelAnimationFrame(busInfo.animationId);
                        animateBusMarker(busInfo.marker, oldLatLng, newLatLng, busInfo);
                    }
                } else {
                    const el = createBusTextIcon(plottedRoute.lineID || "", vehNo, plottedRoute.color);
                    const popup = new maplibregl.Popup({ className: 'bus-popup', offset: 20, closeButton: false });
                    popup.setHTML(popupContent);
                    const newMarker = new maplibregl.Marker({ element: el }).setLngLat([newLatLng.lng, newLatLng.lat]).setPopup(popup);
                    const busInfo = { marker: newMarker, popup, animationId: null };
                    el.style.opacity = 0;
                    newMarker.addTo(map);
                    setTimeout(() => { el.style.opacity = 1; }, 100);
                    plottedRoute.busMarkers.set(vehNo, busInfo);
                }
            });
        }
        if (currentBusMarkers) {
            currentBusMarkers.forEach((busInfo, vehNo) => {
                if (!receivedBusNumbers.has(vehNo)) {
                    if (busInfo.animationId) cancelAnimationFrame(busInfo.animationId);
                    if (busInfo.popup) busInfo.popup.remove();
                    busInfo.marker.remove();
                    currentBusMarkers.delete(vehNo);
                }
            });
        }
    } catch (error) {
        console.error("Failed to refresh bus locations:", error);
    }
}

// panel logic
async function showStopInfo(stopProperties) {
  // callers already set currentStopProperties to this stop before calling
  // in - refreshing now both restores whichever previously-selected stop's
  // own highlighted dot (it's no longer the one currentStopProperties
  // points at) and suppresses this new one's, if either is part of a
  // plotted route (see the currentStopProperties check inside
  // updateHighlightedStops)
  if (plottedRoutes.length > 0) updateHighlightedStops();
  clearDemotedPanels();
  stopSuburbanTimer();
  stopFerryCountdownTicker();
  if (typeof stopCityLiveTimer === 'function') stopCityLiveTimer();
  if (typeof clearCitySelectedStopMarker === 'function') clearCitySelectedStopMarker();
  metroStationPanel.classList.remove("visible");
  suburbanStationPanel.classList.remove("visible");
  tramStationPanel.classList.remove("visible");
  ferryStationPanel.classList.remove("visible");
  cityStopPanel.classList.remove("visible");
  schedulePanel.classList.remove("visible");
  stopTimer();
  switchToTab("arrivals");
  stopInfoTitle.innerHTML = '';
  const titleText = document.createElement('span');
  titleText.className = 'stop-info-title-text';
  titleText.textContent = stopProperties.stop_descr;
  stopInfoTitle.appendChild(titleText);
  if (stopProperties.ramp && stopProperties.ramp.toUpperCase() === 'NAI') {
    const iconWrapper = document.createElement('span');
    iconWrapper.className = 'access-icon-wrapper tooltip-trigger';
    iconWrapper.title = 'Accessible Stop';
    iconWrapper.innerHTML = accessibilityIconSvg;
    iconWrapper.addEventListener('click', (e) => {
      e.stopPropagation();
      const iconRect = e.currentTarget.getBoundingClientRect();
      delayTooltip.textContent = "This Stop has a Road Platform";
      delayTooltip.style.opacity = '1';
      delayTooltip.style.pointerEvents = 'auto';
      const tooltipRect = delayTooltip.getBoundingClientRect();
      const finalLeft = iconRect.left + (iconRect.width / 2) - (tooltipRect.width / 2);
      delayTooltip.style.left = `${finalLeft}px`;
      delayTooltip.style.top = `${iconRect.top - tooltipRect.height - 10}px`;
    });
    stopInfoTitle.appendChild(iconWrapper);
  }
  if (stopProperties.stop_type_code === 'ΕΞΥΠΝΗ ΣΤΑΣΗ') {
    const iconWrapper = document.createElement('span');
    iconWrapper.className = 'access-icon-wrapper tooltip-trigger';
    iconWrapper.title = 'Smart Stop';
    iconWrapper.innerHTML = smartStopIconSvg;
    iconWrapper.addEventListener('click', (e) => {
      e.stopPropagation();
      const iconRect = e.currentTarget.getBoundingClientRect();
      delayTooltip.textContent = "This Stop has an Arrivals Screen";
      delayTooltip.style.opacity = '1';
      delayTooltip.style.pointerEvents = 'auto';
      const tooltipRect = delayTooltip.getBoundingClientRect();
      const finalLeft = iconRect.left + (iconRect.width / 2) - (tooltipRect.width / 2);
      delayTooltip.style.left = `${finalLeft}px`;
      delayTooltip.style.top = `${iconRect.top - tooltipRect.height - 10}px`;
    });
    stopInfoTitle.appendChild(iconWrapper);
  }

  stopInfoPanel.classList.add("visible");
  currentStopRouteData = null;

  if (selectedHeadingMarker) {
      selectedHeadingMarker.remove();
      selectedHeadingMarker = null;
  }
  if (stopProperties.heading !== undefined && stopProperties.heading !== null) {
      if (selectedStopMarker) {
          const latlng = selectedStopMarker.getLngLat();
          const bigArrowIcon = createHeadingIcon(stopProperties.heading, 65);
          if (bigArrowIcon) {
              selectedHeadingMarker = new maplibregl.Marker({ element: bigArrowIcon }).setLngLat(latlng).addTo(map);
          }
      }
  }

  if (!dataFeaturesEnabled.buses) {
    showFinalError(linesContent, dataOffMessage('Bus data'));
    showNoArrivalsUI(arrivalsContent, dataOffMessage('Bus data'));
    markDataNeeded('buses');
    return;
  }

  const stopCode = stopProperties.StopCode;
  const routesUrl = `${PROXY_URL}${encodeURIComponent(`https://telematics.oasa.gr/api/?act=webRoutesForStop&p1=${stopCode}&t=${Date.now()}`)}`;
  const arrivalsUrl = `${PROXY_URL}${encodeURIComponent(`https://telematics.oasa.gr/api/?act=getStopArrivals&p1=${stopCode}&t=${Date.now()}`)}`;
  showLoadingUI(linesContent, "Loading Lines...");
  try {
    const response = await fetch(routesUrl);
    if (!response.ok) throw new Error("Network response for routes failed");
    const routeData = await response.json();
    currentStopRouteData = routeData;
    linesContent.innerHTML = "";
    if (Array.isArray(routeData) && routeData.length > 0) {
      const uniqueLines = new Map();
      routeData.forEach((route) => {
        if (!uniqueLines.has(route.LineCode)) {
          uniqueLines.set(route.LineCode, route);
        }
      });
      uniqueLines.forEach((route) => {
        const lineRow = document.createElement("div");
        lineRow.className = "line-row";
        lineRow.innerHTML = `<div class="line-id-pill">${route.LineID}</div><div class="line-descr">${route.LineDescrEng}</div>`;
        lineRow.onclick = () => showSchedulePanel(route);
        linesContent.appendChild(lineRow);
      });
    } else {
      showFinalError(linesContent, "No lines found.");
    }
    await fetchAndDisplayArrivals(arrivalsUrl);
  } catch (error) {
    console.error("Initial stop info fetch failed:", error);
    showFinalError(linesContent, "Could not fetch line data.");
    showNoArrivalsUI(arrivalsContent, "Could not get live arrivals.");
  }
}

async function fetchAndDisplayArrivals(arrivalsUrl) {
  if (!dataFeaturesEnabled.buses) {
    showNoArrivalsUI(arrivalsContent, dataOffMessage('Bus data'));
    markDataNeeded('buses');
    return;
  }
  if (!arrivalsContent.querySelector('.loader-container')) {
    showLoadingUI(arrivalsContent, "Getting Live Arrivals...", true);
  }
  try {
    if (!currentStopRouteData) throw new Error("Route data not available.");
    routeInfoMap.clear();
    currentStopRouteData.forEach((route) => routeInfoMap.set(route.RouteCode, route));
    const arrivalsResponse = await fetch(arrivalsUrl);
    const arrivalsLoaderBar = arrivalsContent.querySelector(".loader-bar-fill");
    if (arrivalsLoaderBar) arrivalsLoaderBar.style.width = "70%";
    if (!arrivalsResponse.ok) throw new Error("Arrivals fetch failed");
    const arrivalsData = await arrivalsResponse.json();
    if (arrivalsLoaderBar) arrivalsLoaderBar.style.width = "100%";
    const loaderContainer = arrivalsContent.querySelector(".loader-container");
    if (loaderContainer) loaderContainer.classList.add("fading-out");
    await new Promise((resolve) => setTimeout(resolve, 400));
    arrivalsContent.innerHTML = "";
    if (Array.isArray(arrivalsData) && arrivalsData.length > 0) {
      arrivalsData.forEach((arrival) => {
        const routeInfo = routeInfoMap.get(arrival.route_code);
        if (routeInfo) {
          const row = document.createElement("div");
          row.className = "arrival-row";
          row.dataset.routeCode = arrival.route_code;
          row.dataset.lineId = routeInfo.LineID;
          row.dataset.routeDescr = routeInfo.RouteDescrEng;
          row.innerHTML = `<div class="arrival-lineid"><span class="lineid-text">${routeInfo.LineID}</span><span class="veh-code-text">${arrival.veh_code}</span></div><div class="arrival-descr">${routeInfo.RouteDescrEng}</div><div class="arrival-right-content"><div class="arrival-time"><span class="arrival-time-min">${arrival.btime2}'</span><span class="arrival-eta">${formatEtaClock(arrival.btime2)}</span></div><div class="arrival-time-container"><button class="plot-route-icon-btn">${plotRouteIconSvg}</button><div class="btime-timer-wrapper"><svg class="timer-svg btime-timer-svg" viewBox="0 0 36 36"><path class="timer-track" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path><path class="timer-progress btime-timer-progress" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path></svg><div class="timer-text btime-timer-text"></div></div></div></div>`;
          const plotBtn = row.querySelector('.plot-route-icon-btn');
          if (plotBtn) {
            plotBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              const parentRow = e.currentTarget.closest('.arrival-row');
              const routeCode = parentRow.dataset.routeCode;
              const lineId = parentRow.dataset.lineId;
              const routeDescr = parentRow.dataset.routeDescr;
              const routeName = `${lineId} ${routeDescr}`;
              const existingRoute = plottedRoutes.find(r => r.routeCode === routeCode);
              if (existingRoute) {
                const textColor = existingRoute.color === 'cyan' ? '#2c5aa0' : '#28a745';
                const html = `You already have <span class="notif-highlight-pill" style="color:${textColor}">${routeName}</span> on the map`;
                showPlotNotification(html, 'notif-gray');
                return;
              }
              if (plottedRoutes.length >= 2) {
                showPlotNotification("Cannot have more than 2 routes on the map", 'notif-gray');
                return;
              }
              plotAnimatedRoute(routeCode, lineId, routeDescr);
            });
          }
          arrivalsContent.appendChild(row);
        }
      });
      startTimer();
    } else {
      showNoArrivalsUI(arrivalsContent, "No live arrivals at the moment.");
      startTimer();
    }
  } catch (error) {
    console.error("Arrivals fetch failed:", error);
    showNoArrivalsUI(arrivalsContent, "Could not get live arrivals.");
  } finally {
    updateArrivalsUIState();
    plottedRoutes.forEach((route) => {
      startBusLocationTimer(route.routeCode, route.color);
    });
  }
}

function startTimer() {
  stopTimer();
  autoRefreshContainer.classList.add("visible");
  let timeLeft = autoRefreshDuration;
  function updateTimer() {
    const progress = timeLeft / autoRefreshDuration;
    const offset = circumference * (1 - progress);
    timerProgress.style.strokeDashoffset = offset;
    timerText.textContent = timeLeft;
  }
  autoRefreshIntervalId = setInterval(() => {
    updateTimer();
    if (timeLeft <= 0) {
      stopTimer();
      if (currentStopProperties) stopInfoRefresh.dispatchEvent(new Event("click"));
      return;
    }
    timeLeft--;
  }, 1000);
  updateTimer();
}

function stopTimer() {
  autoRefreshContainer.classList.remove("visible");
  if (autoRefreshIntervalId) {
    clearInterval(autoRefreshIntervalId);
    autoRefreshIntervalId = null;
  }
}

stopInfoClose.addEventListener("click", () => {
  stopInfoPanel.classList.remove("visible");
  currentStopProperties = null;
  stopTimer();
  clearDataNeeded('buses');
  if (selectedStopMarker) {
    selectedStopMarker.remove();
    selectedStopMarker = null;
  }
  if (selectedHeadingMarker) {
    selectedHeadingMarker.remove();
    selectedHeadingMarker = null;
  }
  // closing the panel means this stop no longer has its own selectedStopMarker
  // to stand in for it - if it's still part of a plotted route, it needs its
  // own highlighted dot back (updateHighlightedStops skips that while the
  // stop's info panel is the one showing it, see currentStopProperties check there)
  if (plottedRoutes.length > 0) updateHighlightedStops();
});

stopInfoRefresh.addEventListener("click", () => {
  if (currentStopProperties) {
    stopTimer();
    plottedRoutes.forEach((route) => {
      refreshBusLocations(route.routeCode);
    });
    const stopCode = currentStopProperties.StopCode;
    const arrivalsUrl = `${PROXY_URL}${encodeURIComponent(`https://telematics.oasa.gr/api/?act=getStopArrivals&p1=${stopCode}&t=${Date.now()}`)}`;
    fetchAndDisplayArrivals(arrivalsUrl);
  }
});

clearRouteButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (plottedRoutes.length === 0 || isClearing) return;

    // toggle logic
    if (deletePopup.classList.contains('visible')) {
        deletePopup.classList.remove('visible');
        return;
    }

    manageOpenPanels('delete');

    // position the popup
    const btnRect = clearRouteButton.getBoundingClientRect();
    deletePopup.style.top = `${btnRect.top}px`;
    deletePopup.style.left = `${btnRect.right + 10}px`;

    // reset elements
    deleteCyanBtn.style.display = 'none';
    deleteGreenBtn.style.display = 'none';
    deleteAllBtn.style.display = 'none';

    // setup cyan route row
    const cyanRoute = plottedRoutes.find(r => r.color === 'cyan');
    if (cyanRoute) {
        deleteCyanBtn.style.display = 'flex';
        // update text
        deleteCyanBtn.querySelector('.delete-route-id').textContent = cyanRoute.lineID;
        deleteCyanBtn.querySelector('.delete-route-descr').textContent = cyanRoute.routeDescr;

        // handle delete click on the button on the right
        const actionBtn = deleteCyanBtn.querySelector('.route-delete-action');
        // remove old listeners by cloning
        const newBtn = actionBtn.cloneNode(true);
        actionBtn.parentNode.replaceChild(newBtn, actionBtn);

        newBtn.onclick = (ev) => {
            ev.stopPropagation();
            clearRoutes([cyanRoute]);
            deletePopup.classList.remove('visible');
        };
    }

    // setup green route row
    const greenRoute = plottedRoutes.find(r => r.color === 'green');
    if (greenRoute) {
        deleteGreenBtn.style.display = 'flex';
        // update text
        deleteGreenBtn.querySelector('.delete-route-id').textContent = greenRoute.lineID;
        deleteGreenBtn.querySelector('.delete-route-descr').textContent = greenRoute.routeDescr;

        // handle delete click
        const actionBtn = deleteGreenBtn.querySelector('.route-delete-action');
        // remove old listeners by cloning
        const newBtn = actionBtn.cloneNode(true);
        actionBtn.parentNode.replaceChild(newBtn, actionBtn);

        newBtn.onclick = (ev) => {
            ev.stopPropagation();
            clearRoutes([greenRoute]);
            deletePopup.classList.remove('visible');
        };
    }

    // setup delete both
    if (plottedRoutes.length > 1) {
        deleteAllBtn.style.display = 'block';
    }

    deletePopup.classList.add('visible');
});

deleteCyanBtn.addEventListener('click', () => {
  const cyanRoute = plottedRoutes.find(r => r.color === 'cyan');
  if (cyanRoute) clearRoutes([cyanRoute]);
  deletePopup.classList.remove('visible');
});

deleteGreenBtn.addEventListener('click', () => {
  const greenRoute = plottedRoutes.find(r => r.color === 'green');
  if (greenRoute) clearRoutes([greenRoute]);
  deletePopup.classList.remove('visible');
});

deleteAllBtn.addEventListener('click', () => {
  clearRoutes([...plottedRoutes]);
  deletePopup.classList.remove('visible');
});

function switchToTab(tabName) {
  if (tabName === "arrivals") {
    tabArrivals.classList.add("active");
    arrivalsContent.classList.add("active");
    tabLines.classList.remove("active");
    linesContent.classList.remove("active");
  } else {
    tabLines.classList.add("active");
    linesContent.classList.add("active");
    tabArrivals.classList.remove("active");
    arrivalsContent.classList.remove("active");
  }
}

tabArrivals.addEventListener("click", () => switchToTab("arrivals"));
tabLines.addEventListener("click", () => switchToTab("lines"));
