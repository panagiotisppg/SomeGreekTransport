const map = L.map("map", {
  zoomControl: false,
  zoomSnap: 0.25,
  zoomDelta: 0.25,
}).setView([37.9838, 23.7275], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// panes
map.createPane("animatedRoutePane"); map.getPane("animatedRoutePane").style.zIndex = 610;
map.createPane("headingPane"); map.getPane("headingPane").style.zIndex = 350;
map.createPane("highlightedStopsPane"); map.getPane("highlightedStopsPane").style.zIndex = 620;
map.createPane("staticDotsPane"); map.getPane("staticDotsPane").style.zIndex = 618;
map.createPane("arrowPane"); map.getPane("arrowPane").style.zIndex = 614;
map.createPane("busPane"); map.getPane("busPane").style.zIndex = 660;
map.createPane("selectedArrowPane"); map.getPane("selectedArrowPane").style.zIndex = 630; 
map.createPane("selectedStopPane"); map.getPane("selectedStopPane").style.zIndex = 640;
map.createPane("userPane"); map.getPane("userPane").style.zIndex = 700;
map.createPane('metroPane'); map.getPane('metroPane').style.zIndex = 500;
map.createPane("plottedArrowPane"); map.getPane("plottedArrowPane").style.zIndex = 618;
map.createPane('suburbanPane'); map.getPane('suburbanPane').style.zIndex = 490;
map.createPane('metroStationPane'); map.getPane('metroStationPane').style.zIndex = 505;
map.createPane('suburbanStationPane'); map.getPane('suburbanStationPane').style.zIndex = 495;

const myCanvasRenderer = L.canvas({ padding: 0.5 });
const routeZoomThreshold = 14;
const clickableStopZoomThreshold = 15;
const labelZoomThreshold = 16.5;

// layer styles
function getStopRadius(zoom) {
  if (zoom <= 13) return 2;
  if (zoom < 14) return 3;
  if (zoom < 15) return 4;
  if (zoom < 16) return 5;
  if (zoom < 17) return 6;
  if (zoom < 18) return 7;
  return 8;
}

function getRouteStyle(zoom) {
  let opacity = 0;
  if (zoom > 8) {
    opacity = Math.min(0.8, (zoom - 8) * 0.1);
  }
  return { ...defaultRouteStyle, opacity: opacity };
}

function getLabelZoomThreshold() {
  if (window.innerWidth > 768) {
    return desktopLabelZoomThreshold;
  } else {
    return mobileLabelZoomThreshold;
  }
}

function createHeadingIcon(heading, displaySize = 40) {
    if (heading === null || heading === undefined) return null;
    const viewPortSize = 40; 
    const iconHtml = `<svg class="heading-svg" viewBox="0 0 ${viewPortSize} ${viewPortSize}" width="${displaySize}" height="${displaySize}" style="transform: rotate(${heading}deg);"><path d="M 20 -4 L 8 16 L 20 12 L 32 16 Z" /></svg>`;
    return L.divIcon({ className: 'heading-arrow-icon', html: iconHtml, iconSize: [displaySize, displaySize], iconAnchor: [displaySize / 2, displaySize / 2] });
}

// map updates
function updateVisibleHeadings() {
    if (!toggleBusStops.checked || map.getZoom() < getLabelZoomThreshold()) {
        stopsHeadingLayer.clearLayers();
        return;
    }
    if (isUpdatingHeadings) return;
    isUpdatingHeadings = true;
    const bounds = map.getBounds().pad(0.1);
    const newMarkers = [];
    mergedStopsGeoJSON.features.forEach(feature => {
        const props = feature.properties;
        if (props.heading === null || props.heading === undefined) return;
        if (plottedStopCodes.has(props.StopCode)) return;
        const lat = feature.geometry.coordinates[1];
        const lng = feature.geometry.coordinates[0];
        const latlng = L.latLng(lat, lng);
        if (bounds.contains(latlng)) {
            const icon = createHeadingIcon(props.heading);
            if (icon) {
                const marker = L.marker(latlng, { icon: icon, pane: 'headingPane', interactive: false });
                newMarkers.push(marker);
            }
        }
    });
    stopsHeadingLayer.clearLayers();
    newMarkers.forEach(m => stopsHeadingLayer.addLayer(m));
    isUpdatingHeadings = false;
}

function updateAllLayers() {
  const currentZoom = map.getZoom();
  const currentRadius = getStopRadius(currentZoom);

  if (toggleBusStops.checked) {
      if (currentZoom >= clickableStopZoomThreshold) {
        if (map.hasLayer(stopsLayerNotInteractive)) map.removeLayer(stopsLayerNotInteractive);
        if (!map.hasLayer(stopsLayerInteractive)) map.addLayer(stopsLayerInteractive);
        stopsLayerInteractive.eachLayer((layer) => layer.setRadius(currentRadius));
        if (typeof stopsHeadingLayer !== 'undefined') {
             if (!map.hasLayer(stopsHeadingLayer)) map.addLayer(stopsHeadingLayer);
        }
      } else {
        if (map.hasLayer(stopsLayerInteractive)) map.removeLayer(stopsLayerInteractive);
        if (typeof stopsHeadingLayer !== 'undefined' && map.hasLayer(stopsHeadingLayer)) {
            map.removeLayer(stopsHeadingLayer);
            stopsHeadingLayer.clearLayers();
        }
        if (!map.hasLayer(stopsLayerNotInteractive)) map.addLayer(stopsLayerNotInteractive);
        stopsLayerNotInteractive.setStyle({ radius: currentRadius });
      }
  } else {
      if (map.hasLayer(stopsLayerInteractive)) map.removeLayer(stopsLayerInteractive);
      if (map.hasLayer(stopsLayerNotInteractive)) map.removeLayer(stopsLayerNotInteractive);
      if (typeof stopsHeadingLayer !== 'undefined' && map.hasLayer(stopsHeadingLayer)) {
          map.removeLayer(stopsHeadingLayer);
      }
  }

  if (plottedRoutes.length === 0) {
    if (toggleBusNetwork.checked) {
        if (currentZoom >= routeZoomThreshold) {
            if (!map.hasLayer(routesLayer)) map.addLayer(routesLayer);
            routesLayer.setStyle(getRouteStyle(currentZoom));
        } else {
            if (map.hasLayer(routesLayer)) map.removeLayer(routesLayer);
        }
    } else {
        if (map.hasLayer(routesLayer)) map.removeLayer(routesLayer);
    }
  } else {
    if (map.hasLayer(routesLayer)) map.removeLayer(routesLayer);
  }
}

function updateStopLabels() {
  const currentZoom = map.getZoom();
  if (!map.hasLayer(stopsLayerInteractive)) return;
  if (currentZoom >= getLabelZoomThreshold()) {
    const bounds = map.getBounds();
    const layersToShow = [];
    stopsLayerInteractive.eachLayer((layer) => {
      if (!plottedStopCodes.has(layer.feature.properties.StopCode)) {
        if (bounds.contains(layer.getLatLng())) {
          layersToShow.push(layer);
        } else {
          layer.getTooltip().options.permanent = false;
          layer.closeTooltip();
        }
      } else {
        layer.getTooltip().options.permanent = false;
        layer.closeTooltip();
      }
    });
    let index = 0;
    const chunkSize = 60;
    function processChunk() {
      const end = Math.min(index + chunkSize, layersToShow.length);
      for (let i = index; i < end; i++) {
        const layer = layersToShow[i];
        if (layer.getTooltip()) {
          layer.getTooltip().options.permanent = true;
          layer.openTooltip();
        }
      }
      index = end;
      if (index < layersToShow.length) {
        requestAnimationFrame(processChunk);
      }
    }
    requestAnimationFrame(processChunk);
  } else {
    stopsLayerInteractive.eachLayer((layer) => {
      if (layer.getTooltip()) {
        layer.getTooltip().options.permanent = false;
        layer.closeTooltip();
      }
    });
  }
}

function updatePlottedStopLabels() {
  const currentZoom = map.getZoom();
  if (!map.hasLayer(plottedStopsLayer)) return;
  const showLabels = currentZoom >= plottedLabelZoomThreshold;
  const bounds = map.getBounds().pad(0.2); 
  plottedStopsLayer.eachLayer((layer) => {
    if (layer.isPlottedArrow) {
       if (layer._icon) layer._icon.style.display = 'flex';
       return; 
    }
    if (showLabels && bounds.contains(layer.getLatLng())) {
        if (layer.getTooltip()) {
          layer.getTooltip().options.permanent = true;
          layer.openTooltip();
        }
    } else {
        if (layer.getTooltip()) {
          layer.getTooltip().options.permanent = false;
          layer.closeTooltip();
        }
    }
  });
}

function updateMetroStationsVisibility() {
  if (!toggleMetroNetwork.checked) {
    if (map.hasLayer(metroStationsLayer)) map.removeLayer(metroStationsLayer);
    return;
  }
  if (map.getZoom() >= 14) {
    if (!map.hasLayer(metroStationsLayer)) map.addLayer(metroStationsLayer);
  } else {
    if (map.hasLayer(metroStationsLayer)) map.removeLayer(metroStationsLayer);
  }
}

function updateSuburbanStationsVisibility() {
  if (!toggleSuburbanNetwork.checked) {
    if (map.hasLayer(suburbanStationsLayer)) map.removeLayer(suburbanStationsLayer);
    return;
  }
  if (map.getZoom() >= 13) {
    if (!map.hasLayer(suburbanStationsLayer)) map.addLayer(suburbanStationsLayer);
  } else {
    if (map.hasLayer(suburbanStationsLayer)) map.removeLayer(suburbanStationsLayer);
  }
}

function updateAllMapView() {
  updateAllLayers();
  updateStopLabels();
  updatePlottedStopLabels();
  updateVisibleHeadings();
  updateMetroStationsVisibility();
  updateSuburbanStationsVisibility();
}

// user location logic
function animateUserMarker(marker, from, to) {
  const duration = 1000;
  let startTime = null;
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = (timestamp - startTime) / duration;
    if (progress > 1) {
      marker.setLatLng(to);
      return;
    }
    const lat = from.lat + (to.lat - from.lat) * progress;
    const lng = from.lng + (to.lng - from.lng) * progress;
    marker.setLatLng([lat, lng]);
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

locationButton.addEventListener("click", () => {
  if (isTrackingUser) {
    if (userLocationWatcher) {
      navigator.geolocation.clearWatch(userLocationWatcher);
      userLocationWatcher = null;
    }
    if (userLocationMarker) {
      if (userLocationMarker.getElement()) {
        userLocationMarker.getElement().classList.remove("tracking");
        userLocationMarker.getElement().style.opacity = "0";
      }
      setTimeout(() => {
        if (userLocationMarker) {
          map.removeLayer(userLocationMarker);
          userLocationMarker = null;
        }
      }, 300);
    }
    locationButton.classList.remove("active");
    isTrackingUser = false;
    return;
  }

  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  locationButton.classList.add("active");
  isTrackingUser = true;

  const geoOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  };

  userLocationWatcher = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      const newLatLng = L.latLng(latitude, longitude);

      if (!userLocationMarker) {
        userLocationMarker = L.marker(newLatLng, {
          icon: L.divIcon({ className: "user-location-marker", html: '<div class="user-location-dot"></div>', iconSize: [20, 20] }),
          pane: "userPane",
        }).addTo(map);

        setTimeout(() => {
          if (userLocationMarker.getElement()) {
            userLocationMarker.getElement().classList.add("tracking");
          }
        }, 50);
        map.flyTo(newLatLng, 16.5, { duration: 1.0 });
      } 
      else {
        const currentLatLng = userLocationMarker.getLatLng();
        if (currentLatLng.distanceTo(newLatLng) > 0.5) {
          animateUserMarker(userLocationMarker, currentLatLng, newLatLng);
        }
      }
    },
    (error) => {
      locationButton.classList.remove("active");
      isTrackingUser = false;
      let msg = "Could not get your location.";
      if (error.code === 1) msg = "Location Access Denied.<br>Please enable it in Settings.";
      else if (error.code === 2) msg = "Location Unavailable.<br>Check your GPS signal.";
      else if (error.code === 3) msg = "Location request timed out.<br>Try moving outdoors.";
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
           msg = "Location requires <b>HTTPS</b>.<br>Your connection is not secure.";
      }
      console.warn("Location error:", error.message);
      showPlotNotification(msg, 'notif-red', 4000);
    },
    geoOptions
  );
});

// listeners
layerControlBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  // Dynamic positioning logic
  if (!layerControlPanel.classList.contains('visible')) {
    manageOpenPanels('layers');
    // Calculate position based on the button's current location
    const btnRect = layerControlBtn.getBoundingClientRect();
    layerControlPanel.style.top = `${btnRect.top}px`;
    // Place it to the right of the button with a 10px gap
    layerControlPanel.style.left = `${btnRect.right + 10}px`;
  }
  layerControlPanel.classList.toggle('visible');
});

toggleBusStops.addEventListener('change', () => {
    updateAllLayers();
    updateStopLabels();
    updateVisibleHeadings();
    updatePlottedStopLabels(); 
});

toggleBusNetwork.addEventListener('change', (e) => {
  const isVisible = e.target.checked;
  if (isVisible) {
    if (plottedRoutes.length === 0 && map.getZoom() >= routeZoomThreshold) {
      if (!map.hasLayer(routesLayer)) map.addLayer(routesLayer);
    }
  } else {
    if (map.hasLayer(routesLayer)) map.removeLayer(routesLayer);
  }
});

toggleMetroNetwork.addEventListener('change', (e) => {
  const isVisible = e.target.checked;
  if (isVisible) {
    if (!map.hasLayer(metroLayer)) map.addLayer(metroLayer);
    updateMetroStationsVisibility();
  } else {
    if (map.hasLayer(metroLayer)) map.removeLayer(metroLayer);
    if (map.hasLayer(metroStationsLayer)) map.removeLayer(metroStationsLayer);
  }
});

toggleSuburbanNetwork.addEventListener('change', (e) => {
  const isVisible = e.target.checked;
  if (isVisible) {
    if (!map.hasLayer(suburbanLayer)) map.addLayer(suburbanLayer);
    updateSuburbanStationsVisibility();
  } else {
    if (map.hasLayer(suburbanLayer)) map.removeLayer(suburbanLayer);
    if (map.hasLayer(suburbanStationsLayer)) map.removeLayer(suburbanStationsLayer);
  }
});

map.on("click", (e) => {
  if (deletePopup.classList.contains('visible')) deletePopup.classList.remove('visible');
  if (layerControlPanel.classList.contains('visible')) layerControlPanel.classList.remove('visible');
  if (timerOptionsPopup && timerOptionsPopup.classList.contains('visible')) timerOptionsPopup.classList.remove('visible');
  if (!searchContainer.contains(e.originalEvent.target)) searchResultsContainer.classList.remove("visible");
});
map.on('movestart', () => map.closePopup());
map.on("zoomend", updateAllMapView);
map.on("moveend", updateAllMapView);