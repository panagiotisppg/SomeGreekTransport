// dom elements
const loadingOverlay = document.getElementById("loading-overlay");
const progressBar = document.getElementById("loading-bar-progress");
const loadingText = document.getElementById("loading-text");
const stopInfoPanel = document.getElementById("stop-info-panel");
const stopInfoTitle = document.getElementById("stop-info-title");
const stopInfoArrivals = document.getElementById("stop-info-arrivals");
const stopInfoClose = document.getElementById("stop-info-close");
const stopInfoRefresh = document.getElementById("stop-info-refresh");
const autoRefreshContainer = document.getElementById("auto-refresh-container");
const timerProgress = document.querySelector(".timer-progress");
const timerText = document.getElementById("timer-text");
const clearRouteButton = document.getElementById("clear-route-button");
const deleteModal = document.getElementById('delete-confirmation-modal');
const deletePopup = document.getElementById('delete-options-popup');
const deleteCyanBtn = document.getElementById('delete-route-cyan');
const deleteGreenBtn = document.getElementById('delete-route-green');
const deleteAllBtn = document.getElementById('delete-route-all');
const metroStationPanel = document.getElementById("metro-station-panel");
const metroStationTitle = document.getElementById("metro-station-title");
const metroStationLines = document.getElementById("metro-station-lines");
const metroStationClose = document.getElementById("metro-station-close");
const suburbanStationPanel = document.getElementById("suburban-station-panel");
const suburbanStationTitle = document.getElementById("suburban-station-title");
const suburbanStationClose = document.getElementById("suburban-station-close");
const suburbanStationRefresh = document.getElementById("suburban-station-refresh");
const layerControlBtn = document.getElementById('layer-control-button');
const layerControlPanel = document.getElementById('layer-control-panel');
const toggleZoomOnRoute = document.getElementById('toggle-zoom-on-route'); 
const toggleBusStops = document.getElementById('toggle-bus-stops');
const toggleBusNetwork = document.getElementById('toggle-bus-network');
const toggleMetroNetwork = document.getElementById('toggle-metro-network');
const toggleSuburbanNetwork = document.getElementById('toggle-suburban-network');
const suburbanRefreshContainer = document.getElementById("suburban-refresh-container");
const suburbanTimerProgress = document.getElementById("suburban-timer-progress");
const suburbanTimerText = document.getElementById("suburban-timer-text");
const tabArrivals = document.getElementById("tab-arrivals");
const tabLines = document.getElementById("tab-lines");
const arrivalsContent = document.getElementById("stop-info-arrivals");
const linesContent = document.getElementById("stop-info-lines-content");
const schedulePanel = document.getElementById("schedule-panel");
const scheduleLoadingOverlay = document.getElementById("schedule-loading-overlay");
const scheduleProgressBar = document.getElementById("schedule-loading-bar-progress");
const scheduleTitle = document.getElementById("schedule-title");
const scheduleClose = document.getElementById("schedule-close");
const scheduleGoTimes = document.getElementById("schedule-go-times");
const scheduleComeTimes = document.getElementById("schedule-come-times");
const scheduleRoutesTitle = document.getElementById("schedule-routes-title");
const scheduleRoutesList = document.getElementById("schedule-routes-list");
const plotNotification = document.getElementById("plot-notification");
const goTimesSection = document.getElementById("go-times-section");
const comeTimesSection = document.getElementById("come-times-section");
const searchInput = document.getElementById("search-input");
const searchResultsContainer = document.getElementById("search-results-container");
const searchContainer = document.getElementById("search-container");
const searchToggle = document.querySelector(".toggle-switch");
const locationButton = document.getElementById("location-button");
const customControlsContainer = document.querySelector(".custom-controls-container");
const delayTooltip = document.getElementById('delay-tooltip');
const activeTimersContainer = document.getElementById('active-timers-container');

// apply touch setting for dragging
if (plotNotification) {
    plotNotification.style.touchAction = "none";
    plotNotification.style.cursor = "grab";
}

// global state
let suburbanRefreshIntervalId = null;
let currentSuburbanProperties = null;
const suburbanRefreshDuration = 90;
let userLocationWatcher = null;
let isTrackingUser = false;
let currentStopProperties = null;
let currentStopRouteData = null;
let autoRefreshIntervalId = null;
const autoRefreshDuration = 30;
const circumference = 2 * Math.PI * 15.9155;
let plottedRoutes = [];
let busRefreshTimers = new Map();
let selectedStopMarker = null;
let selectedHeadingMarker = null;
let plottedStopsLayer = null;
let plottedStopCodes = new Set();
const plottedLabelZoomThreshold = 15;
const desktopLabelZoomThreshold = 16.5;
const mobileLabelZoomThreshold = 16;
let routeInfoMap = new Map();
let isClearing = false;
let allLinesData = [];
let mergedStopsGeoJSON = { features: [] };
let stopStreetmap = new Map();
let userLocationMarker = null;
let stopsLayerNotInteractive, stopsLayerInteractive, routesLayer, stopsHeadingLayer;
let metroLayer, metroStationsLayer, suburbanLayer, suburbanStationsLayer;
let isUpdatingHeadings = false;
let notificationTimeout = null;

// configs and data
const suburbanStationCodes = {
  "ΑΓΙΟΣ ΣΤΕΦΑΝΟΣ": 83, "ΔΕΚΕΛΕΙΑ": 149, "ΑΦΙΔΝΕΣ": 89, "ΣΦΕΝΔΑΛΗ": 555,
  "ΑΥΛΩΝΑΣ": 87, "ΑΓΙΟΣ ΘΩΜΑΣ": 681, "ΟΙΝΟΦΥΤΑ": 412, "ΟΙΝΟΗ": 11,
  "ΔΗΛΕΣΙ": 554, "ΑΓΙΟΣ ΓΕΩΡΓΙΟΣ": 605, "ΚΑΛΟΧΩΡΙ-ΠΑΝΤΕΙΧΙ": 228, "ΑΥΛΙΔΑ": 86,
  "ΧΑΛΚΙΔΑ": 597, "ΑΣΠΡΟΠΥΡΓΟΣ": 437, "ΠΛΑΚΕΝΤΙΑ": 17, "ΠΑΛΛΗΝΗ": 14,
  "ΚΑΝΤΖΑ": 13, "ΚΟΡΩΠΙ": 458, "ΑΕΡΟΔΡΟΜΙΟ": 28, "ΚΗΦΙΣΙΑΣ": 15,
  "ΝΕΡΑΤΖΙΩΤΙΣΣΑ": 18, "ΗΡΑΚΛΕΙΟ": 16, "ΑΝΩ ΛΙΟΣΙΑ": 19, "ΜΑΓΟΥΛΑ": 466,
  "ΠΕΝΤΕΛΗΣ": 481, "ΑΓ.ΑΝΑΡΓΥΡΟΙ": 428, "ΜΕΤΑΜΟΡΦΩΣΗ": 21, "ΠΕΙΡΑΙΑΣ": 2,
  "ΛΕΥΚΑ": 462, "ΡΕΝΤΗΣ": 422, "ΡΟΥΦ": 24, "ΛΑΡΙΣΗΣ": 1,
  "ΤΑΥΡΟΣ": 25, "ΖΕΦΥΡΙ": 194, "Ν.ΠΕΡΑΜΟΣ": 469, "ΑΧΑΡΝΕΣ": 91,
  "ΣΚΑ-ΑΧΑΡΝΑΙ": 27, "ΣΙΔΗΡ/ΚΟ ΚΕΝΤΡΟ ΑΧΑΡΝΩΝ": 27, "ΚΑΤΩ ΑΧΑΡΝΑΙ (ΛΥΚΟΤΡΥΠΑ)": 253,
  "ΠΥΡΓΟΣ ΒΑΣΙΛΙΣΣΗΣ": 494
};

const suburbanLineColors = {
  'A_X': '#FFC107', 'P1': '#9C27B0', 'P2': '#673AB7'
};

const metroColors = {
  green: '#1f8136ff', red: '#b80600ff', blue: '#004c9eff'
};

const metroLineColors = {
  1: '#1f8136ff', 2: '#b80600ff', 3: '#004c9eff', 33: '#004c9eff'
};

const colorHex = {
  cyan: "#146eff", green: "#28a745", darkCyan: "#2c5aa0", darkGreen: "#1d7b34",
};

const routeStyles = {
  cyan: { color: colorHex.cyan, weight: 5, opacity: 0.9 },
  green: { color: colorHex.green, weight: 5, opacity: 0.9 },
};

const highlightedStopStyles = {
  cyan: { radius: 6, fillColor: colorHex.cyan, color: "#fff", weight: 1, fillOpacity: 0.9, pane: "highlightedStopsPane", interactive: false },
  green: { radius: 6, fillColor: colorHex.green, color: "#fff", weight: 1, fillOpacity: 0.9, pane: "highlightedStopsPane", interactive: false },
};

const defaultRouteStyle = { color: "#007BFF", weight: 2.5, opacity: 0, interactive: false };
const baseStopStyle = { fillColor: "#003366", color: "#fff", weight: 1, fillOpacity: 0.85 };
const fadedStopLayerStyle = { ...baseStopStyle, fillColor: "#001a33", fillOpacity: 0.6 };

const greeklishMap = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "h", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "ks", ο: "o", π: "p", ρ: "r", σ: "s", τ: "t", υ: "y", φ: "f", χ: "x", ψ: "ps", ω: "o",
  ά: "a", έ: "e", ή: "h", ί: "i", ό: "o", ύ: "y", ώ: "w", ς: "s",
  Α: "A", Β: "V", Γ: "G", Δ: "D", Ε: "E", Ζ: "Z", Η: "H", Θ: "TH", Ι: "I", Κ: "K", Λ: "L", Μ: "M", Ν: "N", Ξ: "KS", Ο: "O", Π: "P", Ρ: "R", Σ: "S", Τ: "T", Υ: "Y", Φ: "F", Χ: "X", Ψ: "PS", Ω: "O"
};

// icons
const plotRouteIconSvg = `<svg class="plot-route-svg" viewBox="0 0 24 24"><g transform="translate(5, 22)"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M 1 0 L 1 -13 C 1 -18 7 -18 7 -13 L 7 -7 C 7 -2 13 -2 13 -7 L 13 -20"></path><circle fill="currentColor" cx="1" cy="0" r="2.5"></circle><circle fill="currentColor" cx="13" cy="-20" r="2.5"></circle></g></svg>`;
const accessibilityIconSvg = `<svg class="access-icon-svg" viewBox="0 0 24 24"><g fill="none" stroke="#003366" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><rect x="6.5" y="6" width="8" height="8" rx="1"/><circle cx="8.5" cy="15" r="1"/><circle cx="12.5" cy="15" r="1"/><path d="M 22 14 H 16 V 16"/></g></svg>`;
const smartStopIconSvg = `<svg class="access-icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="#003366" stroke-width="1.5"/><g fill="#003366"><circle cx="15.5" cy="7.8" r="1.5"/><rect x="7" y="9" width="10" height="5" rx="1"/><rect x="14.9" y="14" width="2" height="4"/></g></svg>`;