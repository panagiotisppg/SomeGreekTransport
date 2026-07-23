// panel logic
async function showSchedulePanel(lineData) {
  if (stopInfoPanel.classList.contains('visible')) {
    stopInfoPanel.classList.add('panel-demoted');
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

function populateScheduleRoutes(routesArray, lineID) {
  scheduleRoutesList.innerHTML = "";
  if (!routesArray || routesArray.length === 0) {
    scheduleRoutesList.innerHTML = `<div class="info-message">No routes found.</div>`;
    return;
  }
  routesArray.forEach((route) => {
    const routeRow = document.createElement("div");
    routeRow.className = "schedule-route-row";
    routeRow.innerHTML = `<div class="line-id-pill">${lineID}</div><div class="schedule-route-descr">${route.route_descr_eng}</div><button class="plot-route-icon-btn schedule-plot-btn visible" data-route-code="${route.route_code}">${plotRouteIconSvg}</button>`;
    routeRow.querySelector(".schedule-plot-btn").addEventListener("click", () => {
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
    scheduleRoutesList.appendChild(routeRow);
  });
  // update state immediately to gray out buttons if needed
  updateArrivalsUIState();
}

// the train/suburban stops dataset stores names transliterated to latin
// (eg "Aerodromio") rather than greek, so a greek query has to be
// converted to match it instead of the other way around like the bus
// stops - toGreeklish alone still misses a lot though, since this
// datasets own transliteration convention disagrees with it on a couple
// of very common letters (eta as "i" not "h", chi as "ch" not "x"), so
// this tries that alternate spelling too. a handful of major hubs are
// translated outright rather than transliterated at all (eg "Airport"),
// which no transliteration scheme can bridge, so those get a small
// explicit alias instead
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

    // ranks how well each stop actually matches - exact/starts-with/contains,
    // or weakest of all a bus stop that only matched via its street rather
    // than its own name - computed the same way for both types so neither
    // one gets a structural edge, with the previous bug (train matches via
    // an alias/alt-spelling never registering as a strong match, so they
    // always lost ties) fixed by scoring every variant that could have
    // found the item, not just the raw query
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
        // train / suburban rail stop - same pie-chart dot as its own map
        // marker (one sector per line group) and line pills instead of a
        // street, since this dataset doesnt have street data
        const groups = item.properties.groups || [];
        const iconHtml = createSuburbanIcon(groups).replace('<svg ', '<svg class="search-result-icon" ');
        const pillsHtml = groups
          .map((g) => `<span class="suburban-line-pill" style="background:${suburbanGroupColors.get(g) || '#64748b'}">${g}</span>`)
          .join('');
        row.innerHTML = `${iconHtml}<div class="search-result-name">${item.properties.name}</div><div class="search-result-lines">${pillsHtml}</div>`;
        row.onclick = () => {
          const coords = item.geometry.coordinates;
          const latlng = L.latLng(coords[1], coords[0]);
          map.flyTo(latlng, 16, { duration: 0.75 });
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
            iconHtml = createSharedStopIcon().options.html;
          } else {
            const color = statusSet.values().next().value;
            iconHtml = `<svg class="search-result-icon" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="${colorHex[color]}" stroke="white" stroke-width="1"/></svg>`;
          }
        }
        row.innerHTML = `${iconHtml}<div class="search-result-name">${item.properties.stop_descr}</div><div class="search-result-stop-street">(Street: ${street})</div>`;
        row.onclick = () => {
          if (selectedStopMarker) map.removeLayer(selectedStopMarker);
          if (selectedHeadingMarker) map.removeLayer(selectedHeadingMarker);
          const latlng = L.latLng(item.geometry.coordinates[1], item.geometry.coordinates[0]);
          map.flyTo(latlng, 17, { duration: 0.75 });
          const stopProps = item.properties;
          stopProps.stop_street = street;
          currentStopProperties = stopProps;
          selectedStopMarker = L.circleMarker(latlng, { ...getSelectedStopStyle(), pane: "selectedStopPane", }).addTo(map);
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
}

// listeners
searchInput.addEventListener("input", handleSearch);
searchToggle.addEventListener("change", (e) => {
  searchInput.placeholder = e.target.value === "lines" ? "Search for a bus line..." : "Search for a bus or train/suburban stop...";
  clearAndHideSearch();
});
function onSearchFocus() {
  manageOpenPanels('search');
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
      customControlsContainer.style.top = "12px";
    }
  }, 50);
}
const observer = new MutationObserver(updateButtonPosition);
observer.observe(searchResultsContainer, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true, });
window.addEventListener("resize", updateButtonPosition);