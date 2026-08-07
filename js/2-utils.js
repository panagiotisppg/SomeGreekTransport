// ui helpers
function updateProgressBar(p) {
  if (progressBar) progressBar.style.width = p + "%";
}

function hideLoader() {
  updateProgressBar(100);
  if (loadingText) loadingText.innerText = "Done!";
  setTimeout(() => loadingOverlay.classList.add("hidden"), 500);
  setTimeout(() => {
    if (loadingOverlay) loadingOverlay.style.display = "none";
    // the map got its initial view the instant js/3-map-engine.js parsed,
    // which can be before the real mobile viewport height had settled -
    // the loading overlay has kept the map untouched this whole time, so
    // its safe here to resync maplibres cached container size and reapply
    // the real starting view, clearing out any drift a stale size baked
    // into that first setview (this is what made the map sometimes start
    // off center, and every flyto after it land off too)
    if (map) {
      map.resize();
      map.jumpTo({ center: [23.7275, 37.9838], zoom: 12 });
    }
  }, 1200);
}

function showLoadingUI(container, message, showBar = false) {
  let barHtml = "";
  if (showBar) {
    barHtml = `<div class="loading-bar-background"><div class="loader-bar-fill"></div></div>`;
  }
  container.innerHTML = `<div class="loader-container"><div class="loader-text">${message}</div>${barHtml}</div>`;
  if (showBar) {
    setTimeout(() => {
      const bar = container.querySelector(".loader-bar-fill");
      if (bar) bar.style.width = "25%";
    }, 100);
  }
}

function showFinalError(container, message) {
  container.innerHTML = `<div class="info-message">${message}</div>`;
}

function showNoArrivalsUI(container, message) {
  const noBusSvg = `<svg viewBox="0 0 64 64"><g fill="none" stroke="#bbb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 48 V 24 C 12 21, 14 19, 17 19 H 47 C 50 19, 52 21, 52 24 V 48 H 12 Z"></path><path d="M12 25 H 42"></path><path d="M12 35 H 42"></path><path d="M22 35 V 25"></path><path d="M32 35 V 25"></path><path d="M42 35 V 25"></path><circle fill="#bbb" cx="20" cy="48" r="4"></circle><circle fill="#bbb" cx="44" cy="48" r="4"></circle><line x1="56" y1="8" x2="8" y2="56"></line></g></svg>`;
  container.innerHTML = `<div class="no-arrivals-container"><div class="no-arrivals-icon">${noBusSvg}</div><div class="info-message">${message}</div></div>`;
}

function manageOpenPanels(panelToKeep) {
  const panels = [
    { element: searchResultsContainer, name: 'search' },
    { element: deletePopup, name: 'delete' },
    { element: layerControlPanel, name: 'layers' },
    { element: timerOptionsPopup, name: 'timer' }
  ];
  panels.forEach(panel => {
    if (panel.name !== panelToKeep && panel && panel.element && panel.element.classList.contains('visible')) {
      panel.element.classList.remove('visible');
    }
  });
}

// opening any regular panel resets the live train sheets special
// in front / demoted stacking too so it never gets left open behind one
function clearDemotedPanels() {
  stopInfoPanel.classList.remove('panel-demoted');
  suburbanStationPanel.classList.remove('panel-demoted');
  tramStationPanel.classList.remove('panel-demoted');
  metroStationPanel.classList.remove('panel-demoted');
  cityStopPanel.classList.remove('panel-demoted');
  schedulePanel.classList.remove('panel-demoted');
  if (typeof closeLiveTrainSheet === 'function') closeLiveTrainSheet();
}

// a closed sheet only slides off via transform, its content stays live -
// force-close them all here so nothing shows through underneath
function closeAllInfoPanels() {
  stopTimer();
  stopSuburbanTimer();
  if (typeof stopFerryCountdownTicker === 'function') stopFerryCountdownTicker();
  if (typeof stopCityLiveTimer === 'function') stopCityLiveTimer();
  if (typeof clearCitySelectedStopMarker === 'function') clearCitySelectedStopMarker();
  [stopInfoPanel, metroStationPanel, suburbanStationPanel, tramStationPanel, ferryStationPanel, cityStopPanel, schedulePanel].forEach((panel) => {
    if (panel) panel.classList.remove('visible');
  });
  clearDemotedPanels();
}

// notifications and drag logic
let dragStartY = 0;
let isDraggingNotif = false;

function initNotificationGestures() {
    if (!plotNotification) return;

    plotNotification.addEventListener('pointerdown', (e) => {
        isDraggingNotif = true;
        dragStartY = e.clientY;
        plotNotification.style.transition = 'none';
        plotNotification.setPointerCapture(e.pointerId);
        plotNotification.style.cursor = "grabbing";
    });

    plotNotification.addEventListener('pointermove', (e) => {
        if (!isDraggingNotif) return;
        const deltaY = e.clientY - dragStartY;
        // only move if dragging upwards
        if (deltaY < 0) {
            plotNotification.style.transform = `translate(-50%, ${deltaY}px)`;
        }
    });

    plotNotification.addEventListener('pointerup', (e) => {
        if (!isDraggingNotif) return;
        isDraggingNotif = false;
        plotNotification.releasePointerCapture(e.pointerId);
        plotNotification.style.cursor = "grab";
        
        const deltaY = e.clientY - dragStartY;
        
        // threshold to close is -30px
        if (deltaY < -30) {
            // slide out fully up
            plotNotification.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
            plotNotification.style.transform = `translate(-50%, -150%)`;
            plotNotification.classList.remove('visible');
            if (notificationTimeout) clearTimeout(notificationTimeout);
        } else {
            // snap back
            plotNotification.style.transition = 'transform 0.3s ease';
            plotNotification.style.transform = `translate(-50%, 0)`;
        }
    });
}

function showPlotNotification(htmlContent, className, duration = 3000) {
  const notification = document.getElementById("plot-notification");
  const textSpan = document.getElementById("notification-text");
  const timerBar = document.getElementById("notification-timer-bar");

  notification.className = ''; 
  if (notificationTimeout) clearTimeout(notificationTimeout);

  // reset position and transition from any previous drags
  notification.style.transform = '';
  notification.style.transition = '';

  notification.classList.add(className);
  if (textSpan) {
      textSpan.innerHTML = htmlContent;
  } else {
      notification.innerHTML = htmlContent; 
  }

  notification.classList.add("visible");

  // animate bar left to right
  if (timerBar) {
      timerBar.style.transition = 'none';
      timerBar.style.width = '0%';
      void timerBar.offsetWidth; 
      timerBar.style.transition = `width ${duration}ms linear`;
      timerBar.style.width = '100%';
  }

  notificationTimeout = setTimeout(() => {
    notification.classList.remove("visible");
  }, duration);
}

// data helpers
function toGreeklish(text) {
  return text.toLowerCase().split("").map((char) => greeklishMap[char.toLowerCase()] || char).join("");
}

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

async function fetchAndDecompressGzip(filePath) {
  const response = await fetch(filePath);
  if (!response.ok) {
      throw new Error(`Failed to fetch ${filePath}: ${response.statusText}`);
  }
  const compressed = await response.arrayBuffer();
  if (typeof pako === 'undefined') {
      throw new Error("Pako library is missing. Ensure it is loaded in index.html");
  }
  const decompressed = pako.inflate(compressed);
  const text = new TextDecoder("utf-8").decode(decompressed);
  return JSON.parse(text);
}

// map helpers - maplibre has no divicon or lat/lng distance helper built in
function elFromHTML(html) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html.trim();
  return wrapper.firstElementChild;
}

// straight-line (haversine) distance in meters between two {lat,lng} points
// clock time a bus/train is expected at, given "arrives in N minutes" -
// used as the smaller sub-line under a stop's own minutes-until countdown
function formatEtaClock(minutesFromNow) {
  const mins = parseInt(minutesFromNow, 10);
  if (isNaN(mins)) return '';
  const eta = new Date(Date.now() + mins * 60000);
  const hh = String(eta.getHours()).padStart(2, '0');
  const mm = String(eta.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// plain circular dot marker element, replaces L.circleMarker for the bounded-count
// dot markers that stayed as DOM markers (selected stop, plotted route stops)
function createDotMarkerElement(diameter, fillColor, { strokeColor = "#fff", strokeWidth = 1.5 } = {}) {
  const el = document.createElement("div");
  el.className = "dot-marker";
  el.style.width = `${diameter}px`;
  el.style.height = `${diameter}px`;
  el.style.backgroundColor = fillColor;
  el.style.border = `${strokeWidth}px solid ${strokeColor}`;
  return el;
}

// no canvas filter runs in dark mode (see styles.css) - the map keeps its
// light style and every custom color renders as configured in both themes.
// this only matters to the app's own dom ui at this point (panels, buttons)
function isDarkTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

// init circle settings and gestures
if (timerProgress) {
    timerProgress.style.strokeDasharray = `${circumference} ${circumference}`;
}
if (suburbanTimerProgress) {
    suburbanTimerProgress.style.strokeDasharray = `${circumference} ${circumference}`;
}
if (cityStopTimerProgress) {
    cityStopTimerProgress.style.strokeDasharray = `${circumference} ${circumference}`;
}
// initialize the drag listener immediately
initNotificationGestures();