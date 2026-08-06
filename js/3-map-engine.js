// ─── layer/source ids ───────────────────────────────────────────────────────
// bulk features are gl sources+layers, gpu rendered. bounded-count stuff
// (stations, buses, live trains, selected/plotted stop dots) stays as
// plain maplibregl.Marker dom elements
const SOURCE_IDS = {
  busStops: "bus-stops",
  busNetwork: "bus-network",
  metroLines: "metro-lines",
  tramLines: "tram-lines",
  suburbanLines: "suburban-lines",
};
const LAYER_IDS = {
  busNetwork: "bus-network-layer",
  metroLines: "metro-lines-layer",
  tramLines: "tram-lines-layer",
  suburbanLines: "suburban-lines-layer",
  stopHeading: "bus-stop-heading-layer",
  stops: "bus-stops-layer",
  stopsLabel: "bus-stops-label-layer",
};

const routeZoomThreshold = 14;
const clickableStopZoomThreshold = 15;
const labelZoomThreshold = 16.5;
const trainStationLabelZoomThreshold = 15;

// ─── map init ───────────────────────────────────────────────────────────────
// real dark/light base styles instead of a css filter on the canvas - a
// filter would also distort every custom layer sharing that canvas
// (stops, routes, metro/tram/suburban lines)
const MAP_STYLES = {
  light: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

const map = new maplibregl.Map({
  container: "map",
  style: MAP_STYLES[isDarkTheme() ? "dark" : "light"],
  center: [23.7275, 37.9838], // [lng, lat] order, not [lat, lng]
  zoom: 12,
});

// resolves once the style has finished loading - addSource/addLayer/addImage
// all need this to have fired first
const mapLoadPromise = new Promise((resolve) => map.once("load", resolve));

// setStyle() throws away every runtime-added source/layer/image - rebuild
// via rebuildMapLayersAfterStyleChange (js/7-main.js) and
// rebuildPlottedRouteLayers (js/5-bus-logic.js). station markers are plain
// dom markers and need no rebuilding.
function onThemeChange() {
  const dark = isDarkTheme();
  map.setStyle(MAP_STYLES[dark ? "dark" : "light"]);
  // "style.load" never actually fires in this maplibre build - "styledata"
  // does, and only once per setStyle() call
  map.once("styledata", () => {
    if (typeof rebuildMapLayersAfterStyleChange === "function") rebuildMapLayersAfterStyleChange();
    if (typeof rebuildPlottedRouteLayers === "function") rebuildPlottedRouteLayers();
    applyMapTheme();
    updateAllLayers();
  });
}
new MutationObserver(onThemeChange).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

// baked once into the circle layer's paint expressions instead of being
// recomputed in js on every zoomend - gl already re-evaluates interpolate
// expressions per frame at zero cost
function stopRadiusExpr() {
  return [
    "interpolate", ["linear"], ["zoom"],
    13, 2, 14, 3, 15, 4, 16, 5, 17, 6, 18, 7, 19, 8,
  ];
}
function stopStrokeWeightExpr() {
  return ["interpolate", ["linear"], ["zoom"], 13, 0.5, 15, 0.7, 17, 1, 18, 1.2];
}
// scales with the dot radius, not against it - a flat weight made the
// outline as wide as the whole dot at low zoom
function stopFillOpacityExpr() {
  return ["step", ["zoom"], 0.85, clickableStopZoomThreshold, 1];
}
function routeLineOpacityExpr() {
  return ["interpolate", ["linear"], ["zoom"], 8, 0, 18, 0.8];
}

function getLabelZoomThreshold() {
  return window.innerWidth > 768 ? desktopLabelZoomThreshold : mobileLabelZoomThreshold;
}

function applyStopLabelZoomRange() {
  if (!map.getLayer(LAYER_IDS.stopsLabel)) return;
  map.setLayerZoomRange(LAYER_IDS.stopsLabel, getLabelZoomThreshold(), 24);
}

// rasterizes a small direction indicator for the bulk heading-arrow layer,
// rotated per-feature via icon-rotate - a slim triangle sized to sit over
// the stop dot itself rather than a big chevron floating above it
const HEADING_ARROW_RASTER_SIZE = 128;
const HEADING_ARROW_BOX = 32; // logical drawing box the points below are in - box center (16,16) is the anchor, ie the stop dot's own center
function buildHeadingArrowImage(fillColor) {
  const size = HEADING_ARROW_RASTER_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const scale = size / HEADING_ARROW_BOX;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = fillColor;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 1;
  ctx.shadowOffsetY = 0.5;
  ctx.beginPath();
  // same chevron-with-notch shape as the live train heading arrow
  // (createLiveTrainIconSvg) and the dom-marker createHeadingIcon - shifted
  // well clear of the box center (16,16) so the whole wedge, not just its
  // tapered tip, sits past the stop dot's edge instead of tucked behind it.
  // points "up" (north) before icon-rotate is applied per feature
  ctx.moveTo(16, 2);
  ctx.lineTo(9, 14);
  ctx.lineTo(16, 11);
  ctx.lineTo(23, 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  return ctx.getImageData(0, 0, size, size);
}
// tracks stopRadiusExpr()'s own zoom curve (only ever shown from
// clickableStopZoomThreshold up) so the arrow scales with the dot instead
// of staying a fixed size regardless of how big the dot currently is
const HEADING_ARROW_SIZE_EXPR = ["interpolate", ["linear"], ["zoom"], 15, 0.14, 17, 0.2, 19, 0.27];

// no canvas filter runs in dark mode, so one plain white raster works for
// both themes - registered lazily, only costs anything once
function ensureHeadingArrowImages() {
  if (!map.hasImage("stop-heading-arrow")) map.addImage("stop-heading-arrow", buildHeadingArrowImage("#ffffff"));
}
function headingArrowImageId() {
  return "stop-heading-arrow";
}

// route arrowhead icons (js/5-bus-logic.js plotAnimatedRoute) - one raster
// per color, registered lazily on first use
function buildArrowImage(color) {
  const size = 24;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(4, 4);
  ctx.lineTo(20, 12);
  ctx.lineTo(4, 20);
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}
function ensureRouteArrowImage(colorName, baseHex) {
  const imageId = `route-arrow-${colorName}`;
  if (!map.hasImage(imageId)) map.addImage(imageId, buildArrowImage(baseHex));
  return imageId;
}

// dark theme keeps its own explicit stop dot/label colors, same as any
// other dark-mode ui color in the app - no canvas filter runs to fight
// with, so these just paint exactly as given
const stopFillColors = { light: "#003366", dark: "#4d94ff" };
const stopLabelColors = {
  light: { text: "#1e3a5f", halo: "#ffffff" },
  dark: { text: "#93c5fd", halo: "#000000" },
};
function applyMapTheme() {
  const dark = isDarkTheme();
  ensureHeadingArrowImages();

  if (map.getLayer(LAYER_IDS.stops)) {
    map.setPaintProperty(LAYER_IDS.stops, "circle-color", dark ? stopFillColors.dark : stopFillColors.light);
  }
  if (map.getLayer(LAYER_IDS.stopsLabel)) {
    const c = dark ? stopLabelColors.dark : stopLabelColors.light;
    map.setPaintProperty(LAYER_IDS.stopsLabel, "text-color", c.text);
    map.setPaintProperty(LAYER_IDS.stopsLabel, "text-halo-color", c.halo);
  }
}

// used for the bounded-count dom marker cases only: the big arrow on the
// currently selected stop, and the per-stop arrows on a plotted route's
// highlighted stops - returns a ready dom element
function createHeadingIcon(heading, displaySize = 40) {
  if (heading === null || heading === undefined) return null;
  const viewPortSize = 40;
  const iconHtml = `<div class="heading-arrow-icon" style="width:${displaySize}px;height:${displaySize}px;"><svg class="heading-svg" viewBox="0 0 ${viewPortSize} ${viewPortSize}" width="${displaySize}" height="${displaySize}" style="transform: rotate(${heading}deg);"><path d="M 20 -4 L 8 16 L 20 12 L 32 16 Z" /></svg></div>`;
  return elFromHTML(iconHtml);
}

function getMetroIconSize(zoom) {
  if (zoom < 13) return 14;
  if (zoom < 15) return 16;
  if (zoom < 17) return 19;
  return 22;
}

// a bit bigger than the metro/tram/suburban dots - at metro size these
// read as just another bus stop instead of a distinct port gate
function getFerryIconSize(zoom) {
  return getMetroIconSize(zoom) + 7;
}

function getSuburbanIconSize(zoom) {
  if (zoom < 13) return 14;
  if (zoom < 15) return 18;
  if (zoom < 17) return 23;
  return 27;
}

// dimmed to 0.3 while a route is plotted, restored to their own fixed
// opacity when cleared - not routeLineOpacityExpr(), that's the bus
// network's zoom-fade curve and faded these to invisible below zoom 8
const DIMMABLE_LINE_LAYERS = {
  [LAYER_IDS.metroLines]: 0.8,
  [LAYER_IDS.suburbanLines]: 0.75,
  [LAYER_IDS.tramLines]: 0.8,
};
const DIMMABLE_CIRCLE_LAYERS = [LAYER_IDS.stops];
const NETWORK_LAYER = LAYER_IDS.busNetwork;

function setDimState(isDimmed) {
  Object.keys(DIMMABLE_LINE_LAYERS).forEach((id) => {
    if (map.getLayer(id)) map.setPaintProperty(id, "line-opacity", isDimmed ? 0.3 : DIMMABLE_LINE_LAYERS[id]);
  });
  DIMMABLE_CIRCLE_LAYERS.forEach((id) => {
    if (map.getLayer(id)) map.setPaintProperty(id, "circle-opacity", isDimmed ? 0.3 : stopFillOpacityExpr());
  });
  if (map.getLayer(LAYER_IDS.stopsLabel)) {
    map.setPaintProperty(LAYER_IDS.stopsLabel, "text-opacity", isDimmed ? 0.3 : 1);
  }
  if (map.getLayer(LAYER_IDS.stopHeading)) {
    map.setPaintProperty(LAYER_IDS.stopHeading, "icon-opacity", isDimmed ? 0.3 : 1);
  }
  if (map.getLayer(NETWORK_LAYER)) {
    map.setPaintProperty(NETWORK_LAYER, "line-opacity", isDimmed ? 0 : routeLineOpacityExpr());
  }
  [metroStationMarkers, suburbanStationMarkers, tramStationMarkers].forEach((arr) => {
    arr.forEach(({ marker }) => {
      const el = marker.getElement();
      el.style.transition = "opacity 1s linear";
      el.style.opacity = isDimmed ? "0.3" : "1";
      el.style.pointerEvents = isDimmed ? "none" : "";
    });
  });
}

function updateAllLayers() {
  if (map.getLayer(LAYER_IDS.stops)) {
    const visible = toggleBusStops.checked;
    const vis = visible ? "visible" : "none";
    map.setLayoutProperty(LAYER_IDS.stops, "visibility", vis);
    map.setLayoutProperty(LAYER_IDS.stopsLabel, "visibility", vis);
    map.setLayoutProperty(LAYER_IDS.stopHeading, "visibility", vis);
  }
  if (map.getLayer(NETWORK_LAYER)) {
    const show = toggleBusNetwork.checked && plottedRoutes.length === 0;
    map.setLayoutProperty(NETWORK_LAYER, "visibility", show ? "visible" : "none");
  }
}

// hides a stop from the bulk gl layer once its own dom marker (a
// plotted-route highlighted stop) is showing for it, so the dimmed
// original dot doesn't peek out from behind it
function updatePlottedStopsFilter() {
  // StopCode is a string or number depending on which api it came from -
  // match against the precomputed StopCodeStr instead (js/7-main.js)
  const codes = [...plottedStopCodes].map(String);
  const exclude = codes.length ? ["!", ["in", ["get", "StopCodeStr"], ["literal", codes]]] : null;
  if (map.getLayer(LAYER_IDS.stops)) map.setFilter(LAYER_IDS.stops, exclude);
  if (map.getLayer(LAYER_IDS.stopsLabel)) map.setFilter(LAYER_IDS.stopsLabel, exclude);
  if (map.getLayer(LAYER_IDS.stopHeading)) {
    const headingFilter = ["!=", ["get", "heading"], null];
    map.setFilter(LAYER_IDS.stopHeading, exclude ? ["all", headingFilter, exclude] : headingFilter);
  }
}

function updatePlottedStopLabels() {
  const currentZoom = map.getZoom();
  const showLabels = currentZoom >= plottedLabelZoomThreshold;
  plottedStopMarkers.forEach(({ marker, isArrow, labelEl }) => {
    if (isArrow || !labelEl) return;
    labelEl.classList.toggle("visible", showLabels);
  });
}

function updateMetroStationsVisibility() {
  const show = toggleMetroNetwork.checked && map.getZoom() >= 14;
  metroStationMarkers.forEach((entry) => {
    if (show && !entry.onMap) { entry.marker.addTo(map); entry.onMap = true; }
    else if (!show && entry.onMap) { entry.marker.remove(); entry.onMap = false; }
  });
}

function updateSuburbanStationsVisibility() {
  const show = toggleSuburbanNetwork.checked && map.getZoom() >= 13;
  suburbanStationMarkers.forEach((entry) => {
    if (show && !entry.onMap) { entry.marker.addTo(map); entry.labelMarker.addTo(map); entry.onMap = true; }
    else if (!show && entry.onMap) { entry.marker.remove(); entry.labelMarker.remove(); entry.onMap = false; }
  });
}

function updateTramStationsVisibility() {
  const show = toggleTramNetwork.checked && map.getZoom() >= 14;
  tramStationMarkers.forEach((entry, i) => {
    if (show && !entry.onMap) { entry.marker.addTo(map); entry.onMap = true; }
    else if (!show && entry.onMap) { entry.marker.remove(); entry.onMap = false; }
  });
}

// same zoom threshold as the suburban stations (no layer-control checkbox
// for these, unlike metro/suburban/tram - there's no bus network toggle to
// piggyback gating on to begin with, and none was asked for)
function updateFerryStationsVisibility() {
  const show = map.getZoom() >= 13;
  ferryStationMarkers.forEach((entry) => {
    if (show && !entry.onMap) { entry.marker.addTo(map); entry.onMap = true; }
    else if (!show && entry.onMap) { entry.marker.remove(); entry.onMap = false; }
  });
}

// only the suburban/regional rail stations get labels not metro or tram
function updateTrainStationLabels() {
  const showLabels = map.getZoom() >= trainStationLabelZoomThreshold;
  suburbanStationMarkers.forEach(({ labelEl }) => {
    if (labelEl) labelEl.classList.toggle("visible", showLabels);
  });
}

// markers dont resize themselves like the circle layer does via a paint
// expression, so this rebuilds each icon's html at the right size for the
// current zoom only when the size actually changes rather than on every pan
let lastMetroIconSize = null;
let lastSuburbanIconSize = null;
function updateTrainStationIconSizes() {
  const zoom = map.getZoom();

  const metroSize = getMetroIconSize(zoom);
  if (metroSize !== lastMetroIconSize) {
    lastMetroIconSize = metroSize;
    metroStationMarkers.forEach(({ marker, msym }) => {
      const el = marker.getElement();
      el.style.width = `${metroSize}px`;
      el.style.height = `${metroSize}px`;
      el.innerHTML = createMetroIcon(msym);
    });
    // ferry gates resize on this same zoom check, just at their own
    // (slightly bigger) size curve
    const ferrySize = getFerryIconSize(zoom);
    ferryStationMarkers.forEach(({ marker, gate }) => {
      const el = marker.getElement();
      el.style.width = `${ferrySize}px`;
      el.style.height = `${ferrySize}px`;
      el.innerHTML = createFerryIcon(gate);
    });
  }

  const suburbanSize = getSuburbanIconSize(zoom);
  if (suburbanSize !== lastSuburbanIconSize) {
    lastSuburbanIconSize = suburbanSize;
    suburbanStationMarkers.forEach(({ marker, groups }) => {
      const el = marker.getElement();
      el.style.width = `${suburbanSize}px`;
      el.style.height = `${suburbanSize}px`;
      el.innerHTML = createSuburbanIcon(groups);
    });
  }
}

function updateAllMapView() {
  updateAllLayers();
  updatePlottedStopLabels();
  updateMetroStationsVisibility();
  updateSuburbanStationsVisibility();
  updateTramStationsVisibility();
  updateFerryStationsVisibility();
  updateTrainStationLabels();
  updateTrainStationIconSizes();
}

function animateUserMarker(marker, from, to) {
  const duration = 1000;
  let startTime = null;
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = (timestamp - startTime) / duration;
    if (progress > 1) {
      marker.setLngLat([to.lng, to.lat]);
      return;
    }
    const lat = from.lat + (to.lat - from.lat) * progress;
    const lng = from.lng + (to.lng - from.lng) * progress;
    marker.setLngLat([lng, lat]);
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
      const el = userLocationMarker.getElement();
      el.classList.remove("tracking");
      el.style.opacity = "0";
      setTimeout(() => {
        if (userLocationMarker) {
          userLocationMarker.remove();
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
    maximumAge: 0,
  };

  userLocationWatcher = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      const newLatLng = { lat: latitude, lng: longitude };

      if (!userLocationMarker) {
        const el = elFromHTML(`<div class="user-location-marker"><div class="user-location-dot"></div></div>`);
        userLocationMarker = new maplibregl.Marker({ element: el })
          .setLngLat([newLatLng.lng, newLatLng.lat])
          .addTo(map);

        setTimeout(() => { el.classList.add("tracking"); }, 50);
        map.flyTo({ center: [newLatLng.lng, newLatLng.lat], zoom: 16.5, duration: 1000 });
      } else {
        const ll = userLocationMarker.getLngLat();
        const currentLatLng = { lat: ll.lat, lng: ll.lng };
        if (distanceMeters(currentLatLng, newLatLng) > 0.5) {
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
      if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
        msg = "Location requires <b>HTTPS</b>.<br>Your connection is not secure.";
      }
      console.warn("Location error:", error.message);
      showPlotNotification(msg, "notif-red", 4000);
    },
    geoOptions
  );
});

// needle always reflects the map's actual bearing (touch/right-click-drag
// rotates it), click resets back to north instead of just being a static icon
map.on("rotate", () => {
  compassIcon.style.transform = `rotate(${-map.getBearing()}deg)`;
});
compassButton.addEventListener("click", (e) => {
  e.stopPropagation();
  map.resetNorth({ duration: 400 });
});

layerControlBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!layerControlPanel.classList.contains("visible")) {
    manageOpenPanels("layers");
    const btnRect = layerControlBtn.getBoundingClientRect();
    layerControlPanel.style.top = `${btnRect.top}px`;
    layerControlPanel.style.left = `${btnRect.right + 10}px`;
  }
  layerControlPanel.classList.toggle("visible");
});

toggleBusStops.addEventListener("change", () => {
  updateAllLayers();
  updatePlottedStopLabels();
});

toggleBusNetwork.addEventListener("change", updateAllLayers);

toggleMetroNetwork.addEventListener("change", (e) => {
  const isVisible = e.target.checked;
  if (map.getLayer(LAYER_IDS.metroLines)) {
    map.setLayoutProperty(LAYER_IDS.metroLines, "visibility", isVisible ? "visible" : "none");
  }
  updateMetroStationsVisibility();
});

toggleSuburbanNetwork.addEventListener("change", (e) => {
  const isVisible = e.target.checked;
  if (map.getLayer(LAYER_IDS.suburbanLines)) {
    map.setLayoutProperty(LAYER_IDS.suburbanLines, "visibility", isVisible ? "visible" : "none");
  }
  updateSuburbanStationsVisibility();
});

toggleTramNetwork.addEventListener("change", (e) => {
  const isVisible = e.target.checked;
  if (map.getLayer(LAYER_IDS.tramLines)) {
    map.setLayoutProperty(LAYER_IDS.tramLines, "visibility", isVisible ? "visible" : "none");
  }
  updateTramStationsVisibility();
});

// registry of transient hover popups (bus "last updated" / live train
// tooltip) so a pan can close all of them at once
const openMapPopups = new Set();

map.on("click", (e) => {
  if (deletePopup.classList.contains("visible")) deletePopup.classList.remove("visible");
  if (layerControlPanel.classList.contains("visible")) layerControlPanel.classList.remove("visible");
  if (timerOptionsPopup && timerOptionsPopup.classList.contains("visible")) timerOptionsPopup.classList.remove("visible");
  if (!searchContainer.contains(e.originalEvent.target)) searchResultsContainer.classList.remove("visible");
});
map.on("movestart", () => {
  openMapPopups.forEach((p) => p.remove());
  openMapPopups.clear();
});
map.on("zoomend", updateAllMapView);
map.on("moveend", updateAllMapView);
window.addEventListener("resize", applyStopLabelZoomRange);
