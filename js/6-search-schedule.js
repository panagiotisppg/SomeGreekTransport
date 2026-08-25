// panel logic
async function showSchedulePanel(lineData) {
  if (stopInfoPanel.classList.contains('visible')) {
    stopInfoPanel.classList.add('panel-demoted');
  }
  if (cityStopPanel.classList.contains('visible')) {
    cityStopPanel.classList.add('panel-demoted');
  }
  if (suburbanStationPanel.classList.contains('visible')) {
    suburbanStationPanel.classList.remove('visible');
    stopSuburbanTimer();
  }
  updateButtonPosition();
  schedulePanel.classList.add("visible");
  scheduleLoadingOverlay.classList.add("visible");
  scheduleProgressBar.style.width = "0%";

  scheduleTitle.innerHTML = `<div class="line-id-pill">${lineData.LineID}</div><span>${lineData.LineDescrEng}</span>`;
  scheduleRoutesTitle.innerHTML = `Routes of <div class="line-id-pill">${lineData.LineID}</div>:`;

  if (!dataFeaturesEnabled.buses) {
    scheduleLoadingOverlay.classList.remove("visible");
    goTimesSection.style.display = "block";
    comeTimesSection.style.display = "none";
    scheduleGoTimes.innerHTML = `<div class="info-message">${dataOffMessage('Bus data')}</div>`;
    markDataNeeded('buses');
    return;
  }

  const scheduleUrl = `${PROXY_URL}${encodeURIComponent(`https://telematics.oasa.gr/api/?act=getDailySchedule&line_code=${lineData.LineCode}&t=${Date.now()}`)}`;
  const routesForLineUrl = `${PROXY_URL}${encodeURIComponent(`https://telematics.oasa.gr/api/?act=getRoutesForLine&p1=${lineData.LineCode}&t=${Date.now()}`)}`;
  
  try {
    setTimeout(() => { scheduleProgressBar.style.width = "30%"; }, 50);
    const [scheduleResponse, routesResponse] = await Promise.all([
      fetch(scheduleUrl),
      fetch(routesForLineUrl),
    ]);
    scheduleProgressBar.style.width = "70%";
    const scheduleData = await scheduleResponse.json();
    const routesData = await routesResponse.json();
    goTimesSection.style.display = scheduleData.go && scheduleData.go.length > 0 ? "block" : "none";
    comeTimesSection.style.display = scheduleData.come && scheduleData.come.length > 0 ? "block" : "none";
    populateScheduleTimes(scheduleGoTimes, scheduleData.go, "sde_start1");
    populateScheduleTimes(scheduleComeTimes, scheduleData.come, "sde_start2");
    populateScheduleRoutes(routesData, lineData.LineID);
    scheduleProgressBar.style.width = "100%";
    setTimeout(() => { scheduleLoadingOverlay.classList.remove("visible"); }, 500);
  } catch (error) {
    console.error("Failed to fetch schedule data:", error);
    scheduleLoadingOverlay.classList.remove("visible");
    goTimesSection.style.display = "block";
    comeTimesSection.style.display = "block";
    scheduleGoTimes.innerHTML = `<div class="info-message">Could not load schedule.</div>`;
    scheduleComeTimes.innerHTML = `<div class="info-message">Could not load schedule.</div>`;
    scheduleRoutesList.innerHTML = `<div class="info-message">Could not load routes.</div>`;
  }
}

function populateScheduleTimes(container, timesArray, timeKey) {
  container.innerHTML = "";
  if (!timesArray || timesArray.length === 0) {
    container.innerHTML = `<div class="info-message">No departures scheduled.</div>`;
    return;
  }
  const now = new Date();
  const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
  let nextDepartureElement = null;
  for (const t of timesArray) {
    if (!t[timeKey]) continue;
    const timeStr = t[timeKey].split(" ")[1].substring(0, 5);
    const [hours, minutes] = timeStr.split(":");
    const departureTimeInMinutes = parseInt(hours, 10) * 60 + parseInt(minutes, 10);
    const timePill = document.createElement("div");
    timePill.className = "time-pill";
    timePill.textContent = timeStr;
    container.appendChild(timePill);
    if (!nextDepartureElement && departureTimeInMinutes >= currentTimeInMinutes) {
      nextDepartureElement = timePill;
    }
  }
  if (!nextDepartureElement && container.firstChild) {
    nextDepartureElement = container.firstChild;
  }
  if (nextDepartureElement) {
    nextDepartureElement.classList.add("highlighted");
    setTimeout(() => {
      nextDepartureElement.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest", });
    }, 300);
  }
}

// only one route's stop list open at a time - reset whenever a fresh line is opened
let expandedScheduleRouteItem = null;
let routeStopsBusRefreshId = null;

async function fetchRouteStops(routeCode) {
  const url = `${PROXY_URL}${encodeURIComponent(`https://telematics.oasa.gr/api/?act=webGetStops&p1=${routeCode}`)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`route stops fetch failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchRouteBusLocationsForTimeline(routeCode) {
  const url = `${PROXY_URL}${encodeURIComponent(`https://telematics.oasa.gr/api/?act=getBusLocation&p1=${routeCode}&t=${Date.now()}`)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data
    .map((b) => ({ vehNo: b.VEH_NO, lat: parseFloat(b.CS_LAT), lng: parseFloat(b.CS_LNG) }))
    .filter((b) => b.lat && b.lng);
}

function renderRouteStopsTimeline(stops) {
  const sorted = [...stops].sort((a, b) => parseInt(a.RouteStopOrder, 10) - parseInt(b.RouteStopOrder, 10));
  const rows = sorted.map((stop) => `<div class="route-stop" data-stop-code="${stop.StopCode}"><div class="route-stop-track"><div class="route-stop-dot"></div></div><div class="route-stop-body"><span class="route-stop-name">${stop.StopDescrEng || stop.StopDescr}</span></div></div>`).join('');
  return `<div class="route-timeline">${rows}</div>`;
}

// opens the real stop info panel for a stop tapped in this timeline, same
// lookup-by-StopCode fallback pattern as a plotted-route stop marker
function openTimelineStop(stop) {
  openStopInfoFromPlottedMarker(stop, parseFloat(stop.StopLng), parseFloat(stop.StopLat));
}

function wireTimelineStopClicks(container, sortedStops) {
  container.querySelectorAll('.route-stop').forEach((el, i) => {
    el.addEventListener('click', () => openTimelineStop(sortedStops[i]));
  });
}

// a "kyklikes" (circular) route ends back near where it started - roughly
// a 3-block loop closure, per the OASA route naming convention
const CIRCULAR_ROUTE_ENDPOINT_METERS = 350;

function isCircularRoute(sortedStops) {
  if (sortedStops.length < 2) return false;
  const first = sortedStops[0];
  const last = sortedStops[sortedStops.length - 1];
  const d = distanceMeters(
    { lat: parseFloat(first.StopLat), lng: parseFloat(first.StopLng) },
    { lat: parseFloat(last.StopLat), lng: parseFloat(last.StopLng) }
  );
  return d <= CIRCULAR_ROUTE_ENDPOINT_METERS;
}

// on a loop, the outbound and return legs can run down parallel streets -
// two stops close in distance but far apart in the stop sequence. only
// flag it as ambiguous when a second candidate is both nearly as close
// and clearly not just the next stop over
const CIRCULAR_AMBIGUITY_RADIUS_METERS = 120;
const CIRCULAR_AMBIGUITY_MIN_INDEX_GAP = 3;

function findAmbiguousStopIdx(dists, bestIdx) {
  for (let i = 0; i < dists.length; i++) {
    if (i === bestIdx) continue;
    if (Math.abs(i - bestIdx) < CIRCULAR_AMBIGUITY_MIN_INDEX_GAP) continue;
    if (dists[i] <= CIRCULAR_AMBIGUITY_RADIUS_METERS && dists[i] <= dists[bestIdx] * 1.6) {
      return i;
    }
  }
  return null;
}

async function fetchStopArrivalVehCodes(stopCode) {
  const url = `${PROXY_URL}${encodeURIComponent(`https://telematics.oasa.gr/api/?act=getStopArrivals&p1=${stopCode}&t=${Date.now()}`)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.map((a) => a.veh_code) : [];
  } catch (err) {
    return [];
  }
}

// disambiguates two geometrically-close-but-sequence-distant stops by
// checking which one's own live arrivals actually list this vehicle
async function resolveCircularAmbiguity(bus, idxA, idxB, sortedStops) {
  const [arrivalsA, arrivalsB] = await Promise.all([
    fetchStopArrivalVehCodes(sortedStops[idxA].StopCode),
    fetchStopArrivalVehCodes(sortedStops[idxB].StopCode),
  ]);
  if (arrivalsA.includes(bus.vehNo)) return idxA;
  if (arrivalsB.includes(bus.vehNo)) return idxB;
  return null;
}

// nearest stop by straight-line distance, then blends toward whichever
// neighbor is second-closest to get a fractional position between the two.
// on circular routes, a genuinely ambiguous nearby stop gets resolved via
// live arrivals instead of trusting geometry alone
async function estimateBusTimelineIndex(bus, sortedStops, circular) {
  const dists = sortedStops.map((s) => distanceMeters(bus, { lat: parseFloat(s.StopLat), lng: parseFloat(s.StopLng) }));
  let bestIdx = 0;
  dists.forEach((d, i) => { if (d < dists[bestIdx]) bestIdx = i; });

  if (circular) {
    const altIdx = findAmbiguousStopIdx(dists, bestIdx);
    if (altIdx !== null) {
      const resolvedIdx = await resolveCircularAmbiguity(bus, bestIdx, altIdx, sortedStops);
      if (resolvedIdx !== null) bestIdx = resolvedIdx;
    }
  }

  const prevDist = bestIdx > 0 ? dists[bestIdx - 1] : Infinity;
  const nextDist = bestIdx < dists.length - 1 ? dists[bestIdx + 1] : Infinity;
  if (nextDist <= prevDist && bestIdx < dists.length - 1) {
    const d1 = dists[bestIdx], d2 = dists[bestIdx + 1];
    return bestIdx + d1 / (d1 + d2 || 1);
  } else if (bestIdx > 0) {
    const d1 = dists[bestIdx - 1], d2 = dists[bestIdx];
    return (bestIdx - 1) + d1 / (d1 + d2 || 1);
  }
  return bestIdx;
}

async function renderBusMarkersOnTimeline(detailsEl, buses, sortedStops) {
  const countEl = detailsEl.querySelector('.route-bus-count');
  if (countEl) countEl.textContent = `${buses.length} live bus${buses.length === 1 ? '' : 'es'} on the route`;
  const container = detailsEl.querySelector('.route-timeline');
  const stopEls = container.querySelectorAll('.route-stop');
  if (!stopEls.length) return;

  const circular = isCircularRoute(sortedStops);
  const indices = await Promise.all(buses.map((bus) => estimateBusTimelineIndex(bus, sortedStops, circular)));

  // markers are kept and moved between refreshes (not wiped and redrawn)
  // so the css top transition can animate them sliding to the new spot
  // instead of hard-cutting to it
  if (!container._busMarkersByVeh) container._busMarkersByVeh = new Map();
  const markersByVeh = container._busMarkersByVeh;
  const seenVehs = new Set();

  buses.forEach((bus, i) => {
    let entry = markersByVeh.get(bus.vehNo);
    let idx = indices[i];
    // even a correctly-resolved position can wobble stop-to-stop off gps
    // noise, and a misjudged one can jump way back - either way a bus
    // sliding backwards up the line reads as broken, so this floor never
    // lets it regress below where it was last drawn
    if (entry && idx < entry.lastIdx) idx = entry.lastIdx;

    const lowerEl = stopEls[Math.min(Math.floor(idx), stopEls.length - 1)];
    const upperEl = stopEls[Math.min(Math.floor(idx) + 1, stopEls.length - 1)];
    const frac = idx - Math.floor(idx);
    const top = lowerEl.offsetTop + (upperEl.offsetTop - lowerEl.offsetTop) * frac + 7;
    seenVehs.add(bus.vehNo);

    if (!entry) {
      const marker = document.createElement('div');
      marker.className = 'route-bus-marker';
      marker.title = `Bus ${bus.vehNo}`;
      marker.innerHTML = busGlyphIconSvg;
      marker.style.top = `${top}px`;
      // prepended, not appended - keeps the last .route-stop as the
      // container's actual last-child so its connector line stays hidden
      container.prepend(marker);
      entry = { el: marker, lastIdx: idx };
      markersByVeh.set(bus.vehNo, entry);
    } else {
      entry.el.style.top = `${top}px`;
      entry.lastIdx = idx;
    }
  });

  markersByVeh.forEach((entry, vehNo) => {
    if (!seenVehs.has(vehNo)) {
      entry.el.remove();
      markersByVeh.delete(vehNo);
    }
  });
}

function stopRouteStopsBusRefresh() {
  if (routeStopsBusRefreshId) {
    clearInterval(routeStopsBusRefreshId);
    routeStopsBusRefreshId = null;
  }
}

function startRouteStopsBusRefresh(detailsEl, routeCode, sortedStops) {
  stopRouteStopsBusRefresh();
  const tick = async () => {
    try {
      const buses = await fetchRouteBusLocationsForTimeline(routeCode);
      await renderBusMarkersOnTimeline(detailsEl, buses, sortedStops);
    } catch (err) {
      console.error('Failed to load route bus locations:', err);
    }
  };
  tick();
  routeStopsBusRefreshId = setInterval(tick, 7000);
}

function collapseScheduleRouteItem(item) {
  item.classList.remove('expanded');
  item.querySelector('.schedule-route-expand-btn').classList.remove('expanded');
  if (expandedScheduleRouteItem === item) {
    expandedScheduleRouteItem = null;
    stopRouteStopsBusRefresh();
  }
}

async function toggleScheduleRouteStops(item, routeCode) {
  if (expandedScheduleRouteItem && expandedScheduleRouteItem !== item) {
    collapseScheduleRouteItem(expandedScheduleRouteItem);
  }
  if (item.classList.contains('expanded')) {
    collapseScheduleRouteItem(item);
    return;
  }
  const detailsEl = item.querySelector('.schedule-route-stops-details');
  item.classList.add('expanded');
  item.querySelector('.schedule-route-expand-btn').classList.add('expanded');
  expandedScheduleRouteItem = item;
  if (!detailsEl.dataset.loaded) {
    detailsEl.innerHTML = `<div class="info-message">Loading stops...</div>`;
    try {
      const stops = await fetchRouteStops(routeCode);
      if (!stops.length) throw new Error('empty');
      const sortedStops = [...stops].sort((a, b) => parseInt(a.RouteStopOrder, 10) - parseInt(b.RouteStopOrder, 10));
      detailsEl.innerHTML = `<div class="route-bus-count"></div>` + renderRouteStopsTimeline(sortedStops);
      detailsEl.dataset.loaded = "1";
      detailsEl._sortedStops = sortedStops;
      wireTimelineStopClicks(detailsEl, sortedStops);
      startRouteStopsBusRefresh(detailsEl, routeCode, sortedStops);
    } catch (err) {
      console.error('Failed to load route stops:', err);
      detailsEl.innerHTML = `<div class="info-message">Could not load stops.</div>`;
    }
  } else if (detailsEl._sortedStops) {
    // already loaded from a previous expand - just resume the live bus refresh
    startRouteStopsBusRefresh(detailsEl, routeCode, detailsEl._sortedStops);
  }
}

function populateScheduleRoutes(routesArray, lineID) {
  scheduleRoutesList.innerHTML = "";
  expandedScheduleRouteItem = null;
  stopRouteStopsBusRefresh();
  if (!routesArray || routesArray.length === 0) {
    scheduleRoutesList.innerHTML = `<div class="info-message">No routes found.</div>`;
    return;
  }
  routesArray.forEach((route) => {
    const routeItem = document.createElement("div");
    routeItem.className = "schedule-route-item";
    routeItem.innerHTML = `<div class="schedule-route-row"><button class="schedule-route-expand-btn" title="Show stops">${chevronDownIconSvg}</button><div class="line-id-pill">${lineID}</div><div class="schedule-route-descr">${route.route_descr_eng}</div><button class="plot-route-icon-btn schedule-plot-btn visible" data-route-code="${route.route_code}">${plotRouteIconSvg}</button></div><div class="schedule-route-stops-details"></div>`;
    routeItem.querySelector(".schedule-route-expand-btn").addEventListener("click", () => {
      toggleScheduleRouteStops(routeItem, route.route_code);
    });
    routeItem.querySelector(".schedule-plot-btn").addEventListener("click", () => {
      const routeCodeToCheck = route.route_code;
      const routeName = `${lineID} ${route.route_descr_eng}`;
      const existingRoute = plottedRoutes.find(r => r.routeCode === routeCodeToCheck);
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
      plotAnimatedRoute(route.route_code, lineID, route.route_descr_eng);
    });
    scheduleRoutesList.appendChild(routeItem);
  });
  // update state immediately to gray out buttons if needed
  updateArrivalsUIState();
}

// train/suburban names disagree with toGreeklish on a couple letters (eta
// as "i" not "h") - hubs translated outright (eg "Airport") get an explicit alias
const trainStopNameAliases = {
  'αεροδρόμιο': 'airport',
  'αθήνα': 'athens',
  'πειραιάς': 'piraeus',
};
function toGreeklishAltSpelling(text) {
  return text.toLowerCase().split('').map((char) => {
    if (char === 'η' || char === 'ή') return 'i';
    if (char === 'χ') return 'ch';
    return greeklishMap[char] || char;
  }).join('');
}
function trainStopSearchVariants(query) {
  const lower = query.toLowerCase();
  return [lower, toGreeklish(lower), toGreeklishAltSpelling(lower), trainStopNameAliases[lower]].filter(Boolean);
}

// search logic
function handleSearch() {
  const query = searchInput.value.toLowerCase();
  const searchType = document.querySelector('input[name="search-type"]:checked').value;
  if (query.length === 0) {
    renderDefaultList();
    return;
  }
  if (searchType === "lines") {
    const queryForId = toGreeklish(query);
    let results = allLinesData.filter((line) => toGreeklish(line.LineID).toLowerCase().includes(queryForId));
    if (results.length === 0) {
      results = allLinesData.filter((line) => line.LineDescr.toLowerCase().includes(query) || line.LineDescrEng.toLowerCase().includes(query));
    }
    results.sort((a, b) => {
      const aStarts = toGreeklish(a.LineID).toLowerCase().startsWith(queryForId);
      const bStarts = toGreeklish(b.LineID).toLowerCase().startsWith(queryForId);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return naturalSort(a.LineID, b.LineID);
    });
    renderSearchResults(results, "lines");
  } else {
    let busResults = mergedStopsGeoJSON.features.filter((feature) => feature.properties.stop_descr.toLowerCase().includes(query) || toGreeklish(feature.properties.stop_descr).toLowerCase().includes(query));
    let busMatchedViaStreetOnly = false;
    if (busResults.length === 0) {
      busResults = mergedStopsGeoJSON.features.filter((feature) => {
        const street = stopStreetmap.get(feature.properties.StopCode) || "";
        return (street.toLowerCase().includes(query) || toGreeklish(street).toLowerCase().includes(query));
      });
      busMatchedViaStreetOnly = true;
    }
    const trainResults = suburbanStopsGeoJSON.features.filter((feature) => {
      const nameGreek = (feature.properties.nameGreek || '').toLowerCase();
      if (nameGreek && nameGreek.includes(query)) return true;
      const name = (feature.properties.name || '').toLowerCase();
      return trainStopSearchVariants(query).some((variant) => name.includes(variant));
    });

    // ranks exact/starts-with/contains/street-only matches the same way for
    // both types - scores every alias variant, not just the raw query, so trains dont lose ties
    const bestScore = (name, variants) => {
      let best = null;
      variants.forEach((variant) => {
        if (!variant || !name) return;
        const score = name === variant ? 0 : name.startsWith(variant) ? 1 : name.includes(variant) ? 2 : null;
        if (score !== null && (best === null || score < best)) best = score;
      });
      return best;
    };
    const greeklishQuery = toGreeklish(query);
    const rank = (item) => {
      if (item.properties.groups !== undefined) {
        const nameGreek = (item.properties.nameGreek || '').toLowerCase();
        const name = (item.properties.name || '').toLowerCase();
        const greekScore = nameGreek ? bestScore(nameGreek, [query]) : null;
        const latinScore = bestScore(name, trainStopSearchVariants(query));
        const scores = [greekScore, latinScore].filter((s) => s !== null);
        return scores.length ? Math.min(...scores) : 3;
      }
      if (busMatchedViaStreetOnly) return 3;
      const name = item.properties.stop_descr.toLowerCase();
      const score = bestScore(name, [query, greeklishQuery]);
      return score === null ? 3 : score;
    };
    const displayName = (item) => (item.properties.stop_descr || item.properties.nameGreek || item.properties.name || '').toLowerCase();
    const combined = [...busResults, ...trainResults];
    combined.sort((a, b) => rank(a) - rank(b) || displayName(a).localeCompare(displayName(b)));
    renderSearchResults(combined, "stops");
  }
}

function renderDefaultList() {
  const searchType = document.querySelector('input[name="search-type"]:checked').value;
  if (searchType === "lines") {
    const uniqueLines = new Map();
    allLinesData.forEach((line) => {
      if (!uniqueLines.has(line.LineID)) {
        uniqueLines.set(line.LineID, line);
      }
    });
    const sortedLines = [...uniqueLines.values()].sort((a, b) => naturalSort(a.LineID, b.LineID));
    renderSearchResults(sortedLines, "lines");
  } else {
    searchResultsContainer.innerHTML = "";
    searchResultsContainer.classList.remove("visible");
  }
}

function renderSearchResults(results, type) {
  const plottedStopStatusMap = new Map();
  plottedRoutes.forEach((route) => {
    route.stops.forEach((stop) => {
      const stopCode = stop.StopCode;
      if (!plottedStopStatusMap.has(stopCode)) {
        plottedStopStatusMap.set(stopCode, new Set());
      }
      plottedStopStatusMap.get(stopCode).add(route.color);
    });
  });

  searchResultsContainer.innerHTML = "";
  if (results.length > 0) {
    results.forEach((item) => {
      const row = document.createElement("div");
      row.className = "search-result-row";
      if (type === "lines") {
        row.innerHTML = `<div class="line-id-pill">${item.LineID}</div><div class="schedule-route-descr">${item.LineDescrEng}</div><button class="search-result-info-button">Info</button>`;
        row.querySelector(".search-result-info-button").onclick = (e) => {
          e.stopPropagation();
          clearAndHideSearch();
          showSchedulePanel(item);
        };
      } else if (item.properties.groups !== undefined) {
        // train/suburban stop - same pie-chart dot as its map marker, line
        // pills instead of a street since this dataset has no street data
        const groups = item.properties.groups || [];
        const iconHtml = createSuburbanIcon(groups).replace('<svg ', '<svg class="search-result-icon" ');
        const pillsHtml = groups
          .map((g) => `<span class="suburban-line-pill" style="background:${suburbanGroupColors.get(g) || '#64748b'}">${g}</span>`)
          .join('');
        row.innerHTML = `${iconHtml}<div class="search-result-name">${item.properties.name}</div><div class="search-result-lines">${pillsHtml}</div>`;
        row.onclick = () => {
          const coords = item.geometry.coordinates;
          map.flyTo({ center: coords, zoom: 16, duration: 750 });
          showSuburbanInfo(item.properties);
          clearAndHideSearch();
        };
      } else {
        const stopCode = item.properties.StopCode;
        const street = stopStreetmap.get(stopCode) || "";
        const statusSet = plottedStopStatusMap.get(stopCode);
        let iconHtml = '<svg class="search-result-icon" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="#003366" stroke="white" stroke-width="1"/></svg>';
        if (statusSet) {
          if (statusSet.size > 1) {
            iconHtml = createSharedStopIconSvg().replace('<svg ', '<svg class="search-result-icon" ');
          } else {
            const color = statusSet.values().next().value;
            iconHtml = `<svg class="search-result-icon" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="${colorHex[color]}" stroke="white" stroke-width="1"/></svg>`;
          }
        }
        row.innerHTML = `${iconHtml}<div class="search-result-name">${item.properties.stop_descr}</div><div class="search-result-stop-street">(Street: ${street})</div>`;
        row.onclick = () => {
          if (selectedStopMarker) selectedStopMarker.remove();
          if (selectedHeadingMarker) selectedHeadingMarker.remove();
          const lngLat = item.geometry.coordinates;
          map.flyTo({ center: lngLat, zoom: 17, duration: 750 });
          const stopProps = item.properties;
          stopProps.stop_street = street;
          currentStopProperties = stopProps;
          const style = getSelectedStopStyle();
          selectedStopMarker = new maplibregl.Marker({ element: createDotMarkerElement(style.radius * 2, style.fillColor, { strokeWidth: style.weight }) })
            .setLngLat(lngLat)
            .addTo(map);
          showStopInfo(currentStopProperties);
          clearAndHideSearch();
        };
      }
      searchResultsContainer.appendChild(row);
    });
    searchResultsContainer.classList.add("visible");
  } else {
    searchResultsContainer.innerHTML = `<div class="info-message">No results found.</div>`;
    searchResultsContainer.classList.add("visible");
  }
}

function clearAndHideSearch() {
  searchInput.value = "";
  searchResultsContainer.classList.remove("visible");
  // a tapped result is rarely itself focusable, so the input keeps focus
  // and ios keeps the keyboard/zoom-in state around unless told to let go
  searchInput.blur();
}

// listeners
searchInput.addEventListener("input", handleSearch);
searchToggle.addEventListener("change", (e) => {
  searchInput.placeholder = e.target.value === "lines" ? "Search for a bus line..." : "Search for a bus or train/suburban stop...";
  clearAndHideSearch();
});
function onSearchFocus() {
  manageOpenPanels('search');
  closeAllInfoPanels();
  if (searchInput.value.length > 0) {
    handleSearch();
  } else {
    renderDefaultList();
  }
}
searchInput.addEventListener("focus", onSearchFocus);

scheduleClose.addEventListener("click", () => {
  schedulePanel.classList.remove("visible");
  clearDemotedPanels();
  clearDataNeeded('buses');
  stopRouteStopsBusRefresh();
  expandedScheduleRouteItem = null;
});

function updateButtonPosition() {
  setTimeout(() => {
    if (window.innerWidth > 768) {
      customControlsContainer.style.top = "12px";
      if (schedulePanel.classList.contains('visible')) {
        customControlsContainer.style.left = '370px';
      } else {
        customControlsContainer.style.left = '10px';
      }
      return; 
    }
    if (searchResultsContainer.classList.contains("visible") && searchResultsContainer.offsetHeight > 0) {
      const resultsRect = searchResultsContainer.getBoundingClientRect();
      const newTop = resultsRect.bottom + 10;
      customControlsContainer.style.top = `${newTop}px`;
    } else {
      // mobile search bar spans nearly the full width - aligning the button
      // stack like on desktop would overlap it, so it sits below instead
      const searchRect = searchContainer.getBoundingClientRect();
      customControlsContainer.style.top = `${searchRect.bottom + 10}px`;
    }
  }, 50);
}
const observer = new MutationObserver(updateButtonPosition);
observer.observe(searchResultsContainer, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true, });
window.addEventListener("resize", updateButtonPosition);