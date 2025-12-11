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

function showNoSuburbanArrivalsUI(container, message) {
  const noTrainSvg = `<svg viewBox="0 0 64 64"><g fill="none" stroke="#bbb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="16" width="60" height="28" rx="4"></rect><rect x="22" y="22" width="20" height="13"></rect><rect fill="#bbb" x="40" y="45" width="6" height="4"></rect><rect fill="#bbb" x="18" y="45" width="6" height="4"></rect><path d="M24 16 L 40 16"></path><path d="M10 52 H 54"></path><line x1="56" y1="8" x2="8" y2="56"></line></g></svg>`;
  container.innerHTML = `<div class="no-arrivals-container"><div class="no-arrivals-icon">${noTrainSvg}</div><div class="info-message">${message}</div></div>`;
}

function manageOpenPanels(panelToKeep) {
  const panels = [
    { element: searchResultsContainer, name: 'search' },
    { element: deletePopup, name: 'delete' },
    { element: layerControlPanel, name: 'layers' }
  ];
  panels.forEach(panel => {
    if (panel.name !== panelToKeep && panel.element.classList.contains('visible')) {
      panel.element.classList.remove('visible');
    }
  });
}

function clearDemotedPanels() {
  stopInfoPanel.classList.remove('panel-demoted');
  suburbanStationPanel.classList.remove('panel-demoted');
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
        // only move if dragging upwards (negative delta)
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
        
        // threshold to close: -30px
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

// init circle settings and gestures
if (timerProgress) {
    timerProgress.style.strokeDasharray = `${circumference} ${circumference}`;
}
if (suburbanTimerProgress) {
    suburbanTimerProgress.style.strokeDasharray = `${circumference} ${circumference}`;
}
// Initialize the drag listener immediately
initNotificationGestures();