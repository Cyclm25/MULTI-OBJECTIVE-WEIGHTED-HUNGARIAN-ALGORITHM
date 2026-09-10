const resourceTypes = ['Water', 'Food', 'Medical', 'Shelter', 'Standard Food Pack', 'Medical Kit', 'Mobility Aid', 'Specialized PWD Support Pack', 'Specialized PWD Support', 'Senior Support Pack'];
const RESOURCE_TYPE_COMPATIBILITY_COLUMNS = Object.freeze({
  standardfoodpack: ['Standard Food Pack Compatibility'],
  medicalkit: ['Medical Kit Compatibility'],
  mobilityaid: ['Mobility Aid Compatibility'],
  specializedpwdsupportpack: ['Specialized PWD Support Compatibility', 'Specialized PWD Support Pack Compatibility'],
  specializedpwdsupport: ['Specialized PWD Support Compatibility', 'Specialized PWD Support Pack Compatibility'],
  seniorsupportpack: ['Senior Support Pack Compatibility']
});
const RESEARCH_WEIGHTS = Object.freeze({ distance: 0.164, urgency: 0.539, compatibility: 0.297 });
const BENCHMARK_MATRIX_SIZES = Object.freeze([10, 20, 30, 40, 50, 60]);
const HIGH_URGENCY_THRESHOLD = 7;
const FOUR_POINT_HIGH_URGENCY_THRESHOLD = 3;
const HUNDRED_POINT_HIGH_URGENCY_THRESHOLD = 70;
function deriveAHPWeights() { return { ...RESEARCH_WEIGHTS }; }
const DEBUG_ALGORITHM_DIAGNOSTICS = false;
const IMPORT_FLOW_VERSION = 'resource-workbook-flow-20260907-map-fix';
// Bump this key whenever geocoding rules change so stale, unconstrained matches
// cannot silently re-enter the Barangay 160 dataset.
const GEOCODE_CACHE_KEY = 'allocation-geocode-cache-v4';
const RESEARCH_CONFIG = {
  areaName: 'Barangay 160',
  geocodingContext: 'Tondo, Manila, Metro Manila, Philippines',
  hub: {
    name: 'Barangay 160, Tondo, Manila',
    address: 'Barangay 160 Barangay Hall, Tondo, Manila, Metro Manila, Philippines',
    coordinates: [14.6207513, 120.97349635]
  },
  researchArea: {
    name: 'Configured Barangay 160 review boundary',
    type: 'bbox',
    bounds: [[14.6200279, 120.9729135], [14.6214747, 120.9740792]]
  },
  locationReview: {
    reviewBufferKm: 1.5,
    enforceBoundaryForEligibility: true
  },
  geocoding: {
    provider: 'Nominatim',
    endpoint: 'https://nominatim.openstreetmap.org/search',
    requestDelayMs: 1100
  }
};
const state = { rawRows: [], rawHeaders: [], columnMapping: {}, mappingIssues: [], dataset: [], researchDataset: [], verifiedHouseholdSet: [], invalidRows: [], validation: null, filename: '', resourceRows: [], resourceHeaders: [], resourceMapping: {}, resourceMappingIssues: [], reliefResources: [], resourceValidation: null, resourceFilename: '', resourceSource: '', comparisonSize: 10, currentResources: [], latest: null, results: {}, history: JSON.parse(localStorage.getItem('allocation-history') || '[]'), weights: deriveAHPWeights(), geocodeCache: JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || '{}'), processing: false, resourceProcessing: false };
const DEMO_HOUSEHOLD_HEADERS = ['household', 'address', 'latitude', 'longitude', 'urgency', 'compatible_resource', 'verification', 'vulnerability_factors'];
const DEMO_RESOURCE_HEADERS = ['resource_id', 'resource_type', 'latitude', 'longitude', 'quantity', 'availability'];
const VARIED_DEMO_HOUSEHOLDS = Object.freeze([
  { household: 'DEMO-HH-001', address: 'Demo Cluster A1, Barangay 160, Tondo, Manila', latitude: 14.62018, longitude: 120.97300, urgency: 9, compatible_resource: 'Medical Kit', verification: 'Verified', vulnerability_factors: 'Senior; chronic medical need' },
  { household: 'DEMO-HH-002', address: 'Demo Cluster A2, Barangay 160, Tondo, Manila', latitude: 14.62018, longitude: 120.97332, urgency: 2, compatible_resource: 'Standard Food Pack', verification: 'Verified', vulnerability_factors: 'Low-income household' },
  { household: 'DEMO-HH-003', address: 'Demo Cluster B1, Barangay 160, Tondo, Manila', latitude: 14.62046, longitude: 120.97304, urgency: 8, compatible_resource: 'Senior Support Pack', verification: 'Verified', vulnerability_factors: 'Two senior residents' },
  { household: 'DEMO-HH-004', address: 'Demo Cluster B2, Barangay 160, Tondo, Manila', latitude: 14.62046, longitude: 120.97336, urgency: 3, compatible_resource: 'Water', verification: 'Verified', vulnerability_factors: 'Routine water support' },
  { household: 'DEMO-HH-005', address: 'Demo Cluster C1, Barangay 160, Tondo, Manila', latitude: 14.62074, longitude: 120.97308, urgency: 10, compatible_resource: 'Specialized PWD Support', verification: 'Verified', vulnerability_factors: 'PWD mobility support required' },
  { household: 'DEMO-HH-006', address: 'Demo Cluster C2, Barangay 160, Tondo, Manila', latitude: 14.62074, longitude: 120.97340, urgency: 4, compatible_resource: 'Food', verification: 'Verified', vulnerability_factors: 'Food insecurity' },
  { household: 'DEMO-HH-007', address: 'Demo Cluster D1, Barangay 160, Tondo, Manila', latitude: 14.62102, longitude: 120.97312, urgency: 7, compatible_resource: 'Shelter', verification: 'Verified', vulnerability_factors: 'Temporary shelter need' },
  { household: 'DEMO-HH-008', address: 'Demo Cluster D2, Barangay 160, Tondo, Manila', latitude: 14.62102, longitude: 120.97344, urgency: 1, compatible_resource: 'Medical Kit', verification: 'Verified', vulnerability_factors: 'Routine medical supplies' },
  { household: 'DEMO-HH-009', address: 'Demo Cluster E1, Barangay 160, Tondo, Manila', latitude: 14.62130, longitude: 120.97316, urgency: 8, compatible_resource: 'Water', verification: 'Verified', vulnerability_factors: 'Infant care and water need' },
  { household: 'DEMO-HH-010', address: 'Demo Cluster E2, Barangay 160, Tondo, Manila', latitude: 14.62130, longitude: 120.97348, urgency: 2, compatible_resource: 'Standard Food Pack', verification: 'Verified', vulnerability_factors: 'Routine food support' }
]);
const VARIED_DEMO_RESOURCES = Object.freeze([
  { resource_id: 'DEMO-R-001', resource_type: 'Standard Food Pack', latitude: 14.62018, longitude: 120.97300, quantity: 1, availability: 'Available' },
  { resource_id: 'DEMO-R-002', resource_type: 'Medical Kit', latitude: 14.62018, longitude: 120.97332, quantity: 1, availability: 'Available' },
  { resource_id: 'DEMO-R-003', resource_type: 'Water', latitude: 14.62046, longitude: 120.97304, quantity: 1, availability: 'Available' },
  { resource_id: 'DEMO-R-004', resource_type: 'Senior Support Pack', latitude: 14.62046, longitude: 120.97336, quantity: 1, availability: 'Available' },
  { resource_id: 'DEMO-R-005', resource_type: 'Food', latitude: 14.62074, longitude: 120.97308, quantity: 1, availability: 'Available' },
  { resource_id: 'DEMO-R-006', resource_type: 'Specialized PWD Support', latitude: 14.62074, longitude: 120.97340, quantity: 1, availability: 'Available' },
  { resource_id: 'DEMO-R-007', resource_type: 'Medical Kit', latitude: 14.62102, longitude: 120.97312, quantity: 1, availability: 'Available' },
  { resource_id: 'DEMO-R-008', resource_type: 'Shelter', latitude: 14.62102, longitude: 120.97344, quantity: 1, availability: 'Available' },
  { resource_id: 'DEMO-R-009', resource_type: 'Standard Food Pack', latitude: 14.62130, longitude: 120.97316, quantity: 1, availability: 'Available' },
  { resource_id: 'DEMO-R-010', resource_type: 'Water', latitude: 14.62130, longitude: 120.97348, quantity: 1, availability: 'Available' }
]);
const RELIEF_HUB = { name: RESEARCH_CONFIG.hub.name, address: RESEARCH_CONFIG.hub.address, coordinates: [...RESEARCH_CONFIG.hub.coordinates], bounds: RESEARCH_CONFIG.researchArea.bounds };
const MAP_ZOOM = 17;
const MAP_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_ATTRIBUTION = '&copy; OpenStreetMap contributors';
let hubIcon;
function scheduleMapInvalidate(map) {
  if (!map?.invalidateSize) return;
  const resize = () => {
    const container = map.getContainer?.();
    if (!container || !container.clientWidth || !container.clientHeight) return;
    map.invalidateSize({ pan: false });
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(resize);
  setTimeout(resize, 0);
  setTimeout(resize, 120);
  setTimeout(resize, 320);
}
function safeFitMapBounds(map, points, options = {}) {
  const validPoints = points.filter(point => Array.isArray(point) && point.length >= 2 && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])));
  if (validPoints.length > 1) map.fitBounds(validPoints, { padding: [42, 42], maxZoom: MAP_ZOOM, ...options });
  else if (validPoints.length === 1) map.setView(validPoints[0], MAP_ZOOM, { animate: false });
  else map.setView(RELIEF_HUB.coordinates, MAP_ZOOM, { animate: false });
  scheduleMapInvalidate(map);
}
function createReliefMap(elementId) {
  const map = L.map(elementId, {
    center: RELIEF_HUB.coordinates,
    zoom: MAP_ZOOM,
    zoomControl: false,
    scrollWheelZoom: false,
    preferCanvas: true
  });
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  const tiles = L.tileLayer(MAP_TILES, {
    attribution: MAP_ATTRIBUTION,
    maxZoom: 20,
    detectRetina: true,
    updateWhenIdle: true,
    keepBuffer: 3,
    crossOrigin: true
  }).addTo(map);
  tiles.on('tileerror', () => {
    if (map._tileErrorReported || typeof console === 'undefined') return;
    map._tileErrorReported = true;
    console.warn('[Leaflet] OpenStreetMap tiles failed to load. Check network access or tile-provider availability.');
  });
  map.whenReady(() => scheduleMapInvalidate(map));
  return map;
}
function addHubMarkerAt(map, coordinates = RELIEF_HUB.coordinates, popupTitle = 'Relief distribution hub', label = RELIEF_HUB.name) {
  if (!hubIcon) hubIcon = L.divIcon({
    className: 'hub-marker-wrap',
    html: '<span class="hub-marker"><span></span></span>',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -18]
  });
  return L.marker(coordinates, { icon: hubIcon, keyboard: true, title: label })
    .addTo(map)
    .bindPopup(`<strong>${popupTitle}</strong><br>${escapeHtml(label)}`);
}

function addHubMarker(map, popupTitle = 'Relief distribution hub') {
  return addHubMarkerAt(map, RELIEF_HUB.coordinates, popupTitle, RELIEF_HUB.name);
}

function getPointKey(point) {
  return `${Number(point[0]).toFixed(7)},${Number(point[1]).toFixed(7)}`;
}

function getDominantResourceSource(resources = []) {
  const grouped = new Map();
  resources.forEach(resource => {
    if (!hasValidCoordinates(resource)) return;
    const point = [Number(resource.latitude), Number(resource.longitude)];
    const key = getPointKey(point);
    const entry = grouped.get(key) || { point, count: 0 };
    entry.count += 1;
    grouped.set(key, entry);
  });
  if (!grouped.size) return null;
  const total = [...grouped.values()].reduce((sum, entry) => sum + entry.count, 0);
  const dominant = [...grouped.values()].sort((a, b) => b.count - a.count)[0];
  return { ...dominant, total };
}

function addAssignmentHubMarker(map, layers, resources = [], popupTitle = 'Relief distribution hub') {
  const dominant = getDominantResourceSource(resources);
  if (dominant && dominant.count === dominant.total) {
    const marker = addHubMarkerAt(map, dominant.point, `${popupTitle} (from resource dataset)`, 'Uploaded resource hub/source');
    layers.push(marker);
    return dominant.point;
  }
  layers.push(addHubMarker(map, popupTitle));
  return RELIEF_HUB.coordinates;
}

function addResourceSourceMarkers(map, layers, resources = [], excludePoint = null) {
  const excludedKey = excludePoint ? getPointKey(excludePoint) : '';
  const grouped = new Map();
  resources.forEach(resource => {
    if (!hasValidCoordinates(resource)) return;
    const point = [Number(resource.latitude), Number(resource.longitude)];
    const key = getPointKey(point);
    const entry = grouped.get(key) || { point, resources: [] };
    entry.resources.push(resource);
    grouped.set(key, entry);
  });
  grouped.forEach(({ point, resources: sourceResources }) => {
    if (getPointKey(point) === excludedKey) return;
    const count = sourceResources.length;
    const title = count === 1 ? sourceResources[0].resource_id : `${count} resources`;
    const resourceList = sourceResources.slice(0, 6).map(resource => escapeHtml(resource.resource_id)).join(', ');
    const more = count > 6 ? `, +${count - 6} more` : '';
    const marker = L.circleMarker(point, {
      radius: 6,
      color: '#fff',
      weight: 2,
      fillColor: '#7b8d45',
      fillOpacity: .96,
      opacity: 1
    }).addTo(map).bindPopup(`<strong>Resource source</strong><br>${escapeHtml(title)}<br>${resourceList}${more}`);
    layers.push(marker);
  });
}
function getUrgencyMeta(value) {
  const urgency = Number(value) || 0;
  if (urgency >= 7) return { urgency, color: '#b55454', label: 'Immediate' };
  if (urgency >= 4) return { urgency, color: '#c58a45', label: 'Priority' };
  return { urgency, color: '#59799d', label: 'Routine' };
}
const MAP_LEGEND = '<span class="map-legend-item"><i class="hub-dot"></i>Hub</span><span class="map-legend-item"><i class="immediate-dot"></i>Immediate (7–10)</span><span class="map-legend-item"><i class="priority-dot"></i>Priority (4–6)</span><span class="map-legend-item"><i class="routine-dot"></i>Routine (0–3)</span>';
const EXISTING_MAP_LEGEND = '<span class="map-legend-item"><i class="hub-dot"></i>Distribution Hub</span><span class="map-legend-item"><i class="household-dot"></i>Household</span><span class="map-legend-item"><i class="assignment-line"></i>Distance-based assignment</span><span class="map-legend-item"><i class="unassigned-dot"></i>Unassigned Household</span><span class="map-legend-item"><i class="pending-dot"></i>Pending Verification</span>';
const RESOURCE_SOURCE_LEGEND_ITEM = '<span class="map-legend-item"><i class="resource-source-dot"></i>Resource source</span>';
function getResearchAreaBounds() {
  return RESEARCH_CONFIG.researchArea?.bounds || RELIEF_HUB.bounds || null;
}
function getResearchAreaLimits() {
  const bounds = getResearchAreaBounds();
  if (!Array.isArray(bounds) || bounds.length < 2) return null;
  const latitudes = bounds.map(point => Number(point?.[0])).filter(Number.isFinite);
  const longitudes = bounds.map(point => Number(point?.[1])).filter(Number.isFinite);
  if (!latitudes.length || !longitudes.length) return null;
  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLon: Math.min(...longitudes),
    maxLon: Math.max(...longitudes)
  };
}
function getResearchBoundaryPolygon() {
  const limits = getResearchAreaLimits();
  if (!limits) return [];
  const { minLat, maxLat, minLon, maxLon } = limits;
  return [[minLat, minLon], [minLat, maxLon], [maxLat, maxLon], [maxLat, minLon], [minLat, minLon]];
}
function addResearchBoundaryLayer(map) {
  const polygon = getResearchBoundaryPolygon();
  if (!polygon.length || typeof L === 'undefined') return null;
  return L.polygon(polygon, {
    color: '#29496b',
    weight: 1.4,
    opacity: .52,
    fillColor: '#29496b',
    fillOpacity: .045,
    dashArray: '6 5',
    interactive: false,
    className: 'research-boundary-layer'
  }).addTo(map);
}
function isInsideResearchArea(lat, lon) {
  const limits = getResearchAreaLimits();
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!limits) return true;
  // This bbox is stored as Leaflet-style [latitude, longitude], not GeoJSON [longitude, latitude].
  return latitude >= limits.minLat && latitude <= limits.maxLat && longitude >= limits.minLon && longitude <= limits.maxLon;
}
function getResearchAreaDistanceKm(lat, lon) {
  const limits = getResearchAreaLimits();
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!limits || !hasValidCoordinatePair(latitude, longitude)) return null;
  if (isInsideResearchArea(latitude, longitude)) return 0;
  const nearestLat = Math.min(Math.max(latitude, limits.minLat), limits.maxLat);
  const nearestLon = Math.min(Math.max(longitude, limits.minLon), limits.maxLon);
  return geoDistanceKm([latitude, longitude], [nearestLat, nearestLon]);
}
function getLocationReviewBufferKm() {
  const value = Number(RESEARCH_CONFIG.locationReview?.reviewBufferKm);
  return Number.isFinite(value) ? value : 0;
}
function isResearchBoundaryEnforced() {
  return RESEARCH_CONFIG.locationReview?.enforceBoundaryForEligibility === true;
}
function isApproximateGeocode(row) {
  return /approximate/i.test(String(row?.geocoding_status || ''));
}
function classifyResearchAreaLocation(row) {
  const lat = Number(row.latitude);
  const lon = Number(row.longitude);
  if (!hasValidCoordinatePair(lat, lon)) {
    return { status: 'Unresolved Location', inside: false, review: false, outside: false, distanceKm: null, reason: 'Address could not be resolved to coordinates' };
  }
  if (isInsideResearchArea(lat, lon)) {
    return { status: 'Inside Research Area', inside: true, review: false, outside: false, distanceKm: 0, reason: '' };
  }
  const distanceKm = getResearchAreaDistanceKm(lat, lon);
  const approximate = isApproximateGeocode(row);
  const nearBoundary = Number.isFinite(distanceKm) && distanceKm <= getLocationReviewBufferKm();
  const distanceText = Number.isFinite(distanceKm) ? `${distanceKm.toFixed(2)} km` : 'an unknown distance';
  if (approximate || nearBoundary) {
    return {
      status: 'Needs Location Review',
      inside: false,
      review: true,
      outside: false,
      distanceKm,
      reason: `${approximate ? 'Approximate geocode' : 'Borderline resolved point'} is ${distanceText} outside the configured review boundary`
    };
  }
  return {
    status: 'Outside Research Area',
    inside: false,
    review: false,
    outside: true,
    distanceKm,
    reason: `Resolved point is ${distanceText} outside the configured review boundary`
  };
}
function isVerified(row) { return String(row.verification_status || row.verification || '').trim().toLowerCase() === 'verified'; }
function getResourceAt(index) {
  return state.currentResources?.[index] || state.reliefResources?.[index] || null;
}
function resourceType(index) { return getResourceAt(index)?.resource_type || ''; }
function resourceLabel(index) { return getResourceAt(index)?.resource_id || ''; }
function formatAssignedResource(index) {
  const resource = getResourceAt(index);
  return resource ? `${resource.resource_id} (${resource.resource_type})` : '';
}
function getHouseholdCompatibilityProfile(row) {
  const explicitNeed = normalizeResourceRequirement(row?.compatible_resource);
  if (isKnownResourceRequirement(explicitNeed)) return new Set([explicitNeed]);
  const text = Object.entries(row || {})
    .filter(([key, value]) => !key.startsWith('_') && hasDisplayValue(value) && !NEGATIVE_FIELD_VALUES.test(String(value)))
    .map(([key, value]) => `${key} ${value}`)
    .join(' ')
    .toLowerCase();
  const matches = new Set();
  if (/medical|medicine|health|pwd|disab|pregnan|lactating|chronic|illness|sick|injur|senior|elderly/.test(text)) matches.add('Medical');
  if (/shelter|evacuation|evacuee|homeless|damage|destroyed|roof|flood|fire|relocat/.test(text)) matches.add('Shelter');
  if (/water|dehydrat|infant|baby|child|children/.test(text)) matches.add('Water');
  if (/food|meal|hunger|rice|relief|low.?income|livelihood|solo.?parent/.test(text)) matches.add('Food');
  return matches;
}

function isCompatible(row, resourceIndex) {
  const assignedType = resourceType(resourceIndex);
  const compatibilityValue = getHouseholdResourceCompatibility(row, assignedType);
  if (compatibilityValue !== null) return compatibilityValue;
  return getHouseholdCompatibilityProfile(row).has(assignedType);
}

function formatCompatibilityProfile(row) {
  const profile = [...getHouseholdCompatibilityProfile(row)];
  return profile.length ? profile.join(', ') : 'Unresolved';
}
const $ = selector => document.querySelector(selector);
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2200); }
function reportRunError(error, fallback = 'Run failed') {
  if (typeof console !== 'undefined') console.error('[Allocation Lab]', error);
  toast(error?.message || fallback);
}
function go(page) { if (!['existing', 'enhanced', 'compare', 'history'].includes(page)) page = 'compare'; document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === `view-${page}`)); document.querySelectorAll('.nav-item[data-page]').forEach(item => item.classList.toggle('active', item.dataset.page === page)); const labels = { existing: 'Existing Algorithm', enhanced: 'Enhanced Algorithm', compare: 'Comparison', history: 'History' }; const titles = { existing: 'Standard Hungarian Algorithm - Distance-Only Baseline', enhanced: 'Enhanced Multi-Objective Weighted Hungarian Algorithm', compare: 'Research Comparison', history: 'Run History' }; $('#page-title').textContent = labels[page]; $('#header-title').textContent = titles[page]; window.scrollTo(0, 0); }
function parseCsvRecords(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(value => value !== '')) rows.push(row);
  return rows;
}

function parseCsvDocument(text) {
  const records = parseCsvRecords(text);
  if (!records.length) return { headers: [], rows: [] };
  const headers = records.shift().map(header => header.trim());
  const rows = records.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ''])));
  return { headers, rows };
}

function parseCsv(text) {
  return parseCsvDocument(text).rows;
}

function parseSpreadsheetRows(rows) {
  const normalizeSpreadsheetCell = value => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text === '' ? null : text;
  };
  const populatedRows = rows
    .map(row => Array.from(row || [], normalizeSpreadsheetCell))
    .filter(row => row.some(value => value !== null));
  if (!populatedRows.length) return { headers: [], rows: [] };
  const headers = populatedRows.shift().map(header => String(header || '').trim());
  const dataRows = populatedRows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? null])));
  return { headers, rows: dataRows };
}

async function parseXlsxDocument(file) {
  if (typeof XLSX === 'undefined') throw new Error('xlsx-library-missing');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { headers: [], rows: [] };
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false, raw: false });
  return parseSpreadsheetRows(rows);
}

async function parseXlsxWorkbook(file) {
  if (typeof XLSX === 'undefined') throw new Error('xlsx-library-missing');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const sheets = Object.fromEntries(workbook.SheetNames.map(name => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: null, blankrows: false, raw: false });
    return [name, parseSpreadsheetRows(rows)];
  }));
  return { sheetNames: workbook.SheetNames, sheets };
}

function getWorkbookSheet(workbook, targetName) {
  const target = normalizeFieldName(targetName);
  const sheetName = workbook.sheetNames.find(name => normalizeFieldName(name) === target);
  return sheetName ? { name: sheetName, ...workbook.sheets[sheetName] } : null;
}

function logWorkbookImportDiagnostics(workbook, label = 'Workbook import') {
  if (typeof console === 'undefined') return;
  console.info(`[${label}] Import flow version: ${IMPORT_FLOW_VERSION}`);
  console.info(`[${label}] Workbook sheets:`, workbook?.sheetNames || []);
  console.info(`[${label}] Households parsed: ${state.rawRows.length}`);
  console.info(`[${label}] Verified H*: ${getVerifiedHouseholdSet().length}`);
  console.info(`[${label}] Resource rows parsed: ${state.resourceRows.length}`);
  console.info(`[${label}] Available resources: ${state.reliefResources.length}`);
  console.info(`[${label}] Invalid resources: ${state.resourceValidation?.invalidResources ?? 0}`);
  console.info(`[${label}] Matrix dimensions: ${state.reliefResources.length} x ${getVerifiedHouseholdSet().length}`);
}

function parseDatasetFile(file) {
  const filename = file.name.toLowerCase();
  if (filename.endsWith('.xlsx')) return parseXlsxDocument(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => resolve(parseCsvDocument(event.target.result));
    reader.onerror = () => reject(reader.error || new Error('file-read-failed'));
    reader.readAsText(file);
  });
}

async function loadFile(file) {
  if (!file) return;
  const extension = file.name.toLowerCase().split('.').pop();
  try {
    if (extension === 'xlsx') {
      const workbook = await parseXlsxWorkbook(file);
      const householdSheet = getWorkbookSheet(workbook, 'System Import');
      const resourceSheet = getWorkbookSheet(workbook, 'Resources');
      if (householdSheet && resourceSheet) {
        await loadCombinedWorkbook(file, workbook);
        return;
      }
      if (householdSheet) {
        applyHouseholdImport(file.name, householdSheet.headers, householdSheet.rows);
        state.resourceRows = [];
        state.resourceHeaders = [];
        state.resourceMapping = {};
        state.resourceMappingIssues = [{ field: 'resources', level: 'error', message: 'Resources sheet not found' }];
        state.reliefResources = [];
        state.resourceValidation = { totalRows: 0, validResources: 0, availableResources: 0, unavailableResources: 0, invalidResources: 0, issues: ['Resources sheet not found'] };
        state.resourceFilename = '';
        state.resourceSource = '';
        renderDataset();
        go('compare');
        toast('Resources sheet not found');
        return;
      }
    }
    const { headers, rows } = await parseDatasetFile(file);
    if (!rows.length) throw new Error('empty');
    applyHouseholdImport(file.name, headers, rows);
    logAllocationDiagnostics(`${extension?.toUpperCase() || 'Dataset'} upload: ${file.name}`);
    renderDataset();
    go('compare');
    toast(state.mappingIssues.some(issue => issue.level === 'error') ? 'Review column mapping before validation' : 'Dataset imported; ready to geocode and validate');
  } catch (error) {
    toast(error.message === 'xlsx-library-missing' ? 'XLSX parser is unavailable' : error.message || 'Could not parse this file');
  }
}

function applyHouseholdImport(filename, headers, rows) {
  state.rawRows = rows;
  state.rawHeaders = headers;
  state.columnMapping = inferColumnMapping(headers);
  state.mappingIssues = getMappingIssues(state.columnMapping, headers);
  state.dataset = rows;
  state.researchDataset = [];
  state.verifiedHouseholdSet = [];
  state.invalidRows = [];
  state.validation = null;
  state.results = {};
  state.latest = null;
  state.filename = filename;
  const mappingPanel = $('#column-mapping-panel');
  if (mappingPanel) mappingPanel.dataset.open = 'false';
}

function cloneRows(rows) {
  return rows.map(row => ({ ...row }));
}

async function loadVariedDemoData() {
  if (state.processing || state.resourceProcessing) return;
  applyHouseholdImport('varied-sop1-demo.csv', DEMO_HOUSEHOLD_HEADERS, cloneRows(VARIED_DEMO_HOUSEHOLDS));
  state.resourceRows = cloneRows(VARIED_DEMO_RESOURCES);
  state.resourceHeaders = DEMO_RESOURCE_HEADERS;
  state.resourceMapping = inferResourceMapping(state.resourceHeaders);
  state.resourceMappingIssues = getResourceMappingIssues(state.resourceMapping, state.resourceHeaders);
  state.reliefResources = [];
  state.resourceValidation = null;
  state.resourceFilename = 'varied-sop1-demo-resources.csv';
  state.resourceSource = 'Built-in varied SOP 1 demo';
  state.currentResources = [];
  state.results = {};
  state.latest = null;
  renderDataset();
  go('compare');
  await validateAndPrepareDataset();
  await validateAndPrepareResources();
  if (!getRunBlockers('existing', getSelectedComparisonSize()).length && compare()) {
    go('compare');
    toast('Varied demo loaded and compared');
  }
}

async function loadCombinedWorkbook(file, workbook) {
  const householdSheet = getWorkbookSheet(workbook, 'System Import');
  const resourceSheet = getWorkbookSheet(workbook, 'Resources');
  if (!householdSheet) throw new Error('System Import sheet not found');
  if (!resourceSheet) throw new Error('Resources sheet not found');
  if (!householdSheet.rows.length) throw new Error('System Import sheet has no household rows');
  if (!resourceSheet.rows.length) throw new Error('Resources sheet has no resource rows');

  applyHouseholdImport(file.name, householdSheet.headers, householdSheet.rows);

  state.resourceRows = resourceSheet.rows;
  state.resourceHeaders = resourceSheet.headers;
  state.resourceMapping = inferResourceMapping(resourceSheet.headers);
  state.resourceMappingIssues = getResourceMappingIssues(state.resourceMapping, resourceSheet.headers);
  state.reliefResources = [];
  state.resourceValidation = null;
  state.filename = file.name;
  state.resourceFilename = `${file.name} / Resources`;
  state.resourceSource = 'Loaded from workbook: Resources sheet';
  state.currentResources = [];
  state.results = {};
  state.latest = null;

  const mappingPanel = $('#column-mapping-panel');
  if (mappingPanel) mappingPanel.dataset.open = 'false';
  renderDataset();
  go('compare');

  const mappingErrors = [
    ...state.mappingIssues.map(issue => `System Import: ${issue.message}`),
    ...state.resourceMappingIssues.map(issue => `Resources: ${issue.message}`)
  ];
  if (mappingErrors.length) {
    state.resourceValidation = { totalRows: state.resourceRows.length, validResources: 0, availableResources: 0, unavailableResources: 0, invalidResources: state.resourceRows.length, issues: mappingErrors };
    renderDataset();
    toast(mappingErrors[0]);
    return;
  }

  await validateAndPrepareDataset();
  await validateAndPrepareResources();
  const matrixSize = Math.min(getVerifiedHouseholdSet().length, state.reliefResources.length);
  const ready = getVerifiedHouseholdSet().length === state.rawRows.length && state.reliefResources.length === state.resourceRows.length;
  logWorkbookImportDiagnostics(workbook, file.name);
  toast(ready ? `Workbook ready: ${state.rawRows.length} raw, ${getVerifiedHouseholdSet().length} H*, ${state.reliefResources.length} resources, ${matrixSize}x${matrixSize}` : 'Workbook imported with validation issues; review details');
}

async function loadResourceFile(file) {
  if (!file) return;
  const extension = file.name.toLowerCase().split('.').pop();
  try {
    let parsed;
    if (extension === 'xlsx') {
      const workbook = await parseXlsxWorkbook(file);
      parsed = getWorkbookSheet(workbook, 'Resources') || workbook.sheets[workbook.sheetNames[0]];
      if (!parsed) throw new Error('Resources sheet not found');
    } else {
      parsed = await parseDatasetFile(file);
    }
    const { headers, rows } = parsed;
    if (!rows.length) throw new Error('empty');
    state.resourceRows = rows;
    state.resourceHeaders = headers;
    state.resourceMapping = inferResourceMapping(headers);
    state.resourceMappingIssues = getResourceMappingIssues(state.resourceMapping, headers);
    state.reliefResources = [];
    state.resourceValidation = null;
    state.resourceFilename = file.name;
    state.resourceSource = extension === 'xlsx' ? 'Loaded from Resources sheet' : 'Loaded from resource file';
    state.currentResources = [];
    state.results = {};
    state.latest = null;
    logAllocationDiagnostics(`${extension?.toUpperCase() || 'Dataset'} resource upload: ${file.name}`);
    renderDataset();
    go('compare');
    await validateAndPrepareResources();
  } catch (error) {
    state.resourceProcessing = false;
    renderDataset();
    toast(error.message === 'xlsx-library-missing' ? 'XLSX parser is unavailable' : 'Could not parse this resource file');
  }
}
function renderDataset() {
  const rows = state.dataset;
  const keys = getDatasetTableKeys(rows);
  const validation = state.validation;
  $('#top-dataset').textContent = rows.length ? state.filename : 'No dataset loaded';
  $('#stat-status').textContent = state.processing ? 'Processing' : rows.length ? validation ? 'Ready' : 'Mapping' : 'Waiting';
  $('#stat-file').textContent = rows.length ? validation ? `${validation.eligibleHouseholds} households in verified set H*` : 'Review and validate raw dataset' : 'Upload raw Barangay CSV or XLSX';
  $('#stat-records').textContent = rows.length;
  $('#data-name').textContent = state.filename || '—';
  $('#data-rows').textContent = rows.length;
  $('#data-cols').textContent = state.rawHeaders.length || keys.length;
  $('#data-missing').textContent = validation ? validation.invalidRows : getPreValidationInvalidRowCount();
  $('#data-head').innerHTML = keys.map(key => `<th>${formatFieldLabel(key)}</th>`).join('');
  renderColumnMappingPanel();
  renderValidationSummary();
  renderResourceSummary();
  renderTable();
  ['#existing-input', '#enhanced-input'].forEach(selector => { if ($(selector)) $(selector).textContent = rows.length ? validation ? `${getVerifiedHouseholdSet().length} H* / ${rows.length} raw; ${state.reliefResources.length} resources` : `${rows.length} raw records; ${state.reliefResources.length} resources` : 'No dataset'; });
}
function renderTable() {
  const query = ($('#table-search')?.value || '').toLowerCase();
  const rows = state.dataset.filter(row => JSON.stringify(getSearchableRow(row)).toLowerCase().includes(query));
  const headers = ['Household', 'Need Summary', 'Urgency', 'Status', 'Details'];
  $('#data-head').innerHTML = `<tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr>`;
  $('#data-body').innerHTML = rows.slice(0, 50).map(row => {
    const fields = getHouseholdTableFields(row);
    return `<tr class="household-preview-row"><td>${renderHouseholdIdentity(fields)}</td><td>${renderVulnerabilityChips(fields.vulnerability)}</td><td>${renderUrgencyValue(fields.urgency)}</td><td>${renderStatusStack(fields)}</td><td>${renderHouseholdTechnicalDetails(row, fields)}</td></tr>`;
  }).join('');
  $('#table-count').textContent = `${rows.length} of ${state.dataset.length} records`;
}
function distance(row, resourceIndex = null) {
  if (!hasValidCoordinates(row)) return Number.POSITIVE_INFINITY;
  const resource = typeof resourceIndex === 'number' ? getResourceAt(resourceIndex) : null;
  if (resourceIndex !== null && !hasValidCoordinates(resource)) return Number.POSITIVE_INFINITY;
  const origin = resource ? [Number(resource.latitude), Number(resource.longitude)] : RELIEF_HUB.coordinates;
  return geoDistanceKm(origin, [Number(row.latitude), Number(row.longitude)]);
}
function hungarian(matrix) { const n = matrix.length, m = matrix[0].length, u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0); for (let i = 1; i <= n; i++) { p[0] = i; let j0 = 0; const minv = Array(m + 1).fill(Infinity), used = Array(m + 1).fill(false); do { used[j0] = true; const i0 = p[j0]; let delta = Infinity, j1 = 0; for (let j = 1; j <= m; j++) if (!used[j]) { const cur = matrix[i0 - 1][j - 1] - u[i0] - v[j]; if (cur < minv[j]) { minv[j] = cur; way[j] = j0; } if (minv[j] < delta) { delta = minv[j]; j1 = j; } } for (let j = 0; j <= m; j++) { if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; } j0 = j1; } while (p[j0] !== 0); do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0 !== 0); } const result = Array(n); for (let j = 1; j <= m; j++) result[p[j] - 1] = j - 1; return result; }
function getNormalizationScale(values) {
  const numeric = values.map(Number).filter(Number.isFinite);
  if (!numeric.length) return { min: 0, max: 0 };
  return { min: Math.min(...numeric), max: Math.max(...numeric) };
}

function normalizeByScale(value, scale) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return scale.max === scale.min ? 0 : (numeric - scale.min) / (scale.max - scale.min);
}

function normalize(values) {
  const scale = getNormalizationScale(values);
  return values.map(value => normalizeByScale(value, scale));
}
function getActiveResources(rows, requestedCount = null) {
  const hasRequestedCount = requestedCount !== null && requestedCount !== undefined && requestedCount !== '';
  const parsedCount = Number(requestedCount);
  const availableResources = (state.reliefResources || []).filter(resource => resource.available && hasValidCoordinates(resource));
  const defaultCount = availableResources.length;
  const count = hasRequestedCount && Number.isFinite(parsedCount) ? Math.min(parsedCount, availableResources.length) : defaultCount;
  return availableResources.slice(0, Math.max(0, count));
}

function getSelectedComparisonSize() {
  const selected = Number($('#comparison-size')?.value || state.comparisonSize || BENCHMARK_MATRIX_SIZES[0]);
  return BENCHMARK_MATRIX_SIZES.includes(selected) ? selected : BENCHMARK_MATRIX_SIZES[0];
}

function getControlledComparisonInputs(size = getSelectedComparisonSize()) {
  return {
    size,
    households: getVerifiedHouseholdSet().slice(0, size),
    resources: getActiveResources(getVerifiedHouseholdSet(), size)
  };
}

function getVerifiedHouseholdSet() {
  return state.verifiedHouseholdSet?.length ? state.verifiedHouseholdSet : (state.researchDataset || []);
}

function buildDistanceMatrix(rows, activeResources) {
  return activeResources.map((_, resourceIndex) => rows.map(row => distance(row, resourceIndex)));
}

function getUrgencyPriorityScore(row, rows) {
  const value = Number(row?.urgency);
  if (!Number.isFinite(value)) return 0;
  const urgencyValues = (rows || []).map(item => Number(item.urgency)).filter(Number.isFinite);
  const maxUrgency = urgencyValues.length ? Math.max(...urgencyValues) : 10;
  const denominator = maxUrgency <= 4 ? 4 : maxUrgency <= 10 ? 10 : 100;
  return Math.max(0, Math.min(1, value / denominator));
}

function buildExistingCostMatrix(rows, activeResources) {
  // Standard Hungarian baseline: distance is the only optimization criterion.
  // Equal-distance ties follow stable resource/household input order; no urgency,
  // priority, vulnerability, or compatibility fields are inspected here.
  return { matrix: buildDistanceMatrix(rows, activeResources), components: null };
}

function buildEnhancedCostMatrix(rows, activeResources) {
  const distances = buildDistanceMatrix(rows, activeResources);
  const urgency = activeResources.map(resource => rows.map(row => {
    const compatibilityScore = getHouseholdResourceCompatibilityScore(row, resource.resource_type);
    const suitabilityGap = 1 - (isFiniteNumber(compatibilityScore) ? Number(compatibilityScore) : 0);
    return getUrgencyPriorityScore(row, rows) * suitabilityGap;
  }));
  const compatibility = activeResources.map(resource => rows.map(row => {
    const score = getHouseholdResourceCompatibilityScore(row, resource.resource_type);
    return 1 - (isFiniteNumber(score) ? Number(score) : 0);
  }));
  const scales = {
    distance: getNormalizationScale(distances.flat()),
    urgency: getNormalizationScale(urgency.flat()),
    compatibility: getNormalizationScale(compatibility.flat())
  };
  const flatDistance = distances.flat().map(value => normalizeByScale(value, scales.distance));
  const flatUrgency = urgency.flat().map(value => normalizeByScale(value, scales.urgency));
  const flatCompatibility = compatibility.flat().map(value => normalizeByScale(value, scales.compatibility));
  const components = activeResources.map((_, resourceIndex) => rows.map((__, householdIndex) => {
    const index = resourceIndex * rows.length + householdIndex;
    const distanceComponent = flatDistance[index] * state.weights.distance;
    const urgencyComponent = flatUrgency[index] * state.weights.urgency;
    const compatibilityComponent = flatCompatibility[index] * state.weights.compatibility;
    return { distanceComponent, urgencyComponent, compatibilityComponent };
  }));
  return {
    matrix: components.map(row => row.map(item => item.distanceComponent + item.urgencyComponent + item.compatibilityComponent)),
    components,
    componentScales: scales
  };
}

function makeMatrix(mode, rows = getVerifiedHouseholdSet(), activeResources = getActiveResources(rows)) {
  // Controlled experiment: H* is produced once by system validation, then both
  // algorithms receive the same household coordinates and uploaded resource order.
  return mode === 'existing'
    ? { ...buildExistingCostMatrix(rows, activeResources), activeResources }
    : { ...buildEnhancedCostMatrix(rows, activeResources), activeResources };
}

function isFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return false;
  return Number.isFinite(Number(value));
}

function round(value, digits = 2) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(digits) : 'N/A';
}

function formatDistanceKm(value, digits = 2) {
  return isFiniteNumber(value) ? `${round(value, digits)} km` : 'N/A';
}

function formatPercent(value, digits = 1) {
  return isFiniteNumber(value) ? `${(Number(value) * 100).toFixed(digits)}%` : 'N/A';
}

function formatPercentagePoint(value, digits = 1) {
  if (!isFiniteNumber(value)) return 'N/A';
  const numeric = Number(value) * 100;
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(digits)} pp`;
}

function formatAbsolutePercentagePoint(value, digits = 1) {
  if (!isFiniteNumber(value)) return 'N/A';
  return `${Math.abs(Number(value) * 100).toFixed(digits)} pp`;
}

function formatSignedNumber(value, digits = 2, suffix = '') {
  if (!isFiniteNumber(value)) return 'N/A';
  const numeric = Number(value);
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(digits)}${suffix}`;
}

function formatSignedInteger(value) {
  if (!isFiniteNumber(value)) return 'N/A';
  const numeric = Number(value);
  return `${numeric > 0 ? '+' : ''}${numeric}`;
}

function formatCoefficient(value) {
  return isFiniteNumber(value) ? Number(value).toFixed(3) : 'Requires varied data';
}

function formatNativeCost(result) {
  if (!result) return 'N/A';
  return result.mode === 'existing'
    ? `${round(result.cost, 3)} km`
    : round(result.cost, 3);
}

function formatDurationMs(value) {
  return isFiniteNumber(value) ? `${Number(value).toFixed(2)} ms` : 'N/A';
}

function formatDifferenceValue(value, formatter, digits = 2) {
  if (!isFiniteNumber(value)) return 'N/A';
  const numeric = Number(value);
  if (Math.abs(numeric) < 1e-9) return formatter(0, digits);
  return `${numeric > 0 ? '+' : ''}${formatter(numeric, digits)}`;
}

function formatCostDifference(standard, enhanced) {
  if (!standard || !enhanced) return 'N/A';
  return 'Different objective units';
}

function getMatrixSummary(result) {
  const values = result?.matrixValues || [];
  if (!values.length) return { min: null, max: null, mean: null, entries: 0 };
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    entries: values.length
  };
}

function formatMatrixSummary(result, unit = '') {
  const summary = getMatrixSummary(result);
  if (!summary.entries) return 'N/A';
  const suffix = unit ? ` ${unit}` : '';
  return `min ${round(summary.min, 3)}${suffix}; mean ${round(summary.mean, 3)}${suffix}; max ${round(summary.max, 3)}${suffix}; ${summary.entries} cells`;
}

function formatCriterionList(items) {
  return items.map(item => `<span class="criterion-pill">${escapeHtml(item)}</span>`).join('');
}

function getComparisonState(standard, enhanced, higherIsImproved = true) {
  if (!isFiniteNumber(standard) || !isFiniteNumber(enhanced)) return 'Comparable';
  const diff = Number(enhanced) - Number(standard);
  if (Math.abs(diff) < 1e-9) return 'Comparable';
  return higherIsImproved ? (diff > 0 ? 'Improved' : 'Lower') : (diff < 0 ? 'Lower' : 'Higher');
}

function renderMetricSummary(items) {
  return `<div class="result-summary-grid">${items.map(item => `<div><span>${escapeHtml(item.label)}</span><strong>${item.value}</strong></div>`).join('')}</div>`;
}

function renderWeightedCostMatrixDetails(result) {
  if (!result || result.mode !== 'enhanced') return '';
  const rows = result.activeResources.map((resource, resourceIndex) => {
    const values = (result.householdOrder || []).map((_, householdIndex) => `<td>${round(result.costMatrix?.[resourceIndex]?.[householdIndex], 3)}</td>`).join('');
    return `<tr><td>${escapeHtml(resource.resource_id || `R${resourceIndex + 1}`)}</td>${values}</tr>`;
  }).join('');
  const householdHeaders = (result.householdOrder || []).map((id, index) => `<th>${escapeHtml(id || `H* ${index + 1}`)}</th>`).join('');
  return `<details class="technical-details"><summary>View Weighted Cost Matrix</summary><div class="table-wrap matrix-detail-wrap"><table class="compare-table matrix-detail-table"><thead><tr><th>Resource</th>${householdHeaders}</tr></thead><tbody>${rows}</tbody></table></div><p class="compare-note">The full weighted matrix is hidden by default because it is a technical validation artifact, not the primary presentation result.</p></details>`;
}

function computeComparableWeightedCost(result, rows, activeResources) {
  if (!result) return null;
  const enhancedMatrix = buildEnhancedCostMatrix(rows, activeResources).matrix;
  return (result.output || []).reduce((sum, item) => {
    const householdIndex = rows.findIndex(row => row === item.household || getHouseholdId(row) === getHouseholdId(item.household));
    const resourceIndex = item.resourceIndex;
    const value = enhancedMatrix?.[resourceIndex]?.[householdIndex];
    return Number.isFinite(Number(value)) ? sum + Number(value) : sum;
  }, 0);
}

function getUrgencyScaleMax(rows) {
  const urgencyValues = (rows || []).map(row => Number(row.urgency)).filter(Number.isFinite);
  const maxUrgency = urgencyValues.length ? Math.max(...urgencyValues) : 10;
  return maxUrgency <= 4 ? 4 : maxUrgency <= 10 ? 10 : 100;
}

function createDynamicUrgencyEvents(rows, count = 5) {
  const candidates = (rows || [])
    .map((row, index) => ({ row, index, urgency: Number(row.urgency) }))
    .filter(item => Number.isFinite(item.urgency));
  if (!candidates.length) return [];
  const maxUrgency = getUrgencyScaleMax(rows);
  const ordered = candidates.sort((a, b) => b.urgency - a.urgency || a.index - b.index);
  return Array.from({ length: count }, (_, eventIndex) => {
    const candidate = ordered[eventIndex % ordered.length];
    const direction = candidate.urgency >= maxUrgency - 1 ? -1 : 1;
    const newUrgency = Math.max(0, Math.min(maxUrgency, candidate.urgency + direction * 2));
    return {
      eventNumber: eventIndex + 1,
      householdIndex: candidate.index,
      previousUrgency: candidate.urgency,
      newUrgency,
      delta: Math.abs(newUrgency - candidate.urgency),
      triggered: Math.abs(newUrgency - candidate.urgency) >= 2
    };
  });
}

function applyDynamicEventRows(rows, event) {
  const updatedRows = rows.map(row => ({ ...row }));
  if (event?.triggered && updatedRows[event.householdIndex]) {
    updatedRows[event.householdIndex].urgency = event.newUrgency;
  }
  return updatedRows;
}

function computeEnhancedCostEntry(row, rows, resource, resourceIndex, householdIndex, scales) {
  const compatibilityScore = getHouseholdResourceCompatibilityScore(row, resource.resource_type);
  const compatibilityGap = 1 - (isFiniteNumber(compatibilityScore) ? Number(compatibilityScore) : 0);
  const urgencyPenalty = getUrgencyPriorityScore(row, rows) * compatibilityGap;
  const distanceComponent = normalizeByScale(distance(row, resourceIndex), scales.distance) * state.weights.distance;
  const urgencyComponent = normalizeByScale(urgencyPenalty, scales.urgency) * state.weights.urgency;
  const compatibilityComponent = normalizeByScale(compatibilityGap, scales.compatibility) * state.weights.compatibility;
  return {
    value: distanceComponent + urgencyComponent + compatibilityComponent,
    components: { distanceComponent, urgencyComponent, compatibilityComponent },
    householdIndex
  };
}

function selectiveEnhancedReassignment(currentResult, updatedRows, activeResources, affectedIndexes) {
  const started = performance.now();
  state.currentResources = activeResources;
  const currentOutput = (currentResult?.output || []).map(item => ({ ...item }));
  const currentMaps = getResultAssignmentMaps(currentResult);
  const affectedAssignments = affectedIndexes
    .map(householdIndex => getResultAssignmentForRow(currentResult, updatedRows[householdIndex], currentMaps))
    .filter(Boolean);
  const resourceIndexes = [...new Set(affectedAssignments.map(item => item.resourceIndex).filter(index => typeof index === 'number'))];
  if (!affectedIndexes.length || !resourceIndexes.length) {
    return { ...currentResult, output: currentOutput, durationMs: performance.now() - started, affectedCount: 0 };
  }
  const scales = currentResult.componentScales || buildEnhancedCostMatrix(updatedRows, activeResources).componentScales;
  const subEntries = resourceIndexes.map(resourceIndex => affectedIndexes.map(householdIndex => (
    computeEnhancedCostEntry(updatedRows[householdIndex], updatedRows, activeResources[resourceIndex], resourceIndex, householdIndex, scales)
  )));
  const subAssignment = hungarian(subEntries.map(row => row.map(item => item.value)));
  const outputByResource = new Map(currentOutput.map(item => [item.resourceIndex, item]));
  subAssignment.forEach((assignedHouseholdPosition, resourcePosition) => {
    const resourceIndex = resourceIndexes[resourcePosition];
    const entry = subEntries[resourcePosition][assignedHouseholdPosition];
    const household = updatedRows[entry.householdIndex];
    outputByResource.set(resourceIndex, {
      resource: formatAssignedResource(resourceIndex),
      resourceIndex,
      resourceName: resourceLabel(resourceIndex),
      resourceType: resourceType(resourceIndex),
      household,
      value: entry.value,
      distanceKm: distance(household, resourceIndex),
      components: entry.components
    });
  });
  const output = currentOutput.map(item => outputByResource.get(item.resourceIndex) || item);
  const durationMs = performance.now() - started;
  const metrics = calculateAssignmentMetrics(output, updatedRows);
  return {
    ...currentResult,
    output,
    cost: metrics.nativeCost,
    totalDistance: metrics.totalDistance,
    meanDistance: metrics.meanDistance,
    maxDistance: metrics.maxDistance,
    priorityMatches: metrics.highUrgencyCorrect,
    accuracy: metrics.allocationAccuracy,
    prioritization: metrics.prioritizationEfficiency,
    duration: durationMs.toFixed(2),
    durationMs,
    householdOrder: updatedRows.map(row => getHouseholdId(row) || row.household_id || ''),
    metrics
  };
}

function simulateDynamicReassignment(enhanced, rows, activeResources) {
  if (!enhanced || !rows.length) return { status: 'Not Triggered', events: [], affectedCount: 0, durationMs: 0 };
  const events = createDynamicUrgencyEvents(rows, 5);
  if (!events.length) return { status: 'Not Triggered', events: [], affectedCount: 0, durationMs: 0 };
  let standardRows = rows.map(row => ({ ...row }));
  let enhancedRows = rows.map(row => ({ ...row }));
  let currentEnhanced = enhanced;
  let standardDurationMs = 0;
  let enhancedDurationMs = 0;
  const eventDetails = events.map(event => {
    const previousAssignment = getResultAssignmentForRow(currentEnhanced, enhancedRows[event.householdIndex]);
    if (!event.triggered) {
      return { household: enhancedRows[event.householdIndex], ...event, previousAssignment, updatedAssignment: previousAssignment, changed: false, standardMs: 0, enhancedMs: 0 };
    }
    standardRows = applyDynamicEventRows(standardRows, event);
    enhancedRows = applyDynamicEventRows(enhancedRows, event);
    const standardRecomputed = runAssignment('existing', standardRows, activeResources);
    currentEnhanced = selectiveEnhancedReassignment(currentEnhanced, enhancedRows, activeResources, [event.householdIndex]);
    standardDurationMs += standardRecomputed.durationMs;
    enhancedDurationMs += currentEnhanced.durationMs;
    const updatedAssignment = getResultAssignmentForRow(currentEnhanced, enhancedRows[event.householdIndex]);
    return {
      household: enhancedRows[event.householdIndex],
      ...event,
      previousAssignment,
      updatedAssignment,
      changed: previousAssignment?.resourceIndex !== updatedAssignment?.resourceIndex,
      standardMs: standardRecomputed.durationMs,
      enhancedMs: currentEnhanced.durationMs
    };
  });
  const affectedIndexes = new Set(eventDetails.filter(event => event.triggered).map(event => event.householdIndex));
  return {
    status: affectedIndexes.size ? 'Triggered' : 'Not Triggered',
    affectedCount: affectedIndexes.size,
    standardDurationMs,
    durationMs: enhancedDurationMs,
    updated: currentEnhanced,
    updatedRows: enhancedRows,
    events: eventDetails
  };
}

function getResultAssignmentMaps(result) {
  const byRow = new Map();
  const byId = new Map();
  (result?.output || []).forEach(item => {
    byRow.set(item.household, item);
    const id = getHouseholdId(item.household);
    if (id) byId.set(id, item);
  });
  return { byRow, byId };
}

function getResultAssignmentForRow(result, row, maps = getResultAssignmentMaps(result)) {
  const id = getHouseholdId(row);
  return maps.byRow.get(row) || (id ? maps.byId.get(id) : null);
}

function averageRanks(values) {
  const ranked = values.map((value, index) => ({ value: Number(value), index })).sort((a, b) => a.value - b.value);
  const ranks = Array(values.length).fill(0);
  for (let index = 0; index < ranked.length;) {
    let end = index + 1;
    while (end < ranked.length && ranked[end].value === ranked[index].value) end += 1;
    const rank = (index + 1 + end) / 2;
    for (let cursor = index; cursor < end; cursor++) ranks[ranked[cursor].index] = rank;
    index = end;
  }
  return ranks;
}

function pearsonCorrelation(left, right) {
  if (left.length !== right.length || left.length < 2) return null;
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < left.length; index++) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftVariance += leftDelta ** 2;
    rightVariance += rightDelta ** 2;
  }
  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator ? numerator / denominator : null;
}

function spearmanCorrelation(left, right) {
  const pairs = left.map((value, index) => [Number(value), Number(right[index])]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  if (pairs.length < 2) return null;
  const leftRanks = averageRanks(pairs.map(([value]) => value));
  const rightRanks = averageRanks(pairs.map(([, value]) => value));
  return pearsonCorrelation(leftRanks, rightRanks);
}

function isAssignedCompatible(item) {
  if (!item?.household) return false;
  const assignedType = item.resourceType || resourceType(item.resourceIndex);
  return getHouseholdResourceCompatibilityScore(item.household, assignedType) > 0;
}

function getAssignedCompatibilityScore(item) {
  if (!item?.household) return 0;
  const assignedType = item.resourceType || resourceType(item.resourceIndex);
  return getHouseholdResourceCompatibilityScore(item.household, assignedType);
}

function getHighUrgencyThreshold(rows) {
  const urgencyValues = (rows || []).map(row => Number(row.urgency)).filter(Number.isFinite);
  if (!urgencyValues.length) return HIGH_URGENCY_THRESHOLD;
  const maxUrgency = Math.max(...urgencyValues);
  if (maxUrgency <= 4) return FOUR_POINT_HIGH_URGENCY_THRESHOLD;
  if (maxUrgency <= 10) return HIGH_URGENCY_THRESHOLD;
  return HUNDRED_POINT_HIGH_URGENCY_THRESHOLD;
}

function calculateAssignmentMetrics(output, rows) {
  const assignmentCount = output.length;
  const compatibleAssignments = output.filter(isAssignedCompatible).length;
  const mismatchCount = assignmentCount - compatibleAssignments;
  const compatibilityScores = output.map(getAssignedCompatibilityScore);
  const compatibilityScoreTotal = compatibilityScores.reduce((sum, score) => sum + score, 0);
  const totalDistance = output.reduce((sum, item) => sum + (Number(item.distanceKm) || 0), 0);
  const meanDistance = assignmentCount ? totalDistance / assignmentCount : null;
  const maxDistance = assignmentCount ? Math.max(...output.map(item => Number(item.distanceKm) || 0)) : null;
  const assignmentMaps = getResultAssignmentMaps({ output });
  const highUrgencyThreshold = getHighUrgencyThreshold(rows);
  const highUrgencyRows = rows.filter(row => Number(row.urgency) >= highUrgencyThreshold);
  const highUrgencyCorrect = highUrgencyRows.filter(row => isAssignedCompatible(getResultAssignmentForRow({ output }, row, assignmentMaps))).length;
  const urgencyWeighted = output.reduce((totals, item) => {
    const urgency = Number(item.household?.urgency);
    if (!Number.isFinite(urgency) || urgency <= 0) return totals;
    totals.weight += urgency;
    totals.served += urgency * getAssignedCompatibilityScore(item);
    return totals;
  }, { served: 0, weight: 0 });
  const prioritizationEfficiency = urgencyWeighted.weight ? urgencyWeighted.served / urgencyWeighted.weight : null;
  return {
    assignmentCount,
    compatibleAssignments,
    mismatchCount,
    highUrgencyCorrect,
    highUrgencyTotal: highUrgencyRows.length,
    highUrgencyThreshold,
    allocationAccuracy: assignmentCount ? compatibilityScoreTotal / assignmentCount : null,
    compatibilityRate: assignmentCount ? compatibleAssignments / assignmentCount : null,
    meanCompatibilityScore: assignmentCount ? compatibilityScoreTotal / assignmentCount : null,
    totalDistance,
    meanDistance,
    maxDistance,
    prioritizationEfficiency,
    urgencyWeightedCompatible: urgencyWeighted.served,
    urgencyWeightTotal: urgencyWeighted.weight,
    nativeCost: output.reduce((sum, item) => sum + (Number(item.value) || 0), 0),
    unassignedCount: Math.max(0, rows.length - assignmentCount)
  };
}

function runAssignment(mode, rows, activeResources) {
  const started = performance.now();
  state.currentResources = activeResources;
  const { matrix, components, componentScales } = makeMatrix(mode, rows, activeResources);
  logAlgorithmCriteriaDiagnostics(mode, matrix, activeResources.length);
  const resourcesExceedHouseholds = activeResources.length > rows.length;
  const solverMatrix = resourcesExceedHouseholds
    ? rows.map((_, householdIndex) => activeResources.map((__, resourceIndex) => matrix[resourceIndex][householdIndex]))
    : matrix;
  const assignment = hungarian(solverMatrix);
  const output = assignment.map((assignedIndex, index) => {
    const resourceIndex = resourcesExceedHouseholds ? assignedIndex : index;
    const householdIndex = resourcesExceedHouseholds ? index : assignedIndex;
    const household = rows[householdIndex];
    return {
      resource: formatAssignedResource(resourceIndex),
      resourceIndex,
      resourceName: resourceLabel(resourceIndex),
      resourceType: resourceType(resourceIndex),
      household,
      value: matrix[resourceIndex][householdIndex],
      distanceKm: distance(household, resourceIndex),
      components: components?.[resourceIndex]?.[householdIndex] || null
    };
  }).filter(item => item.household);
  const durationMs = performance.now() - started;
  const metrics = calculateAssignmentMetrics(output, rows);
  return {
    mode,
    output,
    cost: metrics.nativeCost,
    totalDistance: metrics.totalDistance,
    meanDistance: metrics.meanDistance,
    maxDistance: metrics.maxDistance,
    priorityMatches: metrics.highUrgencyCorrect,
    accuracy: metrics.allocationAccuracy,
    prioritization: metrics.prioritizationEfficiency,
    duration: durationMs.toFixed(2),
    durationMs,
    dataset: state.filename,
    records: rows.length,
    resourceCount: activeResources.length,
    activeResources: activeResources.map(resource => ({ ...resource })),
    householdOrder: rows.map(row => getHouseholdId(row) || row.household_id || ''),
    matrixRows: activeResources.length,
    matrixColumns: rows.length,
    matrixSize: `${activeResources.length} x ${rows.length}`,
    matrixValues: matrix.flat().filter(isFiniteNumber).map(Number),
    costMatrix: matrix.map(row => row.slice()),
    componentScales,
    metrics,
    weights: { ...state.weights }
  };
}

function logAlgorithmCriteriaDiagnostics(mode, matrix, activeResourceCount) {
  if (!DEBUG_ALGORITHM_DIAGNOSTICS || typeof console === 'undefined') return;
  const existing = mode === 'existing';
  console.groupCollapsed(`=== ${existing ? 'EXISTING' : 'ENHANCED'} ALGORITHM ===`);
  console.log(`Criterion: ${existing ? 'DISTANCE ONLY' : 'DISTANCE + URGENCY + COMPATIBILITY'}`);
  console.log(`Households: ${getVerifiedHouseholdSet().length}`);
  console.log(`Resources: ${activeResourceCount}`);
  console.log(`Cost matrix shape: ${matrix.length} x ${matrix[0]?.length || 0}`);
  console.table({
    distance: 'YES',
    urgency: existing ? 'NO' : 'YES',
    compatibility: existing ? 'NO' : 'YES',
    priority: existing ? 'NO' : 'DERIVED FROM URGENCY'
  });
  console.groupEnd();
}

function execute(mode) {
  const blockers = getRunBlockers(mode);
  if (blockers.length) {
    toast(blockers[0]);
    go('compare');
    return null;
  }
  const verifiedHouseholds = getVerifiedHouseholdSet();
  const activeResources = getActiveResources(verifiedHouseholds);
  const result = runAssignment(mode, verifiedHouseholds, activeResources);
  state.latest = result;
  state.results[mode] = result;
  state.history.unshift({ id: `RUN-${String(Date.now()).slice(-5)}`, mode, dataset: state.filename, records: verifiedHouseholds.length, duration: result.duration, timestamp: new Date().toLocaleString() });
  state.history = state.history.slice(0, 20);
  localStorage.setItem('allocation-history', JSON.stringify(state.history));
  logAllocationDiagnostics(`${mode} algorithm output`, result);
  renderResult(result);
  renderHistory();
  return result;
}

function executeShared(mode, rows, activeResources) {
  const result = runAssignment(mode, rows, activeResources);
  state.latest = result;
  state.results[mode] = result;
  state.history.unshift({ id: `RUN-${String(Date.now()).slice(-5)}`, mode, dataset: state.filename, records: rows.length, duration: result.duration, timestamp: new Date().toLocaleString() });
  state.history = state.history.slice(0, 20);
  localStorage.setItem('allocation-history', JSON.stringify(state.history));
  logAllocationDiagnostics(`${mode} algorithm output`, result);
  renderResult(result);
  renderHistory();
  return result;
}

function renderResult(result) {
  const target = result.mode === 'existing' ? '#existing-output' : '#enhanced-output';
  const metrics = result.mode === 'existing' ? '#existing-metrics' : '#enhanced-metrics';
  $(target).className = 'result-list';
  $(target).innerHTML = result.output.map(item => {
    const summary = result.mode === 'existing'
      ? `distance cost ${item.value.toFixed(2)} km · basis distance only`
      : `urgency ${item.household.urgency} · weighted cost ${item.value.toFixed(2)}`;
    return `<div class="result-row"><span>${item.resource} <b>→</b> ${item.household.household_id}</span><small>${summary}</small></div>`;
  }).join('');
  if (result.mode === 'existing') {
    $(metrics).innerHTML = `<div class="metric-section-title"><span>Optimization criterion</span><strong>Distance only</strong></div><div><span>Total distance cost</span><strong>${result.cost.toFixed(2)} km</strong></div><div><span>Mean assignment distance</span><strong>${result.meanDistance.toFixed(2)} km</strong></div><div><span>Maximum assignment distance</span><strong>${result.maxDistance.toFixed(2)} km</strong></div><div><span>Number of assignments</span><strong>${result.output.length}</strong></div><div><span>Execution time</span><strong>${result.duration} ms</strong></div><div class="metric-section-note"><span>Evaluation metrics only</span><small>Compatibility and priority are measured after assignment; they do not affect the Standard Hungarian result.</small></div><div><span>Compatibility rate</span><strong>${(result.accuracy * 100).toFixed(1)}%</strong></div><div><span>Prioritization efficiency</span><strong>${(result.prioritization * 100).toFixed(1)}%</strong></div>`;
  } else {
    $(metrics).innerHTML = `<div><span>Total weighted cost</span><strong>${result.cost.toFixed(2)}</strong></div><div><span>Total assignment distance</span><strong>${result.totalDistance.toFixed(2)} km</strong></div><div><span>Compatibility rate</span><strong>${(result.accuracy * 100).toFixed(1)}%</strong></div><div><span>Prioritization efficiency</span><strong>${(result.prioritization * 100).toFixed(1)}%</strong></div><div><span>Execution time</span><strong>${result.duration} ms</strong></div>`;
  }
  $(`#${result.mode}-status`).textContent = 'Complete';
  $('#stat-latest').textContent = result.mode === 'existing' ? 'Baseline' : 'Enhanced';
  $('#stat-latest-detail').textContent = `${result.duration} ms · ${result.records} verified records`;
  $('#dashboard-output').className = 'result-list';
  $('#dashboard-output').innerHTML = result.output.slice(0, 5).map(item => `<div class="result-row"><span>${item.resource} <b>→</b> ${item.household.household_id}</span><small>${item.value.toFixed(2)}</small></div>`).join('');
}
function compare() {
  const blockers = [...getRunBlockers('existing'), ...getRunBlockers('enhanced')];
  if (blockers.length) {
    toast(blockers[0]);
    go('compare');
    return;
  }
  const existing = execute('existing');
  const enhanced = execute('enhanced');
  if (!existing || !enhanced) return;
  $('#compare-empty').classList.add('hidden');
  $('#compare-content').classList.remove('hidden');
  $('#compare-records').textContent = existing.records;
  $('#compare-baseline').textContent = existing.cost.toFixed(2);
  $('#compare-enhanced').textContent = enhanced.cost.toFixed(2);
  $('#compare-changed').textContent = `${(existing.accuracy * 100).toFixed(1)}% → ${(enhanced.accuracy * 100).toFixed(1)}%`;
  $('#compare-priority').textContent = `${(enhanced.prioritization * 100).toFixed(1)}%`;
  const draw = (result, target) => {
    $(target).innerHTML = result.output.map(item => `<div class="compare-row"><span>${item.resource} <b>→</b> ${item.household.household_id}</span><span>${item.value.toFixed(2)}</span></div>`).join('');
  };
  draw(existing, '#compare-existing');
  draw(enhanced, '#compare-enhanced-list');
}
function renderHistory() { $('#history-list').innerHTML = state.history.length ? state.history.map(run => `<div class="history-row"><span>${run.id}</span><span>${run.mode === 'existing' ? 'Existing' : 'Enhanced'}</span><span>${run.dataset}</span><span>${run.records}</span><span>${run.duration} ms</span><span>Complete</span></div>`).join('') : '<div class="empty-output"><span>↺</span><p>No runs recorded yet.</p></div>'; }
renderResult = function (result) {
  const target = result.mode === 'existing' ? '#existing-output' : '#enhanced-output';
  const metrics = result.mode === 'existing' ? '#existing-metrics' : '#enhanced-metrics';
  $(target).className = 'result-list';
  const outputRows = result.mode === 'existing'
    ? result.output.map(item => `<tr><td>${escapeHtml(item.resource)}<br><small>${escapeHtml(item.resourceType || '')}</small></td><td>${escapeHtml(item.household.household_id)}</td><td>${formatDistanceKm(item.distanceKm)}</td></tr>`).join('')
    : result.output.map(item => `<tr><td>${escapeHtml(item.resource)}<br><small>${escapeHtml(item.resourceType || '')}</small></td><td>${escapeHtml(item.household.household_id)}</td><td>${formatDistanceKm(item.distanceKm)}</td><td>${escapeHtml(item.household.urgency)}</td><td>${escapeHtml(formatCompatibilityProfile(item.household))}</td><td>${assignmentCompatibilityLabel(item)}</td><td>${round(item.value, 3)}</td></tr>`).join('');
  const headers = result.mode === 'existing'
    ? '<tr><th>Resource ID / Resource Type</th><th>Assigned Household ID</th><th>Distance</th></tr>'
    : '<tr><th>Resource ID / Resource Type</th><th>Assigned Household ID</th><th>Distance</th><th>Urgency</th><th>Required Resource Type</th><th>Compatibility</th><th>Composite Weighted Cost</th></tr>';
  const note = result.mode === 'existing'
    ? 'Baseline output is distance-only. Urgency, vulnerability, compatibility, and research weights are excluded from this tab and from baseline optimization.'
    : `Fixed research weights: distance ${result.weights.distance.toFixed(3)}, urgency ${result.weights.urgency.toFixed(3)}, compatibility ${result.weights.compatibility.toFixed(3)}.`;
  const summaryItems = result.mode === 'existing'
    ? [
      { label: 'Eligible Households', value: result.records },
      { label: 'Available Resources', value: result.resourceCount },
      { label: 'Total Assignments', value: result.metrics.assignmentCount },
      { label: 'Total Distance', value: formatDistanceKm(result.totalDistance) },
      { label: 'Mean Distance', value: formatDistanceKm(result.meanDistance) },
      { label: 'Execution Time', value: formatDurationMs(result.durationMs) }
    ]
    : [
      { label: 'Verified / Eligible Households', value: result.records },
      { label: 'Total Assignments', value: result.metrics.assignmentCount },
      { label: 'Compatibility Rate', value: formatPercent(result.metrics.compatibilityRate) },
      { label: 'Prioritization Efficiency', value: formatPercent(result.metrics.prioritizationEfficiency) },
      { label: 'Total Physical Distance', value: formatDistanceKm(result.totalDistance) },
      { label: 'Total Weighted Cost', value: round(result.cost, 3) },
      { label: 'Execution Time', value: formatDurationMs(result.durationMs) }
    ];
  const tableTitle = result.mode === 'existing' ? 'Standard Hungarian Allocation Results' : 'Enhanced Allocation Results';
  $(target).innerHTML = `${renderMetricSummary(summaryItems)}<p class="compare-note">${escapeHtml(note)}</p><div class="table-wrap"><table class="assignment-output-table"><caption>${escapeHtml(tableTitle)}</caption><thead>${headers}</thead><tbody>${outputRows}</tbody></table></div>${renderWeightedCostMatrixDetails(result)}`;
  if (result.mode === 'existing') {
    $(metrics).innerHTML = `<div class="metric-section-title"><span>Displayed basis</span><strong>Distance-only baseline</strong></div><div><span>Cost matrix</span><strong>Geographical distance only</strong></div><div><span>Excluded from baseline</span><strong>Urgency, vulnerability, compatibility, weights</strong></div>`;
  } else {
    $(metrics).innerHTML = `<div><span>Distance</span><strong>${result.weights.distance.toFixed(3)}</strong></div><div><span>Urgency</span><strong>${result.weights.urgency.toFixed(3)}</strong></div><div><span>Compatibility</span><strong>${result.weights.compatibility.toFixed(3)}</strong></div><div><span>Dynamic re-assignment</span><strong>Shown only when tested</strong></div>`;
  }
  $(`#${result.mode}-status`).textContent = 'Complete';
  $('#stat-latest').textContent = result.mode === 'existing' ? 'Baseline' : 'Enhanced';
  $('#stat-latest-detail').textContent = `${formatDurationMs(result.durationMs)}; ${result.records} verified records`;
  const dashboardOutput = $('#dashboard-output');
  if (dashboardOutput) {
    dashboardOutput.className = 'result-list';
    dashboardOutput.innerHTML = result.output.slice(0, 5).map(item => `<div class="result-row"><span>${escapeHtml(item.household.household_id)} <b>&rarr;</b> ${escapeHtml(item.resource)}</span><small>${formatDistanceKm(item.distanceKm)}</small></div>`).join('');
  }
};

function renderComparisonTable(rows, title = '') {
  const caption = title ? `<caption>${escapeHtml(title)}</caption>` : '';
  return `<div class="table-wrap compare-table-wrap"><table class="compare-table">${caption}<thead><tr><th>Metric</th><th>Existing</th><th>Enhanced</th><th>Difference</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escapeHtml(row.metric)}${row.note ? `<small class="metric-note">${escapeHtml(row.note)}</small>` : ''}</td><td>${row.standard}</td><td>${row.enhanced}</td><td>${row.difference}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderDiagnosticTable(rows, title = '') {
  return `<div class="diagnostic-card-list">${title ? `<h4>${escapeHtml(title)}</h4>` : ''}${rows.map(row => `<article class="diagnostic-card"><div><strong>${escapeHtml(row.metric)}</strong>${row.note ? `<small class="metric-note">${escapeHtml(row.note)}</small>` : ''}</div><div class="diagnostic-result">${row.result}</div></article>`).join('')}</div>`;
}

function compareHigherBetter(standard, enhanced) {
  if (!isFiniteNumber(standard) || !isFiniteNumber(enhanced)) return 'Requires varied data';
  if (Number(enhanced) > Number(standard)) return 'Enhanced higher';
  if (Number(standard) > Number(enhanced)) return 'Standard higher';
  return 'Tie';
}

function compareLowerBetter(standard, enhanced) {
  if (!isFiniteNumber(standard) || !isFiniteNumber(enhanced)) return 'Requires data';
  if (Number(enhanced) < Number(standard)) return 'Enhanced lower';
  if (Number(standard) < Number(enhanced)) return 'Standard lower';
  return 'Tie';
}

function getHighUrgencyServiceRate(result) {
  const total = result?.metrics?.highUrgencyTotal;
  return total ? result.metrics.highUrgencyCorrect / total : null;
}

function formatHighUrgencyServed(result) {
  const total = result?.metrics?.highUrgencyTotal;
  if (!total) return 'Not measurable - no high-urgency households in selected dataset';
  return `${result.metrics.highUrgencyCorrect} / ${total}`;
}

function compareHighUrgencyPriority(standard, enhanced) {
  const standardRate = getHighUrgencyServiceRate(standard);
  const enhancedRate = getHighUrgencyServiceRate(enhanced);
  return compareHigherBetter(standardRate, enhancedRate);
}

function formatHighUrgencyChange(standard, enhanced) {
  const standardRate = getHighUrgencyServiceRate(standard);
  const enhancedRate = getHighUrgencyServiceRate(enhanced);
  if (!isFiniteNumber(standardRate) || !isFiniteNumber(enhancedRate)) return 'Requires high-urgency H*';
  const countDiff = enhanced.metrics.highUrgencyCorrect - standard.metrics.highUrgencyCorrect;
  return `${formatHighUrgencyServed(standard)} -> ${formatHighUrgencyServed(enhanced)} (${formatSignedInteger(countDiff)} households; ${formatPercentagePoint(enhancedRate - standardRate)})`;
}

function formatCoefficientChange(standard, enhanced) {
  if (!isFiniteNumber(standard) || !isFiniteNumber(enhanced)) return 'Requires varied data';
  return `${formatCoefficient(standard)} -> ${formatCoefficient(enhanced)}`;
}

function formatPrioritizationChange(standard, enhanced) {
  if (!isFiniteNumber(standard) || !isFiniteNumber(enhanced)) return 'Requires urgency data';
  return formatPercentagePoint(Number(enhanced) - Number(standard));
}

function formatAssignmentComparisonResult(changedCount, total) {
  return `${changedCount} of ${total} assignments differ (${formatPercent(total ? changedCount / total : null)})`;
}

function formatDynamicTimeSaved(value) {
  if (!isFiniteNumber(value)) return 'N/A';
  const numeric = Number(value);
  if (Math.abs(numeric) < 0.005) return 'No measurable saving';
  return numeric > 0
    ? `${numeric.toFixed(2)} ms saved`
    : `${Math.abs(numeric).toFixed(2)} ms slower`;
}

function formatDynamicImprovement(value, savedMs) {
  if (!isFiniteNumber(value) || !isFiniteNumber(savedMs)) return 'Not mathematically valid';
  if (Number(savedMs) <= 0) return 'No improvement';
  return formatPercent(value);
}

function formatSop1Outcome(existing, enhanced, existingComparableCost, enhancedComparableCost) {
  const accuracyDiff = enhanced.metrics.allocationAccuracy - existing.metrics.allocationAccuracy;
  const priorityDiff = enhanced.metrics.prioritizationEfficiency - existing.metrics.prioritizationEfficiency;
  const compositeDiff = enhancedComparableCost - existingComparableCost;
  const improvements = [
    isFiniteNumber(accuracyDiff) && accuracyDiff > 0.0005,
    isFiniteNumber(priorityDiff) && priorityDiff > 0.0005,
    isFiniteNumber(compositeDiff) && compositeDiff < -0.0005
  ].filter(Boolean).length;
  if (improvements) return `Enhanced improves ${improvements} multi-objective indicator${improvements === 1 ? '' : 's'} in this run.`;
  const ties = [
    isFiniteNumber(accuracyDiff) && Math.abs(accuracyDiff) <= 0.0005,
    isFiniteNumber(priorityDiff) && Math.abs(priorityDiff) <= 0.0005,
    isFiniteNumber(compositeDiff) && Math.abs(compositeDiff) <= 0.0005
  ].filter(Boolean).length;
  if (ties >= 2) return 'No visible SOP 1 improvement in this run; the selected data may not create enough distance-compatibility-urgency conflict.';
  return 'Enhanced does not outperform the baseline on the measured SOP 1 indicators in this run.';
}

function compareFasterInThisRun(standardMs, enhancedMs) {
  if (!isFiniteNumber(standardMs) || !isFiniteNumber(enhancedMs)) return 'Requires data';
  if (Number(enhancedMs) < Number(standardMs)) return 'Enhanced faster in this run';
  if (Number(standardMs) < Number(enhancedMs)) return 'Standard faster in this run';
  return 'Tie in this run';
}

function assignmentLabel(item) {
  return item ? item.resource : 'Unassigned';
}

function assignmentCompatibilityLabel(item) {
  if (!item) return 'Unassigned';
  return isAssignedCompatible(item) ? 'Yes' : 'No';
}

function buildHouseholdComparisonRows(rows, existing, enhanced) {
  const existingMaps = getResultAssignmentMaps(existing);
  const enhancedMaps = getResultAssignmentMaps(enhanced);
  return rows.map((household, index) => {
    const standard = getResultAssignmentForRow(existing, household, existingMaps);
    const enhancedAssignment = getResultAssignmentForRow(enhanced, household, enhancedMaps);
    const standardKey = standard ? standard.resourceIndex : null;
    const enhancedKey = enhancedAssignment ? enhancedAssignment.resourceIndex : null;
    const changed = standardKey !== enhancedKey;
    const corrected = changed && standard && enhancedAssignment && !isAssignedCompatible(standard) && isAssignedCompatible(enhancedAssignment);
    return {
      index,
      household,
      standard,
      enhanced: enhancedAssignment,
      changed,
      corrected,
      label: corrected ? 'Yes - corrected mismatch' : changed ? 'Yes' : 'No'
    };
  });
}

function formatAssignmentChangeCount(changedCount, total) {
  return `${changedCount} / ${total} (${formatPercent(total ? changedCount / total : null)})`;
}

function getResourceTypeVariety(activeResources) {
  return new Set((activeResources || []).map(resource => normalizeResourceRequirement(resource.resource_type)).filter(Boolean)).size;
}

function getHouseholdNeedVariety(rows) {
  return new Set((rows || []).map(formatCompatibilityProfile).filter(value => value && value !== 'Unresolved')).size;
}

function hasHighUrgencyHouseholds(rows) {
  const threshold = getHighUrgencyThreshold(rows);
  return (rows || []).some(row => Number(row.urgency) >= threshold);
}

function hasCompatibilityConflict(rows, activeResources) {
  if (!rows?.length || !activeResources?.length) return false;
  return activeResources.some((_, resourceIndex) => rows.some(row => !isCompatible(row, resourceIndex)));
}

function getComparisonDataNotes(existing, enhanced, householdRows, rows, activeResources) {
  const notes = [];
  const changedCount = householdRows.filter(row => row.changed).length;
  const squareMatrix = existing?.metrics?.assignmentCount > 0 && rows.length === activeResources.length;
  if (!changedCount) {
    notes.push('The current run produced the same household-resource pairs. The table now reports this as no assignment change instead of implying a hidden improvement.');
  }
  if (squareMatrix) {
    notes.push('This is a square comparison: every listed household receives one listed resource. A household-only urgency term can change the enhanced cost values, but by itself it does not change which household is paired with which resource.');
  }
  if (getResourceTypeVariety(activeResources) <= 1 || getHouseholdNeedVariety(rows) <= 1) {
    notes.push('Compatibility differences require varied resource types and varied household needs. If all assignments are compatible, compatibility rate will tie honestly.');
  }
  if (!hasCompatibilityConflict(rows, activeResources)) {
    notes.push('No compatibility conflict exists in this dataset.');
  }
  if (!existing?.metrics?.highUrgencyTotal && !enhanced?.metrics?.highUrgencyTotal) {
    notes.push(`Not measurable - no high-urgency households in selected dataset. The high-urgency threshold is ${getHighUrgencyThreshold(rows)} for the detected urgency scale.`);
  }
  return notes;
}

function renderComparisonDataNotes(existing, enhanced, householdRows, rows, activeResources) {
  const notes = getComparisonDataNotes(existing, enhanced, householdRows, rows, activeResources);
  if (!notes.length) return '';
  return `<div class="comparison-note-box"><strong>What this run actually shows</strong>${notes.map(note => `<p>${escapeHtml(note)}</p>`).join('')}</div>`;
}

function renderHouseholdComparisonTable(rows) {
  return `<p class="compare-note">Urgency and resource need are shown here only to explain the Enhanced output and to evaluate both completed assignments. The Existing assignment columns remain distance-only.</p><div class="table-wrap household-compare-wrap"><table class="compare-table household-compare-table" id="household-change-table"><thead><tr><th>Household</th><th>Urgency</th><th>Resource Need</th><th>Existing Assignment</th><th>Existing Distance</th><th>Enhanced Assignment</th><th>Enhanced Distance</th><th>Enhanced Compatibility</th><th>Changed?</th></tr></thead><tbody>${rows.map(row => {
    const attrs = row.changed ? ` data-change-index="${row.index}" tabindex="0"` : '';
    return `<tr class="household-change-row${row.changed ? ' is-changed' : ''}"${attrs}><td>${escapeHtml(getHouseholdId(row.household) || row.household.household_id || `H* ${row.index + 1}`)}</td><td>${escapeHtml(row.household.urgency)}</td><td>${escapeHtml(formatCompatibilityProfile(row.household))}</td><td>${escapeHtml(assignmentLabel(row.standard))}</td><td>${formatDistanceKm(row.standard?.distanceKm)}</td><td>${escapeHtml(assignmentLabel(row.enhanced))}</td><td>${formatDistanceKm(row.enhanced?.distanceKm)}</td><td>${assignmentCompatibilityLabel(row.enhanced)}</td><td>${escapeHtml(row.label)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderHouseholdChangeDetail(row) {
  if (!row) return '<p class="compare-note">No assignment changes were produced by the current Standard and Enhanced outputs.</p>';
  const standard = row.standard;
  const enhanced = row.enhanced;
  return `<div class="change-detail-grid"><div><span>Household</span><strong>${escapeHtml(getHouseholdId(row.household) || row.household.household_id || `H* ${row.index + 1}`)}</strong></div><div><span>Resource Need</span><strong>${escapeHtml(formatCompatibilityProfile(row.household))}</strong></div><div><span>Urgency</span><strong>${escapeHtml(row.household.urgency)}</strong></div></div><div class="change-detail-columns"><section><h4>STANDARD</h4><div class="change-detail-line"><span>Assignment</span><strong>${escapeHtml(assignmentLabel(standard))}</strong></div><div class="change-detail-line"><span>Distance</span><strong>${formatDistanceKm(standard?.distanceKm, 3)}</strong></div><div class="change-detail-line"><span>Decision basis</span><strong>Distance only</strong></div></section><section><h4>ENHANCED</h4><div class="change-detail-line"><span>Assignment</span><strong>${escapeHtml(assignmentLabel(enhanced))}</strong></div><div class="change-detail-line"><span>Distance component</span><strong>${round(enhanced?.components?.distanceComponent, 3)}</strong></div><div class="change-detail-line"><span>Urgency component</span><strong>${round(enhanced?.components?.urgencyComponent, 3)}</strong></div><div class="change-detail-line"><span>Compatibility component</span><strong>${round(enhanced?.components?.compatibilityComponent, 3)}</strong></div><div class="change-detail-line"><span>Composite cost</span><strong>${round(enhanced?.value, 3)}</strong></div></section></div>`;
}

function bindComparisonReport(rows) {
  const detail = $('#change-detail-content');
  if (!detail) return;
  const changedRows = rows.filter(row => row.changed);
  const buttons = Array.from(document.querySelectorAll('#household-change-table [data-change-index]'));
  const selectRow = selected => {
    detail.innerHTML = renderHouseholdChangeDetail(selected);
    buttons.forEach(button => button.classList.toggle('is-selected', Number(button.dataset.changeIndex) === selected.index));
  };
  buttons.forEach(button => {
    const row = rows[Number(button.dataset.changeIndex)];
    button.addEventListener('click', () => selectRow(row));
    button.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      selectRow(row);
    });
  });
  if (changedRows.length) selectRow(changedRows[0]);
  else detail.innerHTML = renderHouseholdChangeDetail(null);
}

function runDynamicPerformanceBenchmark(rows, activeResources) {
  const standardInitial = runAssignment('existing', rows, activeResources);
  const enhancedInitial = runAssignment('enhanced', rows, activeResources);
  const events = createDynamicUrgencyEvents(rows, 5);
  if (events.length < 5) {
    return { standardInitial, enhancedInitial, events, status: 'Needs valid urgency values for five dynamic events' };
  }
  let standardRows = rows.map(row => ({ ...row }));
  let enhancedRows = rows.map(row => ({ ...row }));
  let currentEnhanced = enhancedInitial;
  const standardEventTimes = [];
  const enhancedEventTimes = [];
  const eventLogs = [];
  events.forEach(event => {
    if (!event.triggered) {
      standardEventTimes.push(0);
      enhancedEventTimes.push(0);
      eventLogs.push({ ...event, standardMs: 0, enhancedMs: 0, changed: false });
      return;
    }
    standardRows = applyDynamicEventRows(standardRows, event);
    enhancedRows = applyDynamicEventRows(enhancedRows, event);
    const standardRecomputed = runAssignment('existing', standardRows, activeResources);
    currentEnhanced = selectiveEnhancedReassignment(currentEnhanced, enhancedRows, activeResources, [event.householdIndex]);
    standardEventTimes.push(standardRecomputed.durationMs);
    enhancedEventTimes.push(currentEnhanced.durationMs);
    eventLogs.push({
      ...event,
      standardMs: standardRecomputed.durationMs,
      enhancedMs: currentEnhanced.durationMs,
      changed: true
    });
  });
  const standardReassignTotal = standardEventTimes.reduce((sum, value) => sum + value, 0);
  const enhancedReassignTotal = enhancedEventTimes.reduce((sum, value) => sum + value, 0);
  const eventCount = events.length;
  return {
    status: 'Complete',
    standardInitial,
    enhancedInitial,
    standardReassignTotal,
    enhancedReassignTotal,
    standardAverageReassign: eventCount ? standardReassignTotal / eventCount : null,
    enhancedAverageReassign: eventCount ? enhancedReassignTotal / eventCount : null,
    standardOverall: standardInitial.durationMs + standardReassignTotal,
    enhancedOverall: enhancedInitial.durationMs + enhancedReassignTotal,
    savedMs: standardReassignTotal - enhancedReassignTotal,
    improvementRate: standardReassignTotal > 0 ? (standardReassignTotal - enhancedReassignTotal) / standardReassignTotal : null,
    events: eventLogs
  };
}

function buildBenchmarkRows(rows) {
  return BENCHMARK_MATRIX_SIZES.map(size => {
    if (rows.length < size) return { size, status: `Needs ${size} verified H*; current H* is ${rows.length}`, standard: null, enhanced: null };
    const benchmarkRows = rows.slice(0, size);
    const benchmarkResources = getActiveResources(benchmarkRows, size);
    if (benchmarkResources.length < size) return { size, status: `Needs ${size} available resources; current R is ${benchmarkResources.length}`, standard: null, enhanced: null };
    return { size, ...runDynamicPerformanceBenchmark(benchmarkRows, benchmarkResources) };
  });
}

function renderBenchmarkTable(rows) {
  const benchmarks = buildBenchmarkRows(rows);
  return `<div class="table-wrap benchmark-wrap"><table class="compare-table benchmark-table"><caption>SOP 3 - Computational Performance Across 5 Dynamic Events</caption><thead><tr><th>Matrix Size</th><th>Initial Time</th><th>Avg Re-Assignment Time</th><th>Total Re-Assignment Time</th><th>Overall Time</th><th>Dynamic Time Saved</th><th>Dynamic Improvement</th></tr></thead><tbody>${benchmarks.map(row => {
    if (row.status !== 'Complete') return `<tr><td>${row.size}x${row.size}</td><td colspan="6">${escapeHtml(row.status)}</td></tr>`;
    return `<tr><td>${row.size}x${row.size}</td><td><strong>Existing:</strong> ${formatDurationMs(row.standardInitial.durationMs)}<br><strong>Enhanced:</strong> ${formatDurationMs(row.enhancedInitial.durationMs)}</td><td><strong>Existing:</strong> ${formatDurationMs(row.standardAverageReassign)}<br><strong>Enhanced:</strong> ${formatDurationMs(row.enhancedAverageReassign)}</td><td><strong>Existing:</strong> ${formatDurationMs(row.standardReassignTotal)}<br><strong>Enhanced:</strong> ${formatDurationMs(row.enhancedReassignTotal)}</td><td><strong>Existing:</strong> ${formatDurationMs(row.standardOverall)}<br><strong>Enhanced:</strong> ${formatDurationMs(row.enhancedOverall)}</td><td>${formatDynamicTimeSaved(row.savedMs)}</td><td>${formatDynamicImprovement(row.improvementRate, row.savedMs)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderTradeoffSummary(existing, enhanced) {
  const rows = [
    { label: 'Distance Efficiency', outcome: compareLowerBetter(existing.metrics.meanDistance, enhanced.metrics.meanDistance), detail: `${formatDistanceKm(existing.metrics.meanDistance)} vs ${formatDistanceKm(enhanced.metrics.meanDistance)}` },
    { label: 'Compatibility', outcome: compareHigherBetter(existing.metrics.compatibilityRate, enhanced.metrics.compatibilityRate), detail: `${formatPercent(existing.metrics.compatibilityRate)} vs ${formatPercent(enhanced.metrics.compatibilityRate)}` },
    { label: 'Prioritization', outcome: compareHighUrgencyPriority(existing, enhanced), detail: `${formatHighUrgencyServed(existing)} vs ${formatHighUrgencyServed(enhanced)}` },
    { label: 'Execution Time', outcome: compareFasterInThisRun(existing.durationMs, enhanced.durationMs), detail: `${formatDurationMs(existing.durationMs)} vs ${formatDurationMs(enhanced.durationMs)}` }
  ];
  return `<div class="tradeoff-list">${rows.map(row => `<div><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(row.outcome)}</strong><small>${escapeHtml(row.detail)}</small></div>`).join('')}</div>`;
}

function renderInterpretations(existing, enhanced, changedCount, rows) {
  const compatibilityDiff = enhanced.metrics.compatibilityRate - existing.metrics.compatibilityRate;
  const prioritizationDiff = enhanced.metrics.prioritizationEfficiency - existing.metrics.prioritizationEfficiency;
  const distanceDiff = enhanced.metrics.meanDistance - existing.metrics.meanDistance;
  const timeDiff = enhanced.durationMs - existing.durationMs;
  const standardHighUrgencyRate = getHighUrgencyServiceRate(existing);
  const enhancedHighUrgencyRate = getHighUrgencyServiceRate(enhanced);
  const highUrgencyDiff = isFiniteNumber(standardHighUrgencyRate) && isFiniteNumber(enhancedHighUrgencyRate)
    ? enhancedHighUrgencyRate - standardHighUrgencyRate
    : null;
  const distanceDirection = isFiniteNumber(distanceDiff) && Math.abs(distanceDiff) > 0.0005
    ? Number(distanceDiff) > 0 ? `accepted ${formatDistanceKm(Math.abs(distanceDiff))} longer mean physical distance` : `reduced mean physical distance by ${formatDistanceKm(Math.abs(distanceDiff))}`
    : 'kept mean physical distance unchanged';
  const urgencyDirection = isFiniteNumber(highUrgencyDiff) && Math.abs(highUrgencyDiff) > 0.0005
    ? Number(highUrgencyDiff) > 0 ? `improved high-urgency service by ${formatAbsolutePercentagePoint(highUrgencyDiff)}` : `reduced high-urgency service by ${formatAbsolutePercentagePoint(highUrgencyDiff)}`
    : isFiniteNumber(highUrgencyDiff) ? 'left high-urgency service unchanged' : 'could not evaluate high-urgency service';
  const compatibilityDirection = isFiniteNumber(compatibilityDiff) && Math.abs(compatibilityDiff) > 0.0005
    ? Number(compatibilityDiff) > 0 ? `improved compatibility by ${formatAbsolutePercentagePoint(compatibilityDiff)}` : `reduced compatibility by ${formatAbsolutePercentagePoint(compatibilityDiff)}`
    : 'left compatibility unchanged';
  const statements = [
    `Enhanced changed ${changedCount} of ${rows.length} H* assignment decisions (${formatPercent(rows.length ? changedCount / rows.length : null)}).`,
    `Enhanced changed compatibility from ${formatPercent(existing.metrics.compatibilityRate)} to ${formatPercent(enhanced.metrics.compatibilityRate)}, a change of ${formatPercentagePoint(compatibilityDiff)}.`,
    `High-urgency households correctly served changed from ${formatHighUrgencyServed(existing)} to ${formatHighUrgencyServed(enhanced)}, a change of ${isFiniteNumber(highUrgencyDiff) ? formatPercentagePoint(highUrgencyDiff) : 'N/A'}.`,
    `Enhanced changed mean physical distance from ${formatDistanceKm(existing.metrics.meanDistance)} to ${formatDistanceKm(enhanced.metrics.meanDistance)}, a difference of ${formatSignedNumber(distanceDiff, 2, ' km')}.`,
    `Enhanced changed execution time from ${formatDurationMs(existing.durationMs)} to ${formatDurationMs(enhanced.durationMs)}, a difference of ${formatSignedNumber(timeDiff, 2, ' ms')}.`,
    isFiniteNumber(existing.metrics.prioritizationEfficiency) && isFiniteNumber(enhanced.metrics.prioritizationEfficiency)
      ? `Urgency-weighted compatible service changed from ${formatPercent(existing.metrics.prioritizationEfficiency)} to ${formatPercent(enhanced.metrics.prioritizationEfficiency)}, a change of ${formatPercentagePoint(prioritizationDiff)}.`
      : 'Prioritization efficiency requires urgency values in the current assignments.',
    `Standard optimizes distance only. Enhanced uses the weighted distance, urgency, and compatibility objective; in this run it ${distanceDirection}, ${urgencyDirection}, and ${compatibilityDirection}.`
  ];
  return `<div class="interpretation-list">${statements.map(statement => `<p>${escapeHtml(statement)}</p>`).join('')}<p>Native assignment costs are reported in their own units: Standard uses distance-only kilometers; Enhanced uses composite weighted cost.</p></div>`;
}

function renderComparisonReport(existing, enhanced, rows, activeResources) {
  const householdRows = buildHouseholdComparisonRows(rows, existing, enhanced);
  const changedCount = householdRows.filter(row => row.changed).length;
  const dynamic = simulateDynamicReassignment(enhanced, rows, activeResources);
  const highUrgencyExistingRate = getHighUrgencyServiceRate(existing);
  const highUrgencyEnhancedRate = getHighUrgencyServiceRate(enhanced);
  const existingComparableCost = computeComparableWeightedCost(existing, rows, activeResources);
  const enhancedComparableCost = computeComparableWeightedCost(enhanced, rows, activeResources);
  const sop1Outcome = formatSop1Outcome(existing, enhanced, existingComparableCost, enhancedComparableCost);
  const sop1Rows = [
    { metric: 'Criteria Used', standard: formatCriterionList(['Distance']), enhanced: formatCriterionList(['Distance', 'Urgency', 'Compatibility']), difference: 'Model design' },
    { metric: 'Total Assignment Cost', standard: formatNativeCost(existing), enhanced: formatNativeCost(enhanced), difference: 'Not directly comparable', note: 'Native cost: Existing is total distance. Enhanced is composite weighted cost.' },
    { metric: 'Mean Allocation Accuracy', standard: formatPercent(existing.metrics.allocationAccuracy), enhanced: formatPercent(enhanced.metrics.allocationAccuracy), difference: formatPercentagePoint(enhanced.metrics.allocationAccuracy - existing.metrics.allocationAccuracy), note: 'Mean compatibility score of the final assignments.' },
    { metric: 'Compatible Assignments', standard: `${existing.metrics.compatibleAssignments} / ${existing.metrics.assignmentCount}`, enhanced: `${enhanced.metrics.compatibleAssignments} / ${enhanced.metrics.assignmentCount}`, difference: formatSignedInteger(enhanced.metrics.compatibleAssignments - existing.metrics.compatibleAssignments), note: 'Post-run evaluation for Existing; optimization criterion for Enhanced.' },
    { metric: 'High-Urgency Households Served', standard: formatHighUrgencyServed(existing), enhanced: formatHighUrgencyServed(enhanced), difference: isFiniteNumber(highUrgencyExistingRate) && isFiniteNumber(highUrgencyEnhancedRate) ? formatPercentagePoint(highUrgencyEnhancedRate - highUrgencyExistingRate) : 'Not measurable' },
    { metric: 'Prioritization Efficiency', standard: formatPercent(existing.metrics.prioritizationEfficiency), enhanced: formatPercent(enhanced.metrics.prioritizationEfficiency), difference: formatPrioritizationChange(existing.metrics.prioritizationEfficiency, enhanced.metrics.prioritizationEfficiency), note: 'Urgency-weighted compatibility score of the actual assignment output.' },
    { metric: 'Total Physical Distance', standard: formatDistanceKm(existing.metrics.totalDistance), enhanced: formatDistanceKm(enhanced.metrics.totalDistance), difference: formatSignedNumber(enhanced.metrics.totalDistance - existing.metrics.totalDistance, 2, ' km') },
    { metric: 'Post-run Composite Cost Evaluation', standard: round(existingComparableCost, 3), enhanced: round(enhancedComparableCost, 3), difference: formatSignedNumber(enhancedComparableCost - existingComparableCost, 3), note: 'Both final solutions are evaluated using the enhanced formula for comparison only.' },
    { metric: 'Assignments Changed', standard: 'Distance-only output', enhanced: 'Weighted output', difference: formatAssignmentComparisonResult(changedCount, rows.length), note: 'Direct comparison of final household-resource pairings.' }
  ];
  const changedByDynamic = dynamic.events.some(event => event.changed);
  const dynamicRows = dynamic.events.length ? `<tr><td>5 controlled urgency-change events for selected ${rows.length}x${activeResources.length} matrix</td><td>${dynamic.affectedCount}</td><td>${dynamic.status === 'Triggered' ? 'Yes' : 'No'}</td><td>${dynamic.status === 'Triggered' ? 'Full distance-only recomputation for each qualifying event' : 'No recalculation'}</td><td>${dynamic.status === 'Triggered' ? 'Affected assignment subset only for each qualifying event' : 'No selective update'}</td><td>${formatDurationMs(dynamic.standardDurationMs)}</td><td>${formatDurationMs(dynamic.durationMs)}</td><td>${changedByDynamic ? 'Yes' : 'No'}</td></tr>` : '';
  const dynamicDetailRows = dynamic.events.map(event => `<tr><td>${event.eventNumber}</td><td>${escapeHtml(getHouseholdId(event.household) || event.household.household_id || 'H*')}</td><td>${round(event.previousUrgency, 1)}</td><td>${round(event.newUrgency, 1)}</td><td>${round(event.delta, 1)}</td><td>${formatDurationMs(event.standardMs)}</td><td>${formatDurationMs(event.enhancedMs)}</td><td>${escapeHtml(assignmentLabel(event.previousAssignment))}</td><td>${escapeHtml(assignmentLabel(event.updatedAssignment))}</td><td>${event.changed ? 'Output changed' : 'Same output'}</td></tr>`).join('');
  const sop2Table = dynamicRows
    ? `<div class="table-wrap compare-table-wrap"><table class="compare-table"><caption>SOP 2 - Dynamic Re-Assignment Evaluation</caption><thead><tr><th>Event</th><th>Affected Households</th><th>Triggered by Delta &gt;= 2?</th><th>Existing Recalculation Scope</th><th>Enhanced Recalculation Scope</th><th>Existing Time</th><th>Enhanced Time</th><th>Output Changed?</th></tr></thead><tbody>${dynamicRows}</tbody></table></div><p class="compare-note">SOP 2 uses the same deterministic five-event urgency-change test used in SOP 3 for the currently selected matrix size. Timing values are measured live and can vary slightly; changing the matrix size changes which households are included.</p><details class="technical-details"><summary>View Dynamic Event Details</summary><div class="table-wrap compare-table-wrap"><table class="compare-table"><thead><tr><th>Event #</th><th>Household ID</th><th>Previous Urgency</th><th>New Urgency</th><th>Delta</th><th>Existing Time</th><th>Enhanced Time</th><th>Previous Assignment</th><th>Updated Assignment</th><th>Output Result</th></tr></thead><tbody>${dynamicDetailRows}</tbody></table></div></details>`
    : '<div class="notice-panel">SOP 2 is not measurable for this run because the selected dataset has no valid urgency values to update.</div>';
  const assignmentDetails = `<details class="technical-details"><summary>View Household-Level Assignment Comparison</summary>${renderHouseholdComparisonTable(householdRows)}</details>`;
  const technicalDetails = `<details class="technical-details"><summary>View Technical Details</summary><p class="compare-note">Existing distance-only matrix summary: ${escapeHtml(formatMatrixSummary(existing, 'km'))}. Enhanced matrix summary: ${escapeHtml(formatMatrixSummary(enhanced))}. Enhanced weights: distance ${state.weights.distance.toFixed(3)}, urgency ${state.weights.urgency.toFixed(3)}, compatibility ${state.weights.compatibility.toFixed(3)}.</p></details>`;
  const sop3Table = renderBenchmarkTable(rows);
  state.currentResources = activeResources;
  $('#compare-content').innerHTML = `<section class="panel compare-section"><div class="panel-head"><div><p class="eyebrow">SOP 1</p><h3>Multi-Criteria Allocation Comparison</h3></div></div>${renderComparisonDataNotes(existing, enhanced, householdRows, rows, activeResources)}<div class="comparison-note-box"><strong>SOP 1 result</strong><p>${escapeHtml(sop1Outcome)}</p><p>Enhanced is expected to improve allocation quality when distance conflicts with urgency or resource compatibility. It is not expected to beat the distance-only baseline on physical distance, because distance is the baseline's only objective.</p></div>${renderComparisonTable(sop1Rows, 'SOP 1 - Multi-Criteria Allocation Comparison')}<p class="compare-note">Existing uses distance only. Enhanced uses the proposed weighted cost matrix: distance + urgency + compatibility. All values are computed from the actual assignment outputs.</p></section><section class="panel compare-section"><div class="panel-head"><div><p class="eyebrow">SOP 2</p><h3>Dynamic Re-Assignment Evaluation</h3></div></div>${sop2Table}</section><section class="panel compare-section"><div class="panel-head"><div><p class="eyebrow">SOP 3</p><h3>Computational Performance</h3></div></div>${sop3Table}<p class="compare-note">SOP 3 separates initial assignment time from dynamic re-assignment time. The enhanced model may cost more at first because it builds a composite matrix, while its computational advantage is evaluated during urgency-change events where Standard performs full recomputation and Enhanced selectively re-optimizes only affected assignments. Dynamic improvement is shown only when Enhanced actually saves measured re-assignment time; otherwise the table reports no improvement or slower execution.</p></section>${assignmentDetails}${technicalDetails}`;
  bindComparisonReport(householdRows);
}

compare = function () {
  const selectedSize = getSelectedComparisonSize();
  state.comparisonSize = selectedSize;
  const blockers = [...getRunBlockers('existing', selectedSize), ...getRunBlockers('enhanced', selectedSize)];
  if (blockers.length) {
    toast(blockers[0]);
      go('compare');
    return null;
  }
  const { households: verifiedHouseholds, resources: activeResources } = getControlledComparisonInputs(selectedSize);
  const existing = executeShared('existing', verifiedHouseholds, activeResources);
  const enhanced = executeShared('enhanced', verifiedHouseholds, activeResources);
  if (!existing || !enhanced) return null;
  $('#compare-empty').classList.add('hidden');
  $('#compare-content').classList.remove('hidden');
  renderComparisonReport(existing, enhanced, verifiedHouseholds, activeResources);
  return { existing, enhanced };
};

function bind() { document.querySelectorAll('[data-page]').forEach(item => item.addEventListener('click', event => { event.preventDefault(); go(item.dataset.page); })); document.querySelectorAll('[data-page-target]').forEach(item => item.addEventListener('click', () => go(item.dataset.pageTarget))); document.querySelectorAll('[data-run]').forEach(item => item.addEventListener('click', () => { try { if (item.dataset.run === 'both') { if (compare()) go('compare'); } else { if (execute(item.dataset.run)) go(item.dataset.run); } } catch (error) { reportRunError(error); } })); $('#load-demo-data')?.addEventListener('click', () => loadVariedDemoData().catch(error => reportRunError(error, 'Demo load failed'))); $('#file-input')?.addEventListener('change', event => loadFile(event.target.files[0])); $('#resource-file-input')?.addEventListener('change', event => loadResourceFile(event.target.files[0])); $('#comparison-size')?.addEventListener('change', event => { state.comparisonSize = Number(event.target.value); renderDataset(); }); $('#table-search')?.addEventListener('input', renderTable); $('#clear-history')?.addEventListener('click', () => { state.history = []; localStorage.removeItem('allocation-history'); renderHistory(); toast('History cleared'); }); }
function initializeApp() {
  bind();
  if ($('#comparison-size')) $('#comparison-size').value = String(state.comparisonSize);
  renderDataset();
  renderHistory();
  ['distance', 'urgency', 'compat'].forEach(name => {
    const key = name === 'compat' ? 'compatibility' : name;
    $(`#enh-${name}`).max = '1';
    $(`#enh-${name}`).step = '0.001';
    $(`#enh-${name}`).value = state.weights[key];
    $(`#enh-${name}`).disabled = true;
    $(`#enh-${name}`).title = 'Fixed AHP-derived research weight';
    $(`#enh-${name}-label`).textContent = state.weights[key].toFixed(3);
  });
  $('.threshold span').textContent = 'Fixed re-assignment threshold';
  $('.threshold strong').textContent = 'Delta >= 2';
  $('.threshold strong').textContent = 'Δ ≥ 2';
  $('.threshold strong').textContent = 'Delta >= 2';
  if ($('#settings-hub-address')) $('#settings-hub-address').textContent = RELIEF_HUB.address;
  if ($('#settings-geocoding-context')) $('#settings-geocoding-context').textContent = RESEARCH_CONFIG.geocodingContext;
  go(location.hash.slice(1) || 'existing');
}

function renderReliefMap() {
  if (typeof L === 'undefined') return;
  let panel = $('#relief-map-panel');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'relief-map-panel';
    panel.className = 'panel map-panel';
    panel.innerHTML = `<div class="panel-head"><div><p class="eyebrow">Research area</p><h3>${RELIEF_HUB.name} household locations</h3></div><div class="map-legend" aria-label="Household urgency legend">${MAP_LEGEND}</div></div><div id="relief-map" class="relief-map"></div><div class="map-foot"><span>Resolved household locations and the configured research boundary are shown.</span><strong id="map-count">0 households mapped</strong></div>`;
    const mapHost = $('#view-compare');
    if (!mapHost) return;
    mapHost.appendChild(panel);
  }
  if (!window.reliefMap) {
    window.reliefMap = createReliefMap('relief-map');
  }
  if (window.reliefLayers) window.reliefLayers.forEach(layer => layer.remove());
  window.reliefLayers = [];
  const hub = RELIEF_HUB.coordinates;
  window.reliefLayers.push(addHubMarker(window.reliefMap));
  const boundaryLayer = addResearchBoundaryLayer(window.reliefMap);
  if (boundaryLayer) window.reliefLayers.push(boundaryLayer);
  const mapped = [];
  state.dataset.forEach(row => {
    const lat = Number(row.latitude);
    const lon = Number(row.longitude);
    if (!hasValidCoordinates(row)) return;
    const point = [lat, lon];
    const { urgency, color, label } = getUrgencyMeta(row.urgency);
    const markerStyle = getDatasetMarkerStyle(row, color);
    window.reliefLayers.push(L.circleMarker(point, markerStyle).addTo(window.reliefMap).bindPopup(`<strong>${escapeHtml(row.household_id || 'Household')}</strong><br>H*: ${escapeHtml(row.verification_status || 'Pending System Validation')}<br>Urgency: ${urgency}/10<br>Geocoding: ${escapeHtml(row.geocoding_status || 'Resolved')}<br>Location: ${escapeHtml(row.location_status || 'Pending Location Check')}`));
    mapped.push(point);
  });
  const eligible = state.validation ? getVerifiedHouseholdSet().length : 0;
  $('#map-count').textContent = `${state.dataset.length} households · ${mapped.length} mapped · ${eligible} eligible`;
  safeFitMapBounds(window.reliefMap, [hub, ...mapped]);
}

const renderDatasetWithMap = renderDataset;
renderDataset = function () { renderDatasetWithMap(); };

function geoDistanceKm(from, to) {
  const radians = value => value * Math.PI / 180;
  const earthRadius = 6371;
  const latDelta = radians(to[0] - from[0]);
  const lonDelta = radians(to[1] - from[1]);
  const a = Math.sin(latDelta / 2) ** 2 + Math.cos(radians(from[0])) * Math.cos(radians(to[0])) * Math.sin(lonDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const HOUSEHOLD_FIELD_ALIASES = {
  id: ['household', 'household_id', 'household id', 'household_number', 'household_no', 'house_no', 'hh_id', 'hh id', 'id'],
  head: ['household_head', 'household_head_name', 'head_name', 'representative_name', 'representative', 'respondent_name', 'name', 'contact_person'],
  directAddress: ['address', 'household_address', 'household address', 'location', 'street_address', 'street address', 'residence'],
  addressParts: ['house_number', 'house_no', 'block_lot', 'street', 'purok', 'sitio', 'zone', 'barangay'],
  latitude: ['latitude', 'lat', 'geocoded_latitude', 'geocoded latitude', 'derived_latitude', 'derived latitude'],
  longitude: ['longitude', 'lng', 'lon', 'long', 'geocoded_longitude', 'geocoded longitude', 'derived_longitude', 'derived longitude'],
  members: ['household_members', 'members', 'member_count', 'family_members', 'family_size', 'household_size', 'number_of_members', 'no_of_members', 'num_members'],
  urgency: ['urgency', 'urgency_score', 'urgency score', 'priority_score', 'priority score'],
  verification: ['beneficiary_verification', 'beneficiary verification', 'beneficiary_verification_status', 'beneficiary verification status', 'verification_status', 'verification', 'verified', 'validated', 'validation_status', 'status'],
  seniorCount: ['senior_count', 'senior count', 'senior_citizen_count', 'senior citizen count', 'elderly_count'],
  pwdCount: ['pwd_count', 'pwd count', 'persons_with_disability', 'persons with disability', 'disability_count'],
  vulnerabilityFactors: ['vulnerability_factors', 'vulnerability factors', 'vulnerabilities', 'vulnerability', 'vulnerable_factors'],
  compatibleResource: ['compatible_resource', 'preferred_resource', 'needed_resource', 'resource_need', 'resource_requirement', 'relief_need', 'primary_need', 'required_resource'],
  coordinateSource: ['coordinate_source', 'coordinate source', 'location_source', 'location source'],
  geocodePrecision: ['geocode_precision', 'geocode precision', 'coordinate_precision', 'coordinate precision'],
  locationVerification: ['location_verification', 'location verification', 'location_verification_status', 'location verification status'],
  assignmentStatus: ['assignment_status', 'allocation_status', 'delivery_status', 'status']
};
const HOUSEHOLD_LABELS = {
  householdid: 'Household ID',
  householdnumber: 'Household No.',
  householdno: 'Household No.',
  hhid: 'Household ID',
  householdhead: 'Household Head',
  householdheadname: 'Household Head',
  headname: 'Household Head',
  representativename: 'Representative',
  householdmembers: 'Members',
  membercount: 'Members',
  familysize: 'Members',
  householdsize: 'Members',
  compatible_resource: 'Resource Need',
  compatibleresource: 'Resource Need',
  sourceverificationstatus: 'Beneficiary Verification',
  beneficiaryverification: 'Beneficiary Verification',
  beneficiaryverificationstatus: 'Beneficiary Verification',
  verificationstatus: 'Beneficiary Verification',
  verificationreason: 'Beneficiary Verification Reason',
  locationverificationstatus: 'Location Verification',
  locationsource: 'Coordinate Source',
  coordinateprecision: 'Coordinate Precision',
  eligibilitystatus: 'Eligibility',
  locationstatus: 'Research Area',
  seniorcount: 'Senior Count',
  pwdcount: 'PWD Count',
  vulnerabilityfactors: 'Vulnerability Factors',
  pwd: 'PWD'
};
const VULNERABILITY_PATTERN = /senior|elderly|pwd|disab|pregnan|infant|child|children|solo.?parent|lactating|medical|vulnerab|special.?need|chronic/i;
const EXTRA_INFO_PATTERN = /contact|phone|mobile|evacuation|shelter|damage|risk|hazard|flood|note|remark|income|livelihood|barangay|zone|purok|sitio/i;
const NEGATIVE_FIELD_VALUES = /^(no|none|n\/a|na|false|0|not applicable)$/i;
const AFFIRMATIVE_FIELD_VALUES = /^(yes|true|1)$/i;
const NORMALIZED_TABLE_KEYS = ['household_id', 'address', 'urgency', 'senior_count', 'pwd_count', 'vulnerability_factors', 'compatible_resource', 'beneficiary_verification_status', 'verification_status', 'verification_reason', 'location_verification_status', 'coordinate_source', 'coordinate_precision', 'geocoding_status', 'location_status', 'eligibility_status', 'latitude', 'longitude', 'validation_status'];
const MAPPING_FIELDS = [
  { key: 'householdId', label: 'Household ID', aliases: HOUSEHOLD_FIELD_ALIASES.id, required: true },
  { key: 'address', label: 'Address', aliases: HOUSEHOLD_FIELD_ALIASES.directAddress, required: false },
  { key: 'urgency', label: 'Urgency', aliases: HOUSEHOLD_FIELD_ALIASES.urgency, required: true },
  { key: 'verification', label: 'Beneficiary Verification', aliases: HOUSEHOLD_FIELD_ALIASES.verification, required: true },
  { key: 'seniorCount', label: 'Senior Count', aliases: HOUSEHOLD_FIELD_ALIASES.seniorCount, required: false },
  { key: 'pwdCount', label: 'PWD Count', aliases: HOUSEHOLD_FIELD_ALIASES.pwdCount, required: false },
  { key: 'vulnerabilityFactors', label: 'Vulnerability Factors', aliases: HOUSEHOLD_FIELD_ALIASES.vulnerabilityFactors, required: false },
  { key: 'compatibleResource', label: 'Resource Need (optional)', aliases: HOUSEHOLD_FIELD_ALIASES.compatibleResource, required: false },
  { key: 'coordinateSource', label: 'Coordinate Source', aliases: HOUSEHOLD_FIELD_ALIASES.coordinateSource, required: false },
  { key: 'geocodePrecision', label: 'Geocode Precision', aliases: HOUSEHOLD_FIELD_ALIASES.geocodePrecision, required: false },
  { key: 'locationVerification', label: 'Location Verification', aliases: HOUSEHOLD_FIELD_ALIASES.locationVerification, required: false },
  { key: 'latitude', label: 'Latitude', aliases: HOUSEHOLD_FIELD_ALIASES.latitude, required: false },
  { key: 'longitude', label: 'Longitude', aliases: HOUSEHOLD_FIELD_ALIASES.longitude, required: false }
];
const RESOURCE_FIELD_ALIASES = {
  id: ['resource_id', 'resource id', 'relief_id', 'relief id', 'resource', 'resource_name', 'resource name', 'id'],
  type: ['resource_type', 'resource type', 'relief_type', 'relief type', 'type', 'category', 'item_type', 'item type'],
  latitude: ['latitude', 'lat', 'resource_latitude', 'resource latitude', 'location_latitude', 'location latitude'],
  longitude: ['longitude', 'lng', 'lon', 'long', 'resource_longitude', 'resource longitude', 'location_longitude', 'location longitude'],
  location: ['hub/source location', 'hub source location', 'hub / coordinate reference', 'hub coordinate reference', 'coordinate_reference', 'coordinate reference', 'source_location', 'source location', 'hub_location', 'hub location', 'location', 'address', 'resource_location', 'resource location', 'resource_address', 'resource address', 'pickup_location', 'pickup location'],
  quantity: ['quantity', 'qty', 'stock', 'count', 'inventory'],
  availability: ['availability', 'available', 'resource_availability', 'resource availability', 'status']
};
const RESOURCE_MAPPING_FIELDS = [
  { key: 'id', label: 'Resource ID', aliases: RESOURCE_FIELD_ALIASES.id, required: true },
  { key: 'type', label: 'Resource Type', aliases: RESOURCE_FIELD_ALIASES.type, required: true },
  { key: 'latitude', label: 'Latitude', aliases: RESOURCE_FIELD_ALIASES.latitude, required: false },
  { key: 'longitude', label: 'Longitude', aliases: RESOURCE_FIELD_ALIASES.longitude, required: false },
  { key: 'quantity', label: 'Quantity', aliases: RESOURCE_FIELD_ALIASES.quantity, required: false },
  { key: 'location', label: 'Hub/Source Location', aliases: RESOURCE_FIELD_ALIASES.location, required: false },
  { key: 'availability', label: 'Availability', aliases: RESOURCE_FIELD_ALIASES.availability, required: true }
];

function getHeaderCandidates(headers, aliases) {
  const aliasSet = new Set(aliases.map(normalizeFieldName));
  return headers.filter(header => aliasSet.has(normalizeFieldName(header)));
}

function inferResourceMapping(headers) {
  return Object.fromEntries(RESOURCE_MAPPING_FIELDS.map(field => {
    const candidates = getHeaderCandidates(headers, field.aliases);
    return [field.key, candidates.length === 1 ? candidates[0] : ''];
  }));
}

function getResourceMappingIssues(mapping = state.resourceMapping, headers = state.resourceHeaders) {
  if (!headers.length) return [];
  const issues = [];
  RESOURCE_MAPPING_FIELDS.forEach(field => {
    const candidates = getHeaderCandidates(headers, field.aliases);
    if (candidates.length > 1 && !mapping[field.key]) issues.push({ field: field.key, level: 'error', message: `${field.label} has multiple possible columns. Select the correct one.` });
    if (field.required && !mapping[field.key]) issues.push({ field: field.key, level: 'error', message: `Missing ${field.label} column` });
  });
  if ((mapping.latitude && !mapping.longitude) || (!mapping.latitude && mapping.longitude)) issues.push({ field: 'latitude', level: 'error', message: 'Resource latitude and longitude must be mapped together.' });
  if (!mapping.location && !(mapping.latitude && mapping.longitude)) issues.push({ field: 'location', level: 'error', message: 'Missing resource coordinates' });
  return issues;
}

function getMappedResourceValue(row, key) {
  const column = state.resourceMapping[key];
  return column ? String(row?.[column] ?? '').trim() : '';
}

function parseAvailability(value) {
  if (!hasDisplayValue(value)) return null;
  const text = String(value).trim();
  const numeric = Number(text);
  if (Number.isFinite(numeric)) return numeric > 0;
  if (/^(available|yes|true|in stock|ready|active)$/i.test(text)) return true;
  if (/^(unavailable|no|false|out of stock|inactive|0)$/i.test(text)) return false;
  return null;
}

function parseQuantity(value) {
  if (!hasDisplayValue(value)) return 1;
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : null;
}

function parseCompatibilityValue(value) {
  if (!hasDisplayValue(value)) return null;
  const text = String(value).trim();
  const numeric = Number(text);
  if (Number.isFinite(numeric)) return numeric > 0;
  if (/^(yes|true|compatible|match|matched|suitable|available|eligible)$/i.test(text)) return true;
  if (/^(no|false|incompatible|mismatch|not compatible|not suitable|0)$/i.test(text)) return false;
  return null;
}

function getHouseholdResourceCompatibility(row, type) {
  const aliases = RESOURCE_TYPE_COMPATIBILITY_COLUMNS[normalizeFieldName(type)] || [`${type} Compatibility`];
  const aliasSet = new Set(aliases.map(normalizeFieldName));
  const match = Object.entries(row || {}).find(([key]) => aliasSet.has(normalizeFieldName(key)));
  return match ? parseCompatibilityValue(match[1]) : null;
}

function parseCompatibilityScore(value) {
  if (!hasDisplayValue(value)) return null;
  const text = String(value).trim();
  const numeric = Number(text);
  if (Number.isFinite(numeric)) {
    if (numeric <= 0) return 0;
    return Math.max(0, Math.min(1, numeric / 5));
  }
  const booleanValue = parseCompatibilityValue(value);
  return booleanValue === null ? null : booleanValue ? 1 : 0;
}

function getHouseholdResourceCompatibilityScore(row, type) {
  const aliases = RESOURCE_TYPE_COMPATIBILITY_COLUMNS[normalizeFieldName(type)] || [`${type} Compatibility`];
  const aliasSet = new Set(aliases.map(normalizeFieldName));
  const match = Object.entries(row || {}).find(([key]) => aliasSet.has(normalizeFieldName(key)));
  if (match) return parseCompatibilityScore(match[1]);
  return getHouseholdCompatibilityProfile(row).has(type) ? 1 : 0;
}

function isHubSourceLocation(value) {
  const text = String(value || '').trim().toLowerCase();
  return /^(hub|distribution hub|barangay hub|barangay distribution hub|relief hub|source hub)$/i.test(text)
    || (/barangay\s*160/i.test(text) && /(hub|hall|source|distribution)/i.test(text))
    || text === RESEARCH_CONFIG.hub.name.toLowerCase()
    || text === RESEARCH_CONFIG.hub.address.toLowerCase();
}

function inferColumnMapping(headers) {
  return Object.fromEntries(MAPPING_FIELDS.map(field => {
    const candidates = getHeaderCandidates(headers, field.aliases);
    return [field.key, candidates.length === 1 ? candidates[0] : ''];
  }));
}

function hasAddressPartColumns(headers = state.rawHeaders) {
  return HOUSEHOLD_FIELD_ALIASES.addressParts.some(alias => headers.some(header => normalizeFieldName(header) === normalizeFieldName(alias)));
}

function getMappingIssues(mapping = state.columnMapping, headers = state.rawHeaders) {
  if (!headers.length) return [];
  const issues = [];
  MAPPING_FIELDS.forEach(field => {
    const candidates = getHeaderCandidates(headers, field.aliases);
    if (candidates.length > 1 && !mapping[field.key] && field.key !== 'verification') issues.push({ field: field.key, level: 'error', message: `${field.label} has multiple possible columns. Select the correct one.` });
    if (field.required && !mapping[field.key]) issues.push({ field: field.key, level: 'error', message: `${field.label} column is required.` });
  });
  const hasMappedCoordinates = mapping.latitude && mapping.longitude;
  if (!mapping.address && !hasMappedCoordinates && !hasAddressPartColumns(headers)) issues.push({ field: 'address', level: 'error', message: 'Address or resolved latitude/longitude columns are required.' });
  if ((mapping.latitude && !mapping.longitude) || (!mapping.latitude && mapping.longitude)) issues.push({ field: 'latitude', level: 'error', message: 'Latitude and longitude must be mapped together.' });
  return issues;
}

function getMappedValue(row, key) {
  const column = state.columnMapping[key];
  return column ? String(row?.[column] ?? '').trim() : '';
}

function getAddressFromMappedColumns(raw) {
  const direct = getMappedValue(raw, 'address');
  if (direct) return direct;
  return HOUSEHOLD_FIELD_ALIASES.addressParts
    .map(alias => {
      const header = state.rawHeaders.find(name => normalizeFieldName(name) === normalizeFieldName(alias));
      return header ? String(raw[header] || '').trim() : '';
    })
    .filter(Boolean)
    .join(', ');
}

function normalizeVerificationValue(value) {
  const text = String(value || '').trim();
  const normalized = text.toLowerCase();
  if (AFFIRMATIVE_FIELD_VALUES.test(text)) return 'Verified';
  if (NEGATIVE_FIELD_VALUES.test(text)) return 'Pending';
  if (['verified', 'valid', 'validated', 'approved'].includes(normalized)) return 'Verified';
  if (['pending', 'unverified', 'for verification', 'for review'].includes(normalized)) return 'Pending';
  if (['flagged', 'duplicate', 'for validation'].includes(normalized)) return 'Flagged';
  if (['rejected', 'invalid', 'denied'].includes(normalized)) return 'Rejected';
  return text;
}

function parseUrgencyValue(value) {
  if (!hasDisplayValue(value)) return null;
  const urgency = Number(value);
  return Number.isFinite(urgency) && urgency >= 0 && urgency <= 10 ? urgency : null;
}

function normalizeResourceRequirement(value) {
  const text = String(value || '').trim();
  const match = resourceTypes.find(type => type.toLowerCase() === text.toLowerCase());
  return match || text;
}

function isKnownResourceRequirement(value) {
  return resourceTypes.some(type => type.toLowerCase() === String(value || '').trim().toLowerCase());
}

function getDetectedVulnerabilityColumns(headers = state.rawHeaders) {
  return headers.filter(header => {
    const normalized = normalizeFieldName(header);
    const standardAliases = [
      ...HOUSEHOLD_FIELD_ALIASES.seniorCount,
      ...HOUSEHOLD_FIELD_ALIASES.pwdCount,
      ...HOUSEHOLD_FIELD_ALIASES.vulnerabilityFactors
    ].map(normalizeFieldName);
    return standardAliases.includes(normalized) || VULNERABILITY_PATTERN.test(header);
  });
}

function parseCoordinate(value) {
  if (!hasDisplayValue(value)) return null;
  const text = String(value).trim();
  if (/^(nan|null|undefined)$/i.test(text)) return null;
  const coordinate = Number(text);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function hasValidCoordinatePair(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat === 0 && lon === 0) return false;
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function normalizeAddressQuery(address) {
  const clean = String(address || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const lower = clean.toLowerCase();
  const additions = RESEARCH_CONFIG.geocodingContext
    .split(',')
    .map(item => item.trim())
    .filter(item => item && !lower.includes(item.toLowerCase()));
  return [clean, ...additions].join(', ');
}

function standardizeAddressSpelling(address) {
  return String(address || '')
    .replace(/\bbrgy\.?\b/ig, 'Barangay')
    .replace(/\bbgy\.?\b/ig, 'Barangay')
    .replace(/\bsta\.?\b/ig, 'Santa')
    .replace(/\bst\.(?=\s|,|$)/ig, 'Street')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeInteriorAddressParts(address) {
  return String(address || '')
    .replace(/\b(?:[a-z]\s+)?int\.?\s*(?:[a-z0-9-]+)?\b/ig, ' ')
    .replace(/\binterior\s*(?:[a-z0-9-]+)?\b/ig, ' ')
    .replace(/\b(?:unit|room|rm\.?|apt\.?|apartment|floor|flr\.?)\s*[a-z0-9-]*\b/ig, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/,\s*,+/g, ',')
    .replace(/^\s*,|,\s*$/g, '')
    .trim();
}

function getGeocodeCandidates(address) {
  const original = String(address || '').trim();
  const standardized = standardizeAddressSpelling(original);
  const parent = removeInteriorAddressParts(standardized);
  const candidates = [
    { query: normalizeAddressQuery(original), precision: null },
    { query: normalizeAddressQuery(standardized), precision: null },
    { query: normalizeAddressQuery(parent), precision: 'Parent Address' }
  ];
  const seen = new Set();
  return candidates.filter(candidate => {
    if (!candidate.query || seen.has(candidate.query)) return false;
    seen.add(candidate.query);
    return true;
  });
}

function writeGeocodeCache() {
  try {
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(state.geocodeCache));
  } catch (error) {
    // Cache writes can fail in private browsing or storage-constrained sessions.
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let lastGeocodeRequestAt = 0;
async function waitForGeocoderSlot() {
  const elapsed = Date.now() - lastGeocodeRequestAt;
  const waitMs = Math.max(0, RESEARCH_CONFIG.geocoding.requestDelayMs - elapsed);
  if (waitMs) await delay(waitMs);
  lastGeocodeRequestAt = Date.now();
}

function classifyGeocodeResult(result) {
  const resultType = String(result?.type || '').toLowerCase();
  const resultClass = String(result?.class || '').toLowerCase();
  if (['house', 'building', 'residential'].includes(resultType) || ['building'].includes(resultClass)) return 'Exact';
  return 'Parent Address Match';
}

async function geocodeQuery(query, precisionOverride = null) {
  if (state.geocodeCache[query]) return { ...state.geocodeCache[query], cached: true };
  if (typeof fetch !== 'function') return { status: 'Unresolved', reason: 'Geocoding service unavailable' };
  await waitForGeocoderSlot();
  try {
    const limits = getResearchAreaLimits();
    const params = new URLSearchParams({ format: 'jsonv2', q: query, limit: '1', addressdetails: '1' });
    if (limits) {
      // Nominatim viewbox order is left,top,right,bottom (lon,lat,lon,lat).
      params.set('viewbox', `${limits.minLon},${limits.maxLat},${limits.maxLon},${limits.minLat}`);
    }
    const response = await fetch(`${RESEARCH_CONFIG.geocoding.endpoint}?${params.toString()}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('geocoder response failed');
    const results = await response.json();
    const match = Array.isArray(results) ? results[0] : null;
    const lat = parseCoordinate(match?.lat);
    const lon = parseCoordinate(match?.lon);
    const resolved = hasValidCoordinatePair(lat, lon)
      ? { status: precisionOverride || classifyGeocodeResult(match), latitude: lat, longitude: lon, displayName: match.display_name || '', provider: RESEARCH_CONFIG.geocoding.provider, query }
      : { status: 'Unresolved', reason: 'Address could not be geocoded' };
    state.geocodeCache[query] = resolved;
    writeGeocodeCache();
    return resolved;
  } catch (error) {
    return { status: 'Unresolved', reason: 'Geocoding service unavailable' };
  }
}

async function geocodeAddress(address) {
  const candidates = getGeocodeCandidates(address);
  if (!candidates.length) return { status: 'Unresolved', reason: 'Missing address' };
  let bestMatch = null;
  for (const candidate of candidates) {
    const result = await geocodeQuery(candidate.query, candidate.precision);
    if (!hasValidCoordinatePair(result.latitude, result.longitude)) continue;
    if (result.status === 'Exact' || result.status === 'Parent Address') return result;
    bestMatch = bestMatch || result;
  }
  return bestMatch || { status: 'Unresolved', reason: 'Address could not be geocoded' };
}

async function resolveHubLocation() {
  if (Array.isArray(RELIEF_HUB.coordinates) && RELIEF_HUB.coordinates.every(Number.isFinite)) return true;
  const result = await geocodeAddress(RELIEF_HUB.address);
  if (Number.isFinite(result.latitude) && Number.isFinite(result.longitude)) {
    RELIEF_HUB.coordinates = [result.latitude, result.longitude];
    return true;
  }
  return false;
}

function normalizeResourceRow(raw, index) {
  const resourceId = getMappedResourceValue(raw, 'id');
  const resourceTypeValue = normalizeResourceRequirement(getMappedResourceValue(raw, 'type'));
  const location = getMappedResourceValue(raw, 'location');
  const latitudeRaw = getMappedResourceValue(raw, 'latitude');
  const longitudeRaw = getMappedResourceValue(raw, 'longitude');
  const latitude = parseCoordinate(latitudeRaw);
  const longitude = parseCoordinate(longitudeRaw);
  const hasProvidedCoordinates = hasValidCoordinatePair(latitude, longitude);
  const availabilityRaw = getMappedResourceValue(raw, 'availability');
  const available = parseAvailability(availabilityRaw);
  const quantityRaw = getMappedResourceValue(raw, 'quantity');
  const quantity = parseQuantity(quantityRaw);
  return {
    ...raw,
    resource_id: resourceId,
    resource_type: resourceTypeValue,
    location,
    quantity,
    source_quantity: quantityRaw,
    availability: availabilityRaw,
    available,
    source_latitude: latitudeRaw,
    source_longitude: longitudeRaw,
    latitude: hasProvidedCoordinates ? latitude : '',
    longitude: hasProvidedCoordinates ? longitude : '',
    resolved_latitude: hasProvidedCoordinates ? latitude : '',
    resolved_longitude: hasProvidedCoordinates ? longitude : '',
    coordinate_source: hasProvidedCoordinates ? 'Uploaded dataset' : '',
    coordinate_precision: hasProvidedCoordinates ? 'Provided' : '',
    geocoding_status: hasProvidedCoordinates ? 'Provided Coordinates' : 'Pending Geocoding',
    geocoding_provider: hasProvidedCoordinates ? 'Uploaded dataset' : '',
    geocoding_display_name: '',
    geocoding_query: normalizeAddressQuery(location),
    validation_status: 'Pending Validation',
    _sourceRow: index + 2,
    _resourceReasons: []
  };
}

function expandAvailableResourceUnits(resources) {
  return resources.flatMap(resource => {
    const quantity = parseQuantity(resource.quantity);
    if (!quantity || quantity <= 1) return [resource];
    return Array.from({ length: quantity }, (_, index) => ({
      ...resource,
      resource_id: `${resource.resource_id}-${String(index + 1).padStart(2, '0')}`,
      parent_resource_id: resource.resource_id,
      quantity: 1
    }));
  });
}

function addResourceReason(resource, reason) {
  if (reason && !resource._resourceReasons.includes(reason)) resource._resourceReasons.push(reason);
}

async function resolveResourceLocation(resource) {
  if (hasValidCoordinates(resource)) return { attempted: false, resolved: true, reason: 'Valid uploaded coordinates' };
  if (!hasDisplayValue(resource.location)) {
    resource.geocoding_status = 'Geocoding Failed';
    addResourceReason(resource, 'Missing resource coordinates or location');
    return { attempted: false, resolved: false, reason: 'Missing resource coordinates or location' };
  }
  if (isHubSourceLocation(resource.location) && hasValidCoordinatePair(RELIEF_HUB.coordinates?.[0], RELIEF_HUB.coordinates?.[1])) {
    resource.latitude = RELIEF_HUB.coordinates[0];
    resource.longitude = RELIEF_HUB.coordinates[1];
    resource.resolved_latitude = resource.latitude;
    resource.resolved_longitude = resource.longitude;
    resource.coordinate_source = 'Configured distribution hub';
    resource.coordinate_precision = 'Hub/Source Location';
    resource.geocoding_status = 'Provided Hub Coordinates';
    resource.geocoding_provider = 'System configuration';
    resource.geocoding_display_name = RELIEF_HUB.address;
    resource.geocoding_query = RELIEF_HUB.address;
    return { attempted: false, resolved: true, reason: 'Configured distribution hub coordinates' };
  }
  resource.geocoding_status = 'Needs Geocoding';
  const result = await geocodeAddress(resource.location);
  if (!hasValidCoordinatePair(result.latitude, result.longitude)) {
    resource.geocoding_status = 'Geocoding Failed';
    addResourceReason(resource, result.reason || 'Resource location could not be geocoded');
    return { attempted: true, resolved: false, reason: result.reason || 'Resource location could not be geocoded' };
  }
  resource.latitude = result.latitude;
  resource.longitude = result.longitude;
  resource.resolved_latitude = result.latitude;
  resource.resolved_longitude = result.longitude;
  resource.coordinate_source = result.provider || RESEARCH_CONFIG.geocoding.provider;
  resource.coordinate_precision = result.status || 'Approximate';
  resource.geocoding_status = 'Geocoded';
  resource.geocoding_provider = result.provider || RESEARCH_CONFIG.geocoding.provider;
  resource.geocoding_display_name = result.displayName || '';
  resource.geocoding_query = result.query || resource.geocoding_query;
  return { attempted: true, resolved: true, reason: resource.coordinate_precision };
}

async function validateAndPrepareResources() {
  if (!state.resourceRows.length || state.resourceProcessing) return;
  state.resourceMappingIssues = getResourceMappingIssues();
  if (state.resourceMappingIssues.some(issue => issue.level === 'error')) {
    state.resourceValidation = { totalRows: state.resourceRows.length, validResources: 0, availableResources: 0, unavailableResources: 0, invalidResources: state.resourceRows.length, issues: state.resourceMappingIssues.map(issue => issue.message) };
    renderDataset();
    toast('Review relief resource columns');
    return;
  }
  state.resourceProcessing = true;
  renderDataset();
  try {
    await resolveHubLocation();
    const normalized = state.resourceRows.map(normalizeResourceRow);
    const seenIds = new Map();
    normalized.forEach(resource => {
      if (!hasDisplayValue(resource.resource_id)) addResourceReason(resource, 'Missing resource ID');
      if (resource.resource_id) seenIds.set(resource.resource_id, (seenIds.get(resource.resource_id) || 0) + 1);
      if (!hasDisplayValue(resource.resource_type)) addResourceReason(resource, 'Missing resource type');
      if (hasDisplayValue(resource.resource_type) && !isKnownResourceRequirement(resource.resource_type)) addResourceReason(resource, 'Unknown resource type');
      if (resource.available === null) addResourceReason(resource, 'Missing or invalid availability');
      if (resource.quantity === null) addResourceReason(resource, 'Invalid resource quantity');
      const providedSomeCoordinates = hasDisplayValue(resource.source_latitude) || hasDisplayValue(resource.source_longitude);
      if (providedSomeCoordinates && !hasValidCoordinatePair(parseCoordinate(resource.source_latitude), parseCoordinate(resource.source_longitude))) addResourceReason(resource, 'Invalid resource coordinates');
    });
    const duplicateIds = new Set([...seenIds.entries()].filter(([, count]) => count > 1).map(([id]) => id));
    let geocodeAttempts = 0;
    let geocodeResolved = 0;
    for (const resource of normalized) {
      if (resource.resource_id && duplicateIds.has(resource.resource_id)) addResourceReason(resource, 'Duplicate resource ID');
      if (!hasValidCoordinates(resource)) {
        geocodeAttempts += 1;
        toast(`Resolving resource location ${geocodeAttempts}`);
      }
      const location = await resolveResourceLocation(resource);
      if (location?.attempted && location.resolved) geocodeResolved += 1;
      if (!hasValidCoordinates(resource)) addResourceReason(resource, 'Invalid or unresolved resource coordinates');
      resource.validation_status = resource._resourceReasons.length ? 'Invalid' : resource.available ? 'Available' : 'Unavailable';
    }
    state.reliefResources = expandAvailableResourceUnits(normalized.filter(resource => resource.available && !resource._resourceReasons.length && hasValidCoordinates(resource)));
    const resourceIssues = normalized.flatMap(resource => resource._resourceReasons.map(reason => `${resource.resource_id || `Row ${resource._sourceRow}`}: ${reason}`));
    if (normalized.length && !state.reliefResources.length) resourceIssues.unshift(`${normalized.length} resource rows found but 0 passed Availability filtering and coordinate validation`);
    if (normalized.some(resource => resource._resourceReasons.includes('Invalid resource coordinates'))) resourceIssues.unshift('Resource coordinates are invalid');
    state.resourceValidation = {
      totalRows: normalized.length,
      validResources: normalized.filter(resource => !resource._resourceReasons.length).length,
      availableResources: state.reliefResources.length,
      unavailableResources: normalized.filter(resource => resource.available === false && !resource._resourceReasons.length).length,
      invalidResources: normalized.filter(resource => resource._resourceReasons.length).length,
      geocodeAttempts,
      geocodeResolved,
      issues: resourceIssues
    };
    state.currentResources = [];
    state.results = {};
    state.latest = null;
  } catch (error) {
    state.resourceValidation = { totalRows: state.resourceRows.length, validResources: 0, availableResources: 0, unavailableResources: 0, invalidResources: state.resourceRows.length, issues: [error.message || 'Resource import failed'] };
    toast(error.message || 'Resource import failed');
  } finally {
    state.resourceProcessing = false;
    renderDataset();
  }
  if (state.reliefResources.length) toast(`${state.reliefResources.length} available relief resources ready`);
}

function normalizeHouseholdRow(raw, index) {
  const householdId = getMappedValue(raw, 'householdId');
  const address = getAddressFromMappedColumns(raw);
  const urgency = parseUrgencyValue(getMappedValue(raw, 'urgency'));
  const verificationRaw = getMappedValue(raw, 'verification');
  const sourceVerification = hasDisplayValue(verificationRaw) ? normalizeVerificationValue(verificationRaw) : '';
  const compatibleResource = normalizeResourceRequirement(getMappedValue(raw, 'compatibleResource'));
  const seniorCount = getMappedValue(raw, 'seniorCount');
  const pwdCount = getMappedValue(raw, 'pwdCount');
  const vulnerabilityFactors = getMappedValue(raw, 'vulnerabilityFactors');
  const latitudeRaw = getMappedValue(raw, 'latitude');
  const longitudeRaw = getMappedValue(raw, 'longitude');
  const latitude = parseCoordinate(latitudeRaw);
  const longitude = parseCoordinate(longitudeRaw);
  const hasProvidedCoordinates = hasValidCoordinatePair(latitude, longitude);
  const coordinateSource = getMappedValue(raw, 'coordinateSource');
  const geocodePrecision = getMappedValue(raw, 'geocodePrecision');
  const locationVerification = getMappedValue(raw, 'locationVerification');
  const geocodingQuery = normalizeAddressQuery(address);
  const row = {
    ...raw,
    household_id: householdId,
    household: householdId,
    address,
    urgency: urgency ?? '',
    compatible_resource: compatibleResource,
    senior_count: seniorCount,
    pwd_count: pwdCount,
    vulnerability_factors: vulnerabilityFactors,
    source_verification: verificationRaw,
    source_verification_status: sourceVerification,
    beneficiary_verification_status: sourceVerification,
    verification_status: 'Pending System Validation',
    verification_reason: '',
    source_latitude: latitudeRaw,
    source_longitude: longitudeRaw,
    latitude: hasProvidedCoordinates ? latitude : '',
    longitude: hasProvidedCoordinates ? longitude : '',
    resolved_latitude: hasProvidedCoordinates ? latitude : '',
    resolved_longitude: hasProvidedCoordinates ? longitude : '',
    geocoding_query: geocodingQuery,
    coordinate_source: hasProvidedCoordinates ? coordinateSource || 'Uploaded dataset' : '',
    coordinate_precision: hasProvidedCoordinates ? geocodePrecision || 'Provided' : '',
    geocoding_status: hasProvidedCoordinates ? 'Provided Coordinates' : 'Pending Geocoding',
    geocoding_provider: hasProvidedCoordinates ? 'Uploaded dataset' : '',
    geocoding_display_name: '',
    location_verification_status: locationVerification || 'Pending Location Check',
    location_status: locationVerification || 'Pending Location Check',
    research_area_distance_km: '',
    validation_status: 'Pending Validation',
    eligibility_status: 'Pending Eligibility',
    _original: { ...raw },
    _sourceRow: index + 2,
    _validationReasons: [],
    _locationReasons: [],
    _eligibilityReasons: []
  };
  return row;
}

function addValidationReason(row, reason) {
  if (!row._validationReasons.includes(reason)) row._validationReasons.push(reason);
}

function addLocationReason(row, reason) {
  if (reason && !row._locationReasons.includes(reason)) row._locationReasons.push(reason);
}

function addEligibilityReason(row, reason) {
  if (reason && !row._eligibilityReasons.includes(reason)) row._eligibilityReasons.push(reason);
}

function validateHouseholdFields(row, duplicateIds) {
  if (!hasDisplayValue(row.household_id)) addValidationReason(row, 'Missing household ID');
  if (row.household_id && duplicateIds.has(row.household_id)) addValidationReason(row, 'Duplicate household ID');
  const providedSomeCoordinates = hasDisplayValue(row.source_latitude) || hasDisplayValue(row.source_longitude);
  if (providedSomeCoordinates && !hasValidCoordinatePair(parseCoordinate(row.source_latitude), parseCoordinate(row.source_longitude))) addValidationReason(row, 'Invalid household coordinates');
  if (!hasDisplayValue(row.address) && !hasValidCoordinates(row)) addValidationReason(row, 'Missing address');
  if (parseUrgencyValue(row.urgency) === null) addValidationReason(row, 'Invalid urgency value');
  if (hasDisplayValue(row.compatible_resource) && !isKnownResourceRequirement(row.compatible_resource)) addValidationReason(row, 'Unknown optional resource need');
  if (!hasDisplayValue(row.source_verification)) addValidationReason(row, 'Missing beneficiary verification status');
  if (hasDisplayValue(row.source_verification) && !['verified', 'pending', 'flagged', 'rejected'].includes(String(row.source_verification_status).toLowerCase())) addValidationReason(row, 'Unknown beneficiary verification status');
}

function titleCaseStatus(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function deriveSystemVerification(row, location) {
  const sourceStatus = String(row.source_verification_status || '').trim().toLowerCase();
  if (['pending', 'flagged', 'rejected'].includes(sourceStatus)) {
    const status = titleCaseStatus(sourceStatus);
    return { status, reason: `Beneficiary verification is ${status}` };
  }
  if (row._validationReasons.length) {
    return { status: 'Flagged', reason: `System validation failed: ${row._validationReasons.join('; ')}` };
  }
  if (!hasValidCoordinates(row) || location?.status === 'Unresolved Location') {
    return { status: 'Pending', reason: 'System validation needs a resolved household location' };
  }
  if (sourceStatus === 'verified') {
    return { status: 'Verified', reason: 'Beneficiary verification confirmed; system validation passed' };
  }
  return { status: 'Pending', reason: 'Beneficiary verification is not Verified' };
}

async function resolveHouseholdLocation(row) {
  row.geocoding_query = normalizeAddressQuery(row.address);
  if (hasValidCoordinates(row)) return { attempted: false, resolved: true, reason: 'Valid uploaded coordinates' };
  if (!hasDisplayValue(row.address)) {
    row.geocoding_status = 'Needs Geocoding';
    row.location_verification_status = 'Needs Review';
    addLocationReason(row, 'Missing address for geocoding');
    return { attempted: false, resolved: false, reason: 'Missing address for geocoding' };
  }
  row.geocoding_status = 'Needs Geocoding';
  const result = await geocodeAddress(row.address);
  if (hasValidCoordinatePair(result.latitude, result.longitude)) {
    row.latitude = result.latitude;
    row.longitude = result.longitude;
    row.resolved_latitude = result.latitude;
    row.resolved_longitude = result.longitude;
    row.coordinate_source = result.provider || RESEARCH_CONFIG.geocoding.provider;
    row.coordinate_precision = result.status || 'Approximate';
    row.geocoding_status = 'Geocoded';
    row.geocoding_provider = result.provider || RESEARCH_CONFIG.geocoding.provider;
    row.geocoding_display_name = result.displayName || '';
    row.geocoding_query = result.query || row.geocoding_query;
    return { attempted: true, resolved: true, reason: row.coordinate_precision };
  } else {
    row.geocoding_status = 'Geocoding Failed';
    row.coordinate_source = '';
    row.coordinate_precision = '';
    row.location_verification_status = 'Needs Review';
    addLocationReason(row, result.reason || 'Address could not be geocoded');
    return { attempted: true, resolved: false, reason: result.reason || 'Address could not be geocoded' };
  }
}

function deriveLocationVerificationStatus(row, location) {
  if (!hasValidCoordinates(row)) return 'Needs Review';
  if (row.coordinate_precision === 'Parent Address') return 'Parent Address Match';
  if (row.coordinate_precision && !['provided', 'exact'].includes(String(row.coordinate_precision).toLowerCase())) return 'Needs Review';
  if (location?.review) return 'Needs Review';
  if (location?.outside) return 'Outside Research Area';
  return 'Verified';
}

function finalizeGeographyValidation(row) {
  let location;
  if (!hasValidCoordinates(row)) {
    location = { status: 'Needs Location Review', inside: false, review: true, outside: false, distanceKm: null, reason: 'Address could not be resolved' };
  } else {
    row.distance_km = geoDistanceKm(RELIEF_HUB.coordinates, [Number(row.latitude), Number(row.longitude)]).toFixed(4);
    location = row.coordinate_precision === 'Parent Address'
      ? { status: 'Needs Location Review', inside: false, review: true, outside: false, distanceKm: getResearchAreaDistanceKm(Number(row.latitude), Number(row.longitude)), reason: 'Geocoding resolved to the parent street address' }
      : row.coordinate_precision && !['provided', 'exact'].includes(String(row.coordinate_precision).toLowerCase())
      ? { status: 'Needs Location Review', inside: false, review: true, outside: false, distanceKm: getResearchAreaDistanceKm(Number(row.latitude), Number(row.longitude)), reason: 'Geocoding resolved only an ambiguous or parent address' }
      : classifyResearchAreaLocation(row);
  }
  row.location_status = location.status;
  row.location_verification_status = deriveLocationVerificationStatus(row, location);
  row.research_area_distance_km = Number.isFinite(location.distanceKm) ? location.distanceKm.toFixed(4) : '';
  if (!location.inside) addLocationReason(row, location.reason || location.status);
  if (isResearchBoundaryEnforced() && !location.inside) addEligibilityReason(row, location.reason || location.status);
  const verification = deriveSystemVerification(row, location);
  row.verification_status = verification.status;
  row.verification_reason = verification.reason;
  if (!isVerified(row)) addEligibilityReason(row, verification.reason);
  if (row._validationReasons.length) {
    row.validation_status = 'Invalid';
    row._validationReasons.forEach(reason => addEligibilityReason(row, reason));
  } else if (!isVerified(row)) {
    row.validation_status = `${row.verification_status} Verification`;
  } else if (!location.inside) {
    row.validation_status = isResearchBoundaryEnforced() ? location.status : 'Location Review';
  } else {
    row.validation_status = 'Valid';
  }
  row.eligibility_status = isEligibleForAllocation(row) ? 'Eligible for Allocation' : 'Not Eligible';
}

function getDuplicateIds(rows) {
  const counts = rows.reduce((map, row) => {
    if (row.household_id) map.set(row.household_id, (map.get(row.household_id) || 0) + 1);
    return map;
  }, new Map());
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id));
}

function computeValidationSummary(rows) {
  const validRows = rows.filter(row => !row._validationReasons.length);
  const resolvedRows = rows.filter(hasValidCoordinates);
  const verifiedRows = rows.filter(isVerified);
  const pendingRows = rows.filter(isPending);
  const insideRows = resolvedRows.filter(isInsideResearchAreaRow);
  const outsideRows = rows.filter(row => row.location_status === 'Outside Research Area');
  const reviewRows = rows.filter(row => row.location_status === 'Needs Location Review' || row.validation_status === 'Location Review');
  const locationVerifiedRows = rows.filter(row => row.location_verification_status === 'Verified');
  const parentMatchRows = rows.filter(row => row.coordinate_precision === 'Parent Address' || row.coordinate_precision === 'Parent Address Match' || row.coordinate_precision === 'Approximate');
  const geocodingFailedRows = rows.filter(row => row.geocoding_status === 'Geocoding Failed');
  return {
    totalRows: rows.length,
    validHouseholds: validRows.length,
    verifiedHouseholds: verifiedRows.length,
    eligibleHouseholds: rows.filter(isEligibleForAllocation).length,
    pendingVerification: pendingRows.length,
    pendingNeedsReview: rows.length - rows.filter(isEligibleForAllocation).length,
    invalidRows: rows.filter(row => row._validationReasons.length).length,
    addressesResolved: resolvedRows.length,
    addressesUnresolved: rows.length - resolvedRows.length,
    insideResearchArea: insideRows.length,
    outsideResearchArea: outsideRows.length,
    needsLocationReview: reviewRows.length,
    locationVerified: locationVerifiedRows.length,
    parentAddressMatch: parentMatchRows.length,
    geocodingFailed: geocodingFailedRows.length,
    boundaryEnforced: isResearchBoundaryEnforced()
  };
}

function setValidationProgress(message) {
  const progress = $('#validation-progress');
  if (progress) progress.textContent = message;
}

async function validateAndPrepareDataset({ autoRun = false } = {}) {
  if (!state.rawRows.length || state.processing) return;
  state.mappingIssues = getMappingIssues(state.columnMapping);
  renderColumnMappingPanel();
  if (state.mappingIssues.some(issue => issue.level === 'error')) {
    const mappingPanel = $('#column-mapping-panel');
    if (mappingPanel) mappingPanel.dataset.open = 'true';
    renderColumnMappingPanel();
    renderValidationSummary();
    toast('Resolve column mapping before validation');
    return;
  }
  state.processing = true;
  renderDataset();
  setValidationProgress('Processing dataset...');
  await resolveHubLocation();
  const normalizedRows = state.rawRows.map(normalizeHouseholdRow);
  const duplicateIds = getDuplicateIds(normalizedRows);
  normalizedRows.forEach(row => validateHouseholdFields(row, duplicateIds));
  const rowsNeedingGeocoding = normalizedRows.filter(row => !hasValidCoordinates(row) && hasDisplayValue(row.address)).length;
  let geocodeAttempts = 0;
  let geocodeResolved = 0;
  for (let index = 0; index < normalizedRows.length; index++) {
    const row = normalizedRows[index];
    if (!hasValidCoordinates(row) && hasDisplayValue(row.address)) {
      geocodeAttempts += 1;
      setValidationProgress(`Geocoding address ${geocodeAttempts} / ${rowsNeedingGeocoding}: ${row.household_id || `Row ${row._sourceRow}`}`);
    }
    const locationResult = await resolveHouseholdLocation(row);
    if (locationResult?.attempted && locationResult.resolved) geocodeResolved += 1;
    finalizeGeographyValidation(row);
    setValidationProgress(`Processing dataset... ${index + 1} / ${normalizedRows.length} records checked; ${geocodeResolved} / ${geocodeAttempts} geocodes resolved`);
  }
  state.dataset = normalizedRows;
  state.invalidRows = normalizedRows.filter(row => row._validationReasons.length);
  state.verifiedHouseholdSet = normalizedRows.filter(isEligibleForAllocation);
  state.researchDataset = state.verifiedHouseholdSet;
  state.validation = computeValidationSummary(normalizedRows);
  state.results = {};
  state.latest = null;
  state.processing = false;
  logGeographicValidationDiagnostics(normalizedRows);
  renderDataset();
  logAllocationDiagnostics(`Dataset validation: ${state.filename}`);
  if (autoRun && getVerifiedHouseholdSet().length && !getRunBlockers('enhanced').length) {
    if (compare()) {
      go('compare');
      toast(`${state.validation.eligibleHouseholds} verified households validated and compared`);
    }
  } else {
    go('compare');
    toast(`Geocoding complete: ${state.validation.addressesResolved} resolved, ${state.validation.addressesUnresolved} unresolved, ${state.validation.eligibleHouseholds} H*`);
  }
}

function getRunBlockers(mode, requestedCount = null) {
  const blockers = [];
  const hstar = getVerifiedHouseholdSet();
  const requestedSize = requestedCount === null || requestedCount === undefined || requestedCount === '' ? null : Number(requestedCount);
  // This guards the application workflow; the Standard Hungarian solver itself
  // still assumes its input is already valid and optimizes distance only.
  if (state.processing) blockers.push('Dataset is still being processed');
  if (state.resourceProcessing) blockers.push('Relief resources are still being processed');
  if (!state.validation) blockers.push('Validate the dataset before running algorithms');
  if (!hstar.length) blockers.push('No households are available in verified set H*');
  if (!state.resourceRows.length) blockers.push('Relief resource data required');
  if (state.resourceRows.length && !state.reliefResources.length) blockers.push('No available relief resources with valid coordinates');
  if (hstar.length && state.reliefResources.length && !getActiveResources(hstar).length) blockers.push('No relief resources are available for verified H*');
  if (requestedSize !== null && Number.isFinite(requestedSize)) {
    if (!BENCHMARK_MATRIX_SIZES.includes(requestedSize)) blockers.push('Select a supported thesis matrix size');
    if (hstar.length && hstar.length < requestedSize) blockers.push(`At least ${requestedSize} verified H* households are required for a ${requestedSize}x${requestedSize} comparison`);
    if (state.reliefResources.length && state.reliefResources.length < requestedSize) blockers.push(`At least ${requestedSize} available relief resources are required for a ${requestedSize}x${requestedSize} comparison`);
  }
  if (mode === 'enhanced') {
    const missingUrgency = hstar.filter(row => parseUrgencyValue(row.urgency) === null);
    if (missingUrgency.length) blockers.push('Enhanced Algorithm cannot run because urgency data is missing or invalid');
  }
  return blockers;
}

function ensureDatasetPanel(id, className) {
  let panel = $(`#${id}`);
  if (panel) return panel;
  const anchor = $('.upload-panel');
  if (!anchor?.parentNode) return null;
  panel = document.createElement('section');
  panel.id = id;
  panel.className = `panel ${className}`;
  anchor.parentNode.insertBefore(panel, anchor.nextSibling);
  return panel;
}

function getImportReadinessSummary() {
  const mapping = state.columnMapping || {};
  const mappedRequired = MAPPING_FIELDS.filter(field => field.required && mapping[field.key]).map(field => field.label);
  const vulnerabilityColumns = getDetectedVulnerabilityColumns();
  const missingLocationRows = state.rawRows.filter(row => {
    const lat = parseCoordinate(mapping.latitude ? row[mapping.latitude] : '');
    const lon = parseCoordinate(mapping.longitude ? row[mapping.longitude] : '');
    return !hasValidCoordinatePair(lat, lon);
  }).length;
  return {
    mappedRequired,
    vulnerabilityColumns,
    missingLocationRows,
    hasMappingErrors: state.mappingIssues.some(issue => issue.level === 'error')
  };
}

function renderFieldList(items) {
  return items.length ? items.map(item => escapeHtml(item)).join(', ') : 'None detected';
}

function getIssueAction(issue) {
  if (/geocod|address|location|parent|boundary|outside/i.test(issue)) return 'Review location';
  if (/verification/i.test(issue)) return 'Review beneficiary verification';
  if (/urgency/i.test(issue)) return 'Fix urgency';
  if (/duplicate|household id/i.test(issue)) return 'Fix household ID';
  return 'Review record';
}

function renderValidationIssuesTable(rows) {
  if (!rows.length) return '';
  const issueRows = rows.flatMap(row => {
    const status = row.validation_status || row.eligibility_status || getLocationStatus(row);
    return getRowIssues(row).map(issue => ({ householdId: row.household_id || `Row ${row._sourceRow}`, issue, status, action: getIssueAction(issue) }));
  }).slice(0, 20);
  if (!issueRows.length) return '';
  return `<section class="validation-issues"><div class="panel-head compact-head"><div><p class="eyebrow">Validation Issues</p><h3>Records needing attention</h3></div></div><div class="table-wrap"><table class="validation-issues-table"><thead><tr><th>Household ID</th><th>Issue</th><th>Status</th><th>Action</th></tr></thead><tbody>${issueRows.map(row => `<tr><td>${escapeHtml(row.householdId)}</td><td>${escapeHtml(row.issue)}</td><td class="${getCellClass('validation_status', row.status)}">${escapeHtml(row.status)}</td><td>${escapeHtml(row.action)}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function renderColumnMappingPanel() {
  const panel = ensureDatasetPanel('column-mapping-panel', 'mapping-panel');
  if (!panel) return;
  if (!state.rawRows.length) {
    panel.classList.add('hidden');
    return;
  }
  state.mappingIssues = getMappingIssues(state.columnMapping);
  const hasErrors = state.mappingIssues.some(issue => issue.level === 'error');
  const shouldOpen = hasErrors || panel.dataset.open === 'true';
  panel.classList.toggle('hidden', !shouldOpen);
  if (!shouldOpen) return;
  const issueHtml = state.mappingIssues.length
    ? `<div class="validation-issues compact">${state.mappingIssues.map(issue => `<span>${escapeHtml(issue.message)}</span>`).join('')}</div>`
    : '<p class="mapping-note">Columns were mapped confidently. You can still adjust them for a differently structured source file.</p>';
  const optionHtml = value => ['<option value="">Not mapped</option>', ...state.rawHeaders.map(header => `<option value="${escapeHtml(header)}"${header === value ? ' selected' : ''}>${escapeHtml(header)}</option>`)].join('');
  panel.innerHTML = `<div class="panel-head"><div><p class="eyebrow">Import Barangay dataset</p><h3>Column mapping</h3></div><button class="small-button" id="validate-mapping" type="button">Validate Dataset</button></div><div class="mapping-grid">${MAPPING_FIELDS.map(field => `<label><span>${escapeHtml(field.label)}${field.required ? ' *' : ''}</span><select data-mapping-key="${field.key}">${optionHtml(state.columnMapping[field.key])}</select></label>`).join('')}</div>${issueHtml}`;
  panel.querySelectorAll('[data-mapping-key]').forEach(select => {
    select.addEventListener('change', event => {
      state.columnMapping[event.target.dataset.mappingKey] = event.target.value;
      renderColumnMappingPanel();
    });
  });
  panel.querySelector('#validate-mapping').addEventListener('click', () => validateAndPrepareDataset());
}

function renderStagedValidationSummary(panel, summary) {
  const attentionRows = summary
    ? state.dataset.filter(row => row._validationReasons?.length || row._locationReasons?.length || row._eligibilityReasons?.length).slice(0, 12)
    : [];
  const issues = renderValidationIssuesTable(attentionRows);
  const progress = state.processing
    ? 'Processing dataset...'
    : summary
      ? `${summary.eligibleHouseholds} households are in verified set H* for both Standard and Enhanced algorithms. Borderline and parent-address locations are marked for review instead of rejected.`
      : 'Map columns, then validate the uploaded dataset.';
  const importSummary = getImportReadinessSummary();
  const actionHtml = !summary
    ? `<div class="validation-actions"><button class="primary-button" id="geocode-validate" type="button"${state.processing || importSummary.hasMappingErrors ? ' disabled' : ''}>Geocode & Validate Locations</button><button class="small-button" id="review-mapping" type="button">Review/Fix Column Mapping</button></div>`
    : `<div class="validation-actions"><button class="small-button" id="review-mapping" type="button">Review/Fix Column Mapping</button></div>`;
  const stagedHtml = !summary ? `<div class="import-readiness"><div><span>✓ detected fields</span><strong>${renderFieldList(importSummary.mappedRequired)}</strong></div><div><span>✓ household count</span><strong>${state.rawRows.length}</strong></div><div><span>✓ vulnerability fields</span><strong>${renderFieldList(importSummary.vulnerabilityColumns)}</strong></div><div><span>⚠ locations requiring geocoding</span><strong>${importSummary.missingLocationRows}</strong></div></div>` : '';
  panel.innerHTML = `<div class="panel-head"><div><p class="eyebrow">System verification</p><h3>Research readiness</h3></div><span class="live-label">${state.processing ? 'Processing' : summary ? 'Validated' : 'Awaiting validation'}</span></div>${stagedHtml}${actionHtml}<details class="advanced-mapping"><summary>Advanced &gt; Review Column Mapping</summary></details><div class="validation-summary-grid compact-readiness"><div><span>Total Records</span><strong>${summary?.totalRows ?? state.rawRows.length}</strong></div><div><span>Verified H*</span><strong>${summary?.eligibleHouseholds ?? '---'}</strong></div><div><span>Pending/Needs Review</span><strong>${summary?.pendingNeedsReview ?? '---'}</strong></div><div><span>Locations Resolved</span><strong>${summary?.addressesResolved ?? '---'}</strong></div><div><span>Locations Unresolved</span><strong>${summary?.addressesUnresolved ?? '---'}</strong></div></div><p class="validation-progress" id="validation-progress">${escapeHtml(progress)}</p>${issues}`;
  panel.querySelector('#geocode-validate')?.addEventListener('click', () => validateAndPrepareDataset());
  panel.querySelector('#review-mapping')?.addEventListener('click', () => {
    const mappingPanel = $('#column-mapping-panel');
    if (mappingPanel) mappingPanel.dataset.open = 'true';
    renderColumnMappingPanel();
  });
}

function renderValidationSummary() {
  const panel = ensureDatasetPanel('validation-panel', 'validation-panel');
  if (!panel) return;
  if (!state.rawRows.length) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  const summary = state.validation;
  renderStagedValidationSummary(panel, summary);
  return;
}

function renderResourceSummary() {
  const panel = ensureDatasetPanel('resource-panel', 'resource-panel');
  if (!panel) return;
  if (!state.rawRows.length && !state.resourceRows.length) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  const validation = state.resourceValidation;
  const mappingErrors = state.resourceMappingIssues?.some(issue => issue.level === 'error');
  const status = state.resourceProcessing ? 'Processing' : state.reliefResources.length ? 'Ready' : state.resourceRows.length ? 'Review required' : 'Required';
  const hstarCount = getVerifiedHouseholdSet().length;
  const matrixCount = Math.min(hstarCount, state.reliefResources.length);
  const importStatus = state.processing || state.resourceProcessing
    ? 'Processing'
    : state.validation && state.resourceValidation && hstarCount && state.reliefResources.length && !state.invalidRows.length && !state.resourceValidation.invalidResources
      ? 'Ready for comparison'
      : state.validation || state.resourceValidation ? 'Review required' : 'Awaiting import';
  const issues = validation?.issues?.length
    ? `<div class="table-wrap"><table class="validation-issues-table"><thead><tr><th>Resource</th><th>Issue</th><th>Status</th><th>Action</th></tr></thead><tbody>${validation.issues.slice(0, 12).map(issue => {
      const [resource, ...rest] = String(issue).split(':');
      return `<tr><td>${escapeHtml(resource)}</td><td>${escapeHtml(rest.join(':').trim() || issue)}</td><td>Invalid</td><td>Review resource data</td></tr>`;
    }).join('')}</tbody></table></div>`
    : '';
  const mappingIssueHtml = mappingErrors
    ? `<div class="validation-issues compact">${state.resourceMappingIssues.map(issue => `<span>${escapeHtml(issue.message)}</span>`).join('')}</div>`
    : '';
  const matrixReadiness = BENCHMARK_MATRIX_SIZES.map(size => `<span class="${hstarCount >= size && state.reliefResources.length >= size ? 'inside-research-area' : 'invalid'}">${size}x${size}</span>`).join('');
  const runActions = hstarCount && state.reliefResources.length
    ? '<div class="validation-actions"><button class="small-button" type="button" data-ready-run="existing">Run Existing</button><button class="small-button" type="button" data-ready-run="enhanced">Run Enhanced</button><button class="primary-button" type="button" data-ready-run="both">Run Comparison</button></div>'
    : '';
  panel.innerHTML = `<div class="panel-head"><div><p class="eyebrow">Relief resources</p><h3>Resource set R</h3></div><span class="live-label">${escapeHtml(status)}</span></div><div class="validation-summary-grid compact-readiness"><div><span>Raw Households</span><strong>${state.rawRows.length}</strong></div><div><span>Verified H*</span><strong>${hstarCount || '---'}</strong></div><div><span>Total Resources</span><strong>${validation?.totalRows ?? state.resourceRows.length}</strong></div><div><span>Available Resources</span><strong>${state.reliefResources.length}</strong></div><div><span>Matrix</span><strong>${matrixCount ? `${matrixCount} x ${matrixCount}` : '---'}</strong></div><div><span>Source</span><strong>${escapeHtml(state.resourceSource || (state.resourceRows.length ? 'Resources parsed' : 'Required'))}</strong></div><div><span>Invalid Resources</span><strong>${validation?.invalidResources ?? '---'}</strong></div><div><span>Import Status</span><strong>${escapeHtml(importStatus)}</strong></div></div><p class="validation-progress">${state.reliefResources.length ? 'Both algorithms will use this same available resource set R.' : state.resourceRows.length ? 'Resource rows were parsed but none are ready for assignment. Review the errors below.' : 'Relief resource data required before running assignment algorithms.'}</p>${runActions}<div class="matrix-readiness">${matrixReadiness}</div>${mappingIssueHtml}${issues}`;
  panel.querySelectorAll('[data-ready-run]').forEach(button => {
    button.addEventListener('click', () => {
      try {
        const mode = button.dataset.readyRun;
        if (mode === 'both') {
          if (compare()) go('compare');
        } else if (execute(mode)) {
          go(mode);
        }
      } catch (error) {
        reportRunError(error);
      }
    });
  });
}

function getDatasetTableKeys(rows) {
  if (!rows.length) return [];
  const first = rows[0];
  if (!state.validation) return Object.keys(first).filter(key => !key.startsWith('_')).slice(0, 12);
  return NORMALIZED_TABLE_KEYS.filter(key => rows.some(row => hasDisplayValue(row[key])));
}

function getRawOrNormalizedValue(row, normalizedKey, aliases = []) {
  if (hasDisplayValue(row?.[normalizedKey])) return String(row[normalizedKey]).trim();
  return findDatasetField(row, aliases)?.value || '';
}

function getVulnerabilitySummary(row) {
  const items = [];
  if (hasDisplayValue(row?.senior_count)) items.push(`Seniors: ${row.senior_count}`);
  if (hasDisplayValue(row?.pwd_count)) items.push(`PWD: ${row.pwd_count}`);
  if (hasDisplayValue(row?.vulnerability_factors)) items.push(String(row.vulnerability_factors));
  const used = new Set(['seniorcount', 'pwdcount', 'vulnerabilityfactors']);
  getVulnerabilityItems(row, used).forEach(item => items.push(item));
  return items.length ? items.join('; ') : 'None listed';
}

function getLocationStatus(row) {
  return row.location_verification_status || row.location_status || (hasValidCoordinates(row) ? 'Pending Location Check' : 'Needs Geocoding');
}

function getEligibilityStatus(row) {
  if (state.validation) return row.eligibility_status || (isEligibleForAllocation(row) ? 'Eligible for Allocation' : 'Not Eligible');
  return 'Pending Validation';
}

function getHouseholdTableFields(row) {
  return {
    householdId: getRawOrNormalizedValue(row, 'household_id', HOUSEHOLD_FIELD_ALIASES.id) || `Row ${row._sourceRow || ''}`.trim(),
    address: getRawOrNormalizedValue(row, 'address', HOUSEHOLD_FIELD_ALIASES.directAddress) || 'Missing',
    vulnerability: getVulnerabilitySummary(row),
    urgency: getRawOrNormalizedValue(row, 'urgency', HOUSEHOLD_FIELD_ALIASES.urgency) || 'Missing',
    beneficiaryVerification: row.beneficiary_verification_status || row.source_verification_status || getVerificationStatus(row) || 'Pending',
    locationStatus: getLocationStatus(row),
    eligibility: getEligibilityStatus(row)
  };
}

function renderHouseholdIdentity(fields) {
  return `<div class="household-identity"><strong>${escapeHtml(fields.householdId)}</strong><span>${escapeHtml(fields.address)}</span></div>`;
}

function simplifyVulnerabilityLabel(item) {
  const text = String(item || '').trim();
  const compatibility = text.match(/^(.+?)\s+Compatibility:\s*(.+)$/i);
  if (compatibility) {
    const label = compatibility[1]
      .replace(/Specialized PWD Support/i, 'PWD support')
      .replace(/Senior Support Pack/i, 'Senior pack')
      .replace(/Medical Kit/i, 'Med kit');
    return `${label}: ${compatibility[2]}`;
  }
  return text.length > 42 ? `${text.slice(0, 39)}...` : text;
}

function getVulnerabilitySummaryItems(summary) {
  return String(summary || '')
    .split(';')
    .map(item => item.trim())
    .filter(Boolean);
}

function renderVulnerabilityChips(summary) {
  const items = getVulnerabilitySummaryItems(summary);
  if (!items.length || String(summary).toLowerCase() === 'none listed') return '<span class="muted-cell">None listed</span>';
  const visibleItems = items.slice(0, 5);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);
  const chips = visibleItems.map(item => `<span class="need-chip" title="${escapeHtml(item)}">${escapeHtml(simplifyVulnerabilityLabel(item))}</span>`).join('');
  const more = hiddenCount ? `<span class="need-chip need-chip-more" title="${escapeHtml(items.slice(5).join('; '))}">+${hiddenCount} more</span>` : '';
  return `<div class="need-chip-list" title="${escapeHtml(summary)}">${chips}${more}</div>`;
}

function renderUrgencyValue(value) {
  return `<strong class="urgency-value">${escapeHtml(value || 'Missing')}</strong>`;
}

function renderStatusStack(fields) {
  const statuses = [
    ['Verification', fields.beneficiaryVerification, 'verification_status'],
    ['Location', fields.locationStatus, 'location_status'],
    ['Eligibility', fields.eligibility, 'eligibility_status']
  ];
  return `<div class="status-stack">${statuses.map(([label, value, key]) => `<span><b>${escapeHtml(label)}</b><i class="${getCellClass(key, value)}">${escapeHtml(value)}</i></span>`).join('')}</div>`;
}

function getRowIssues(row) {
  return [...new Set([...(row._validationReasons || []), ...(row._locationReasons || []), ...(row._eligibilityReasons || [])].filter(Boolean))];
}

function renderHouseholdTechnicalDetails(row, fields = null) {
  const details = [
    ['Full Need Summary', fields?.vulnerability],
    ['Latitude', row.latitude],
    ['Longitude', row.longitude],
    ['Coordinate Source', row.coordinate_source],
    ['Coordinate Precision', row.coordinate_precision],
    ['Geocoding Status', row.geocoding_status],
    ['Geocoding Query', row.geocoding_query],
    ['Geocoder Match', row.geocoding_display_name],
    ['Validation Reason', getRowIssues(row).join('; ')]
  ].filter(([, value]) => hasDisplayValue(value));
  const rows = details.length
    ? details.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatCellValue(value))}</strong></div>`).join('')
    : '<p>No technical fields yet.</p>';
  return `<details class="row-details"><summary>View Details</summary><div class="row-details-grid">${rows}</div></details>`;
}

function getSearchableRow(row) {
  return Object.fromEntries(Object.entries(row || {}).filter(([key]) => !key.startsWith('_')));
}

function formatCellValue(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return '';
  return String(value);
}

function getCellClass(key, value) {
  const text = String(value || '').toLowerCase();
  if (key === 'verification' || key === 'source_verification_status' || key === 'beneficiary_verification_status' || key === 'verification_status' || key === 'validation_status' || key === 'location_status' || key === 'location_verification_status' || key === 'eligibility_status') return text.replace(/\s+/g, '-');
  if (key === 'geocoding_status') return text.includes('unresolved') || text.includes('unavailable') ? 'invalid' : text.toLowerCase();
  return '';
}

function getHouseholdId(row) {
  return findDatasetField(row, HOUSEHOLD_FIELD_ALIASES.id)?.value || '';
}

function getVerificationStatus(row) {
  if (hasDisplayValue(row?.verification_status)) return String(row.verification_status).trim();
  return findDatasetField(row, HOUSEHOLD_FIELD_ALIASES.verification)?.value || '';
}

function isPending(row) {
  return getVerificationStatus(row).trim().toLowerCase() === 'pending';
}

function hasValidCoordinates(row) {
  if (!row) return false;
  return hasValidCoordinatePair(row.latitude, row.longitude);
}

function getPreValidationInvalidRowCount() {
  if (!state.rawRows.length) return 0;
  const mapping = state.columnMapping || {};
  return state.rawRows.filter(row => {
    const missingRequired = MAPPING_FIELDS
      .filter(field => field.required)
      .some(field => !mapping[field.key] || !hasDisplayValue(row[mapping[field.key]]));
    const hasAddress = mapping.address && hasDisplayValue(row[mapping.address]);
    const lat = parseCoordinate(mapping.latitude ? row[mapping.latitude] : '');
    const lon = parseCoordinate(mapping.longitude ? row[mapping.longitude] : '');
    return missingRequired || (!hasAddress && !hasValidCoordinatePair(lat, lon));
  }).length;
}

function isInsideResearchAreaRow(row) {
  return hasValidCoordinates(row) && isInsideResearchArea(Number(row.latitude), Number(row.longitude));
}

function isEligibleForAllocation(row) {
  return !row._validationReasons?.length && isVerified(row) && hasValidCoordinates(row);
}

function householdIds(rows) {
  return rows.map(row => getHouseholdId(row.household || row) || '(missing id)');
}

function makeDiagnosticStage(stage, rows, note = '') {
  return { stage, count: rows.length, ids: householdIds(rows).join(', '), note };
}

function logGeographicValidationDiagnostics(rows) {
  if (!DEBUG_ALGORITHM_DIAGNOSTICS || typeof console === 'undefined') return;
  const limits = getResearchAreaLimits();
  const boundary = {
    name: RESEARCH_CONFIG.researchArea?.name || RESEARCH_CONFIG.areaName,
    type: RESEARCH_CONFIG.researchArea?.type || 'unknown',
    coordinateOrder: '[latitude, longitude] for Leaflet bbox checks',
    enforceBoundaryForEligibility: isResearchBoundaryEnforced(),
    reviewBufferKm: getLocationReviewBufferKm(),
    minLat: limits?.minLat ?? '',
    maxLat: limits?.maxLat ?? '',
    minLng: limits?.minLon ?? '',
    maxLng: limits?.maxLon ?? ''
  };
  console.groupCollapsed(`[Geographic validation] ${state.filename || 'Uploaded dataset'}`);
  console.table([boundary]);
  console.table(rows.map(row => ({
    householdId: row.household_id || `Row ${row._sourceRow}`,
    originalAddress: row._original?.[state.columnMapping.address] || row.address || '',
    normalizedQuery: row.geocoding_query || '',
    resolvedLatitude: row.latitude || '',
    resolvedLongitude: row.longitude || '',
    geocodingQuality: row.geocoding_status || '',
    geocodingDisplayName: row.geocoding_display_name || '',
    researchAreaCheck: row.location_status || '',
    insideConfiguredBoundary: isInsideResearchAreaRow(row),
    verificationStatus: row.verification_status || '',
    eligibilityStatus: row.eligibility_status || '',
    reason: [...(row._validationReasons || []), ...(row._locationReasons || []), ...(row._eligibilityReasons || [])].join('; ')
  })));
  console.groupEnd();
}

function logAllocationDiagnostics(label, result = null, mapItems = null) {
  if (!DEBUG_ALGORITHM_DIAGNOSTICS || typeof console === 'undefined') return;
  const rows = state.dataset;
  const resolvedLocationRows = rows.filter(hasValidCoordinates);
  const unresolvedRows = rows.filter(row => !hasValidCoordinates(row));
  const verifiedRows = rows.filter(isVerified);
  const pendingRows = rows.filter(isPending);
  const insideRows = resolvedLocationRows.filter(isInsideResearchAreaRow);
  const reviewRows = rows.filter(row => row.location_status === 'Needs Location Review' || row.validation_status === 'Location Review');
  const outsideRows = rows.filter(row => row.location_status === 'Outside Research Area');
  const eligibleRows = rows.filter(isEligibleForAllocation);
  const stages = [
    makeDiagnosticStage('CSV rows loaded', rows),
    makeDiagnosticStage('Valid coordinate rows', resolvedLocationRows),
    makeDiagnosticStage('Unresolved address rows', unresolvedRows),
    makeDiagnosticStage('Verified households', verifiedRows),
    makeDiagnosticStage('Pending households', pendingRows),
    makeDiagnosticStage('Households inside research area', insideRows),
    makeDiagnosticStage('Households needing location review', reviewRows),
    makeDiagnosticStage('Households outside research area', outsideRows),
    makeDiagnosticStage('Households sent to algorithm', eligibleRows),
    makeDiagnosticStage('Assignment results', result?.output?.map(item => item.household) || [], result ? `${result.mode} output rows from ${result.resourceCount || 0} uploaded relief resources` : 'not run yet'),
    makeDiagnosticStage('Households sent to map', mapItems?.map(item => item.household || item) || [], mapItems ? 'rendered marker rows' : 'not rendered yet')
  ];
  console.groupCollapsed(`[Allocation diagnostics] ${label}`);
  console.table(stages);
  stages.forEach(item => console.log(`${item.stage}: ${item.count}`, item.ids || '(none)', item.note || ''));
  if (outsideRows.length || reviewRows.length) {
    console.warn('[Allocation diagnostics] Rows outside or near the configured Barangay 160 review boundary', {
      boundary: getResearchAreaLimits(),
      boundaryEnforced: isResearchBoundaryEnforced(),
      outsideIds: householdIds(outsideRows).join(', '),
      reviewIds: householdIds(reviewRows).join(', ')
    });
  }
  console.groupEnd();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function normalizeFieldName(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function hasDisplayValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function findDatasetField(row, aliases) {
  const aliasSet = new Set(aliases.map(normalizeFieldName));
  return Object.entries(row || {}).reduce((match, [key, value]) => {
    if (match || key.startsWith('_') || !hasDisplayValue(value) || !aliasSet.has(normalizeFieldName(key))) return match;
    return { key, value: String(value).trim() };
  }, null);
}

function formatFieldLabel(key) {
  const normalized = normalizeFieldName(key);
  if (HOUSEHOLD_LABELS[normalized]) return HOUSEHOLD_LABELS[normalized];
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
    .replace(/\bId\b/g, 'ID')
    .replace(/\bPwd\b/g, 'PWD');
}

function rememberField(usedFields, field) {
  if (field) usedFields.add(normalizeFieldName(field.key));
}

function getAddressField(row, usedFields) {
  const direct = findDatasetField(row, HOUSEHOLD_FIELD_ALIASES.directAddress);
  if (direct) {
    rememberField(usedFields, direct);
    return direct.value;
  }
  const parts = HOUSEHOLD_FIELD_ALIASES.addressParts
    .map(alias => findDatasetField(row, [alias]))
    .filter(Boolean);
  parts.forEach(field => rememberField(usedFields, field));
  return parts.map(field => field.value).filter(Boolean).join(', ');
}

function addHouseholdDetail(details, usedFields, label, fieldOrValue, options = {}) {
  const value = typeof fieldOrValue === 'object' && fieldOrValue !== null ? fieldOrValue.value : fieldOrValue;
  if (!hasDisplayValue(value)) return;
  if (typeof fieldOrValue === 'object') rememberField(usedFields, fieldOrValue);
  details.push({ label, value: String(value).trim(), ...options });
}

function getVulnerabilityItems(row, usedFields) {
  return Object.entries(row || {}).reduce((items, [key, value]) => {
    const text = String(value || '').trim();
    const normalized = normalizeFieldName(key);
    if (key.startsWith('_') || usedFields.has(normalized) || !text || !VULNERABILITY_PATTERN.test(key) || NEGATIVE_FIELD_VALUES.test(text)) return items;
    usedFields.add(normalized);
    items.push(AFFIRMATIVE_FIELD_VALUES.test(text) ? formatFieldLabel(key) : `${formatFieldLabel(key)}: ${text}`);
    return items;
  }, []);
}

function getExtraHouseholdInfo(row, usedFields) {
  return Object.entries(row || {}).reduce((items, [key, value]) => {
    const text = String(value || '').trim();
    const normalized = normalizeFieldName(key);
    if (key.startsWith('_') || items.length >= 4 || usedFields.has(normalized) || !text || !EXTRA_INFO_PATTERN.test(key)) return items;
    usedFields.add(normalized);
    items.push({ label: formatFieldLabel(key), value: text });
    return items;
  }, []);
}

function getPriorityRangeLabel(meta) {
  if (meta.urgency >= 7) return '7-10';
  if (meta.urgency >= 4) return '4-6';
  return '0-3';
}

function renderHouseholdRows(details) {
  return details.map(detail => `<div class="household-card-row"><span>${escapeHtml(detail.label)}</span><strong>${escapeHtml(detail.value)}</strong></div>`).join('');
}

function renderHouseholdSection(title, details, note = '') {
  if (!details.length && !note) return '';
  return `<div class="household-card-section"><span>${escapeHtml(title)}</span>${renderHouseholdRows(details)}${note ? `<p class="household-card-note">${escapeHtml(note)}</p>` : ''}</div>`;
}

function getAssignedResourceType(item) {
  if (item.resourceType) return item.resourceType;
  if (typeof item.resourceIndex === 'number') return resourceType(item.resourceIndex);
  const match = String(item.resource || '').match(/\(([^)]+)\)/);
  return match?.[1] || '';
}

function getCompatibilityEvaluation(item, compatibleField) {
  if (!item.assigned) return '';
  if (!compatibleField) return isAssignedCompatible(item) ? 'Match' : 'Mismatch';
  const assignedType = getAssignedResourceType(item).trim().toLowerCase();
  const requiredType = compatibleField.value.trim().toLowerCase();
  if (!assignedType || !requiredType) return '';
  return assignedType === requiredType ? 'Match' : 'Mismatch';
}

function getHouseholdCardContext(item) {
  const row = item.household || {};
  const usedFields = new Set();
  const idField = findDatasetField(row, HOUSEHOLD_FIELD_ALIASES.id);
  const headField = findDatasetField(row, HOUSEHOLD_FIELD_ALIASES.head);
  const membersField = findDatasetField(row, HOUSEHOLD_FIELD_ALIASES.members);
  const urgencyField = findDatasetField(row, HOUSEHOLD_FIELD_ALIASES.urgency);
  const verificationField = hasDisplayValue(row.verification_status) ? { key: 'verification_status', value: row.verification_status } : findDatasetField(row, HOUSEHOLD_FIELD_ALIASES.verification);
  const verificationReasonField = hasDisplayValue(row.verification_reason) ? { key: 'verification_reason', value: row.verification_reason } : null;
  const sourceVerificationField = hasDisplayValue(row.source_verification_status) ? { key: 'source_verification_status', value: row.source_verification_status } : null;
  const compatibleField = findDatasetField(row, HOUSEHOLD_FIELD_ALIASES.compatibleResource);
  const statusField = findDatasetField(row, HOUSEHOLD_FIELD_ALIASES.assignmentStatus);
  const assignmentStatus = item.assignmentStatus || statusField?.value || (item.assigned === false ? 'Unassigned' : 'Assigned');
  const outsideRunScope = item.outsideRunScope || String(assignmentStatus).startsWith('Not included');
  const allocation = outsideRunScope ? 'Not included in this comparison run' : item.assigned === false ? 'Unassigned' : item.resource;

  rememberField(usedFields, idField);
  return { row, usedFields, idField, headField, membersField, urgencyField, verificationField, verificationReasonField, sourceVerificationField, compatibleField, statusField, assignmentStatus, allocation, outsideRunScope };
}

function buildExistingHouseholdInfoHtml(item, hubDistance) {
  const { row, usedFields, idField, verificationField, assignmentStatus, allocation, outsideRunScope } = getHouseholdCardContext(item);
  const householdId = idField?.value || 'Household';
  const algorithmDetails = [];
  const basis = outsideRunScope ? assignmentStatus : item.assigned ? 'Minimum Distance' : isPending(row) ? 'Verification required before optimization' : 'No resource assigned';

  addHouseholdDetail(algorithmDetails, usedFields, 'Assigned resource', allocation);
  addHouseholdDetail(algorithmDetails, usedFields, 'Assignment basis', basis);
  addHouseholdDetail(algorithmDetails, usedFields, 'Algorithm distance', `${hubDistance} km`);
  if (typeof item.value === 'number' && Number.isFinite(item.value)) addHouseholdDetail(algorithmDetails, usedFields, 'Distance cost', `${item.value.toFixed(3)} km`);
  addHouseholdDetail(algorithmDetails, usedFields, 'H* status', verificationField);
  addHouseholdDetail(algorithmDetails, usedFields, 'Assignment status', assignmentStatus);

  const stateBadge = `<span class="household-state-badge">${escapeHtml(assignmentStatus)}</span>`;
  const datasetNote = 'Existing Hungarian output is based only on distance.';

  return `<div class="household-card-kicker">Existing algorithm assignment</div><div class="household-card-title"><strong>${escapeHtml(householdId)}</strong>${stateBadge}</div>${renderHouseholdSection('Distance-only decision', algorithmDetails, datasetNote)}`;
}

function buildEnhancedHouseholdInfoHtml(item, hubDistance) {
  const { row, usedFields, idField, headField, membersField, urgencyField, verificationField, verificationReasonField, sourceVerificationField, compatibleField, assignmentStatus, allocation, outsideRunScope } = getHouseholdCardContext(item);
  const householdId = idField?.value || 'Household';
  const urgencyMeta = urgencyField ? getUrgencyMeta(urgencyField.value) : null;
  const algorithmDetails = [];
  const datasetDetails = [];
  const lat = Number(row.latitude);
  const lon = Number(row.longitude);

  addHouseholdDetail(algorithmDetails, usedFields, 'Allocation', allocation);
  addHouseholdDetail(algorithmDetails, usedFields, 'Assignment status', assignmentStatus);
  if (urgencyMeta) {
    addHouseholdDetail(algorithmDetails, usedFields, 'Urgency score', `${urgencyMeta.urgency}/10`);
    rememberField(usedFields, urgencyField);
    addHouseholdDetail(algorithmDetails, usedFields, 'Priority', `${urgencyMeta.label} (${getPriorityRangeLabel(urgencyMeta)})`);
  }
  addHouseholdDetail(algorithmDetails, usedFields, 'Resource Need', compatibleField);
  addHouseholdDetail(algorithmDetails, usedFields, 'Assignment basis', outsideRunScope ? assignmentStatus : 'Distance + Urgency + Compatibility');
  if (typeof item.value === 'number' && Number.isFinite(item.value)) addHouseholdDetail(algorithmDetails, usedFields, 'Composite cost', item.value.toFixed(3));
  if (item.components) {
    addHouseholdDetail(algorithmDetails, usedFields, 'Distance component', item.components.distanceComponent.toFixed(3));
    addHouseholdDetail(algorithmDetails, usedFields, 'Urgency component', item.components.urgencyComponent.toFixed(3));
    addHouseholdDetail(algorithmDetails, usedFields, 'Compatibility component', item.components.compatibilityComponent.toFixed(3));
  }
  addHouseholdDetail(algorithmDetails, usedFields, 'Algorithm distance', `${hubDistance} km`);
  addHouseholdDetail(algorithmDetails, usedFields, 'H* status', verificationField);

  addHouseholdDetail(datasetDetails, usedFields, 'Verification reason', verificationReasonField);
  addHouseholdDetail(datasetDetails, usedFields, 'Representative', headField);
  addHouseholdDetail(datasetDetails, usedFields, 'Address', getAddressField(row, usedFields));
  addHouseholdDetail(datasetDetails, usedFields, 'Members', membersField);
  addHouseholdDetail(datasetDetails, usedFields, 'Geocoding status', row.geocoding_status);
  addHouseholdDetail(datasetDetails, usedFields, 'Research area', row.location_status);
  if (hasValidCoordinates(row)) addHouseholdDetail(datasetDetails, usedFields, 'Coordinates', `${lat.toFixed(5)}, ${lon.toFixed(5)}`);

  const vulnerabilities = getVulnerabilityItems(row, usedFields);
  const extraInfo = getExtraHouseholdInfo(row, usedFields);
  const badge = urgencyMeta ? `<span class="household-priority-badge" style="--priority-color: ${urgencyMeta.color}"><i></i>${escapeHtml(urgencyMeta.label)}</span>` : '';
  const vulnerabilitySection = vulnerabilities.length ? `<div class="household-card-section"><span>Vulnerability</span><div class="household-chip-list">${vulnerabilities.map(item => `<b>${escapeHtml(item)}</b>`).join('')}</div></div>` : '';

  return `<div class="household-card-kicker">Enhanced algorithm assignment</div><div class="household-card-title"><strong>${escapeHtml(householdId)}</strong>${badge}</div>${headField ? `<p class="household-card-subtitle">${escapeHtml(headField.value)}</p>` : ''}${renderHouseholdSection('Multi-objective decision', algorithmDetails)}${renderHouseholdSection('Dataset information', datasetDetails)}${vulnerabilitySection}${renderHouseholdSection('Additional data', extraInfo)}`;
}

function buildHouseholdInfoHtml(item, target, hubDistance) {
  return target === 'existing'
    ? buildExistingHouseholdInfoHtml(item, hubDistance)
    : buildEnhancedHouseholdInfoHtml(item, hubDistance);
}

function needsLocationReview(row) {
  return row.location_status === 'Needs Location Review' || row.validation_status === 'Location Review';
}

function isOutsideResearchArea(row) {
  return row.location_status === 'Outside Research Area';
}

function getComputedAssignmentStatus(row, assignment) {
  if (assignment) return assignment.assignmentStatus || 'Assigned';
  const verification = getVerificationStatus(row).trim();
  if (verification.toLowerCase() === 'pending') return 'Pending Verification';
  if (verification && verification.toLowerCase() !== 'verified') return `${verification} Verification`;
  if (needsLocationReview(row)) return 'Needs Location Review';
  if (isOutsideResearchArea(row)) return 'Outside Research Area';
  return 'Unassigned';
}

function buildAssignmentMapItems(result) {
  const assignedByRow = new Map();
  const assignedById = new Map();
  result.output.forEach(item => {
    assignedByRow.set(item.household, item);
    const id = getHouseholdId(item.household);
    if (id) assignedById.set(id, item);
  });
  return state.dataset.map(row => {
    const id = getHouseholdId(row);
    const assignment = assignedByRow.get(row) || (id ? assignedById.get(id) : null);
    if (assignment) return { ...assignment, household: row, assigned: true, assignmentStatus: getComputedAssignmentStatus(row, assignment) };
    if (result.records !== state.dataset.length) {
      return { household: row, resource: '', resourceIndex: null, value: null, assigned: false, outsideRunScope: true, assignmentStatus: `Not included in ${result.matrixSize} comparison` };
    }
    return { household: row, resource: '', resourceIndex: null, value: null, assigned: false, assignmentStatus: getComputedAssignmentStatus(row, null) };
  });
}

function getAssignmentMapItems(result) {
  return buildAssignmentMapItems(result);
}

function getCoordinateKey(row) {
  return `${Number(row.latitude).toFixed(7)},${Number(row.longitude).toFixed(7)}`;
}

function getVisualMarkerPoint(row, duplicateTracker) {
  const basePoint = [Number(row.latitude), Number(row.longitude)];
  const key = getCoordinateKey(row);
  const duplicateIndex = duplicateTracker.get(key) || 0;
  duplicateTracker.set(key, duplicateIndex + 1);
  if (!duplicateIndex) return basePoint;

  // Display-only spread for stacked markers; persisted coordinates and distances stay unchanged.
  const angle = (duplicateIndex - 1) * 2.399963229728653;
  const radius = 0.000045 * Math.ceil(duplicateIndex / 8);
  return [
    basePoint[0] + Math.sin(angle) * radius,
    basePoint[1] + Math.cos(angle) * radius
  ];
}

function getDatasetMarkerStyle(row, priorityColor, assignedColor = priorityColor) {
  const base = { radius: 7, color: '#fff', weight: 2, fillColor: assignedColor, fillOpacity: .95, opacity: 1 };
  if (isPending(row)) return { ...base, color: priorityColor, fillColor: '#fff', fillOpacity: .28, opacity: .72, dashArray: '3 3' };
  if (needsLocationReview(row)) return { ...base, color: priorityColor, fillColor: '#fff', fillOpacity: .36, opacity: .82, dashArray: '4 3' };
  if (isOutsideResearchArea(row)) return { ...base, color: '#748397', fillColor: '#fff', fillOpacity: .18, opacity: .65, dashArray: '1 4' };
  return base;
}

function getHouseholdMarkerStyle(item, target, priorityColor) {
  const assignedColor = target === 'existing' ? '#29496b' : priorityColor;
  const base = getDatasetMarkerStyle(item.household, target === 'existing' ? '#748397' : priorityColor, assignedColor);
  if (!item.assigned) return { ...base, fillOpacity: Math.min(base.fillOpacity ?? .95, .5), opacity: Math.min(base.opacity ?? 1, .9), dashArray: base.dashArray || '2 3' };
  return base;
}

function getAssignmentLineStyle(target, priorityColor) {
  return { color: target === 'existing' ? '#29496b' : priorityColor, weight: 2, opacity: .58 };
}

function getAlgorithmMapTitle(target) {
  return target === 'existing' ? 'Existing' : 'Enhanced';
}

function getAssignmentMapLegend(target) {
  const legend = target === 'existing' ? EXISTING_MAP_LEGEND : MAP_LEGEND;
  return legend;
}

function updateMapExpandButton(target, expanded) {
  document.querySelectorAll(`[data-map-toggle="${target}"]`).forEach(button => {
    button.textContent = expanded ? 'Exit Full Map' : 'Full Map';
    button.setAttribute('aria-expanded', String(expanded));
  });
}

function refreshAssignmentMapSize(target) {
  const map = window.assignmentMaps?.[target];
  if (!map) return;
  setTimeout(() => {
    scheduleMapInvalidate(map);
    positionHouseholdInfoCard(map);
  }, 0);
  setTimeout(() => {
    scheduleMapInvalidate(map);
    positionHouseholdInfoCard(map);
  }, 180);
}

function setAssignmentMapExpanded(target, expanded) {
  const panel = $(`#${target}-assignment-map-panel`);
  if (!panel) return;
  if (expanded && window.expandedAssignmentMap && window.expandedAssignmentMap !== target) {
    setAssignmentMapExpanded(window.expandedAssignmentMap, false);
  }
  panel.classList.toggle('is-expanded', expanded);
  window.expandedAssignmentMap = expanded ? target : null;
  document.body.classList.toggle('assignment-map-expanded', Boolean(window.expandedAssignmentMap));
  updateMapExpandButton(target, expanded);
  const map = window.assignmentMaps?.[target];
  if (map) hideHouseholdInfoCard(map, true);
  refreshAssignmentMapSize(target);
}

function toggleAssignmentMapExpanded(target) {
  const panel = $(`#${target}-assignment-map-panel`);
  setAssignmentMapExpanded(target, !panel?.classList.contains('is-expanded'));
}

function bindAssignmentMapPanelControls(target) {
  const button = document.querySelector(`[data-map-toggle="${target}"]`);
  if (!button) return;
  button.onclick = () => toggleAssignmentMapExpanded(target);
  updateMapExpandButton(target, window.expandedAssignmentMap === target);
}

function ensureHouseholdInfoCard(map) {
  if (map._householdInfo) return map._householdInfo;
  const card = L.DomUtil.create('div', 'household-info-card', map.getContainer());
  card.setAttribute('aria-hidden', 'true');
  const interaction = { card, marker: null, pinned: false, hideTimer: null };
  L.DomEvent.disableClickPropagation(card);
  L.DomEvent.disableScrollPropagation(card);
  card.addEventListener('mouseenter', () => clearTimeout(interaction.hideTimer));
  card.addEventListener('mouseleave', () => {
    if (!interaction.pinned) scheduleHouseholdInfoHide(map);
  });
  document.addEventListener('pointerdown', event => {
    if (!interaction.pinned || card.contains(event.target) || map.getContainer().contains(event.target)) return;
    hideHouseholdInfoCard(map, true);
  }, true);
  map.on('click', () => hideHouseholdInfoCard(map, true));
  map.on('move zoom resize', () => positionHouseholdInfoCard(map));
  map._householdInfo = interaction;
  return interaction;
}

function positionHouseholdInfoCard(map) {
  const interaction = map._householdInfo;
  if (!interaction?.marker || !interaction.card.classList.contains('is-visible')) return;
  const { card, marker } = interaction;
  const container = map.getContainer();
  const point = map.latLngToContainerPoint(marker.getLatLng());
  const padding = 12;
  const gap = 16;
  const width = card.offsetWidth;
  const height = card.offsetHeight;
  let placement = 'right';
  let left = point.x + gap;
  let top = point.y - height / 2;

  if (left + width + padding > container.clientWidth) {
    placement = 'left';
    left = point.x - width - gap;
  }
  left = Math.max(padding, Math.min(container.clientWidth - width - padding, left));
  top = Math.max(padding, Math.min(container.clientHeight - height - padding, top));

  card.classList.toggle('placement-left', placement === 'left');
  card.classList.toggle('placement-right', placement === 'right');
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
  card.style.setProperty('--arrow-top', `${Math.max(18, Math.min(height - 18, point.y - top))}px`);
}

function emphasizeHouseholdMarker(marker) {
  if (!marker || marker._householdEmphasized) return;
  marker._householdEmphasized = true;
  const base = marker._householdBaseStyle || { radius: 7, weight: 2, fillOpacity: .95 };
  if (marker.setRadius) marker.setRadius((base.radius || 7) + 3);
  marker.setStyle({ weight: (base.weight || 2) + 1, fillOpacity: Math.min(1, (base.fillOpacity || .95) + .28), opacity: 1 });
  if (marker.bringToFront) marker.bringToFront();
}

function resetHouseholdMarker(marker) {
  if (!marker || !marker._householdEmphasized) return;
  marker._householdEmphasized = false;
  const base = marker._householdBaseStyle || { radius: 7, weight: 2, fillOpacity: .95 };
  if (marker.setRadius) marker.setRadius(base.radius);
  marker.setStyle(base);
}

function showHouseholdInfoCard(map, marker, item, target, hubDistance, pinned = false) {
  const interaction = ensureHouseholdInfoCard(map);
  clearTimeout(interaction.hideTimer);
  if (interaction.marker && interaction.marker !== marker) resetHouseholdMarker(interaction.marker);
  interaction.marker = marker;
  interaction.pinned = pinned;
  interaction.card.innerHTML = buildHouseholdInfoHtml(item, target, hubDistance);
  interaction.card.classList.toggle('is-pinned', pinned);
  interaction.card.classList.add('is-visible');
  interaction.card.setAttribute('aria-hidden', 'false');
  emphasizeHouseholdMarker(marker);
  positionHouseholdInfoCard(map);
}

function hideHouseholdInfoCard(map, force = false) {
  const interaction = map._householdInfo;
  if (!interaction || (interaction.pinned && !force)) return;
  clearTimeout(interaction.hideTimer);
  resetHouseholdMarker(interaction.marker);
  interaction.marker = null;
  interaction.pinned = false;
  interaction.card.classList.remove('is-visible', 'is-pinned');
  interaction.card.setAttribute('aria-hidden', 'true');
}

function scheduleHouseholdInfoHide(map) {
  const interaction = map._householdInfo;
  if (!interaction || interaction.pinned) return;
  clearTimeout(interaction.hideTimer);
  interaction.hideTimer = setTimeout(() => hideHouseholdInfoCard(map), 110);
}

function bindHouseholdMarker(map, marker, item, target, hubDistance, baseStyle) {
  marker._householdBaseStyle = baseStyle;
  marker.on('mouseover', () => {
    if (map._householdInfo?.pinned) return;
    showHouseholdInfoCard(map, marker, item, target, hubDistance);
  });
  marker.on('mouseout', () => scheduleHouseholdInfoHide(map));
  marker.on('click', event => {
    if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
    showHouseholdInfoCard(map, marker, item, target, hubDistance, true);
  });
}

function renderAssignmentMap(result) {
  if (typeof L === 'undefined') return;
  const target = result.mode === 'existing' ? 'existing' : 'enhanced';
  const view = $(`#view-${target}`);
  let panel = $(`#${target}-assignment-map-panel`);
  if (!panel) {
    panel = document.createElement('section');
    panel.id = `${target}-assignment-map-panel`;
    panel.className = 'panel assignment-map-panel';
    panel.innerHTML = `<div class="panel-head"><div><p class="eyebrow">Allocation view · Barangay 160</p><h3>${getAlgorithmMapTitle(target)} household assignments</h3></div><div class="map-head-actions"><div class="map-legend" aria-label="${target === 'existing' ? 'Distance-only assignment legend' : 'Household urgency legend'}">${getAssignmentMapLegend(target)}</div><button class="small-button map-expand-button" type="button" data-map-toggle="${target}" aria-expanded="false" aria-controls="${target}-assignment-map">Full Map</button></div></div><div id="${target}-assignment-map" class="relief-map"></div><div class="map-foot"><span>Lines visualize assignments only; they are not delivery routes.</span><strong id="${target}-assignment-map-count">0 assignments</strong></div></div>`;
    view.appendChild(panel);
  }
  if (!panel.querySelector('.map-details')) {
    const details = document.createElement('details');
    details.className = 'map-details';
    const summary = document.createElement('summary');
    summary.textContent = 'View Assignment Map';
    details.appendChild(summary);
    while (panel.firstChild) details.appendChild(panel.firstChild);
    panel.appendChild(details);
  }
  const details = panel.querySelector('.map-details');
  if (details && !details.dataset.bound) {
    details.dataset.bound = 'true';
    details.addEventListener('toggle', () => {
      if (details.open) setTimeout(() => refreshAssignmentMapSize(target), 0);
    });
  }
  bindAssignmentMapPanelControls(target);
  if (!window.assignmentMaps) window.assignmentMaps = {};
  if (!window.assignmentMaps[target]) {
    window.assignmentMaps[target] = createReliefMap(`${target}-assignment-map`);
  }
  const map = window.assignmentMaps[target];
  hideHouseholdInfoCard(map, true);
  if (!window.assignmentMapLayers) window.assignmentMapLayers = {};
  if (window.assignmentMapLayers[target]) window.assignmentMapLayers[target].forEach(layer => layer.remove());
  window.assignmentMapLayers[target] = [];
  const hub = RELIEF_HUB.coordinates;
  window.assignmentMapLayers[target].push(addHubMarker(map));
  const boundaryLayer = addResearchBoundaryLayer(map);
  if (boundaryLayer) window.assignmentMapLayers[target].push(boundaryLayer);
  const bounds = [hub];
  const mapItems = getAssignmentMapItems(result);
  const mappedItems = [];
  const duplicateTracker = new Map();
  let routeCount = 0;
  mapItems.forEach(item => {
    const lat = Number(item.household.latitude);
    const lon = Number(item.household.longitude);
    if (!hasValidCoordinates(item.household)) return;
    const point = [lat, lon];
    const markerPoint = getVisualMarkerPoint(item.household, duplicateTracker);
    const { color } = getUrgencyMeta(item.household.urgency);
    const assignedResource = typeof item.resourceIndex === 'number' ? result.activeResources?.[item.resourceIndex] : null;
    const resourcePoint = hasValidCoordinates(assignedResource) ? [Number(assignedResource.latitude), Number(assignedResource.longitude)] : hub;
    const hubDistance = geoDistanceKm(resourcePoint, point).toFixed(2);
    if (item.assigned) {
      window.assignmentMapLayers[target].push(L.polyline([hub, markerPoint], getAssignmentLineStyle(target, color)).addTo(map));
      routeCount += 1;
    }
    const markerStyle = getHouseholdMarkerStyle(item, target, color);
    const marker = L.circleMarker(markerPoint, markerStyle).addTo(map);
    bindHouseholdMarker(map, marker, item, target, hubDistance, markerStyle);
    window.assignmentMapLayers[target].push(marker);
    if (item.assigned && hasValidCoordinates(assignedResource)) bounds.push(resourcePoint);
    bounds.push(markerPoint);
    mappedItems.push(item);
  });
  const verifiedCount = state.dataset.filter(isVerified).length;
  const mappedNote = mappedItems.length === state.dataset.length ? '' : ` · ${mappedItems.length} mapped`;
  $(`#${target}-assignment-map-count`).textContent = `${state.dataset.length} households · ${verifiedCount} verified · ${routeCount} assigned${mappedNote}`;
  const runScopeNote = result.records !== state.dataset.length ? ` in ${result.matrixSize}` : '';
  $(`#${target}-assignment-map-count`).textContent = `${state.dataset.length} households - ${verifiedCount} verified - ${routeCount}/${result.records} assigned${runScopeNote}${mappedNote}`;
  logAllocationDiagnostics(`${target} assignment map render`, result, mappedItems);
  safeFitMapBounds(map, bounds);
}

function refreshVisibleAssignmentMaps() {
  if (!window.assignmentMaps) return;
  Object.values(window.assignmentMaps).forEach(map => {
    scheduleMapInvalidate(map);
    positionHouseholdInfoCard(map);
  });
}

function refreshVisibleComparisonMaps() {
  if (!window.comparisonMaps) return;
  Object.values(window.comparisonMaps).forEach(map => {
    scheduleMapInvalidate(map);
    positionHouseholdInfoCard(map);
  });
}

function refreshAllLeafletMaps() {
  if (window.reliefMap) scheduleMapInvalidate(window.reliefMap);
  refreshVisibleAssignmentMaps();
  refreshVisibleComparisonMaps();
}

const renderResultWithMap = renderResult;
renderResult = function (result) { renderResultWithMap(result); renderAssignmentMap(result); };
const goWithMapRefresh = go;
go = function (page) {
  if (window.expandedAssignmentMap && window.expandedAssignmentMap !== page) setAssignmentMapExpanded(window.expandedAssignmentMap, false);
  goWithMapRefresh(page);
  if (page === 'compare') renderComparisonMaps();
  setTimeout(refreshAllLeafletMaps, 0);
  setTimeout(refreshAllLeafletMaps, 180);
};
window.addEventListener('resize', () => {
  refreshAllLeafletMaps();
  if (window.expandedAssignmentMap) refreshAssignmentMapSize(window.expandedAssignmentMap);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && window.expandedAssignmentMap) setAssignmentMapExpanded(window.expandedAssignmentMap, false);
});

function renderComparisonMaps() {
  if (typeof L === 'undefined') return;
  let panel = $('#comparison-map-panel');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'comparison-map-panel';
    panel.className = 'panel comparison-map-panel';
    panel.innerHTML = `<div class="panel-head"><div><p class="eyebrow">Geographic comparison</p><h3>Standard distance baseline vs enhanced weighted model</h3></div></div><div class="comparison-map-grid"><div><div class="comparison-map-head"><h4>Standard Hungarian · distance only</h4><div class="map-legend" aria-label="Standard distance-only legend">${EXISTING_MAP_LEGEND}</div></div><div id="compare-existing-map" class="relief-map"></div></div><div><div class="comparison-map-head"><h4>Enhanced Hungarian · distance + urgency + compatibility</h4><div class="map-legend" aria-label="Enhanced priority legend">${MAP_LEGEND}</div></div><div id="compare-enhanced-map" class="relief-map"></div></div></div><div class="map-foot"><span>Click a household marker to inspect its assignment. Lines start from the Barangay hub; they are not routes.</span><strong>Same Barangay 160 research area</strong></div>`;
    $('#view-compare').appendChild(panel);
  }
  if (!panel.querySelector('.map-details')) {
    const details = document.createElement('details');
    details.className = 'map-details';
    const summary = document.createElement('summary');
    summary.textContent = 'View Geographic Comparison Map';
    details.appendChild(summary);
    while (panel.firstChild) details.appendChild(panel.firstChild);
    panel.appendChild(details);
  }
  const details = panel.querySelector('.map-details');
  if (details && !details.dataset.bound) {
    details.dataset.bound = 'true';
    details.addEventListener('toggle', () => {
      if (details.open) setTimeout(refreshVisibleComparisonMaps, 0);
    });
  }
  ['existing', 'enhanced'].forEach(target => renderComparisonMap(state.results[target] || null, target));
}

function setComparisonMapSummary(map, text) {
  if (map._comparisonSummaryControl) {
    map.removeControl(map._comparisonSummaryControl);
  }
  map._comparisonSummaryControl = L.control({ position: 'bottomleft' });
  map._comparisonSummaryControl.onAdd = () => {
    const element = L.DomUtil.create('div', 'map-run-summary');
    element.textContent = text;
    return element;
  };
  map._comparisonSummaryControl.addTo(map);
}

function renderComparisonMap(result, target) {
  if (!window.comparisonMaps) window.comparisonMaps = {};
  if (!window.comparisonMaps[target]) {
    window.comparisonMaps[target] = createReliefMap(`compare-${target}-map`);
  }
  const map = window.comparisonMaps[target];
  if (!window.comparisonMapLayers) window.comparisonMapLayers = {};
  if (window.comparisonMapLayers[target]) window.comparisonMapLayers[target].forEach(layer => layer.remove());
  window.comparisonMapLayers[target] = [];
  const hub = RELIEF_HUB.coordinates;
  const bounds = [hub];
  window.comparisonMapLayers[target].push(addHubMarker(map, 'Relief hub'));
  const boundaryLayer = addResearchBoundaryLayer(map);
  if (boundaryLayer) window.comparisonMapLayers[target].push(boundaryLayer);
  hideHouseholdInfoCard(map, true);
  const mapItems = result
    ? result.output.map(item => ({ ...item, assigned: true, assignmentStatus: item.assignmentStatus || 'Assigned' }))
    : state.dataset.map(household => ({ household, assigned: false, assignmentStatus: 'Not yet assigned' }));
  const duplicateTracker = new Map();
  let mappedCount = 0;
  let assignedCount = 0;
  mapItems.forEach(item => {
    const lat = Number(item.household.latitude);
    const lon = Number(item.household.longitude);
    if (!hasValidCoordinates(item.household)) return;
    const point = [lat, lon];
    const markerPoint = getVisualMarkerPoint(item.household, duplicateTracker);
    const { color } = getUrgencyMeta(item.household.urgency);
    const assignedResource = typeof item.resourceIndex === 'number' ? result?.activeResources?.[item.resourceIndex] : null;
    const resourcePoint = hasValidCoordinates(assignedResource) ? [Number(assignedResource.latitude), Number(assignedResource.longitude)] : hub;
    const hubDistance = geoDistanceKm(resourcePoint, point).toFixed(2);
    if (item.assigned) {
      window.comparisonMapLayers[target].push(L.polyline([hub, markerPoint], getAssignmentLineStyle(target, color)).addTo(map));
      assignedCount += 1;
    }
    const markerStyle = getHouseholdMarkerStyle(item, target, color);
    const marker = L.circleMarker(markerPoint, markerStyle).addTo(map);
    bindHouseholdMarker(map, marker, item, target, hubDistance, markerStyle);
    window.comparisonMapLayers[target].push(marker);
    if (item.assigned && hasValidCoordinates(assignedResource)) bounds.push(resourcePoint);
    bounds.push(markerPoint);
    mappedCount += 1;
  });
  const runSize = result ? result.matrixSize : 'not run';
  const assignedTotal = result ? result.records : 0;
  setComparisonMapSummary(map, `${mappedCount} points - ${assignedCount}/${assignedTotal} assigned - ${runSize}`);
  safeFitMapBounds(map, bounds, { padding: [36, 36] });
}

const compareWithMap = compare;
compare = function () {
  const result = compareWithMap();
  if (result) {
    renderComparisonMaps();
    setTimeout(refreshAllLeafletMaps, 0);
  }
  return result;
};
initializeApp();
