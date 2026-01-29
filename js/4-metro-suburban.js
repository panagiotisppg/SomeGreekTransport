const PROXY_URL = "https://oasa-proxy.panagot94.workers.dev/?url=";
// icon creators
function createMetroIcon(msym) {
  const size = 24;
  const center = size / 2;
  const rOuter = 9;
  const rOuterMulti = 10.5;
  const rWhite = 7.5;
  const rInner = 5.5;
  const strokeWidth = 1.5;
  let svgContent = '';
  const normalizedMsym = msym === 'NM3' ? 'M3' : msym;

  switch (normalizedMsym) {
    case 'M1': svgContent = `<circle cx="${center}" cy="${center}" r="${rOuter}" fill="${metroColors.green}" stroke="#fff" stroke-width="${strokeWidth}"/>`; break;
    case 'M2': svgContent = `<circle cx="${center}" cy="${center}" r="${rOuter}" fill="${metroColors.red}" stroke="#fff" stroke-width="${strokeWidth}"/>`; break;
    case 'M3': svgContent = `<circle cx="${center}" cy="${center}" r="${rOuter}" fill="${metroColors.blue}" stroke="#fff" stroke-width="${strokeWidth}"/>`; break;
    case 'M1+M2': svgContent = `<circle cx="${center}" cy="${center}" r="${rOuterMulti}" fill="${metroColors.green}" stroke="#fff" stroke-width="${strokeWidth}"/><circle cx="${center}" cy="${center}" r="${rWhite}" fill="#fff"/><circle cx="${center}" cy="${center}" r="${rInner}" fill="${metroColors.red}"/>`; break;
    case 'M1+M3': svgContent = `<circle cx="${center}" cy="${center}" r="${rOuterMulti}" fill="${metroColors.green}" stroke="#fff" stroke-width="${strokeWidth}"/><circle cx="${center}" cy="${center}" r="${rWhite}" fill="#fff"/><circle cx="${center}" cy="${center}" r="${rInner}" fill="${metroColors.blue}"/>`; break;
    case 'M2+M3': svgContent = `<circle cx="${center}" cy="${center}" r="${rOuterMulti}" fill="${metroColors.red}" stroke="#fff" stroke-width="${strokeWidth}"/><circle cx="${center}" cy="${center}" r="${rWhite}" fill="#fff"/><circle cx="${center}" cy="${center}" r="${rInner}" fill="${metroColors.blue}"/>`; break;
    default: svgContent = `<circle cx="${center}" cy="${center}" r="${rOuter}" fill="#888" stroke="#fff" stroke-width="${strokeWidth}"/>`;
  }
  return `<svg viewBox="0 0 ${size} ${size}" style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.4));">${svgContent}</svg>`;
}

function createSuburbanIcon() {
  const size = 16;
  const center = size / 2;
  const radius = 6;
  return `<svg viewBox="0 0 ${size} ${size}" style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.4));"><circle cx="${center}" cy="${center}" r="${radius}" fill="#fff" stroke="#333" stroke-width="1.5"/></svg>`;
}

// panel display logic
function showMetroInfo(properties) {
  clearDemotedPanels();
  stopTimer();
  stopSuburbanTimer();
  if (selectedStopMarker) {
    map.removeLayer(selectedStopMarker);
    selectedStopMarker = null;
  }
  if (selectedHeadingMarker) {
    map.removeLayer(selectedHeadingMarker);
    selectedHeadingMarker = null;
  }
  stopInfoPanel.classList.remove("visible");
  suburbanStationPanel.classList.remove("visible");
  schedulePanel.classList.remove("visible");

  const iconHtml = createMetroIcon(properties.MSYM);
  metroStationTitle.innerHTML = `<div class="metro-panel-icon">${iconHtml}</div><span>${properties.GNAME}</span>`;
  const normalizedMsym = properties.MSYM === 'NM3' ? 'M3' : properties.MSYM;
  const lines = normalizedMsym.split('+');
  const coloredLinesHtml = lines.map(line => {
    let color = '#333';
    if (line === 'M1') color = metroColors.green;
    if (line === 'M2') color = metroColors.red;
    if (line === 'M3') color = metroColors.blue;
    return `<span style="color: ${color};">${line}</span>`;
  }).join(' & ');
  metroStationLines.innerHTML = coloredLinesHtml;
  metroStationPanel.classList.add("visible");
}

async function showSuburbanInfo(properties) {
  clearDemotedPanels();
  stopTimer();
  stopSuburbanTimer();
  stopInfoPanel.classList.remove("visible");
  metroStationPanel.classList.remove("visible");
  schedulePanel.classList.remove("visible");
  currentSuburbanProperties = properties;
  suburbanStationTitle.textContent = properties.NAME;
  suburbanStationPanel.classList.add("visible");
  if (selectedStopMarker) {
    map.removeLayer(selectedStopMarker);
    selectedStopMarker = null;
  }
  if (selectedHeadingMarker) {
    map.removeLayer(selectedHeadingMarker);
    selectedHeadingMarker = null;
  }
  const contentArea = document.getElementById("suburban-station-content");
  showLoadingUI(contentArea, "Loading Live Arrivals...", true);
  await fetchAndDisplaySuburbanData();
}

async function fetchAndDisplaySuburbanData() {
  const contentArea = document.getElementById("suburban-station-content");
  const stationId = suburbanStationCodes[currentSuburbanProperties.NAME];
  const loaderContainer = contentArea.querySelector(".loader-container");
  const loaderBar = contentArea.querySelector(".loader-bar-fill");

  if (!stationId) {
    contentArea.innerHTML = `<div class="info-message">Live data is not available for this station.</div>`;
    return;
  }
  const apiUrl = `${PROXY_URL}${encodeURIComponent(`https://ose.mpass.ltd/api/v1/screens/${stationId}/data/multilingual?t=${Date.now()}`)}`;

  try {
    if (loaderBar) loaderBar.style.width = '30%';
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error('Network response was not ok');
    if (loaderBar) loaderBar.style.width = '70%';
    const data = await response.json();
    if (loaderBar) loaderBar.style.width = '100%';
    if (loaderContainer) loaderContainer.classList.add("fading-out");
    await new Promise(resolve => setTimeout(resolve, 400));
    contentArea.innerHTML = '';

    if (data.routes && data.routes.length > 0) {
      data.routes.sort((a, b) => {
        const timeA = new Date(a.routesEl.DR_FORECASTED_DATE.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$2/$1/$3'));
        const timeB = new Date(b.routesEl.DR_FORECASTED_DATE.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$2/$1/$3'));
        return timeA - timeB;
      });

      let tableHtml = `<table class="suburban-table"><thead><tr><th>ΕΤΑΙΡΕΙΑ</th><th>ΑΜΑΞ/ΧΙΑ</th><th>ΑΠΟ - ΠΡΟΣ</th><th>ΠΛΑΤΦ.</th><th>ΑΦΙΞΗ</th><th>ΑΝΑΧΩΡ.</th><th>ΚΑΘΥΣΤ.</th></tr></thead><tbody>`;
      const tableRowsHtml = data.routes.map(route => {
        const routeInfo = route.routesEl;
        const delayMinutes = parseInt(routeInfo.PREVIOUSDELAY9, 10);
        let scheduledArrival = routeInfo.DR_TANA ? routeInfo.DR_TANA.trim() : '-';
        let scheduledDeparture = routeInfo.DR_TAFIX ? routeInfo.DR_TAFIX.trim() : '-';
        if (scheduledArrival !== '-' && scheduledDeparture !== '-') {
          const arrivalValue = parseFloat(scheduledArrival.replace(':', '.'));
          const departureValue = parseFloat(scheduledDeparture.replace(':', '.'));
          if (arrivalValue > departureValue) [scheduledArrival, scheduledDeparture] = [scheduledDeparture, scheduledArrival];
        }
        let arrivalHtml = scheduledArrival;
        let departureHtml = scheduledDeparture;
        let delayContent = '-';
        let rowClass = '';
        if (delayMinutes > 0) {
          rowClass = 'class="delayed"';
          const forecastedTime = routeInfo.DR_FORECASTED_DATE.split(' ')[1];
          if (scheduledArrival !== '-') arrivalHtml = `<span class="scheduled-time">${scheduledArrival}</span> <span class="forecasted-time">${forecastedTime}</span>`;
          if (scheduledDeparture !== '-') departureHtml = `<span class="scheduled-time">${scheduledDeparture}</span> <span class="forecasted-time">${forecastedTime}</span>`;
          if (routeInfo.PREVIOUSDELAY) {
            const delayReason = routeInfo.PREVIOUSDELAY.split('-').slice(1).join('-').trim().replace(/"/g, '&quot;');
            delayContent = `<span class="delay-text">${delayMinutes}'</span><sup class="delay-info-icon" data-reason="${delayReason}" title="Show delay reason">i</sup>`;
          } else {
            delayContent = `<span class="delay-text">${delayMinutes}'</span>`;
          }
        }
        return `<tr ${rowClass}><td class="company-cell">${routeInfo.RUP}</td><td>${routeInfo.TRENO.trim()}</td><td class="from-to-cell">${routeInfo.FROMTO}</td><td>${routeInfo.DR_PLATFORM}</td><td>${arrivalHtml}</td><td>${departureHtml}</td><td class="delay-cell">${delayContent}</td></tr>`;
      }).join('');
      tableHtml += tableRowsHtml + `</tbody></table>`;
      contentArea.innerHTML = tableHtml;

      contentArea.querySelectorAll('.delay-info-icon').forEach(icon => {
        icon.addEventListener('click', (event) => {
          event.stopPropagation();
          const reason = event.target.dataset.reason;
          const iconRect = event.target.getBoundingClientRect();
          delayTooltip.textContent = reason;
          delayTooltip.style.opacity = '1';
          delayTooltip.style.pointerEvents = 'auto';
          const tooltipRect = delayTooltip.getBoundingClientRect();
          const screenEdgeMargin = 10;
          let finalLeft;
          const desiredLeft = iconRect.left + (iconRect.width / 2) - (tooltipRect.width / 2);
          if (desiredLeft + tooltipRect.width > window.innerWidth) {
            finalLeft = window.innerWidth - tooltipRect.width - screenEdgeMargin;
          } else if (desiredLeft < 0) {
            finalLeft = screenEdgeMargin;
          } else {
            finalLeft = desiredLeft;
          }
          delayTooltip.style.left = `${finalLeft}px`;
          delayTooltip.style.top = `${iconRect.top - tooltipRect.height - 5}px`;
        });
      });
    } else {
      showNoSuburbanArrivalsUI(contentArea, "No upcoming arrivals.");
    }
  } catch (error) {
    console.error("Failed to fetch suburban arrivals:", error);
    contentArea.innerHTML = `<div class="info-message">Could not retrieve live data.</div>`;
  } finally {
    startSuburbanTimer();
  }
}

// timers
function startSuburbanTimer() {
  stopSuburbanTimer();
  if (!currentSuburbanProperties) return;
  suburbanRefreshContainer.classList.add('visible');
  let timeLeft = suburbanRefreshDuration;
  function updateTimer() {
    const progress = timeLeft / suburbanRefreshDuration;
    const offset = circumference * (1 - progress);
    suburbanTimerProgress.style.strokeDashoffset = offset;
    suburbanTimerText.textContent = timeLeft;
    if (timeLeft <= 0) {
      stopSuburbanTimer();
      const contentArea = document.getElementById("suburban-station-content");
      showLoadingUI(contentArea, "Loading Live Arrivals...", true);
      (async () => { await fetchAndDisplaySuburbanData(); })();
    }
  }
  suburbanRefreshIntervalId = setInterval(() => { timeLeft--; updateTimer(); }, 1000);
  updateTimer();
}

function stopSuburbanTimer() {
  if (suburbanRefreshIntervalId) {
    clearInterval(suburbanRefreshIntervalId);
    suburbanRefreshIntervalId = null;
  }
  suburbanRefreshContainer.classList.remove('visible');
}

// listeners
suburbanStationClose.addEventListener('click', () => {
  suburbanStationPanel.classList.remove('visible');
  stopSuburbanTimer();
});

suburbanStationRefresh.addEventListener('click', async () => {
  if (currentSuburbanProperties) {
    stopSuburbanTimer();
    const contentArea = document.getElementById("suburban-station-content");
    showLoadingUI(contentArea, "Loading Live Arrivals...", true);
    await fetchAndDisplaySuburbanData();
  }
});

metroStationClose.addEventListener('click', () => {
  metroStationPanel.classList.remove('visible');
  stopTimer();
  stopSuburbanTimer();
});