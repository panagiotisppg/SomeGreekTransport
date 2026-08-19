// whole-day train timetable board - schedule-board gives every train for the
// day in one call, corridor-stations names them, schedule-telemetry (sse) adds live delay/progress

const TIMETABLE_CORRIDORS_URL = `${PROXY_URL}${encodeURIComponent('https://railway.gov.gr/api/public/corridor-stations')}`;
const TIMETABLE_TELEMETRY_URL = `${PROXY_URL}${encodeURIComponent('https://railway.gov.gr/api/public/schedule-telemetry/stream')}`;

function timetableBoardUrl(dateStr) {
  return `${PROXY_URL}${encodeURIComponent(`https://railway.gov.gr/api/public/schedule-board?date=${dateStr}`)}`;
}

function getAthensDateString() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens' }).format(new Date());
}

// deterministic per-corridor color, stable across reloads with no hand
// maintained list - fallback for schedules outside the real A1-A4 line groups
function colorForCorridor(corridorId) {
  if (timetableCorridorColors.has(corridorId)) return timetableCorridorColors.get(corridorId);
  let hash = 0;
  for (let i = 0; i < corridorId.length; i++) hash = (hash * 31 + corridorId.charCodeAt(i)) >>> 0;
  const color = `hsl(${hash % 360}, 62%, 40%)`;
  timetableCorridorColors.set(corridorId, color);
  return color;
}

// reuses identifyTrainLineGroup (js/4-metro-suburban.js) for the map's own
// official suburbanGroupColors instead of the hash fallback when it applies
function colorForSchedule(schedule) {
  const lineGroup = identifyTrainLineGroup(schedule.routeStations || []);
  if (lineGroup && suburbanGroupColors.has(lineGroup)) return suburbanGroupColors.get(lineGroup);
  return colorForCorridor(schedule.corridor);
}

// corridors are broad (most PIRAIR trains only run "Anw Liosia - Aerodromio",
// not the full corridor), so chips are built from actual origin/destination pairs instead
function scheduleLineKey(schedule) {
  const from = (schedule.origin?.nameGreek || schedule.origin?.name || '').trim();
  const to = (schedule.destination?.nameGreek || schedule.destination?.name || '').trim();
  return [from, to].sort((a, b) => a.localeCompare(b, 'el')).join('|');
}

// orders a line's endpoints to match the corridor's own name direction,
// not whichever order the first schedule we saw happened to use
function orderLineEndpoints(corridorId, from, to) {
  const corridor = timetableCorridors && timetableCorridors.find((c) => c.id === corridorId);
  if (corridor && corridor.name) {
    const [primary, secondary] = corridor.name.split('–').map((p) => p.trim());
    if (from === secondary || to === primary) return [to, from];
    if (from === primary || to === secondary) return [from, to];
  }
  return [from, to].sort((a, b) => a.localeCompare(b, 'el'));
}

function getLineLabelForSchedule(schedule) {
  const from = (schedule.origin?.nameGreek || schedule.origin?.name || '').trim();
  const to = (schedule.destination?.nameGreek || schedule.destination?.name || '').trim();
  const [a, b] = orderLineEndpoints(schedule.corridor, from, to);
  return `${a} – ${b}`;
}

function buildTimetableLines() {
  const lines = new Map();
  timetableSchedules.forEach((schedule) => {
    const key = scheduleLineKey(schedule);
    if (!key || lines.has(key)) return;
    lines.set(key, { key, corridor: schedule.corridor, label: getLineLabelForSchedule(schedule) });
  });
  return [...lines.values()].sort((a, b) => a.label.localeCompare(b.label, 'el'));
}

async function openTrainTimetable() {
  manageOpenPanels('timetable');
  closeAllInfoPanels();
  trainTimetablePanel.classList.add('visible');
  trainTimetableDate.textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', timeZone: 'Europe/Athens',
  });

  if (!dataFeaturesEnabled.trains) {
    showFinalError(trainTimetableList, dataOffMessage('Trains'));
    markDataNeeded('trains');
    return;
  }

  if (!timetableHasLoadedOnce) {
    showLoadingUI(trainTimetableList, 'Loading timetable...');
    try {
      const dateStr = getAthensDateString();
      const [corridorsRes, boardRes] = await Promise.all([
        timetableCorridors ? Promise.resolve(null) : fetch(TIMETABLE_CORRIDORS_URL),
        fetch(timetableBoardUrl(dateStr)),
      ]);
      if (corridorsRes) {
        const corridorsData = await corridorsRes.json();
        timetableCorridors = corridorsData.corridors || [];
      }
      const boardData = await boardRes.json();
      timetableSchedules = (boardData.schedules || [])
        .slice()
        .sort((a, b) => new Date(a.scheduledDeparture) - new Date(b.scheduledDeparture));
      timetableHasLoadedOnce = true;
      renderTimetableChips();
      renderTimetableList();
    } catch (error) {
      console.error('Failed to load train timetable:', error);
      showFinalError(trainTimetableList, 'Could not load the timetable.');
    }
  }

  startTimetableTelemetryStream();
}

function closeTrainTimetable() {
  trainTimetablePanel.classList.remove('visible');
  stopTimetableTelemetryStream();
  clearDataNeeded('trains');
}

function startTimetableTelemetryStream() {
  if (timetableEventSource) return;
  timetableEventSource = new EventSource(TIMETABLE_TELEMETRY_URL);
  timetableEventSource.addEventListener('scheduleTelemetry', (e) => {
    try {
      addDataUsage('trains', new Blob([e.data]).size);
      const payload = JSON.parse(e.data);
      (payload.telemetry || []).forEach((t) => {
        if (!t.scheduleId) return;
        timetableTelemetryByScheduleId.set(t.scheduleId, t);
        updateTimetableRowLive(t.scheduleId, t);
      });
    } catch (error) {
      console.error('Failed to parse schedule telemetry payload:', error);
    }
  });
  timetableEventSource.onerror = (err) => {
    console.error('Timetable telemetry stream error (EventSource will auto-reconnect):', err);
  };
}

// this stream never closes on its own - must be closed explicitly or it
// keeps the connection (and the server's work) alive for no reason
function stopTimetableTelemetryStream() {
  if (timetableEventSource) {
    timetableEventSource.close();
    timetableEventSource = null;
  }
}

function renderTimetableChips() {
  const lines = buildTimetableLines();
  const chips = [{ key: 'all', label: 'All' }, ...lines];
  trainTimetableChips.innerHTML = chips
    .map((c) => `<button class="timetable-chip${timetableActiveLineKey === c.key ? ' active' : ''}" data-line-key="${c.key}">${c.label}</button>`)
    .join('');
  trainTimetableChips.querySelectorAll('.timetable-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      timetableActiveLineKey = chip.dataset.lineKey;
      trainTimetableChips.querySelectorAll('.timetable-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      renderTimetableList();
    });
  });
}

function filteredTimetableSchedules() {
  const query = toGreeklish(trainTimetableSearch.value.trim());
  return timetableSchedules.filter((s) => {
    if (timetableActiveLineKey !== 'all' && scheduleLineKey(s) !== timetableActiveLineKey) return false;
    if (!query) return true;
    const haystack = toGreeklish(`${s.trainNumber || ''} ${s.origin?.nameGreek || ''} ${s.destination?.nameGreek || ''}`);
    return haystack.includes(query);
  });
}

function renderTimetableList() {
  const schedules = filteredTimetableSchedules();
  if (schedules.length === 0) {
    showFinalError(trainTimetableList, 'No trains found.');
    return;
  }
  trainTimetableList.innerHTML = schedules.map(renderTimetableRow).join('');
  trainTimetableList.querySelectorAll('.timetable-row').forEach((row) => {
    row.querySelector('.timetable-row-top').addEventListener('click', () => toggleTimetableRowExpand(row));
  });
  trainTimetableList.querySelectorAll('.train-locate-btn').forEach(wireLocateButton);
  scrollToNextTimetableDeparture(schedules);
}

function renderDelayChip(delay) {
  if (delay > 0) return `<span class="train-delay-chip late">+${delay}m</span>`;
  if (delay < 0) return `<span class="train-delay-chip early">${delay}m</span>`;
  return '<span class="train-delay-chip placeholder"></span>';
}

// crossed-out scheduled time + real delay-adjusted time below, same
// convention as .train-time-scheduled/.train-time-actual elsewhere - only when there's a delay
function renderTimetableTimeBlock(delay, scheduledIso) {
  if (!delay) return '';
  const actualIso = new Date(new Date(scheduledIso).getTime() + delay * 60000).toISOString();
  return `<div class="timetable-row-times">
    <span class="train-time-scheduled">${formatLocalTime(scheduledIso)}</span>
    <span class="train-time-actual">${formatLocalTime(actualIso)}</span>
  </div>`;
}

// same live dot + locate icon as the suburban station panel rows, so the
// "this train's live" indicator looks identical everywhere
function renderLiveDotHtml() {
  return '<span class="train-live-dot" title="Live on map"></span>';
}

function renderLocateButtonHtml(scheduleId) {
  return `<button class="train-locate-btn" title="Center map on this train" data-schedule-id="${scheduleId}">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
  </button>`;
}

function renderTimetableLiveActionsHtml(scheduleId) {
  return `<div class="timetable-row-live">${renderLiveDotHtml()}${renderLocateButtonHtml(scheduleId)}</div>`;
}

function wireLocateButton(btn) {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    locateTimetableTrainOnMap(btn.dataset.scheduleId);
  });
}

// shared by the compact trip dots and expanded timeline so they never
// disagree - nextStationId points ahead too early, so while stopped this uses gps instead
function computeTimetableProgress(schedule, telemetry) {
  const stations = schedule.routeStations || [];
  const nextStationId = telemetry.nextStationId;
  const isStopped = typeof telemetry.speedKmh === 'number' && telemetry.speedKmh < 1;

  if (schedule.status === 'completed') {
    return { stations, passedUntilIndex: stations.length - 1, currentIdx: stations.length - 1, isStopped: false, stoppedName: null };
  }

  if (isStopped) {
    let stoppedName = null;
    const pos = liveTrainPositionsByScheduleId.get(schedule._id);
    if (pos && typeof pos.lat === 'number' && typeof pos.lng === 'number') {
      const nearest = findClosestSuburbanStop(pos.lat, pos.lng);
      if (nearest && nearest.distance <= trainAtStopRadiusMeters) stoppedName = nearest.name;
    }
    let stoppedIdx = stoppedName != null ? stations.findIndex((s) => (s.nameGreek || s.name) === stoppedName) : -1;
    if (stoppedIdx === -1 && nextStationId) {
      const nextIdx = stations.findIndex((s) => s.stationId === nextStationId);
      stoppedIdx = nextIdx > 0 ? nextIdx - 1 : 0;
    }
    if (stoppedIdx === -1) stoppedIdx = 0;
    if (!stoppedName) {
      const fallback = stations[stoppedIdx];
      stoppedName = (fallback && (fallback.nameGreek || fallback.name)) || telemetry.nextStation || '';
    }
    return { stations, passedUntilIndex: stoppedIdx - 1, currentIdx: stoppedIdx, isStopped: true, stoppedName };
  }

  if (nextStationId) {
    const nextIdx = stations.findIndex((s) => s.stationId === nextStationId);
    const passedUntilIndex = nextIdx > 0 ? nextIdx - 1 : -1;
    const currentIdx = Math.min(passedUntilIndex + 1, stations.length - 1);
    return { stations, passedUntilIndex, currentIdx, isStopped: false, stoppedName: null };
  }

  return { stations, passedUntilIndex: -1, currentIdx: 0, isStopped: false, stoppedName: null };
}

// compact version of the expanded timeline's "next stop" logic - one dot
// per station, plus a caption naming what its doing (or its real gps stop if stopped)
function renderTimetableTripProgress(schedule, telemetry) {
  const { stations, passedUntilIndex, currentIdx, isStopped, stoppedName } = computeTimetableProgress(schedule, telemetry);
  if (stations.length === 0) return '';

  let caption = '';
  if (isStopped) {
    if (stoppedName) caption = `Currently stopped at ${stoppedName}`;
  } else {
    const currentStop = stations[passedUntilIndex];
    const nextStop = stations[currentIdx];
    const currentName = (currentStop && (currentStop.nameGreek || currentStop.name)) || schedule.origin?.nameGreek || schedule.origin?.name || '';
    const nextName = nextStop && (nextStop.nameGreek || nextStop.name);
    if (nextStop && nextName && currentIdx > passedUntilIndex) caption = `Currently doing the part: ${currentName} → ${nextName}`;
  }

  // while moving, currentIdx is not-yet-reached and must stay gray - the
  // pulsing dot belongs on passedUntilIndex, the last stop actually reached
  const dots = stations.map((stop, idx) => {
    let state = 'upcoming';
    if (isStopped) {
      if (idx < currentIdx) state = 'passed';
      else if (idx === currentIdx) state = 'stopped';
    } else {
      if (idx < passedUntilIndex) state = 'passed';
      else if (idx === passedUntilIndex && passedUntilIndex >= 0) state = 'current';
    }
    return `<div class="timetable-trip-dot ${state}"></div>`;
  }).join('');

  // dots are evenly spaced by index - fill ends at whichever dot is
  // actually pulsing green, not the not-yet-reached one
  const greenUpToIdx = isStopped ? currentIdx : passedUntilIndex;
  const fillPct = stations.length > 1 && greenUpToIdx >= 0 ? (greenUpToIdx / (stations.length - 1)) * 100 : 0;

  // same chase as the live sheet's .train-progress-track - only while moving,
  // only across the segment between the pulsing dot and the next stop
  let chaseHtml = '';
  if (!isStopped && passedUntilIndex >= 0 && currentIdx > passedUntilIndex) {
    const left = (passedUntilIndex / (stations.length - 1)) * 100;
    const width = ((currentIdx - passedUntilIndex) / (stations.length - 1)) * 100;
    chaseHtml = `<div class="timetable-trip-chase" style="left:${left}%;width:${width}%;--chase-delay:-${Date.now() % 1600}ms"></div>`;
  }

  return `
    <div class="timetable-trip-progress">
      ${caption ? `<div class="timetable-trip-caption">${caption}</div>` : ''}
      <div class="timetable-trip-dots">
        <div class="timetable-trip-fill" style="width:${fillPct}%"></div>
        ${chaseHtml}
        ${dots}
      </div>
    </div>
  `;
}

// jumps to a live train's position and opens its sheet - reuses the marker/
// position maps the live map stream already maintains, fetches nothing new
function locateTimetableTrainOnMap(scheduleId) {
  const marker = liveTrainMarkersByScheduleId.get(scheduleId);
  const pos = liveTrainPositionsByScheduleId.get(scheduleId);
  if (!marker || !pos) return;
  closeTrainTimetable();
  map.flyTo({ center: marker.getLngLat(), zoom: Math.max(map.getZoom(), 15), duration: 750 });
  const id = pos.id || pos.trainId;
  if (id) openLiveTrainSheet(id);
}

function renderTimetableRow(schedule) {
  const serviceColor = getServiceTypeColor(schedule.serviceType);
  const hasLiveMarker = liveTrainMarkersByScheduleId.has(schedule._id);
  const telemetry = timetableTelemetryByScheduleId.get(schedule._id);
  const delay = telemetry ? (telemetry.delay || 0) : (schedule.delay || 0);
  const completedClass = schedule.status === 'completed' ? ' is-already-passed' : '';
  return `
    <div class="timetable-row train-row${completedClass}" data-row-key="${schedule._id}">
      <div class="timetable-row-top">
        <div class="timetable-row-time">${formatLocalTime(schedule.scheduledDeparture)}</div>
        <div class="timetable-row-main">
          <div class="train-row-top">
            <span class="train-number-pill" style="background:${serviceColor}">${schedule.trainNumber || ''}</span>
            <span class="train-service-type" style="color:${serviceColor}">${schedule.serviceType || ''}</span>
            <span class="timetable-corridor-pill" style="background:${colorForSchedule(schedule)}">${getLineLabelForSchedule(schedule)}</span>
          </div>
          <div class="train-route">
            <span class="train-route-from">${schedule.origin?.nameGreek || schedule.origin?.name || ''}</span>
            <svg class="train-route-arrow" viewBox="0 0 24 24"><path d="M4 12h14m0 0l-5-5m5 5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="train-route-to">${schedule.destination?.nameGreek || schedule.destination?.name || ''}</span>
          </div>
        </div>
        ${hasLiveMarker ? renderTimetableLiveActionsHtml(schedule._id) : ''}
        ${renderTimetableTimeBlock(delay, schedule.scheduledDeparture)}
        ${renderDelayChip(delay)}
        <svg class="timetable-row-expand-icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      ${telemetry ? renderTimetableTripProgress(schedule, telemetry) : ''}
      <div class="timetable-row-expanded-content"></div>
    </div>
  `;
}

function renderTimetableRouteTimeline(schedule) {
  const telemetry = timetableTelemetryByScheduleId.get(schedule._id);
  const delay = telemetry ? (telemetry.delay || 0) : (schedule.delay || 0);

  // shares computeTimetableProgress with the compact trip dots so they
  // never disagree; no telemetry just falls back to the plain scheduled route
  const routeStations = schedule.routeStations || [];
  const { stations, passedUntilIndex, currentIdx, isStopped } = telemetry
    ? computeTimetableProgress(schedule, telemetry)
    // no telemetry, nothing to highlight as "current" - all passed if
    // finished, plain scheduled otherwise
    : { stations: routeStations, passedUntilIndex: schedule.status === 'completed' ? routeStations.length - 1 : -1, currentIdx: -1, isStopped: false };

  // schedule-board only gives one overall delay figure, no per-stop actual
  // time - shown against every stop as the best estimate we have
  const delayChip = delay !== 0 ? renderDelayChip(delay) : '';
  const rows = stations.map((stop, idx) => {
    const isCurrent = idx === currentIdx;
    const passed = idx <= passedUntilIndex;
    const time = stop.scheduledArrival || stop.scheduledDeparture;
    // same chase as the live sheet's isRouteChasingSegment - the line right
    // after the last passed stop, only while moving
    const isChasing = !isStopped && idx === passedUntilIndex && idx + 1 < stations.length;
    return `
      <div class="route-stop state-${passed ? 'passed' : 'upcoming'}${isCurrent ? ' is-this-station' : ''}">
        <div class="route-stop-track">
          <div class="route-stop-dot"></div>
          ${isChasing ? '<div class="route-stop-chase"></div>' : ''}
        </div>
        <div class="route-stop-body">
          <span class="route-stop-name">${stop.nameGreek || stop.name}</span>
          <span class="route-stop-time">${formatLocalTime(time)}${delayChip}</span>
        </div>
      </div>
    `;
  }).join('');
  return `<div class="route-timeline">${rows}</div>`;
}

function toggleTimetableRowExpand(row) {
  const scheduleId = row.dataset.rowKey;
  const expanded = row.classList.toggle('expanded');
  if (!expanded) return;
  const schedule = timetableSchedules.find((s) => s._id === scheduleId);
  const contentEl = row.querySelector('.timetable-row-expanded-content');
  if (schedule && contentEl) contentEl.innerHTML = renderTimetableRouteTimeline(schedule);
}

// patches only the affected row instead of re-rendering the whole list so
// scroll position and any expanded row survive a live telemetry tick
function updateTimetableRowLive(scheduleId, telemetry) {
  const row = trainTimetableList.querySelector(`.timetable-row[data-row-key="${scheduleId}"]`);
  if (!row) return;

  const schedule = timetableSchedules.find((s) => s._id === scheduleId);
  const newDelay = telemetry.delay || 0;
  const delaySlot = row.querySelector('.timetable-row-top > .train-delay-chip');

  // the position stream runs independently, so a marker can appear after
  // the row rendered - piggyback here to add the live dot/locate button retroactively
  if (delaySlot && !row.querySelector('.train-locate-btn') && liveTrainMarkersByScheduleId.has(scheduleId)) {
    delaySlot.insertAdjacentHTML('beforebegin', renderTimetableLiveActionsHtml(scheduleId));
    wireLocateButton(row.querySelector('.train-locate-btn'));
  }

  // scheduled/actual time block - insert, refresh or drop depending on
  // whether the train actually has a delay to explain right now
  const timesEl = row.querySelector('.timetable-row-times');
  const newTimesHtml = schedule ? renderTimetableTimeBlock(newDelay, schedule.scheduledDeparture) : '';
  if (timesEl) {
    if (newTimesHtml) timesEl.outerHTML = newTimesHtml;
    else timesEl.remove();
  } else if (newTimesHtml && delaySlot) {
    delaySlot.insertAdjacentHTML('beforebegin', newTimesHtml);
  }

  if (delaySlot) delaySlot.outerHTML = renderDelayChip(newDelay);

  if (schedule) {
    const tripProgressEl = row.querySelector('.timetable-trip-progress');
    const newTripHtml = renderTimetableTripProgress(schedule, telemetry);
    if (tripProgressEl) {
      if (newTripHtml) tripProgressEl.outerHTML = newTripHtml;
    } else if (newTripHtml) {
      const expandedContent = row.querySelector('.timetable-row-expanded-content');
      if (expandedContent) expandedContent.insertAdjacentHTML('beforebegin', newTripHtml);
    }
  }

  if (row.classList.contains('expanded') && schedule) {
    const contentEl = row.querySelector('.timetable-row-expanded-content');
    if (contentEl) contentEl.innerHTML = renderTimetableRouteTimeline(schedule);
  }
}

function scrollToNextTimetableDeparture(schedules) {
  const now = Date.now();
  const next = schedules.find((s) => new Date(s.scheduledDeparture).getTime() >= now) || schedules[schedules.length - 1];
  if (!next) return;
  const row = trainTimetableList.querySelector(`.timetable-row[data-row-key="${next._id}"]`);
  if (!row) return;
  row.classList.add('next-departure');
  setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
}

timetableButton.addEventListener('click', openTrainTimetable);
trainTimetableClose.addEventListener('click', closeTrainTimetable);
trainTimetableSearch.addEventListener('input', renderTimetableList);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && trainTimetablePanel.classList.contains('visible')) closeTrainTimetable();
});
