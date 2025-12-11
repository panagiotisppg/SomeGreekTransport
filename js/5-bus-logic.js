// icons and styles
const createBusTextIcon = (lineID, vehNo, color) => {
  const html = `<div class="bus-icon-body" style="background-color: ${colorHex[color]}"><span class="bus-icon-lineid">${lineID}</span><span class="bus-icon-vehno">${vehNo}</span><div class="bus-icon-tire tire-left"></div><div class="bus-icon-tire tire-right"></div></div>`;
  return L.divIcon({ className: "bus-text-icon", html: html, iconSize: [40, 36], iconAnchor: [20, 18], });
};

const createSharedStopIcon = () => {
  const iconHtml = `<svg width="14" height="14" viewBox="0 0 14 14" style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5));"><path d="M7 0 A7 7 0 0 1 7 14" fill="${colorHex.cyan}" /><path d="M7 0 A7 7 0 0 0 7 14" fill="${colorHex.green}" /><circle cx="7" cy="7" r="6.5" fill="transparent" stroke="white" stroke-width="1"/></svg>`;
  return L.divIcon({ className: "shared-stop-icon", html: iconHtml, iconSize: [14, 14], iconAnchor: [7, 7], });
};

const getSelectedStopStyle = () => {
  const fillColor = plottedRoutes.length === 1 ? colorHex.green : colorHex.cyan;
  return { radius: 11, fillColor: fillColor, color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 1, };
};

// NEW: Helper to create the visual timer element
const createRouteTimerUI = (routeCode, lineID, color) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'active-route-timer';
    wrapper.id = `route-timer-${routeCode}`;
    
    // Ensure we use the correct hex color
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
    return wrapper;
};

function updateHighlightedStops() {
  plottedStopsLayer.clearLayers();
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
    const latlng = [parseFloat(stopData.StopLat), parseFloat(stopData.StopLng)];
    let marker;
    const stopCode = stopData.StopCode;
    plottedStopCodes.add(stopCode); 
    if (colors.size > 1) {
      marker = L.marker(latlng, { icon: createSharedStopIcon(), pane: "highlightedStopsPane", interactive: false, });
    } else {
      const color = colors.values().next().value;
      marker = L.circleMarker(latlng, highlightedStopStyles[color]);
    }
    marker.bindTooltip(stopData.StopDescr, { permanent: false, direction: 'bottom', offset: [0, 8], className: 'stop-label' });
    plottedStopsLayer.addLayer(marker);

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
             const arrowIcon = createHeadingIcon(h);
             if (arrowIcon) {
                 const arrowMarker = L.marker(latlng, { icon: arrowIcon, pane: 'plottedArrowPane', interactive: false });
                 arrowMarker.isPlottedArrow = true;
                 plottedStopsLayer.addLayer(arrowMarker);
             }
        }
    }
  });
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

// route plotting
async function plotAnimatedRoute(routeCode, lineID, routeDescr) {
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
    const routesPane = map.hasLayer(routesLayer) ? routesLayer.getPane() : null;
    if (routesPane) { routesPane.style.transition = "opacity 1s linear"; routesPane.style.opacity = 0; }
    const stopsPane = (map.hasLayer(stopsLayerInteractive) ? stopsLayerInteractive.getPane() : null) || (map.hasLayer(stopsLayerNotInteractive) ? stopsLayerNotInteractive.getPane() : null);
    if (stopsPane) { stopsPane.style.transition = "opacity 1s linear"; stopsPane.style.opacity = 0.3; }
    ['metroPane', 'suburbanPane', 'metroStationPane', 'suburbanStationPane', 'headingPane'].forEach(paneName => {
      const pane = map.getPane(paneName);
      if (pane) {
        pane.style.transition = 'opacity 1s linear';
        pane.style.opacity = 0.3; 
        if (paneName.includes('Station')) { pane.style.pointerEvents = 'none'; }
      }
    });
  }
  const lineStyle = routeStyles[color];
  
  // Start the timer immediately so logic works, 
  // we will add the visual element in the rendering phase below
  startBusLocationTimer(routeCode, color);

  const detailsUrl = `https://corsproxy.io/?${encodeURIComponent(`http://telematics.oasa.gr/api/?act=webGetRoutesDetailsAndStops&p1=${routeCode}`)}`;
  try {
    const response = await fetch(detailsUrl);
    const data = await response.json();
    if (!data.details || !data.stops || data.details.length === 0) throw new Error("Invalid route data");
    const routePoints = data.details.map((p) => L.latLng(p.routed_y, p.routed_x));
    const routeStopsGeoJSON = { type: "FeatureCollection", features: data.stops.map((s) => ({ type: "Feature", properties: s, geometry: { type: "Point", coordinates: [parseFloat(s.StopLng), parseFloat(s.StopLat)] }, })), };
    
    const layerGroup = new L.FeatureGroup(); 
    
    const polyline = L.polyline([], { ...lineStyle, pane: "animatedRoutePane" }).addTo(layerGroup);
    const arrowColor = color === "cyan" ? colorHex.darkCyan : colorHex.darkGreen;
    const decorator = L.polylineDecorator(polyline, { patterns: [{ offset: 25, repeat: 200, symbol: L.Symbol.arrowHead({ pixelSize: 12, pathOptions: { fillOpacity: 0.9, color: arrowColor, weight: 1, pane: "arrowPane" } }), }], }).addTo(layerGroup);
    const routeData = { routeCode, color, layerGroup, animationId: null, stops: data.stops, busMarkers: new Map(), points: routePoints, polyline: polyline, decorator: decorator, lineID: lineID, routeDescr: routeDescr || '', routeStopsGeoJSON: routeStopsGeoJSON };
    plottedRoutes.push(routeData);
    
    const startRouteVisuals = async () => {
        layerGroup.addTo(map);
        clearRouteButton.style.display = "flex";
        
        // --- ADD THE FLOATING TIMER TO UI ---
        const timerUI = createRouteTimerUI(routeCode, lineID, color);
        if (activeTimersContainer) {
            activeTimersContainer.appendChild(timerUI);
        }
        // ------------------------------------

        updateArrivalsUIState();
        if (plottedRoutes.length > 1) { updateHighlightedStops(); }
        await refreshBusLocations(routeCode);
        const notifClass = color === 'cyan' ? 'notif-cyan' : 'notif-green';
        showPlotNotification(`${lineID}: ${routeDescr} Plotted!`, notifClass);
        let startTime = null;
        const animationDuration = 1500;
        function animateStep(timestamp) {
          if (!startTime) startTime = timestamp;
          const elapsed = timestamp - startTime;
          const progress = Math.min(elapsed / animationDuration, 1);
          const currentPoints = routePoints.slice(0, Math.floor(routePoints.length * progress));
          polyline.setLatLngs(currentPoints);
          decorator.setPaths(currentPoints);
          if (plottedRoutes.length === 1) {
            const targetStopIndex = Math.floor(data.stops.length * progress);
            const stopsToShow = data.stops.slice(0, targetStopIndex);
            plottedStopsLayer.clearLayers();
            stopsToShow.forEach(stopData => {
              const latlng = [parseFloat(stopData.StopLat), parseFloat(stopData.StopLng)];
              const marker = L.circleMarker(latlng, highlightedStopStyles[color]);
              marker.bindTooltip(stopData.StopDescr, { permanent: false, direction: 'bottom', offset: [0, 8], className: 'stop-label' });
              plottedStopsLayer.addLayer(marker);
              plottedStopCodes.add(stopData.StopCode);
            });
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

    const bounds = L.latLngBounds();
    plottedRoutes.forEach(r => {
        if(r.points) bounds.extend(r.points);
    });

    if(toggleZoomOnRoute && toggleZoomOnRoute.checked && bounds.isValid()) {
        let paddingOptions = { padding: [50, 50], duration: 1.5 };
        if (window.innerWidth <= 768) {
            const bottomPadding = window.innerHeight * 0.45;
            paddingOptions = { 
                paddingTopLeft: [50, 50], 
                paddingBottomRight: [50, bottomPadding], 
                duration: 1.5 
            };
        }
        map.flyToBounds(bounds, paddingOptions);
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
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const keptPoints = Math.floor(totalPoints * (1 - progress));
    route.polyline.setLatLngs(route.points.slice(0, keptPoints));
    if (plottedRoutes.length === 0) {
      const keptStops = Math.floor(totalStops * (1 - progress));
      const stopsToKeep = route.routeStopsGeoJSON.features.slice(0, keptStops);
      plottedStopsLayer.clearLayers();
      plottedStopCodes.clear();
      stopsToKeep.forEach(feature => {
        const stopData = feature.properties;
        const latlng = [parseFloat(stopData.StopLat), parseFloat(stopData.StopLng)];
        const marker = L.circleMarker(latlng, highlightedStopStyles[route.color]);
        marker.bindTooltip(stopData.StopDescr, { permanent: false, direction: 'bottom', offset: [0, 8], className: 'stop-label' });
        plottedStopsLayer.addLayer(marker);
        plottedStopCodes.add(stopData.StopCode);
      });
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
  
  routesToDelete.forEach((route) => {
    // 1. Stop the data logic
    stopBusLocationTimer(route.routeCode);
    
    // 2. Animate and remove the visual timer
    const timerEl = document.getElementById(`route-timer-${route.routeCode}`);
    if (timerEl) {
        timerEl.classList.add('fade-out'); // Triggers opacity/scale/height animation
        setTimeout(() => {
            if(timerEl.parentNode) timerEl.parentNode.removeChild(timerEl);
        }, 350); // wait for CSS transition
    }
  });

  const remainingRoutes = plottedRoutes.filter(r => !routesToDelete.includes(r));
  plottedRoutes = remainingRoutes;
  updateArrivalsUIState();
  routesToDelete.forEach((route) => {
    animateRouteDeletion(route);
    route.busMarkers.forEach((bus) =>
      L.DomUtil.addClass(bus.marker._icon, "layer-fade-out")
    );
  });
  if (remainingRoutes.length === 0) {
    const panesToRestore = [
      map.getPane('metroPane'), map.getPane('suburbanPane'),
      map.getPane('metroStationPane'), map.getPane('suburbanStationPane'),
      map.getPane('headingPane')
    ].filter(p => p);
    if (routesLayer && map.hasLayer(routesLayer)) panesToRestore.push(routesLayer.getPane());
    if (stopsLayerInteractive && map.hasLayer(stopsLayerInteractive)) panesToRestore.push(stopsLayerInteractive.getPane());
    if (stopsLayerNotInteractive && map.hasLayer(stopsLayerNotInteractive)) panesToRestore.push(stopsLayerNotInteractive.getPane());
    panesToRestore.forEach(pane => {
      if (pane && pane.style) {
        pane.style.transition = 'opacity 1s linear';
        pane.style.opacity = 1;
      }
    });
    clearRouteButton.style.display = "none";
  }
  setTimeout(() => {
    routesToDelete.forEach((route) => {
      if (route.animationId) cancelAnimationFrame(route.animationId);
      if (route.decorator) route.decorator.remove();
      route.busMarkers.forEach((busInfo) => busInfo.marker.remove());
      if (route.layerGroup) route.layerGroup.remove();
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
    
    // --- UPDATE UI LOGIC ---
    const displayTime = Math.max(0, timeLeft);
    const progress = displayTime / busRefreshDuration;
    const offset = circumference * (1 - progress);

    // 1. Update In-Panel Timers (Original logic)
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

    // 2. Update Floating Route Timer (New logic)
    const floatingTimer = document.getElementById(`route-timer-${routeCode}`);
    if (floatingTimer) {
        const progressCircle = floatingTimer.querySelector(".route-timer-progress");
        if (progressCircle) {
            progressCircle.style.strokeDashoffset = offset;
        }
    }
    // -----------------------

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
      marker.setLatLng(to);
      busInfo.animationId = null;
      return;
    }
    const lat = from.lat + (to.lat - from.lat) * progress;
    const lng = from.lng + (to.lng - from.lng) * progress;
    marker.setLatLng([lat, lng]);
    busInfo.animationId = requestAnimationFrame(step);
  }
  busInfo.animationId = requestAnimationFrame(step);
}

async function refreshBusLocations(routeCode) {
    const plottedRoute = plottedRoutes.find((r) => r.routeCode === routeCode);
    if (!plottedRoute) return;
    const uniqueUrl = `http://telematics.oasa.gr/api/?act=getBusLocation&p1=${routeCode}&t=${Date.now()}`;
    const busUrl = `https://corsproxy.io/?${encodeURIComponent(uniqueUrl)}`;
    try {
        const response = await fetch(busUrl);
        const busData = await response.json();
        const receivedBusNumbers = new Set();
        const currentBusMarkers = plottedRoute.busMarkers;
        if (Array.isArray(busData) && currentBusMarkers) {
            busData.forEach((bus) => {
                const vehNo = bus.VEH_NO;
                receivedBusNumbers.add(vehNo);
                const newLatLng = L.latLng(bus.CS_LAT, bus.CS_LNG);
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
                    const oldLatLng = busInfo.marker.getLatLng();
                    busInfo.marker.setPopupContent(popupContent); 
                    if (!oldLatLng.equals(newLatLng)) {
                        if (busInfo.animationId) cancelAnimationFrame(busInfo.animationId);
                        animateBusMarker(busInfo.marker, oldLatLng, newLatLng, busInfo);
                    }
                } else {
                    const busIcon = createBusTextIcon(plottedRoute.lineID || "", vehNo, plottedRoute.color);
                    const newMarker = L.marker(newLatLng, { icon: busIcon, pane: "busPane", });
                    newMarker.bindPopup(popupContent, { className: 'bus-popup', offset: [0, -20], closeButton: false, autoPan: false });
                    const busInfo = { marker: newMarker, animationId: null };
                    newMarker.on("add", function() {
                        this._icon.style.opacity = 0;
                        setTimeout(() => { if (this._icon) { this._icon.style.opacity = 1; } }, 100);
                    });
                    plottedRoute.layerGroup.addLayer(newMarker);
                    currentBusMarkers.set(vehNo, busInfo);
                }
            });
        }
        if (currentBusMarkers) {
            currentBusMarkers.forEach((busInfo, vehNo) => {
                if (!receivedBusNumbers.has(vehNo)) {
                    if (busInfo.animationId) cancelAnimationFrame(busInfo.animationId);
                    plottedRoute.layerGroup.removeLayer(busInfo.marker);
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
  clearDemotedPanels();
  stopSuburbanTimer();
  metroStationPanel.classList.remove("visible");
  suburbanStationPanel.classList.remove("visible");
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
      map.removeLayer(selectedHeadingMarker);
      selectedHeadingMarker = null;
  }
  if (stopProperties.heading !== undefined && stopProperties.heading !== null) {
      if (selectedStopMarker) {
          const latlng = selectedStopMarker.getLatLng();
          const bigArrowIcon = createHeadingIcon(stopProperties.heading, 65);
          if (bigArrowIcon) {
              selectedHeadingMarker = L.marker(latlng, {
                  icon: bigArrowIcon,
                  pane: 'selectedArrowPane',
                  interactive: false
              }).addTo(map);
          }
      }
  }

  const stopCode = stopProperties.StopCode;
  const routesUrl = `https://corsproxy.io/?${encodeURIComponent(`http://telematics.oasa.gr/api/?act=webRoutesForStop&p1=${stopCode}`)}`;
  const arrivalsUrl = `https://corsproxy.io/?${encodeURIComponent(`http://telematics.oasa.gr/api/?act=getStopArrivals&p1=${stopCode}`)}`;
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
          row.innerHTML = `<div class="arrival-lineid"><span class="lineid-text">${routeInfo.LineID}</span><span class="veh-code-text">${arrival.veh_code}</span></div><div class="arrival-descr">${routeInfo.RouteDescrEng}</div><div class="arrival-right-content"><div class="arrival-time">${arrival.btime2}'</div><div class="arrival-time-container"><button class="plot-route-icon-btn">${plotRouteIconSvg}</button><div class="btime-timer-wrapper"><svg class="timer-svg btime-timer-svg" viewBox="0 0 36 36"><path class="timer-track" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path><path class="timer-progress btime-timer-progress" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path></svg><div class="timer-text btime-timer-text"></div></div></div></div>`;
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
  if (selectedStopMarker) {
    map.removeLayer(selectedStopMarker);
    selectedStopMarker = null;
  }
  if (selectedHeadingMarker) {
    map.removeLayer(selectedHeadingMarker);
    selectedHeadingMarker = null;
  }
});

stopInfoRefresh.addEventListener("click", () => {
  if (currentStopProperties) {
    stopTimer();
    plottedRoutes.forEach((route) => {
      refreshBusLocations(route.routeCode);
    });
    const stopCode = currentStopProperties.StopCode;
    const arrivalsUrl = `https://corsproxy.io/?${encodeURIComponent(`http://telematics.oasa.gr/api/?act=getStopArrivals&p1=${stopCode}`)}`;
    fetchAndDisplayArrivals(arrivalsUrl);
  }
});

clearRouteButton.addEventListener('click', (e) => {
    e.stopPropagation(); 
    if (plottedRoutes.length === 0 || isClearing) return;
    if (deletePopup.classList.contains('visible')) {
        deletePopup.classList.remove('visible');
        return;
    }
    manageOpenPanels('delete');
    const btnRect = clearRouteButton.getBoundingClientRect();
    deletePopup.style.top = `${btnRect.top}px`;
    deletePopup.style.left = `${btnRect.right + 10}px`;
    deleteCyanBtn.style.display = 'none';
    deleteGreenBtn.style.display = 'none';
    deleteAllBtn.style.display = 'none';
    const cyanRoute = plottedRoutes.find(r => r.color === 'cyan');
    if (cyanRoute) {
        deleteCyanBtn.style.display = 'flex'; 
        deleteCyanBtn.querySelector('.button-text').innerHTML = `Route ${cyanRoute.lineID} <span class="modal-route-descr">${cyanRoute.routeDescr}</span>`;
    }
    const greenRoute = plottedRoutes.find(r => r.color === 'green');
    if (greenRoute) {
        deleteGreenBtn.style.display = 'flex'; 
        deleteGreenBtn.querySelector('.button-text').innerHTML = `Route ${greenRoute.lineID} <span class="modal-route-descr">${greenRoute.routeDescr}</span>`;
    }
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