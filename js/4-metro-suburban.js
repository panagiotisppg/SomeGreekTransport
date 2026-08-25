const PROXY_URL = "https://oasa-proxy.panagot94.workers.dev/?url=";

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

function createSuburbanIcon(groups) {
  const r = 5;
  const stroke = 1.5;
  const size = Math.ceil((r + stroke) * 2);
  const cx = size / 2, cy = size / 2;
  const colors = (groups && groups.length ? groups : [null]).map(g => suburbanGroupColors.get(g) || '#94a3b8');

  let content;
  if (colors.length <= 1) {
    content = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${colors[0]}" stroke="#fff" stroke-width="${stroke}"/>`;
  } else if (colors.length === 2) {
    const leftHalf = `M ${cx},${cy} L ${cx},${cy - r} A ${r},${r} 0 0 1 ${cx},${cy + r} Z`;
    const rightHalf = `M ${cx},${cy} L ${cx},${cy - r} A ${r},${r} 0 0 0 ${cx},${cy + r} Z`;
    content = `<path d="${leftHalf}" fill="${colors[0]}"/><path d="${rightHalf}" fill="${colors[1]}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="${stroke}"/>`;
  } else {
    const n = colors.length;
    const step = (2 * Math.PI) / n;
    let sectors = '';
    for (let i = 0; i < n; i++) {
      const a0 = i * step - Math.PI / 2;
      const a1 = a0 + step;
      const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      sectors += `<path d="M ${cx},${cy} L ${x0},${y0} A ${r},${r} 0 0 1 ${x1},${y1} Z" fill="${colors[i]}"/>`;
    }
    content = `${sectors}<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="${stroke}"/>`;
  }

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.4));">${content}</svg>`;
}

// same dot treatment as createMetroIcon, plus the gate letter+number baked
// into the dot itself instead of a separate label
function createFerryIcon(gate) {
  const size = 24;
  const center = size / 2;
  const rOuter = 9;
  const strokeWidth = 1.5;
  const color = ferryGateColors[gate] || '#888';
  const textColor = FERRY_DARK_TEXT_GATES.has(gate) ? '#1a1a1a' : '#fff';
  return `<svg viewBox="0 0 ${size} ${size}" width="100%" height="100%" style="display:block; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.4));"><circle cx="${center}" cy="${center}" r="${rOuter}" fill="${color}" stroke="#fff" stroke-width="${strokeWidth}"/><text x="${center}" y="${center}" text-anchor="middle" dominant-baseline="central" font-size="7" font-weight="700" font-family="var(--font)" fill="${textColor}">${gate}</text></svg>`;
}
// picked by comparing each ferryGateColors fill against its yiq perceived
// luminance (>=140 reads better with dark text than white)
const FERRY_DARK_TEXT_GATES = new Set(['E1', 'E9']);

// white ship silhouette for the pill badge next to the gate panel title -
// scalloped bottom edge reads as waves lapping the hull
function createShipGlyph() {
  return `<svg viewBox="-4 0 32 24" width="22" height="16">
    <path d="M12 3 L17 11 L7 11 Z" fill="white"/>
    <path d="M-4 11 L28 11 L20 22 L4 22 Z" fill="white"/>
    <line x1="5" y1="10.3" x2="19" y2="10.3" stroke="var(--accent-2)" stroke-width="1"/>
    <path d="M4 22 A2.67 2.67 0 0 1 9.33 22 Z" fill="var(--accent-2)" opacity="0.6"/>
    <path d="M9.33 22 A2.67 2.67 0 0 1 14.67 22 Z" fill="var(--accent-2)"/>
    <path d="M14.67 22 A2.67 2.67 0 0 1 20 22 Z" fill="var(--accent-2)" opacity="0.6"/>
  </svg>`;
}

function createTramIcon(lineT) {
  const size = 18;
  const center = size / 2;
  const radius = 6;
  const strokeWidth = 2;
  const color = tramStopColors[lineT] || '#333';
  return `<svg viewBox="0 0 ${size} ${size}" style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.4));"><circle cx="${center}" cy="${center}" r="${radius}" fill="white" stroke="${color}" stroke-width="${strokeWidth}"/></svg>`;
}

function showMetroInfo(properties) {
  clearDemotedPanels();
  stopTimer();
  stopSuburbanTimer();
  stopFerryCountdownTicker();
  if (typeof stopCityLiveTimer === 'function') stopCityLiveTimer();
  if (typeof clearCitySelectedStopMarker === 'function') clearCitySelectedStopMarker();
  cityStopPanel.classList.remove("visible");
  if (selectedStopMarker) {
    selectedStopMarker.remove();
    selectedStopMarker = null;
  }
  if (selectedHeadingMarker) {
    selectedHeadingMarker.remove();
    selectedHeadingMarker = null;
  }
  stopInfoPanel.classList.remove("visible");
  suburbanStationPanel.classList.remove("visible");
  tramStationPanel.classList.remove("visible");
  ferryStationPanel.classList.remove("visible");
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

const trainServiceTypeColors = {
  Suburban: '#2563eb',
  InterCity: '#dc2626',
  'InterCity Express': '#7c3aed',
  ICE: '#7c3aed',
  Freight: '#6b7280',
};

const trainStatusLabels = {
  scheduled: 'Scheduled',
  approaching: 'Approaching',
  arrived: 'Arrived',
  boarding: 'Boarding',
  ready: 'Ready',
  departed: 'Departed',
  delayed: 'Delayed',
  cancelled: 'Cancelled',
};

// blocklist not allowlist - an allowlist missed "ic regional" (ic is the
// line group) and would keep missing anything else not yet seen
const nonPassengerServiceTypes = new Set(['Freight']);
function isPassengerService(serviceType) {
  return !!serviceType && !nonPassengerServiceTypes.has(serviceType);
}

function getServiceTypeColor(serviceType) {
  return trainServiceTypeColors[serviceType] || '#64748b';
}

function getStatusLabel(status) {
  if (!status) return 'Unknown';
  return trainStatusLabels[status] || (status.charAt(0).toUpperCase() + status.slice(1));
}

function formatLocalTime(isoString) {
  if (!isoString) return '--:--';
  return new Date(isoString).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Athens',
  });
}

// api delay field is unreliable so we just diff the times ourselves
function computeDelayMinutes(leg) {
  if (!leg || !leg.scheduledTime || !leg.actualTime) return 0;
  return Math.round((new Date(leg.actualTime) - new Date(leg.scheduledTime)) / 60000);
}

// arrival and departure share the same id minus the -arrival/-departure suffix thats the join key
function mergeTrainEvents(arrivals, departures) {
  const arrivalsByKey = new Map();
  (arrivals || []).forEach(a => arrivalsByKey.set(a.id.replace(/-arrival$/, ''), a));
  const departuresByKey = new Map();
  (departures || []).forEach(d => departuresByKey.set(d.id.replace(/-departure$/, ''), d));

  const keys = new Set([...arrivalsByKey.keys(), ...departuresByKey.keys()]);
  const merged = [];
  keys.forEach(key => {
    const arrival = arrivalsByKey.get(key) || null;
    const departure = departuresByKey.get(key) || null;
    const primary = arrival || departure;
    merged.push({
      trainNumber: primary.trainNumber,
      serviceType: primary.serviceType,
      from: arrival ? arrival.from : null,
      to: departure ? departure.to : null,
      arrival,
      departure,
      sortTime: new Date(primary.scheduledTime).getTime(),
    });
  });
  merged.sort((a, b) => a.sortTime - b.sortTime);
  return merged;
}

// name is optional (live sheet shows it under the role label, station panel
// rows dont need it); avgDelay only fills in a guess when actualtime is missing
function renderTrainLeg(leg, label, showStatus = true, reserveDelaySpace = false, name = null, avgDelay = 0) {
  if (!leg) return '';
  const diff = computeDelayMinutes(leg);
  const scheduled = formatLocalTime(leg.scheduledTime);
  const actual = diff !== 0 ? formatLocalTime(leg.actualTime) : null;
  const delayChip = diff > 0 ? `<span class="train-delay-chip late">+${diff}m</span>`
                   : diff < 0 ? `<span class="train-delay-chip early">${diff}m</span>`
                   : (reserveDelaySpace ? '<span class="train-delay-chip placeholder"></span>' : '');

  // arrivals/departures endpoint copies scheduledTime into actualTime pre-event;
  // the schedule endpoint leaves it null - checking both is the reliable signal
  const hasNoRealActual = !leg.actualTime || leg.actualTime === leg.scheduledTime;
  const roundedAvg = Math.round(avgDelay);
  const estimate = (hasNoRealActual && roundedAvg !== 0)
    ? `<span class="train-time-estimate">average delays: ${roundedAvg > 0 ? '+' : ''}${roundedAvg}m, estimated ${formatLocalTime(new Date(new Date(leg.scheduledTime).getTime() + roundedAvg * 60000).toISOString())}</span>`
    : '';

  return `
    <div class="train-time-block">
      <span class="train-time-label">${label}</span>
      ${name ? `<span class="train-endpoint-name">${name}</span>` : ''}
      <span class="train-time-value">
        ${actual ? `<span class="train-time-scheduled">${scheduled}</span><span class="train-time-actual">${actual}</span>` : `<span class="train-time-actual">${scheduled}</span>`}
        ${delayChip}
      </span>
      ${estimate}
      ${showStatus ? `<span class="train-time-status status-${leg.status || 'unknown'}">${getStatusLabel(leg.status)}</span>` : ''}
      ${leg.platform ? `<span class="train-platform">Plat. ${leg.platform}</span>` : ''}
    </div>`;
}

// schedule id is the event id with the last two dash segments stripped off
function extractScheduleId(eventId) {
  if (!eventId) return null;
  const parts = eventId.split('-');
  if (parts.length < 3) return null;
  return parts.slice(0, -2).join('-');
}

function diffMinutes(scheduled, actual) {
  if (!scheduled || !actual) return 0;
  return Math.round((new Date(actual) - new Date(scheduled)) / 60000);
}

async function fetchTrainSchedule(scheduleId) {
  const url = `${PROXY_URL}${encodeURIComponent(`https://railway.gov.gr/api/public/schedules/${scheduleId}?t=${Date.now()}`)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

// routestations has the full stop order but only scheduled times while stops has live times but only for the middle stops
// merge both and find the last one with live data for the current position
function buildFullRoute(schedule) {
  const liveByStationId = new Map((schedule.stops || []).map(s => [s.stationId, s]));
  const ordered = (schedule.routeStations || []).slice().sort((a, b) => a.index - b.index);

  const route = ordered.map(rs => {
    if (rs.role === 'origin') {
      return {
        stationId: rs.stationId, name: rs.name, role: 'origin',
        scheduledArrival: rs.scheduledArrival, scheduledDeparture: rs.scheduledDeparture,
        actualArrival: null, actualDeparture: schedule.actualDeparture,
        platform: null,
        hasLive: !!schedule.actualDeparture,
      };
    }
    if (rs.role === 'destination') {
      return {
        stationId: rs.stationId, name: rs.name, role: 'destination',
        scheduledArrival: rs.scheduledArrival, scheduledDeparture: rs.scheduledDeparture,
        actualArrival: schedule.actualArrival, actualDeparture: null,
        platform: null,
        hasLive: !!schedule.actualArrival,
      };
    }
    const live = liveByStationId.get(rs.stationId);
    return {
      stationId: rs.stationId, name: rs.name, role: 'stop',
      scheduledArrival: rs.scheduledArrival, scheduledDeparture: rs.scheduledDeparture,
      actualArrival: live ? live.actualArrival : null,
      actualDeparture: live ? live.actualDeparture : null,
      platform: live ? live.platform : null,
      hasLive: !!(live && (live.actualArrival || live.actualDeparture)),
    };
  });

  let currentIndex = -1;
  route.forEach((stop, i) => { if (stop.hasLive) currentIndex = i; });
  return route.map((stop, i) => ({
    ...stop,
    state: i <= currentIndex ? 'passed' : 'upcoming',
  }));
}

// majority vote across stops instead of requiring all of them to agree so one bad stop in the data wont break it
function identifyTrainLineGroup(route) {
  const counts = new Map();
  route.forEach(stop => {
    const groups = suburbanStopGroupsByGovId.get(stop.stationId);
    if (!groups) return;
    groups.forEach(g => counts.set(g, (counts.get(g) || 0) + 1));
  });
  if (counts.size === 0) return null;
  let best = null, bestCount = 0;
  counts.forEach((count, group) => { if (count > bestCount) { best = group; bestCount = count; } });
  const totalWithData = route.filter(s => suburbanStopGroupsByGovId.has(s.stationId)).length;
  if (totalWithData === 0 || bestCount / totalWithData < 0.5) return null;
  return best;
}

// no stop dot ever flashes - the connecting line between the last confirmed
// stop and the next gets a smooth chase animation instead
function renderRouteStop(stop, isThisStation, isChasingSegment, avgDelay = 0) {
  const time = stop.role === 'origin' ? stop.scheduledDeparture : stop.scheduledArrival;
  const actual = stop.role === 'origin' ? stop.actualDeparture : stop.actualArrival;
  const diff = diffMinutes(time, actual);
  const delayChip = diff > 0 ? `<span class="train-delay-chip late">+${diff}m</span>`
                   : diff < 0 ? `<span class="train-delay-chip early">${diff}m</span>` : '';

  const roundedAvg = Math.round(avgDelay);
  const estimate = stop.state === 'upcoming' && roundedAvg !== 0
    ? `<span class="route-stop-estimate">(${roundedAvg > 0 ? '+' : ''}${roundedAvg}m, ~${formatLocalTime(new Date(new Date(time).getTime() + roundedAvg * 60000).toISOString())})</span>`
    : '';

  return `
    <div class="route-stop state-${stop.state}${isThisStation ? ' is-this-station' : ''}" data-station-id="${stop.stationId}">
      <div class="route-stop-track">
        <div class="route-stop-dot"></div>
        ${isChasingSegment ? '<div class="route-stop-chase"></div>' : ''}
      </div>
      <div class="route-stop-body">
        <span class="route-stop-name">${stop.name}</span>
        <span class="route-stop-time">${formatLocalTime(time)}${delayChip}${estimate}${stop.platform ? ` <span class="train-platform">Plat. ${stop.platform}</span>` : ''}</span>
      </div>
    </div>`;
}

// a delay picked up early doesn't always stick - a driver can claw time
// back over the trip, so this is used to estimate upcoming stops
function getStopDelayMinutes(stop) {
  const time = stop.role === 'origin' ? stop.scheduledDeparture : stop.scheduledArrival;
  const actual = stop.role === 'origin' ? stop.actualDeparture : stop.actualArrival;
  if (!actual) return null;
  return diffMinutes(time, actual);
}

// a flat average lets one early outlier (e.g. a late departure) dominate
// the estimate long after the driver has caught back up - weight each
// passed stop's delay by recency instead, so the most recently passed
// stop counts full weight and older ones fade out exponentially
const DELAY_RECENCY_DECAY = 0.6;

function computeAverageRouteDelay(route) {
  const delays = route.map(getStopDelayMinutes).filter(d => d !== null);
  if (!delays.length) return 0;
  let weightedSum = 0, weightTotal = 0;
  delays.forEach((d, i) => {
    const weight = Math.pow(DELAY_RECENCY_DECAY, delays.length - 1 - i);
    weightedSum += d * weight;
    weightTotal += weight;
  });
  return weightedSum / weightTotal;
}

// the chasing segment is the last passed stops own connector line since
// thats the one visually leading down into the current/next stop
function isRouteChasingSegment(route, i) {
  const stop = route[i];
  const next = route[i + 1];
  return stop.state === 'passed' && !!next && next.state !== 'passed';
}

function renderRouteTimeline(route, currentGovIds) {
  const govIdSet = new Set(currentGovIds || []);
  const avgDelay = computeAverageRouteDelay(route);
  const rows = route.map((stop, i) => renderRouteStop(stop, govIdSet.has(stop.stationId), isRouteChasingSegment(route, i), avgDelay)).join('');
  return `<div class="route-timeline">${rows}</div>`;
}

// patches stop classes and times in place instead of re rendering the whole list
// keeps scroll position on the ~1s refresh and falls back to a full render if the stop count changed
function updateRouteTimelineInPlace(routeDetailsEl, route, currentGovIds) {
  const timelineEl = routeDetailsEl.querySelector('.route-timeline');
  const existingStops = timelineEl ? timelineEl.querySelectorAll(':scope > .route-stop') : null;
  if (!timelineEl || !existingStops || existingStops.length !== route.length) {
    routeDetailsEl.innerHTML = renderRouteTimeline(route, currentGovIds);
    return;
  }
  const govIdSet = new Set(currentGovIds || []);
  const avgDelay = computeAverageRouteDelay(route);
  for (let i = 0; i < route.length; i++) {
    const stop = route[i];
    const el = existingStops[i];
    if (el.dataset.stationId !== stop.stationId) {
      routeDetailsEl.innerHTML = renderRouteTimeline(route, currentGovIds);
      return;
    }
    const temp = document.createElement('div');
    temp.innerHTML = renderRouteStop(stop, govIdSet.has(stop.stationId), isRouteChasingSegment(route, i), avgDelay).trim();
    const fresh = temp.firstElementChild;
    el.className = fresh.className;
    const trackEl = el.querySelector('.route-stop-track');
    const freshTrackEl = fresh.querySelector('.route-stop-track');
    if (trackEl && freshTrackEl && trackEl.innerHTML !== freshTrackEl.innerHTML) {
      trackEl.innerHTML = freshTrackEl.innerHTML;
    }
    const timeEl = el.querySelector('.route-stop-time');
    const freshTimeEl = fresh.querySelector('.route-stop-time');
    if (timeEl && freshTimeEl && timeEl.innerHTML !== freshTimeEl.innerHTML) {
      timeEl.innerHTML = freshTimeEl.innerHTML;
    }
  }
}

// stable key for a train row so we can diff old vs new instead of rebuilding everything
function trainRowKey(event) {
  return event.scheduleId || `train-${event.trainNumber}-${event.sortTime}`;
}

function renderTrainRow(event) {
  const color = getServiceTypeColor(event.serviceType);
  const hasSchedule = !!(event.originName || event.destinationName);
  const fromLabel = hasSchedule ? (event.originName || 'Origin') : (event.from || 'Origin');
  const toLabel = hasSchedule ? (event.destinationName || 'Final stop') : (event.to || 'Final stop');
  const routeClass = hasSchedule ? '' : (!event.arrival ? 'is-origin' : (!event.departure ? 'is-terminus' : ''));
  const scheduleId = event.scheduleId || null;
  const hasPassedOurStation = event.ourStationState === 'passed';
  const alreadyPassedClass = hasPassedOurStation ? ' is-already-passed' : '';
  const isLiveOnMap = !!(scheduleId && liveTrainScheduleIdSet.has(scheduleId));
  const liveDot = isLiveOnMap ? '<span class="train-live-dot" title="Live on map"></span>' : '';
  const locateButton = isLiveOnMap ? `
        <button class="train-locate-btn" title="Center map on this train">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
        </button>` : '';
  const toggleButton = scheduleId ? `
        <button class="train-route-toggle" title="Show full route">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>` : '';
  const serviceTypeBadge = event.lineGroup
    ? `<span class="suburban-line-pill train-line-service-pill" style="background:${suburbanGroupColors.get(event.lineGroup) || color}">${event.lineGroup} ${(event.serviceType || '').toUpperCase()}</span>`
    : `<span class="train-service-type" style="color:${color}">${event.serviceType || ''}</span>`;
  const stationName = (currentSuburbanProperties && currentSuburbanProperties.name) || 'this stop';
  const arrivalLabel = hasPassedOurStation ? `Arrived at ${stationName}` : `Arriving at ${stationName}`;
  const departureLabel = hasPassedOurStation ? `Departed ${stationName}` : `Departing ${stationName}`;
  const liveProgressSection = isLiveOnMap ? renderTrainRowLiveProgress(scheduleId) : '';
  // an unexpanded row only has cached route data if getLiveTrainColor already
  // fetched it for the line color - reuse that instead of a fresh fetch
  const cachedSchedule = scheduleId ? suburbanScheduleCache.get(scheduleId) : null;
  const avgDelay = cachedSchedule ? computeAverageRouteDelay(cachedSchedule.route) : 0;
  return `
    <div class="train-row${alreadyPassedClass}" data-schedule-id="${scheduleId || ''}" data-row-key="${trainRowKey(event)}">
      <div class="train-route ${routeClass}">
        <span class="train-route-from">${fromLabel}</span>
        <svg class="train-route-arrow" viewBox="0 0 24 24"><path d="M4 12h14m0 0l-5-5m5 5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="train-route-to">${toLabel}</span>
      </div>
      <div class="train-row-top">
        ${serviceTypeBadge}
        <span class="train-number-pill" style="background:${color}">${event.trainNumber}</span>
        <div class="train-row-actions">
          ${liveDot}
          ${locateButton}
          ${toggleButton}
        </div>
      </div>
      <div class="train-times">
        ${renderTrainLeg(event.arrival, arrivalLabel, false, false, null, avgDelay)}
        ${renderTrainLeg(event.departure, departureLabel, false, false, null, avgDelay)}
      </div>
      ${liveProgressSection}
      ${scheduleId ? '<div class="train-route-details" hidden></div>' : ''}
    </div>`;
}

// the prefetch in fetchAndRenderSuburbanArrivals can fail or still be in
// flight - patch the boxes in once the dropdown's own fetch resolves
function refreshTrainRowTimesEstimate(row, scheduleId) {
  const event = currentSuburbanTrainEvents.find(e => e.scheduleId === scheduleId);
  const timesEl = row.querySelector(':scope > .train-times');
  if (!event || !timesEl) return;
  const temp = document.createElement('div');
  temp.innerHTML = renderTrainRow(event).trim();
  const freshTimes = temp.firstElementChild.querySelector(':scope > .train-times');
  if (freshTimes && freshTimes.innerHTML !== timesEl.innerHTML) timesEl.replaceWith(freshTimes);
}

// updates a row in place without replacing the node and keeps the route dropdown open if it was expanded
function updateTrainRowInPlace(row, event) {
  // clear any leftover fade out styling in case this row got reused mid animation
  row.classList.remove('row-fade-out');
  row.style.maxHeight = '';
  row.style.overflow = '';

  const detailsEl = row.querySelector('.train-route-details');
  const wasExpanded = !!(detailsEl && !detailsEl.hidden);

  const temp = document.createElement('div');
  temp.innerHTML = renderTrainRow(event).trim();
  const freshRow = temp.firstElementChild;

  row.className = freshRow.className;
  row.dataset.scheduleId = freshRow.dataset.scheduleId;
  row.dataset.rowKey = freshRow.dataset.rowKey;
  row.innerHTML = freshRow.innerHTML;

  if (wasExpanded) {
    const newDetails = row.querySelector('.train-route-details');
    const newToggle = row.querySelector('.train-route-toggle');
    if (newDetails && newToggle) {
      newDetails.hidden = false;
      newToggle.classList.add('expanded');
      const cached = event.scheduleId ? suburbanScheduleCache.get(event.scheduleId) : null;
      if (cached) {
        newDetails.innerHTML = renderRouteTimeline(cached.route, currentSuburbanProperties ? currentSuburbanProperties.govIds : []);
      }
    }
  }
}

function scrollToFirstActiveTrainRow() {
  const contentArea = document.getElementById('suburban-station-content');
  const firstActive = contentArea.querySelector('.train-row:not(.is-already-passed)');
  if (!firstActive) return;
  const contentRect = contentArea.getBoundingClientRect();
  const rowRect = firstActive.getBoundingClientRect();
  const targetScrollTop = contentArea.scrollTop + (rowRect.top - contentRect.top);

  // scroll from the top instead of jumping straight there
  contentArea.scrollTop = 0;
  const duration = 450;
  let startTime = null;
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    contentArea.scrollTop = targetScrollTop * progress;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function renderSuburbanTrainList(scrollToActive) {
  const contentArea = document.getElementById('suburban-station-content');
  if (currentSuburbanTrainEvents.length === 0) {
    showFinalError(contentArea, 'No scheduled arrivals or departures right now.');
    return;
  }
  const events = suburbanShowAllTrains
    ? currentSuburbanTrainEvents
    : currentSuburbanTrainEvents.filter(e => isPassengerService(e.serviceType));
  if (events.length === 0) {
    showFinalError(contentArea, 'No passenger trains scheduled right now — only freight/other traffic.');
    return;
  }

  const existingList = contentArea.querySelector('.train-stop-list');
  if (!existingList) {
    // first render for this station or filter so just build it all
    contentArea.innerHTML = `<div class="train-stop-list">${events.map(renderTrainRow).join('')}</div>`;
    if (scrollToActive) scrollToFirstActiveTrainRow();
    return;
  }

  // reuse rows in place fade out removed ones fade in new ones and dont tear down rows the user has open
  const existingRows = new Map();
  existingList.querySelectorAll(':scope > .train-row').forEach(row => {
    existingRows.set(row.dataset.rowKey, row);
  });

  const newKeys = new Set(events.map(trainRowKey));
  existingRows.forEach((row, key) => {
    if (newKeys.has(key)) return;
    row.style.maxHeight = `${row.scrollHeight}px`;
    row.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      row.classList.add('row-fade-out');
      row.style.maxHeight = '0px';
    });
    setTimeout(() => { if (row.parentNode) row.remove(); }, 320);
  });

  let previousNode = null;
  events.forEach((event) => {
    const key = trainRowKey(event);
    let row = existingRows.get(key);
    let isNew = false;
    if (row) {
      updateTrainRowInPlace(row, event);
    } else {
      const temp = document.createElement('div');
      temp.innerHTML = renderTrainRow(event).trim();
      row = temp.firstElementChild;
      row.classList.add('row-fade-in');
      isNew = true;
    }
    // handles both placing a new row and repositioning an existing one
    const expectedNext = previousNode ? previousNode.nextElementSibling : existingList.firstElementChild;
    if (expectedNext !== row) existingList.insertBefore(row, expectedNext);
    if (isNew) requestAnimationFrame(() => row.classList.remove('row-fade-in'));
    previousNode = row;
  });

  if (scrollToActive) scrollToFirstActiveTrainRow();
}

async function fetchAndRenderSuburbanArrivals(properties, isInitialLoad) {
  const contentArea = document.getElementById('suburban-station-content');
  const govIds = properties.govIds || [];

  if (!dataFeaturesEnabled.trains) {
    currentSuburbanTrainEvents = [];
    showFinalError(contentArea, dataOffMessage('Trains'));
    markDataNeeded('trains');
    return;
  }

  if (govIds.length === 0) {
    currentSuburbanTrainEvents = [];
    showFinalError(contentArea, 'No live data available for this station.');
    return;
  }

  try {
    const perGovId = await Promise.all(govIds.map(async (govId) => {
      const arrivalsUrl = `${PROXY_URL}${encodeURIComponent(`https://railway.gov.gr/api/public/stations/${govId}/arrivals?t=${Date.now()}`)}`;
      const departuresUrl = `${PROXY_URL}${encodeURIComponent(`https://railway.gov.gr/api/public/stations/${govId}/departures?t=${Date.now()}`)}`;
      const [arrivalsRes, departuresRes] = await Promise.all([fetch(arrivalsUrl), fetch(departuresUrl)]);
      const arrivalsJson = arrivalsRes.ok ? await arrivalsRes.json() : null;
      const departuresJson = departuresRes.ok ? await departuresRes.json() : null;
      return {
        arrivals: (arrivalsJson && arrivalsJson.arrivals) || [],
        departures: (departuresJson && departuresJson.departures) || [],
      };
    }));

    const allArrivals = perGovId.flatMap(r => r.arrivals);
    const allDepartures = perGovId.flatMap(r => r.departures);
    const merged = mergeTrainEvents(allArrivals, allDepartures);
    suburbanScheduleCache.clear();

    // fetch each schedule up front so we know the real origin and destination and whether it already passed this station
    await Promise.all(merged.map(async (event) => {
      const legId = event.arrival ? event.arrival.id : (event.departure ? event.departure.id : null);
      const scheduleId = extractScheduleId(legId);
      event.scheduleId = scheduleId;
      if (!scheduleId) return;
      try {
        const schedule = await fetchTrainSchedule(scheduleId);
        if (!schedule) return;
        const route = buildFullRoute(schedule);
        suburbanScheduleCache.set(scheduleId, { schedule, route });
        event.originName = (schedule.origin && (schedule.origin.name || schedule.origin.nameGreek)) || null;
        event.destinationName = (schedule.destination && (schedule.destination.name || schedule.destination.nameGreek)) || null;
        const ourStop = route.find(r => govIds.includes(r.stationId));
        event.ourStationState = ourStop ? ourStop.state : null;
        event.lineGroup = identifyTrainLineGroup(route);
      } catch (err) {
        console.error(`Failed to fetch schedule ${scheduleId}:`, err);
      }
    }));

    currentSuburbanTrainEvents = merged;
    renderSuburbanTrainList(isInitialLoad);
  } catch (error) {
    console.error(`Failed to fetch railway data for "${properties.name}":`, error);
    // keep showing old data on a failed background refresh instead of wiping the view and just retry next tick
    if (isInitialLoad) {
      currentSuburbanTrainEvents = [];
      showFinalError(contentArea, 'Could not load live rail data.');
    }
  } finally {
    startSuburbanTimer();
  }
}

function showSuburbanInfo(properties) {
  clearDemotedPanels();
  stopTimer();
  stopFerryCountdownTicker();
  if (typeof stopCityLiveTimer === 'function') stopCityLiveTimer();
  if (typeof clearCitySelectedStopMarker === 'function') clearCitySelectedStopMarker();
  stopInfoPanel.classList.remove("visible");
  metroStationPanel.classList.remove("visible");
  tramStationPanel.classList.remove("visible");
  ferryStationPanel.classList.remove("visible");
  cityStopPanel.classList.remove("visible");
  schedulePanel.classList.remove("visible");
  if (selectedStopMarker) {
    selectedStopMarker.remove();
    selectedStopMarker = null;
  }
  if (selectedHeadingMarker) {
    selectedHeadingMarker.remove();
    selectedHeadingMarker = null;
  }

  currentSuburbanProperties = properties;
  suburbanStationTitle.textContent = properties.name;
  const groups = properties.groups || [];
  suburbanStationLines.innerHTML = groups
    .map(g => `<span class="suburban-line-pill" style="background:${suburbanGroupColors.get(g) || '#64748b'}">${g}</span>`)
    .join('');
  suburbanStationPanel.classList.add("visible");

  const contentArea = document.getElementById('suburban-station-content');
  showLoadingUI(contentArea, 'Loading Live Data...', true);
  fetchAndRenderSuburbanArrivals(properties, true);
}

// no new network requests - just rereads what the sse stream already put
// in liveTrainPositionsByScheduleId and patches rows instead of waiting for the 60s refresh
function refreshLiveTrainRowProgressSections() {
  const contentArea = document.getElementById('suburban-station-content');
  if (!contentArea) return;
  contentArea.querySelectorAll(':scope .train-row[data-schedule-id]').forEach((row) => {
    const scheduleId = row.dataset.scheduleId;
    if (!scheduleId) return;
    // also catches an average delay that only became available after this
    // row already rendered - cheap dom patch with no extra network requests
    refreshTrainRowTimesEstimate(row, scheduleId);
    const freshHtml = renderTrainRowLiveProgress(scheduleId).trim();
    const existing = row.querySelector(':scope > .train-live-progress');
    if (!freshHtml) {
      if (existing) existing.remove();
      return;
    }
    const temp = document.createElement('div');
    temp.innerHTML = freshHtml;
    const fresh = temp.firstElementChild;
    if (existing) {
      existing.replaceWith(fresh);
    } else {
      const anchor = row.querySelector(':scope > .train-route-details');
      row.insertBefore(fresh, anchor || null);
    }
  });
}

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
      // background refresh with no loading wipe keeps whatever the user had open or scrolled to
      fetchAndRenderSuburbanArrivals(currentSuburbanProperties, false);
    }
  }
  suburbanRefreshIntervalId = setInterval(() => { timeLeft--; updateTimer(); }, 1000);
  updateTimer();
  suburbanLiveProgressIntervalId = setInterval(refreshLiveTrainRowProgressSections, 3000);
}

function stopSuburbanTimer() {
  if (suburbanRefreshIntervalId) {
    clearInterval(suburbanRefreshIntervalId);
    suburbanRefreshIntervalId = null;
  }
  if (suburbanLiveProgressIntervalId) {
    clearInterval(suburbanLiveProgressIntervalId);
    suburbanLiveProgressIntervalId = null;
  }
  suburbanRefreshContainer.classList.remove('visible');
}

function showTramInfo(properties) {
  clearDemotedPanels();
  stopTimer();
  stopSuburbanTimer();
  stopFerryCountdownTicker();
  if (typeof stopCityLiveTimer === 'function') stopCityLiveTimer();
  if (typeof clearCitySelectedStopMarker === 'function') clearCitySelectedStopMarker();
  stopInfoPanel.classList.remove("visible");
  metroStationPanel.classList.remove("visible");
  suburbanStationPanel.classList.remove("visible");
  ferryStationPanel.classList.remove("visible");
  cityStopPanel.classList.remove("visible");
  schedulePanel.classList.remove("visible");
  
  if (selectedStopMarker) {
    selectedStopMarker.remove();
    selectedStopMarker = null;
  }
  if (selectedHeadingMarker) {
    selectedHeadingMarker.remove();
    selectedHeadingMarker = null;
  }

  const iconHtml = createTramIcon(properties.LINE_T);
  tramStationTitle.innerHTML = `<div class="metro-panel-icon">${iconHtml}</div><span>${properties.GNAME}</span>`;
  
  const lines = properties.LINE_T.split('+');
  const coloredLinesHtml = lines.map(line => {
    let color = tramColors[line] || '#333';
    return `<span style="color: ${color};">${line}</span>`;
  }).join(' & ');
  
  tramStationLines.innerHTML = coloredLinesHtml;
  tramStationPanel.classList.add("visible");
}

// ─── ferry gates (port of piraeus / olp.gr) ────────────────────────────────
// no public json api - scrapes olp.gr's dromologia.php tables, turning each
// row into a {ColumnName: value} record keyed off the last header row
const OLP_SCHEDULE_URL = 'https://www.olp.gr/dromologia.php';

function parseOlpTable(tableEl) {
  const headers = [];
  const rows = [];
  tableEl.querySelectorAll('tr').forEach((tr) => {
    const cells = Array.from(tr.querySelectorAll('th,td'));
    const values = cells.map((c) => c.textContent.trim());
    if (!values.length) return;
    const hasTh = tr.querySelector('th');
    const hasTd = tr.querySelector('td');
    if (hasTh && !hasTd) headers.push(values);
    else rows.push(values);
  });
  return { headers, rows };
}

function olpRowsToRecords(headers, rows) {
  let columnNames = null;
  for (let i = headers.length - 1; i >= 0; i--) {
    if (headers[i].length >= 3) { columnNames = headers[i]; break; }
  }
  if (!columnNames) return rows.map((raw) => ({ raw }));
  return rows.map((row) => {
    if (row.length !== columnNames.length) return { raw: row };
    const record = {};
    columnNames.forEach((name, i) => { record[name] = row[i]; });
    return record;
  });
}

function parseOlpResponse(htmlText) {
  const doc = new DOMParser().parseFromString(htmlText, 'text/html');
  const sections = {};
  doc.querySelectorAll('div[id]').forEach((div) => {
    const table = div.querySelector('table');
    if (!table) return;
    const { headers, rows } = parseOlpTable(table);
    const entry = { headers };
    if (div.id.startsWith('departure_') || div.id.startsWith('arrivals_')) {
      entry.records = olpRowsToRecords(headers, rows);
    } else {
      entry.rows = rows;
    }
    sections[div.id] = entry;
  });
  return sections;
}

// olp mixes greek and latin capital E ("Ε9" vs "E9") for the gate column,
// so matching has to normalize that away rather than compare raw text
function normalizeGateLabel(raw) {
  return (raw || '').replace(/Ε/g, 'E').trim().toUpperCase();
}

async function fetchOlpScheduleForGate(gate) {
  const url = `${PROXY_URL}${encodeURIComponent(OLP_SCHEDULE_URL)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`OLP schedule fetch failed: ${response.status}`);
  const htmlText = await response.text();
  const sections = parseOlpResponse(htmlText);
  const targetGate = normalizeGateLabel(gate);
  const byGate = (section) => (sections[section]?.records || [])
    .filter((r) => !r.raw && normalizeGateLabel(r.Gate) === targetGate);
  return {
    departures: byGate('departure_en'),
    arrivals: byGate('arrivals_en'),
  };
}

// olp's own date format is d/m/yyyy (greek convention), paired separately
// with an h:mm time column
function parseOlpDateTime(dateStr, timeStr) {
  const [day, month, year] = (dateStr || '').split('/').map(Number);
  const [hour, minute] = (timeStr || '').split(':').map(Number);
  if (!day || !month || !year || isNaN(hour) || isNaN(minute)) return null;
  return new Date(year, month - 1, day, hour, minute, 0);
}

// "in 2h 15m" for a future sailing, "1h 5m ago" once its passed - the
// schedule mixes both since it always lists a full days worth of gate traffic
function formatFerryCountdown(targetDate) {
  if (!targetDate) return '';
  const diffMs = targetDate.getTime() - Date.now();
  const isPast = diffMs < 0;
  const totalMinutes = Math.round(Math.abs(diffMs) / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h === 0) parts.push(`${m}m`);
  return isPast ? `${parts.join(' ')} ago` : `in ${parts.join(' ')}`;
}

// olp abbreviates the Blue Star Ferries fleet as "B S <name>" in the ship
// column ("B S DELOS", "B S NAXOS", ...) - written out in full for display
function expandShipName(name) {
  return (name || '').replace(/\bB\s*S\b/gi, 'BLUE STAR');
}

// "6/8/2026" -> "06/08"; the year is never useful here (schedules only ever
// span today/tomorrow) so it's dropped to keep the row compact
const FERRY_MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// "6/8/2026" + "01:40" -> "06 AUG 01:40" - year dropped (only today/tomorrow
// ever shown), month spelled out instead of an easy-to-misread number
function formatFerryDateTime(dateStr, timeStr) {
  const [day, month] = (dateStr || '').split('/');
  if (!day || !month) return timeStr || '';
  const monthName = FERRY_MONTH_ABBR[Number(month) - 1] || month;
  return `${day.padStart(2, '0')} ${monthName} ${timeStr || ''}`.trim();
}

function renderFerryScheduleRows(container, records, actionLabel) {
  if (!records.length) {
    container.innerHTML = '<div class="info-message">No sailings listed.</div>';
    return;
  }
  container.innerHTML = records.map((r) => {
    const target = parseOlpDateTime(r.Date, r.Time);
    return `
    <div class="ferry-schedule-row">
      <div class="ferry-row-main">
        <span class="ferry-row-ship">${expandShipName(r.Ship)}</span>
        <div class="ferry-row-pills">
          <span class="ferry-pill-datetime">${actionLabel} ${formatFerryDateTime(r.Date, r.Time)}</span>
          <span class="ferry-pill-duration" data-target="${target ? target.getTime() : ''}">${formatFerryCountdown(target)}</span>
        </div>
      </div>
    </div>
  `;
  }).join('');
}

// re-renders just the countdown text every second while the panel is open,
// instead of re-fetching/re-rendering the whole list
function tickFerryCountdowns() {
  ferryStationPanel.querySelectorAll('.ferry-pill-duration[data-target]').forEach((el) => {
    const target = Number(el.dataset.target);
    if (!target) return;
    el.textContent = formatFerryCountdown(new Date(target));
  });
}

function stopFerryCountdownTicker() {
  if (ferryCountdownIntervalId) {
    clearInterval(ferryCountdownIntervalId);
    ferryCountdownIntervalId = null;
  }
}

async function showFerryInfo(gate) {
  currentFerryGate = gate;
  clearDemotedPanels();
  stopTimer();
  stopSuburbanTimer();
  stopFerryCountdownTicker();
  if (typeof stopCityLiveTimer === 'function') stopCityLiveTimer();
  if (typeof clearCitySelectedStopMarker === 'function') clearCitySelectedStopMarker();
  stopInfoPanel.classList.remove("visible");
  metroStationPanel.classList.remove("visible");
  suburbanStationPanel.classList.remove("visible");
  tramStationPanel.classList.remove("visible");
  cityStopPanel.classList.remove("visible");
  schedulePanel.classList.remove("visible");

  if (selectedStopMarker) {
    selectedStopMarker.remove();
    selectedStopMarker = null;
  }
  if (selectedHeadingMarker) {
    selectedHeadingMarker.remove();
    selectedHeadingMarker = null;
  }

  const iconHtml = createFerryIcon(gate);
  ferryStationTitle.innerHTML = `<div class="metro-panel-icon">${iconHtml}</div><span>Gate ${gate}</span><div class="ferry-title-ship-icon">${createShipGlyph()}</div>`;
  ferryStationPanel.classList.add("visible");
  ferryStationUpdated.textContent = '';

  if (!dataFeaturesEnabled.ports) {
    showFinalError(ferryArrivalsList, dataOffMessage('Piraeus ports'));
    showFinalError(ferryDeparturesList, dataOffMessage('Piraeus ports'));
    markDataNeeded('ports');
    return;
  }

  showLoadingUI(ferryArrivalsList, "Loading arrivals...");
  showLoadingUI(ferryDeparturesList, "Loading departures...");

  try {
    const { departures, arrivals } = await fetchOlpScheduleForGate(gate);
    renderFerryScheduleRows(ferryArrivalsList, arrivals, 'ARRIVING AT');
    renderFerryScheduleRows(ferryDeparturesList, departures, 'DEPARTING AT');
    ferryStationUpdated.textContent = `Updated ${formatEtaClock(0)}`;
    // countdown only shows hours/minutes now (no seconds), so a tick every
    // 20s is plenty to keep it accurate without pointless re-renders
    ferryCountdownIntervalId = setInterval(tickFerryCountdowns, 20000);
  } catch (error) {
    console.error(`Failed to load OLP schedule for gate ${gate}:`, error);
    showFinalError(ferryArrivalsList, "Could not load arrivals.");
    showFinalError(ferryDeparturesList, "Could not load departures.");
  }
}

ferryStationClose.addEventListener('click', () => {
  ferryStationPanel.classList.remove('visible');
  stopFerryCountdownTicker();
  currentFerryGate = null;
  clearDataNeeded('ports');
});

suburbanStationClose.addEventListener('click', () => {
  suburbanStationPanel.classList.remove('visible');
  stopSuburbanTimer();
  clearDataNeeded('trains');
});

suburbanStationRefresh.addEventListener('click', () => {
  if (currentSuburbanProperties) {
    stopSuburbanTimer();
    fetchAndRenderSuburbanArrivals(currentSuburbanProperties, false);
  }
});

document.querySelectorAll('input[name="suburban-filter"]').forEach((radio) => {
  radio.addEventListener('change', (e) => {
    suburbanShowAllTrains = e.target.value === 'all';
    renderSuburbanTrainList();
  });
});

// delegated listener so it survives the content getting replaced on refresh
document.getElementById('suburban-station-content').addEventListener('click', async (e) => {
  const locateBtn = e.target.closest('.train-locate-btn');
  if (locateBtn) {
    const row = locateBtn.closest('.train-row');
    const marker = liveTrainMarkersByScheduleId.get(row.dataset.scheduleId);
    if (marker) map.flyTo({ center: marker.getLngLat(), zoom: 15, duration: 1000 });
    return;
  }

  const button = e.target.closest('.train-route-toggle');
  if (!button) return;
  const row = button.closest('.train-row');
  const details = row.querySelector('.train-route-details');
  const scheduleId = row.dataset.scheduleId;
  if (!scheduleId || !details) return;

  if (!details.hidden) {
    details.hidden = true;
    button.classList.remove('expanded');
    return;
  }

  details.hidden = false;
  button.classList.add('expanded');

  const cached = suburbanScheduleCache.get(scheduleId);
  if (cached) {
    details.innerHTML = renderRouteTimeline(cached.route, currentSuburbanProperties ? currentSuburbanProperties.govIds : []);
    refreshTrainRowTimesEstimate(row, scheduleId);
    return;
  }

  details.innerHTML = '<div class="loader-container"><div class="loader-text">Loading route...</div></div>';
  try {
    const schedule = await fetchTrainSchedule(scheduleId);
    if (!schedule) {
      details.innerHTML = '<div class="info-message">Could not load full route.</div>';
      return;
    }
    const route = buildFullRoute(schedule);
    suburbanScheduleCache.set(scheduleId, { schedule, route });
    details.innerHTML = renderRouteTimeline(route, currentSuburbanProperties ? currentSuburbanProperties.govIds : []);
    refreshTrainRowTimesEstimate(row, scheduleId);
  } catch (error) {
    console.error(`Failed to fetch schedule ${scheduleId}:`, error);
    details.innerHTML = '<div class="info-message">Could not load full route.</div>';
  }
});

metroStationClose.addEventListener('click', () => {
  metroStationPanel.classList.remove('visible');
  stopTimer();
  stopSuburbanTimer();
});

tramStationClose.addEventListener('click', () => {
    tramStationPanel.classList.remove('visible');
});

// live train positions from the sse stream
const TRAIN_STREAM_URL = `${PROXY_URL}${encodeURIComponent('https://railway.gov.gr/api/train-stream')}`;
// dark gray for anything not one of our local suburban groups (intercity,
// regional, freight) and while a schedule is still loading
const DEFAULT_LIVE_TRAIN_COLOR = '#4b5563';
let liveTrainMarkers = new Map(); // train id to marker
let pendingLiveTrainScheduleFetches = new Set(); // schedule ids currently being fetched

// same chevron style as createheadingicon uses for stop headings plus a dot for the trains own position
// the selected train also gets an expanding sonar style ring in its own line color as a whos this pick
function createLiveTrainIconSvg(heading, color, isSelected) {
  const c = color || DEFAULT_LIVE_TRAIN_COLOR;
  const hasHeading = typeof heading === 'number' && !isNaN(heading);
  const arrow = hasHeading
    ? `<g transform="rotate(${heading} 16 16)"><path d="M16 2 L11 13 L16 10 L21 13 Z" fill="${c}" stroke="#fff" stroke-width="0.6"/></g>`
    : '';
  const sonarRing = isSelected ? `<circle class="live-train-sonar-ring" cx="16" cy="16" r="6.5" fill="none" stroke="${c}" stroke-width="2.5"/>` : '';
  return `<svg viewBox="0 0 32 32" style="overflow: visible; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));">${sonarRing}${arrow}<circle cx="16" cy="16" r="6.5" fill="${c}" stroke="#fff" stroke-width="1.5"/></svg>`;
}

function getTrainHeading(pos) {
  if (typeof pos.trackHeading === 'number' && !isNaN(pos.trackHeading)) return pos.trackHeading;
  if (pos.hasCourse && typeof pos.course === 'number' && !isNaN(pos.course)) return pos.course;
  return null;
}

// fetches and caches a schedule if not already cached or in flight used for color matching and the live popup
function ensureTrainScheduleCached(scheduleId) {
  if (!scheduleId || suburbanScheduleCache.has(scheduleId) || pendingLiveTrainScheduleFetches.has(scheduleId)) return;
  pendingLiveTrainScheduleFetches.add(scheduleId);
  fetchTrainSchedule(scheduleId)
    .then((schedule) => {
      if (schedule) suburbanScheduleCache.set(scheduleId, { schedule, route: buildFullRoute(schedule) });
    })
    .catch((err) => console.error(`Failed to fetch schedule ${scheduleId} for live train:`, err))
    .finally(() => pendingLiveTrainScheduleFetches.delete(scheduleId));
}

function getLiveTrainColor(pos) {
  if (!pos.scheduleId) return DEFAULT_LIVE_TRAIN_COLOR;

  const cached = suburbanScheduleCache.get(pos.scheduleId);
  if (cached) {
    const group = identifyTrainLineGroup(cached.route);
    return (group && suburbanGroupColors.get(group)) || DEFAULT_LIVE_TRAIN_COLOR;
  }

  ensureTrainScheduleCached(pos.scheduleId);
  return DEFAULT_LIVE_TRAIN_COLOR;
}

function createLiveTrainMarker(lngLat, heading, color) {
  const el = document.createElement('div');
  el.className = 'live-train-icon';
  el.style.width = '28px';
  el.style.height = '28px';
  el.innerHTML = createLiveTrainIconSvg(heading, color, false);
  return new maplibregl.Marker({ element: el, rotationAlignment: 'map' }).setLngLat(lngLat);
}

// last confirmed stop and the next, not origin/destination - prefers the
// timetable board's live telemetry over the schedule's own state so both agree on "current"
function getTrainProgressStops(route, scheduleId) {
  if (!route || route.length === 0) return null;
  const telemetry = scheduleId ? timetableTelemetryByScheduleId.get(scheduleId) : null;
  if (telemetry && telemetry.nextStationId) {
    const nextIdx = route.findIndex((stop) => stop.stationId === telemetry.nextStationId);
    if (nextIdx > 0) return { current: route[nextIdx - 1], next: route[nextIdx] };
    if (nextIdx === 0) return { current: route[0], next: route[0] };
  }
  let currentIdx = -1;
  route.forEach((stop, i) => { if (stop.state === 'passed') currentIdx = i; });
  if (currentIdx === -1) currentIdx = 0;
  return { current: route[currentIdx], next: route[currentIdx + 1] || null };
}

// long station names get shortened just for this progress line
// ska is the big acharnes railway hub and its full name eats too much space here
function abbreviateProgressStopName(name) {
  if (!name) return name;
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('σιδηροδρομικ') && normalized.includes('αχαρνων')) return 'ΣΚΑ';
  return name;
}

const trainAtStopRadiusMeters = 150;

// yards like the rentis depot fan out over hundreds of meters around the
// one point we have coordinates for, so this needs a wider radius than a platform
const nearestStopRadiusMeters = 500;

// the schedule only flips a stop to passed once a real arrival lags in -
// distanceToNextStation_m is usually null too, so this measures our own stop coords instead
function isTrainStoppedAtNextStation(pos) {
  // prefer the timetable board's own speed field when available so the two
  // features never disagree about whether a train is stopped
  const telemetry = pos.scheduleId ? timetableTelemetryByScheduleId.get(pos.scheduleId) : null;
  if (telemetry && typeof telemetry.speedKmh === 'number') {
    if (telemetry.speedKmh >= 1) return false;
  } else if (typeof pos.speed !== 'number' || pos.speed >= 1) {
    return false;
  }
  if (typeof pos.lat !== 'number' || typeof pos.lng !== 'number') return false;

  if (typeof pos.distanceToNextStation_m === 'number') {
    return pos.distanceToNextStation_m <= trainAtStopRadiusMeters;
  }

  const stop = pos.nextStationId ? suburbanStopCoordsByGovId.get(pos.nextStationId) : null;
  if (!stop) return false;
  const distance = distanceMeters({ lat: pos.lat, lng: pos.lng }, stop);
  return distance <= trainAtStopRadiusMeters;
}

// nearest stop by straight line distance, any line - an unmatched train has
// no schedule to say whats next, so closest is the best guess
function findClosestSuburbanStop(lat, lng) {
  let closestName = null;
  let closestDistance = Infinity;
  suburbanStopCoordsByGovId.forEach((stop) => {
    const distance = distanceMeters({ lat, lng }, stop);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestName = stop.name;
    }
  });
  return closestName ? { name: closestName, distance: closestDistance } : null;
}

// unmatched trains have no schedule to say whats next but a stationary one
// this close to some real stop is still worth naming instead of just corridor and speed
function getStoppedNearbyStopName(pos) {
  if (typeof pos.speed !== 'number' || pos.speed >= 1) return null;
  if (typeof pos.lat !== 'number' || typeof pos.lng !== 'number') return null;
  const closest = findClosestSuburbanStop(pos.lat, pos.lng);
  if (!closest || closest.distance > nearestStopRadiusMeters) return null;
  return closest.name;
}

// green dot for last stop, pulsing dot for next, chasing line between them -
// isAtStop drops that layout for one slow-flashing dot on the actual stop
function renderTrainProgressLine(current, next, isAtStop = false, pos = null) {
  if (!next) {
    return `
      <div class="train-progress">
        <div class="train-progress-stop">
          <span class="train-progress-dot current"></span>
          <span class="train-progress-name current">${abbreviateProgressStopName(current.name)}</span>
        </div>
      </div>`;
  }
  if (isAtStop) {
    // the schedule's "next" claim can be wrong or stale - while stopped,
    // trust the train's real gps position over it instead
    const nearest = pos ? findClosestSuburbanStop(pos.lat, pos.lng) : null;
    const stoppedName = (nearest && nearest.distance <= trainAtStopRadiusMeters) ? nearest.name : next.name;
    return `
      <div class="train-progress">
        <div class="train-progress-stop">
          <span class="train-progress-dot stopped"></span>
          <span class="train-progress-stopped-label">Currently stopped at</span>
          <span class="train-progress-name at-stop">${abbreviateProgressStopName(stoppedName)}</span>
        </div>
      </div>`;
  }
  return `
    <div class="train-progress">
      <div class="train-progress-stop">
        <span class="train-progress-dot passed"></span>
        <span class="train-progress-name passed">${abbreviateProgressStopName(current.name)}</span>
      </div>
      <div class="train-progress-track" style="--chase-delay:-${Date.now() % 1600}ms"></div>
      <div class="train-progress-stop">
        <span class="train-progress-dot current"></span>
        <span class="train-progress-name current">${abbreviateProgressStopName(next.name)}</span>
      </div>
    </div>`;
}

// shared by the station panel row and the live sheet - only for a train
// tracked live on the map, since the stream already gives a real speed directly
function renderTrainSpeedBadge(speed) {
  if (typeof speed !== 'number' || isNaN(speed)) return '';
  return `
    <div class="train-speed">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 15l4-5"/><circle cx="12" cy="15" r="1.3" fill="currentColor" stroke="none"/></svg>
      <span>${Math.round(speed)} km/h</span>
    </div>`;
}

function renderTrainRowLiveProgress(scheduleId) {
  if (!scheduleId) return '';
  const pos = liveTrainPositionsByScheduleId.get(scheduleId);
  if (!pos) return '';
  const cached = suburbanScheduleCache.get(scheduleId);
  const progress = cached ? getTrainProgressStops(cached.route, scheduleId) : null;
  const progressLine = progress ? renderTrainProgressLine(progress.current, progress.next, isTrainStoppedAtNextStation(pos), pos) : '';
  const speedHtml = renderTrainSpeedBadge(pos.speed);
  if (!progressLine && !speedHtml) return '';
  return `<div class="train-live-progress">${progressLine}${speedHtml}</div>`;
}

// shown in the sheet's own header, bigger/bolder than the compact panel rows -
// an unmatched train still usually has a next station on the stream itself as fallback
function renderLiveTrainTitle(pos) {
  const scheduleId = pos.scheduleId || null;
  const cached = scheduleId ? suburbanScheduleCache.get(scheduleId) : null;
  if (cached) {
    const schedule = cached.schedule;
    const originName = (schedule.origin && (schedule.origin.name || schedule.origin.nameGreek)) || 'Origin';
    const destName = (schedule.destination && (schedule.destination.name || schedule.destination.nameGreek)) || 'Destination';
    return `
      <span class="live-train-title-from">${originName}</span>
      <svg class="live-train-title-arrow" viewBox="0 0 24 24"><path d="M4 12h14m0 0l-5-5m5 5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span class="live-train-title-to">${destName}</span>`;
  }
  // a stopped train has no real route to point between - generic label up
  // top, actual "stopped at" name goes on the bigger detail line below
  if (getStoppedNearbyStopName(pos)) {
    return '<span class="live-train-title-unknown">Train of unknown origin and destination</span>';
  }
  if (pos.nextStation) {
    return `
      <span class="live-train-title-from">Heading to</span>
      <svg class="live-train-title-arrow" viewBox="0 0 24 24"><path d="M4 12h14m0 0l-5-5m5 5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span class="live-train-title-to">${pos.nextStation}</span>`;
  }
  if (pos.corridor) return `<span class="live-train-title-from">${formatCorridorName(pos.corridor)} corridor</span>`;
  return '';
}

// the corridor code the stream tags every position with is shouty and
// all one word like kiato or chalkida so just tidy the casing up for display
function formatCorridorName(corridor) {
  return corridor.split(/[\s_]+/).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

// hover tooltip - called again once the async schedule fetch resolves to
// swap the loading state for real origin/destination, kept to a quick glance
function renderLiveTrainTooltip(pos) {
  const cached = pos.scheduleId ? suburbanScheduleCache.get(pos.scheduleId) : null;
  const schedule = cached ? cached.schedule : null;
  const originName = schedule && schedule.origin && (schedule.origin.name || schedule.origin.nameGreek);
  const destName = schedule && schedule.destination && (schedule.destination.name || schedule.destination.nameGreek);
  if (!originName || !destName) {
    return '<div class="live-train-tooltip unknown">Train of unknown origin and destination</div>';
  }
  return `
    <div class="live-train-tooltip">
      <span>${originName}</span>
      <svg class="live-train-tooltip-arrow" viewBox="0 0 24 24"><path d="M4 12h14m0 0l-5-5m5 5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>${destName}</span>
    </div>`;
}

// camera-stream availability per trainId, checked once and cached so the
// live button doesn't need a fresh network round trip on every refresh tick
const trainCameraStreamCache = new Map();
const trainCameraStreamChecksInFlight = new Map();

async function checkTrainCameraStream(trainId) {
  if (trainCameraStreamCache.has(trainId)) return trainCameraStreamCache.get(trainId);
  if (trainCameraStreamChecksInFlight.has(trainId)) return trainCameraStreamChecksInFlight.get(trainId);

  const promise = (async () => {
    const url = `${PROXY_URL}${encodeURIComponent(`https://railway.gov.gr/api/public/trains/${trainId}/stream`)}`;
    let result = null;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.hls && data.hls.isLive && data.hls.playlistUrl) {
          result = { playlistUrl: data.hls.playlistUrl };
        }
      }
    } catch (err) {
      result = null;
    }
    trainCameraStreamCache.set(trainId, result);
    trainCameraStreamChecksInFlight.delete(trainId);
    return result;
  })();

  trainCameraStreamChecksInFlight.set(trainId, promise);
  return promise;
}

// same card style as the station panel rows but without the title row
// since that now lives in the sheets own header via renderlivetraintitle
function renderLiveTrainRow(pos) {
  const scheduleId = pos.scheduleId || null;
  const cached = scheduleId ? suburbanScheduleCache.get(scheduleId) : null;
  const serviceType = (cached && cached.schedule.serviceType) || pos.serviceType || '';
  const color = getServiceTypeColor(serviceType);
  const lineGroup = cached ? identifyTrainLineGroup(cached.route) : null;
  const serviceTypeBadge = lineGroup
    ? `<span class="suburban-line-pill train-line-service-pill" style="background:${suburbanGroupColors.get(lineGroup) || color}">${lineGroup} ${serviceType.toUpperCase()}</span>`
    : `<span class="train-service-type" style="color:${color}">${serviceType}</span>`;

  let timesRow = '';
  let progressSection = '';
  if (cached) {
    const schedule = cached.schedule;
    const originName = (schedule.origin && (schedule.origin.name || schedule.origin.nameGreek)) || 'Origin';
    const destName = (schedule.destination && (schedule.destination.name || schedule.destination.nameGreek)) || 'Destination';

    const departureLeg = {
      scheduledTime: schedule.scheduledDeparture, actualTime: schedule.actualDeparture,
      status: schedule.actualDeparture ? 'departed' : 'scheduled', platform: null,
    };
    const arrivalLeg = {
      scheduledTime: schedule.scheduledArrival, actualTime: schedule.actualArrival,
      status: schedule.actualArrival ? 'arrived' : (schedule.status === 'in_progress' ? 'approaching' : 'scheduled'), platform: null,
    };
    const avgDelay = computeAverageRouteDelay(cached.route);
    timesRow = `
      <div class="train-times">
        ${renderTrainLeg(departureLeg, 'αφετηρια', false, true, originName, avgDelay)}
        ${renderTrainLeg(arrivalLeg, 'τερμα', false, true, destName, avgDelay)}
      </div>`;

    const progress = getTrainProgressStops(cached.route, scheduleId);
    const speedBadge = renderTrainSpeedBadge(pos.speed);
    const atStop = isTrainStoppedAtNextStation(pos);
    // the row itself now says currently stopped at directly so the caption
    // above it would just repeat that only the moving state still needs one
    const progressCaption = atStop ? '' : '<div class="train-progress-caption">Currently doing the part:</div>';
    progressSection = progress
      ? `${progressCaption}<div class="train-progress-row">${renderTrainProgressLine(progress.current, progress.next, atStop, pos)}${speedBadge}</div>`
      : '';
  } else if (scheduleId) {
    progressSection = '<div class="train-route-diagram-loading">Loading route…</div>';
  } else {
    // no scheduleId means the api never matched a schedule, but the stream
    // still tags a corridor and speed - show that instead of a blank card
    const stoppedStopName = getStoppedNearbyStopName(pos);
    const corridorText = pos.corridor ? `${formatCorridorName(pos.corridor)} corridor` : '';
    const speedBadge = renderTrainSpeedBadge(pos.speed);
    const caption = stoppedStopName ? 'Currently stopped' : 'No schedule matched yet';
    // stopped gets the bigger bolder treatment here since the header no
    // longer says it directly - this detail line is now the one place it shows
    const detailText = stoppedStopName ? `Stopped at ${stoppedStopName}` : corridorText;
    const detailClass = stoppedStopName ? 'train-fallback-detail-stopped' : 'train-fallback-detail';
    if (detailText || speedBadge) {
      progressSection = `
        <div class="train-progress-caption">${caption}</div>
        <div class="train-progress-row">${detailText ? `<span class="${detailClass}">${detailText}</span>` : ''}${speedBadge}</div>`;
    }
  }

  const toggleButton = scheduleId ? `
        <button class="train-route-toggle" title="Show full route">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>` : '';

  // only known-live cameras get the button - the check is async (see
  // checkTrainCameraStream) so this only lights up once that resolves and
  // this row gets redrawn, not on the very first paint of the sheet
  const cameraInfo = pos.trainId ? trainCameraStreamCache.get(pos.trainId) : null;
  const cameraButton = cameraInfo ? `
        <button class="train-camera-live-btn" data-train-id="${pos.trainId}" title="Watch live camera">
          ${cameraGlyphIconSvg}LIVE
        </button>` : '';

  return `
    <div class="train-row" data-schedule-id="${scheduleId || ''}">
      <div class="train-row-top">
        ${serviceTypeBadge}
        <span class="train-number-pill" style="background:${color}">${pos.trainNumber || pos.name || ''}</span>
        <div class="train-row-actions">${cameraButton}${toggleButton}</div>
      </div>
      ${timesRow}
      ${progressSection}
      ${scheduleId ? '<div class="train-route-details" hidden></div>' : ''}
    </div>`;
}

// fixed sheet, not a map-anchored popup - always has a proper spot on
// screen regardless of where the train's dot is
let currentLiveTrainSheetId = null;

const LIVE_TRAIN_DEMOTABLE_PANELS = [stopInfoPanel, suburbanStationPanel, tramStationPanel, metroStationPanel, cityStopPanel, schedulePanel];

function demotePanelsBehindLiveTrainSheet() {
  LIVE_TRAIN_DEMOTABLE_PANELS.forEach(panel => {
    if (panel && panel.classList.contains('visible')) panel.classList.add('panel-demoted');
  });
}

function undemotePanelsBehindLiveTrainSheet() {
  LIVE_TRAIN_DEMOTABLE_PANELS.forEach(panel => { if (panel) panel.classList.remove('panel-demoted'); });
}

// desktop stacks the live train sheet below an already-open panel; mobile
// keeps the bottom-sheet overlap since theres no room to stack vertically
function positionLiveTrainSheet() {
  liveTrainPanel.style.top = '';
  liveTrainPanel.style.maxHeight = '';
  if (window.innerWidth <= 768) return;
  const openPanel = LIVE_TRAIN_DEMOTABLE_PANELS.find(panel => panel && panel.classList.contains('visible'));
  if (!openPanel) return;
  const gap = 12;
  const top = openPanel.getBoundingClientRect().bottom + gap;
  liveTrainPanel.style.top = `${top}px`;
  liveTrainPanel.style.maxHeight = `calc(100vh - ${top}px - ${gap}px)`;
}

// redraws one marker's sonar ring on/off for the sheet's current train -
// called right away on select/deselect instead of waiting for the next tick
function refreshLiveTrainMarkerIcon(id) {
  const marker = liveTrainMarkers.get(id);
  const pos = liveTrainLatestPositions.get(id);
  if (!marker || !pos) return;
  marker.getElement().innerHTML = createLiveTrainIconSvg(getTrainHeading(pos), getLiveTrainColor(pos), id === currentLiveTrainSheetId);
}

// opens in front of whatever panel is already open instead of replacing it
// just dimming that panel a little rather than closing it
function openLiveTrainSheet(id) {
  const pos = liveTrainLatestPositions.get(id);
  if (!pos) return;
  const previousId = currentLiveTrainSheetId;
  currentLiveTrainSheetId = id;
  liveTrainHeaderTitle.innerHTML = renderLiveTrainTitle(pos);
  liveTrainContent.innerHTML = renderLiveTrainRow(pos);
  demotePanelsBehindLiveTrainSheet();
  positionLiveTrainSheet();
  liveTrainPanel.classList.add('visible');
  if (pos.scheduleId) ensureTrainScheduleCached(pos.scheduleId);
  if (previousId && previousId !== id) refreshLiveTrainMarkerIcon(previousId);
  refreshLiveTrainMarkerIcon(id);

  // switching to a different train invalidates whatever camera feed was
  // open, since it belonged to the previous sheet's train
  if (previousId !== id) closeTrainCameraPanel();
  if (pos.trainId && !trainCameraStreamCache.has(pos.trainId)) {
    checkTrainCameraStream(pos.trainId).then(() => {
      if (currentLiveTrainSheetId === id) updateLiveTrainSheetIfOpen(id, liveTrainLatestPositions.get(id));
    });
  }
}

function closeLiveTrainSheet() {
  const previousId = currentLiveTrainSheetId;
  currentLiveTrainSheetId = null;
  liveTrainPanel.classList.remove('visible');
  liveTrainHeaderTitle.innerHTML = '';
  undemotePanelsBehindLiveTrainSheet();
  if (previousId) refreshLiveTrainMarkerIcon(previousId);
  closeTrainCameraPanel();
}

// every section except train-route-details gets replaced fresh each tick
// the dropdown is never detached or rebuilt so its scroll position survives
const LIVE_ROW_VOLATILE_SECTIONS = ['train-row-top', 'train-times', 'train-progress-caption', 'train-progress-row', 'train-route-diagram-loading'];

// only refreshes the sheet if its currently showing this exact train
function updateLiveTrainSheetIfOpen(id, pos) {
  if (id !== currentLiveTrainSheetId) return;
  liveTrainHeaderTitle.innerHTML = renderLiveTrainTitle(pos);
  const existingRow = liveTrainContent.querySelector('.train-row');
  if (!existingRow) {
    liveTrainContent.innerHTML = renderLiveTrainRow(pos);
    return;
  }

  const temp = document.createElement('div');
  temp.innerHTML = renderLiveTrainRow(pos).trim();
  const freshRow = temp.firstElementChild;
  existingRow.dataset.scheduleId = freshRow.dataset.scheduleId || '';

  LIVE_ROW_VOLATILE_SECTIONS.forEach(cls => {
    const existingSection = existingRow.querySelector(`:scope > .${cls}`);
    const freshSection = freshRow.querySelector(`:scope > .${cls}`);
    if (existingSection && freshSection) {
      existingSection.replaceWith(freshSection);
    } else if (existingSection && !freshSection) {
      existingSection.remove();
    } else if (!existingSection && freshSection) {
      const anchor = existingRow.querySelector(':scope > .train-route-details');
      existingRow.insertBefore(freshSection, anchor || null);
    }
  });

  let routeDetails = existingRow.querySelector(':scope > .train-route-details');
  const freshRouteDetails = freshRow.querySelector(':scope > .train-route-details');
  if (!routeDetails && freshRouteDetails) {
    existingRow.appendChild(freshRouteDetails);
    routeDetails = freshRouteDetails;
  }

  if (routeDetails && !routeDetails.hidden) {
    const toggle = existingRow.querySelector('.train-route-toggle');
    if (toggle) toggle.classList.add('expanded');
    const cached = pos.scheduleId ? suburbanScheduleCache.get(pos.scheduleId) : null;
    if (cached) updateRouteTimelineInPlace(routeDetails, cached.route, []);
  }
}

// embedded inside the live train sheet itself (not a floating panel of its
// own) so it always reads as part of that sheet
let trainCameraHls = null;

function teardownTrainCameraVideo() {
  if (trainCameraHls) {
    trainCameraHls.destroy();
    trainCameraHls = null;
  }
  trainCameraVideo.pause();
  trainCameraVideo.removeAttribute('src');
  trainCameraVideo.load();
}

// desktop gets the browser's normal video controls (play/pause/fullscreen);
// mobile keeps them stripped out since there's no room to spare there and
// a fullscreened video would cover the sheet it's meant to stay part of
function applyTrainCameraControlPolicy() {
  const isDesktop = window.innerWidth > 768;
  trainCameraVideo.controls = isDesktop;
  trainCameraVideo.disablePictureInPicture = !isDesktop;
  trainCameraVideo.disableRemotePlayback = !isDesktop;
  if (isDesktop) {
    trainCameraVideo.removeAttribute('controlsList');
    trainCameraVideo.oncontextmenu = null;
  } else {
    trainCameraVideo.setAttribute('controlsList', 'nofullscreen nodownload noremoteplayback');
    trainCameraVideo.oncontextmenu = () => false;
  }
}

function openTrainCameraPanel(trainId, pos) {
  const info = trainCameraStreamCache.get(trainId);
  if (!info) return;
  liveTrainCameraRoute.innerHTML = renderLiveTrainTitle(pos);
  trainCameraStatus.textContent = '';
  trainCameraVideo.hidden = false;
  liveTrainCameraSection.hidden = false;
  liveTrainPanel.classList.add('camera-open');
  applyTrainCameraControlPolicy();
  teardownTrainCameraVideo();

  // safari plays hls natively - everywhere else needs hls.js to demux it
  if (trainCameraVideo.canPlayType('application/vnd.apple.mpegurl')) {
    trainCameraVideo.src = info.playlistUrl;
  } else if (typeof Hls !== 'undefined' && Hls.isSupported()) {
    trainCameraHls = new Hls();
    trainCameraHls.loadSource(info.playlistUrl);
    trainCameraHls.attachMedia(trainCameraVideo);
    trainCameraHls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        trainCameraVideo.hidden = true;
        trainCameraStatus.textContent = 'Could not load the live camera feed.';
      }
    });
  } else {
    trainCameraVideo.hidden = true;
    trainCameraStatus.textContent = 'Live video is not supported on this browser.';
    return;
  }
  trainCameraVideo.play().catch(() => {});
}

function closeTrainCameraPanel() {
  liveTrainCameraSection.hidden = true;
  liveTrainPanel.classList.remove('camera-open');
  teardownTrainCameraVideo();
}

liveTrainCameraClose.addEventListener('click', closeTrainCameraPanel);

// the sheet is one persistent element so this is wired once not per train
liveTrainContent.addEventListener('click', async (e) => {
  const cameraBtn = e.target.closest('.train-camera-live-btn');
  if (cameraBtn) {
    const pos = currentLiveTrainSheetId ? liveTrainLatestPositions.get(currentLiveTrainSheetId) : null;
    if (pos) openTrainCameraPanel(cameraBtn.dataset.trainId, pos);
    return;
  }
  const routeBtn = e.target.closest('.train-route-toggle');
  if (!routeBtn) return;
  const details = liveTrainContent.querySelector('.train-route-details');
  if (!details) return;
  if (!details.hidden) {
    details.hidden = true;
    routeBtn.classList.remove('expanded');
    return;
  }
  details.hidden = false;
  routeBtn.classList.add('expanded');

  const pos = currentLiveTrainSheetId ? liveTrainLatestPositions.get(currentLiveTrainSheetId) : null;
  const scheduleId = pos ? pos.scheduleId : null;
  if (!scheduleId) return;
  const cached = suburbanScheduleCache.get(scheduleId);
  if (cached) {
    details.innerHTML = renderRouteTimeline(cached.route, []);
    return;
  }
  details.innerHTML = '<div class="loader-container"><div class="loader-text">Loading route...</div></div>';
  try {
    const schedule = await fetchTrainSchedule(scheduleId);
    if (!schedule) { details.innerHTML = '<div class="info-message">Could not load full route.</div>'; return; }
    const route = buildFullRoute(schedule);
    suburbanScheduleCache.set(scheduleId, { schedule, route });
    details.innerHTML = renderRouteTimeline(route, []);
  } catch (err) {
    console.error(`Failed to fetch schedule ${scheduleId}:`, err);
    details.innerHTML = '<div class="info-message">Could not load full route.</div>';
  }
});

liveTrainClose.addEventListener('click', closeLiveTrainSheet);

function updateLiveTrainPositions(positions, animDuration) {
  const seenIds = new Set();
  liveTrainScheduleIdSet.clear();
  liveTrainMarkersByScheduleId.clear();
  liveTrainPositionsByScheduleId.clear();
  positions.forEach((pos) => {
    if (typeof pos.lat !== 'number' || typeof pos.lng !== 'number') return;
    const id = pos.id || pos.trainId;
    if (!id) return;
    seenIds.add(id);
    liveTrainLatestPositions.set(id, pos);
    const lngLat = [pos.lng, pos.lat];
    const heading = getTrainHeading(pos);
    const color = getLiveTrainColor(pos);
    let marker;
    if (liveTrainMarkers.has(id)) {
      marker = liveTrainMarkers.get(id);
      const from = marker.getLngLat();
      animateTrainMarker(marker, { lat: from.lat, lng: from.lng }, pos, animDuration);
      marker.getElement().innerHTML = createLiveTrainIconSvg(heading, color, id === currentLiveTrainSheetId);
      // schedule fetch is async so the origin/destination may only become
      // known a tick or two after the marker itself was first drawn
      if (marker._hoverPopup) marker._hoverPopup.setHTML(renderLiveTrainTooltip(pos));
      updateLiveTrainSheetIfOpen(id, pos);
    } else {
      marker = createLiveTrainMarker(lngLat, heading, color);
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'live-train-tooltip-wrapper', offset: 14 });
      popup.setHTML(renderLiveTrainTooltip(pos));
      marker._hoverPopup = popup;
      const el = marker.getElement();
      el.addEventListener('mouseenter', () => { popup.setLngLat(marker.getLngLat()).addTo(map); openMapPopups.add(popup); });
      el.addEventListener('mouseleave', () => { popup.remove(); openMapPopups.delete(popup); });
      el.addEventListener('click', () => openLiveTrainSheet(id));
      marker.addTo(map);
      liveTrainMarkers.set(id, marker);
    }
    if (pos.scheduleId) {
      liveTrainScheduleIdSet.add(pos.scheduleId);
      liveTrainMarkersByScheduleId.set(pos.scheduleId, marker);
      liveTrainPositionsByScheduleId.set(pos.scheduleId, pos);
    }
  });

  // stream snapshot is the full state so drop anything missing from it
  liveTrainMarkers.forEach((marker, id) => {
    if (seenIds.has(id)) return;
    if (marker._hoverPopup) marker._hoverPopup.remove();
    marker.remove();
    liveTrainMarkers.delete(id);
    liveTrainLatestPositions.delete(id);
    if (id === currentLiveTrainSheetId) closeLiveTrainSheet();
  });
}

// moves a train marker to its new spot over time instead of snapping there
function animateTrainMarker(marker, from, to, duration = 900) {
  if (marker._animationId) cancelAnimationFrame(marker._animationId);
  let startTime = null;
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = (timestamp - startTime) / duration;
    if (progress > 1) {
      marker.setLngLat([to.lng, to.lat]);
      marker._animationId = null;
      return;
    }
    const lat = from.lat + (to.lat - from.lat) * progress;
    const lng = from.lng + (to.lng - from.lng) * progress;
    marker.setLngLat([lng, lat]);
    marker._animationId = requestAnimationFrame(step);
  }
  marker._animationId = requestAnimationFrame(step);
}

// every message applies as it arrives - animation duration just tracks the
// real gap since the last one, so markers glide regardless of server rate
let lastTrainUpdateTime = null;
let trainPositionEventSource = null;

function startTrainPositionStream() {
  if (trainPositionEventSource || !dataFeaturesEnabled.trains) return;
  const source = new EventSource(TRAIN_STREAM_URL);
  trainPositionEventSource = source;
  source.addEventListener('trainPositionsUx', (e) => {
    try {
      addDataUsage('trains', new Blob([e.data]).size);
      const data = JSON.parse(e.data);
      if (!data || !Array.isArray(data.positions)) return;
      const now = performance.now();
      const gap = lastTrainUpdateTime ? now - lastTrainUpdateTime : 900;
      lastTrainUpdateTime = now;
      updateLiveTrainPositions(data.positions, Math.min(Math.max(gap, 500), 5000));
    } catch (err) {
      console.error('Failed to parse train position update:', err);
    }
  });
  source.onerror = (err) => {
    console.error('Train position stream error (EventSource will auto-reconnect):', err);
  };
}

function stopTrainPositionStream() {
  if (trainPositionEventSource) {
    trainPositionEventSource.close();
    trainPositionEventSource = null;
  }
}

// keeps the track/station layers, just drops the live train dots - used when
// trains data gets switched off (js/10-data-usage.js)
function clearAllLiveTrainMarkers() {
  liveTrainMarkers.forEach((marker) => {
    if (marker._animationId) cancelAnimationFrame(marker._animationId);
    if (marker._hoverPopup) marker._hoverPopup.remove();
    marker.remove();
  });
  liveTrainMarkers.clear();
  liveTrainLatestPositions.clear();
  liveTrainScheduleIdSet.clear();
  liveTrainMarkersByScheduleId.clear();
  liveTrainPositionsByScheduleId.clear();
  if (typeof closeLiveTrainSheet === 'function') closeLiveTrainSheet();
}

startTrainPositionStream();