// ─── data usage panel + per-category kill switches ─────────────────────────
// tracks bytes for live/on-demand traffic only (trains sse+api, oasa+citybus+
// mybus, olp ferry schedule) - the one-time static geography bundles dont
// count since turning a category off never stops those anyway

function formatDataSize(bytes) {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function renderDataUsage() {
  dataUsageTrainsEl.textContent = formatDataSize(dataUsageBytes.trains);
  dataUsageBusesEl.textContent = formatDataSize(dataUsageBytes.buses);
  dataUsagePortsEl.textContent = formatDataSize(dataUsageBytes.ports);
  dataUsageTotalEl.textContent = formatDataSize(dataUsageBytes.trains + dataUsageBytes.buses + dataUsageBytes.ports);
}

function addDataUsage(category, bytes) {
  if (!category || !bytes) return;
  dataUsageBytes[category] += bytes;
  renderDataUsage();
}

// proxied calls carry the real target after ?url=, everything else (static
// json, tiles) is matched on its own url and wont hit any of these hosts
function classifyDataUsageUrl(url) {
  let target = url;
  if (url.startsWith(PROXY_URL)) {
    try { target = decodeURIComponent(url.slice(PROXY_URL.length)); } catch (err) { target = url; }
  }
  if (target.includes('railway.gov.gr')) return 'trains';
  if (target.includes('telematics.oasa.gr') || target.includes('citybus.gr') || target.includes('mybus.gr')) return 'buses';
  if (target.includes('olp.gr')) return 'ports';
  return null;
}

const nativeFetch = window.fetch.bind(window);
window.fetch = function (input, init) {
  const url = typeof input === 'string' ? input : input.url;
  const category = classifyDataUsageUrl(url);
  return nativeFetch(input, init).then((response) => {
    if (category) {
      const len = response.headers.get('content-length');
      if (len) {
        addDataUsage(category, parseInt(len, 10));
      } else {
        // no content-length through the proxy sometimes - clone and measure
        // the real body instead, doesnt touch what the caller reads
        response.clone().arrayBuffer().then((buf) => addDataUsage(category, buf.byteLength)).catch(() => {});
      }
    }
    return response;
  });
};

// ─── trains ──────────────────────────────────────────────────────────────
function disableTrainsData() {
  dataFeaturesEnabled.trains = false;
  stopTrainPositionStream();
  clearAllLiveTrainMarkers();
  if (suburbanStationPanel.classList.contains('visible') && currentSuburbanProperties) {
    fetchAndRenderSuburbanArrivals(currentSuburbanProperties, true);
  }
  if (trainTimetablePanel.classList.contains('visible')) {
    stopTimetableTelemetryStream();
    showFinalError(trainTimetableList, dataOffMessage('Trains'));
    markDataNeeded('trains');
  }
}

function enableTrainsData() {
  dataFeaturesEnabled.trains = true;
  clearDataNeeded('trains');
  startTrainPositionStream();
  if (suburbanStationPanel.classList.contains('visible') && currentSuburbanProperties) {
    showLoadingUI(document.getElementById('suburban-station-content'), 'Loading Live Data...', true);
    fetchAndRenderSuburbanArrivals(currentSuburbanProperties, true);
  }
  if (trainTimetablePanel.classList.contains('visible') && timetableHasLoadedOnce) {
    renderTimetableChips();
    renderTimetableList();
    startTimetableTelemetryStream();
  }
}

// ─── buses (oasa + citybus/mybus cities) ────────────────────────────────
function disableBusesData() {
  dataFeaturesEnabled.buses = false;
  if (plottedRoutes.length) clearRoutes([...plottedRoutes]);
  clearAllCityLiveMarkers();
  if (stopInfoPanel.classList.contains('visible')) stopInfoClose.click();
  if (cityStopPanel.classList.contains('visible')) cityStopClose.click();
  if (schedulePanel.classList.contains('visible')) scheduleClose.click();
}

function enableBusesData() {
  dataFeaturesEnabled.buses = true;
  clearDataNeeded('buses');
}

// ─── piraeus ports ───────────────────────────────────────────────────────
function disablePortsData() {
  dataFeaturesEnabled.ports = false;
  stopFerryCountdownTicker();
  if (ferryStationPanel.classList.contains('visible')) {
    showFinalError(ferryArrivalsList, dataOffMessage('Piraeus ports'));
    showFinalError(ferryDeparturesList, dataOffMessage('Piraeus ports'));
  }
}

function enablePortsData() {
  dataFeaturesEnabled.ports = true;
  clearDataNeeded('ports');
  if (ferryStationPanel.classList.contains('visible') && currentFerryGate) {
    showFerryInfo(currentFerryGate);
  }
}

// ─── "turn this on" attention highlight ─────────────────────────────────
const dataUsageRowByCategory = { trains: dataUsageRowTrains, buses: dataUsageRowBuses, ports: dataUsageRowPorts };

function syncDataUsageAttention() {
  const anyNeeded = dataUsageNeeded.trains || dataUsageNeeded.buses || dataUsageNeeded.ports;
  dataUsageButton.classList.toggle('pulse-attention', anyNeeded);
  Object.keys(dataUsageRowByCategory).forEach((category) => {
    dataUsageRowByCategory[category].classList.toggle('pulse-attention', dataUsageNeeded[category]);
  });
}

// called from wherever a sheet ends up showing dataOffMessage() instead of real data
function markDataNeeded(category) {
  dataUsageNeeded[category] = true;
  syncDataUsageAttention();
}

// called from that same sheet's close handler, and from turning the category back on
function clearDataNeeded(category) {
  dataUsageNeeded[category] = false;
  syncDataUsageAttention();
}

toggleTrainsData.addEventListener('change', (e) => (e.target.checked ? enableTrainsData() : disableTrainsData()));
toggleBusesData.addEventListener('change', (e) => (e.target.checked ? enableBusesData() : disableBusesData()));
togglePortsData.addEventListener('change', (e) => (e.target.checked ? enablePortsData() : disablePortsData()));

renderDataUsage();
