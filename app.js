const resources = ['Relief-01', 'Relief-02', 'Relief-03', 'Relief-04', 'Relief-05', 'Relief-06', 'Relief-07', 'Relief-08'];
const resourceTypes = ['Water', 'Food', 'Medical', 'Shelter'];
function deriveAHPWeights() { const matrix = [[1, 1 / 3, 1 / 2], [3, 1, 2], [2, 1 / 2, 1]]; const geometricMeans = matrix.map(row => Math.pow(row.reduce((product, value) => product * value, 1), 1 / row.length)); const total = geometricMeans.reduce((sum, value) => sum + value, 0); return { distance: geometricMeans[0] / total, urgency: geometricMeans[1] / total, compatibility: geometricMeans[2] / total }; }
const DEBUG_ALGORITHM_DIAGNOSTICS = false;
const GEOCODE_CACHE_KEY = 'allocation-geocode-cache-v1';
const RESEARCH_CONFIG = {
  areaName: 'Barangay 160',
  geocodingContext: 'Tondo, Manila, Metro Manila, Philippines',
  hub: {
    name: 'Barangay 160, Tondo, Manila',
    address: 'Barangay 160 Barangay Hall, Tondo, Manila, Metro Manila, Philippines',
    coordinates: [14.6207513, 120.97349635],
    bounds: [[14.6200279, 120.9729135], [14.6214747, 120.9740792]]
  },
  geocoding: {
    provider: 'Nominatim',
    endpoint: 'https://nominatim.openstreetmap.org/search',
    requestDelayMs: 1100
  }
};
const state = { rawRows: [], rawHeaders: [], columnMapping: {}, mappingIssues: [], dataset: [], researchDataset: [], invalidRows: [], validation: null, filename: '', latest: null, results: {}, history: JSON.parse(localStorage.getItem('allocation-history') || '[]'), weights: deriveAHPWeights(), geocodeCache: JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || '{}'), processing: false };
const RELIEF_HUB = { name: RESEARCH_CONFIG.hub.name, address: RESEARCH_CONFIG.hub.address, coordinates: [...RESEARCH_CONFIG.hub.coordinates], bounds: RESEARCH_CONFIG.hub.bounds };
const MAP_ZOOM = 17;
const MAP_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_ATTRIBUTION = '&copy; OpenStreetMap contributors';
let hubIcon;
function createReliefMap(elementId) {
  const map = L.map(elementId, {
    center: RELIEF_HUB.coordinates,
    zoom: MAP_ZOOM,
    zoomControl: false,
    scrollWheelZoom: false,
    maxBounds: RELIEF_HUB.bounds || undefined,
    maxBoundsViscosity: 1,
    preferCanvas: true
  });
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer(MAP_TILES, { attribution: MAP_ATTRIBUTION, maxZoom: 20 }).addTo(map);
  return map;
}
function addHubMarker(map, popupTitle = 'Relief distribution hub') {
  if (!hubIcon) hubIcon = L.divIcon({
    className: 'hub-marker-wrap',
    html: '<span class="hub-marker"><span></span></span>',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -18]
  });
  return L.marker(RELIEF_HUB.coordinates, { icon: hubIcon, keyboard: true, title: RELIEF_HUB.name })
    .addTo(map)
    .bindPopup(`<strong>${popupTitle}</strong><br>${RELIEF_HUB.name}`);
}
function getUrgencyMeta(value) {
  const urgency = Number(value) || 0;
  if (urgency >= 7) return { urgency, color: '#b55454', label: 'Immediate' };
  if (urgency >= 4) return { urgency, color: '#c58a45', label: 'Priority' };
  return { urgency, color: '#59799d', label: 'Routine' };
}
const MAP_LEGEND = '<span class="map-legend-item"><i class="hub-dot"></i>Hub</span><span class="map-legend-item"><i class="immediate-dot"></i>Immediate (7–10)</span><span class="map-legend-item"><i class="priority-dot"></i>Priority (4–6)</span><span class="map-legend-item"><i class="routine-dot"></i>Routine (0–3)</span>';
const EXISTING_MAP_LEGEND = '<span class="map-legend-item"><i class="hub-dot"></i>Distribution Hub</span><span class="map-legend-item"><i class="household-dot"></i>Household</span><span class="map-legend-item"><i class="assignment-line"></i>Distance-based assignment</span><span class="map-legend-item"><i class="unassigned-dot"></i>Unassigned Household</span><span class="map-legend-item"><i class="pending-dot"></i>Pending Verification</span>';
function isInsideResearchArea(lat, lon) {
  if (!RELIEF_HUB.bounds) return true;
  return lat >= RELIEF_HUB.bounds[0][0] && lat <= RELIEF_HUB.bounds[1][0] && lon >= RELIEF_HUB.bounds[0][1] && lon <= RELIEF_HUB.bounds[1][1];
}
function isVerified(row) { return String(row.verification_status || row.verification || '').trim().toLowerCase() === 'verified'; }
function resourceType(index) { return resourceTypes[index % resourceTypes.length]; }
function isCompatible(row, resourceIndex) { return String(row.compatible_resource || '').trim().toLowerCase() === resourceType(resourceIndex).toLowerCase(); }
const $ = selector => document.querySelector(selector);
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2200); }
function go(page) { document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === `view-${page}`)); document.querySelectorAll('.nav-item[data-page]').forEach(item => item.classList.toggle('active', item.dataset.page === page)); const labels = { dashboard: 'Dashboard', dataset: 'Dataset', existing: 'Existing algorithm', enhanced: 'Enhanced algorithm', compare: 'Compare', history: 'Run history', settings: 'Settings' }; $('#page-title').textContent = labels[page]; $('#header-title').textContent = page === 'dashboard' ? 'Algorithm workspace' : labels[page]; window.scrollTo(0, 0); }
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

async function loadFile(file) {
  if (!file) return;
  if (file.name.toLowerCase().endsWith('.xlsx')) {
    toast('XLSX connector is reserved for the finalized dataset');
    return;
  }
  const reader = new FileReader();
  reader.onload = async event => {
    try {
      const { headers, rows } = parseCsvDocument(event.target.result);
      if (!rows.length) throw new Error('empty');
      state.rawRows = rows;
      state.rawHeaders = headers;
      state.columnMapping = inferColumnMapping(headers);
      state.mappingIssues = getMappingIssues(state.columnMapping);
      state.dataset = rows;
      state.researchDataset = [];
      state.invalidRows = [];
      state.validation = null;
      state.results = {};
      state.latest = null;
      state.filename = file.name;
      logAllocationDiagnostics(`CSV upload: ${file.name}`);
      renderDataset();
      if (state.mappingIssues.some(issue => issue.level === 'error')) {
        go('dataset');
        toast('Review column mapping before validation');
      } else {
        await validateAndPrepareDataset({ autoRun: true });
      }
    } catch (error) {
      toast('Could not parse this CSV');
    }
  };
  reader.readAsText(file);
}
function renderDataset() {
  const rows = state.dataset;
  const keys = getDatasetTableKeys(rows);
  const validation = state.validation;
  $('#top-dataset').textContent = rows.length ? state.filename : 'No dataset loaded';
  $('#stat-status').textContent = state.processing ? 'Processing' : rows.length ? validation ? 'Ready' : 'Mapping' : 'Waiting';
  $('#stat-file').textContent = rows.length ? validation ? `${validation.eligibleHouseholds} eligible verified households` : 'Review and validate dataset' : 'Upload a verified household CSV';
  $('#stat-records').textContent = rows.length;
  $('#data-name').textContent = state.filename || '—';
  $('#data-rows').textContent = rows.length;
  $('#data-cols').textContent = state.rawHeaders.length || keys.length;
  $('#data-missing').textContent = validation ? validation.invalidRows : rows.reduce((sum, row) => sum + keys.filter(key => !row[key]).length, 0);
  $('#data-head').innerHTML = keys.map(key => `<th>${formatFieldLabel(key)}</th>`).join('');
  renderColumnMappingPanel();
  renderValidationSummary();
  renderTable();
  ['#existing-input', '#enhanced-input'].forEach(selector => { if ($(selector)) $(selector).textContent = rows.length ? `${rows.length} records` : 'No dataset'; });
}
function renderTable() {
  const query = ($('#table-search')?.value || '').toLowerCase();
  const rows = state.dataset.filter(row => JSON.stringify(getSearchableRow(row)).toLowerCase().includes(query));
  const keys = getDatasetTableKeys(state.dataset);
  $('#data-body').innerHTML = rows.slice(0, 50).map(row => `<tr>${keys.map(key => `<td class="${getCellClass(key, row[key])}">${escapeHtml(formatCellValue(row[key]))}</td>`).join('')}</tr>`).join('');
  $('#table-count').textContent = `${rows.length} of ${state.dataset.length} records`;
}
function distance(row) {
  if (!hasValidCoordinates(row)) return Number.POSITIVE_INFINITY;
  return geoDistanceKm(RELIEF_HUB.coordinates, [Number(row.latitude), Number(row.longitude)]);
}
function hungarian(matrix) { const n = matrix.length, m = matrix[0].length, u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0); for (let i = 1; i <= n; i++) { p[0] = i; let j0 = 0; const minv = Array(m + 1).fill(Infinity), used = Array(m + 1).fill(false); do { used[j0] = true; const i0 = p[j0]; let delta = Infinity, j1 = 0; for (let j = 1; j <= m; j++) if (!used[j]) { const cur = matrix[i0 - 1][j - 1] - u[i0] - v[j]; if (cur < minv[j]) { minv[j] = cur; way[j] = j0; } if (minv[j] < delta) { delta = minv[j]; j1 = j; } } for (let j = 0; j <= m; j++) { if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; } j0 = j1; } while (p[j0] !== 0); do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0 !== 0); } const result = Array(n); for (let j = 1; j <= m; j++) result[p[j] - 1] = j - 1; return result; }
function normalize(values) { const min = Math.min(...values), max = Math.max(...values); return max === min ? values.map(() => 0) : values.map(value => (value - min) / (max - min)); }
function getActiveResources(rows) {
  return resources.slice(0, Math.min(resources.length, rows.length));
}

function buildDistanceMatrix(rows, activeResources) {
  return activeResources.map((_, resourceIndex) => rows.map(row => distance(row, resourceIndex)));
}

function buildExistingCostMatrix(rows, activeResources) {
  // Standard Hungarian baseline: distance is the only optimization criterion.
  // Equal-distance ties follow stable resource/household input order; no urgency,
  // priority, vulnerability, or compatibility fields are inspected here.
  return { matrix: buildDistanceMatrix(rows, activeResources), components: null };
}

function buildEnhancedCostMatrix(rows, activeResources) {
  const distances = buildDistanceMatrix(rows, activeResources);
  const urgency = activeResources.map(() => rows.map(row => 10 - Number(row.urgency || 0)));
  const compatibility = activeResources.map((_, resourceIndex) => rows.map(row => isCompatible(row, resourceIndex) ? 0 : 1));
  const flatDistance = normalize(distances.flat());
  const flatUrgency = normalize(urgency.flat());
  const flatCompatibility = normalize(compatibility.flat());
  const components = activeResources.map((_, resourceIndex) => rows.map((__, householdIndex) => {
    const index = resourceIndex * rows.length + householdIndex;
    const distanceComponent = flatDistance[index] * state.weights.distance;
    const urgencyComponent = flatUrgency[index] * state.weights.urgency;
    const compatibilityComponent = flatCompatibility[index] * state.weights.compatibility;
    return { distanceComponent, urgencyComponent, compatibilityComponent };
  }));
  return {
    matrix: components.map(row => row.map(item => item.distanceComponent + item.urgencyComponent + item.compatibilityComponent)),
    components
  };
}

function makeMatrix(mode) {
  const rows = state.researchDataset;
  const activeResources = getActiveResources(rows);
  return mode === 'existing'
    ? { ...buildExistingCostMatrix(rows, activeResources), activeResources }
    : { ...buildEnhancedCostMatrix(rows, activeResources), activeResources };
}

function logAlgorithmCriteriaDiagnostics(mode, matrix, activeResourceCount) {
  if (!DEBUG_ALGORITHM_DIAGNOSTICS || typeof console === 'undefined') return;
  const existing = mode === 'existing';
  console.groupCollapsed(`=== ${existing ? 'EXISTING' : 'ENHANCED'} ALGORITHM ===`);
  console.log(`Criterion: ${existing ? 'DISTANCE ONLY' : 'DISTANCE + URGENCY + COMPATIBILITY'}`);
  console.log(`Households: ${state.researchDataset.length}`);
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
    go('dataset');
    return null;
  }
  const started = performance.now();
  const { matrix, components, activeResources } = makeMatrix(mode);
  logAlgorithmCriteriaDiagnostics(mode, matrix, activeResources.length);
  const assignment = hungarian(matrix);
  const output = assignment.map((householdIndex, resourceIndex) => ({
    resource: `${resources[resourceIndex]} (${resourceType(resourceIndex)})`,
    resourceIndex,
    household: state.researchDataset[householdIndex],
    value: matrix[resourceIndex][householdIndex],
    distanceKm: distance(state.researchDataset[householdIndex]),
    components: components?.[resourceIndex]?.[householdIndex] || null
  }));
  const cost = output.reduce((sum, item) => sum + item.value, 0);
  const totalDistance = output.reduce((sum, item) => sum + item.distanceKm, 0);
  const compatible = output.filter(item => isCompatible(item.household, item.resourceIndex)).length;
  const urgent = output.filter(item => Number(item.household.urgency) >= 7);
  const priorityMatches = urgent.filter(item => isCompatible(item.household, item.resourceIndex)).length;
  const accuracy = output.length ? compatible / output.length : 0;
  const prioritization = urgent.length ? priorityMatches / urgent.length : 0;
  const meanDistance = output.length ? totalDistance / output.length : 0;
  const maxDistance = output.length ? Math.max(...output.map(item => item.distanceKm)) : 0;
  const result = { mode, output, cost, totalDistance, meanDistance, maxDistance, priorityMatches, accuracy, prioritization, duration: Math.max(.3, performance.now() - started).toFixed(2), dataset: state.filename, records: state.researchDataset.length };
  state.latest = result;
  state.results[mode] = result;
  state.history.unshift({ id: `RUN-${String(Date.now()).slice(-5)}`, mode, dataset: state.filename, records: state.researchDataset.length, duration: result.duration, timestamp: new Date().toLocaleString() });
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
    $(metrics).innerHTML = `<div><span>Total weighted cost</span><strong>${result.cost.toFixed(2)}</strong></div><div><span>Total assignment distance</span><strong>${result.totalDistance.toFixed(2)} km</strong></div><div><span>Mean allocation accuracy</span><strong>${(result.accuracy * 100).toFixed(1)}%</strong></div><div><span>Prioritization efficiency</span><strong>${(result.prioritization * 100).toFixed(1)}%</strong></div><div><span>Execution time</span><strong>${result.duration} ms</strong></div>`;
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
    go('dataset');
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
function bind() { document.querySelectorAll('[data-page]').forEach(item => item.addEventListener('click', event => { event.preventDefault(); go(item.dataset.page); })); document.querySelectorAll('[data-page-target]').forEach(item => item.addEventListener('click', () => go(item.dataset.pageTarget))); document.querySelectorAll('[data-run]').forEach(item => item.addEventListener('click', () => { if (item.dataset.run === 'both') { compare(); go('compare'); } else { execute(item.dataset.run); go(item.dataset.run); } })); $('#file-input').addEventListener('change', event => loadFile(event.target.files[0])); $('#table-search').addEventListener('input', renderTable); $('#clear-history').addEventListener('click', () => { state.history = []; localStorage.removeItem('allocation-history'); renderHistory(); toast('History cleared'); }); }
function initializeApp() {
  bind();
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
  $('.threshold strong').textContent = 'Δ ≥ 2';
  $('#settings-hub-address').textContent = RELIEF_HUB.address;
  $('#settings-geocoding-context').textContent = RESEARCH_CONFIG.geocodingContext;
  go(location.hash.slice(1) || 'dashboard');
}

function renderReliefMap() {
  if (typeof L === 'undefined') return;
  let panel = $('#relief-map-panel');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'relief-map-panel';
    panel.className = 'panel map-panel';
    panel.innerHTML = `<div class="panel-head"><div><p class="eyebrow">Research area</p><h3>${RELIEF_HUB.name} household locations</h3></div><div class="map-legend" aria-label="Household urgency legend">${MAP_LEGEND}</div></div><div id="relief-map" class="relief-map"></div><div class="map-foot"><span>Resolved household locations inside the configured research boundary are shown.</span><strong id="map-count">0 households mapped</strong></div>`;
    $('#view-dashboard').appendChild(panel);
  }
  if (!window.reliefMap) {
    window.reliefMap = createReliefMap('relief-map');
  }
  if (window.reliefLayers) window.reliefLayers.forEach(layer => layer.remove());
  window.reliefLayers = [];
  const hub = RELIEF_HUB.coordinates;
  window.reliefLayers.push(addHubMarker(window.reliefMap));
  const mapped = [];
  state.dataset.forEach(row => {
    const lat = Number(row.latitude);
    const lon = Number(row.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !isInsideResearchArea(lat, lon)) return;
    const point = [lat, lon];
    const { urgency, color, label } = getUrgencyMeta(row.urgency);
    const markerStyle = isPending(row)
      ? { radius: 6, color, weight: 2, fillColor: '#fff', fillOpacity: .28, opacity: .72, dashArray: '3 3' }
      : { radius: 6, color: '#fff', weight: 2, fillColor: color, fillOpacity: .95 };
    window.reliefLayers.push(L.circleMarker(point, markerStyle).addTo(window.reliefMap).bindPopup(`<strong>${escapeHtml(row.household_id || 'Household')}</strong><br>Verification: ${escapeHtml(row.verification || 'Unknown')}<br>Urgency: ${urgency}/10<br>Location: ${escapeHtml(row.geocoding_status || 'Resolved')}`));
    mapped.push(point);
  });
  const eligible = state.validation ? state.researchDataset.length : 0;
  $('#map-count').textContent = `${state.dataset.length} households · ${mapped.length} mapped · ${eligible} eligible`;
  if (mapped.length) window.reliefMap.fitBounds([hub, ...mapped], { padding: [42, 42], maxZoom: MAP_ZOOM });
  else window.reliefMap.setView(hub, MAP_ZOOM, { animate: false });
  window.reliefMap.invalidateSize();
}

const renderDatasetWithMap = renderDataset;
renderDataset = function () { renderDatasetWithMap(); renderReliefMap(); };
setTimeout(renderReliefMap, 0);

function geoDistanceKm(from, to) {
  const radians = value => value * Math.PI / 180;
  const earthRadius = 6371;
  const latDelta = radians(to[0] - from[0]);
  const lonDelta = radians(to[1] - from[1]);
  const a = Math.sin(latDelta / 2) ** 2 + Math.cos(radians(from[0])) * Math.cos(radians(to[0])) * Math.sin(lonDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const HOUSEHOLD_FIELD_ALIASES = {
  id: ['household', 'household_id', 'household_number', 'household_no', 'house_no', 'hh_id', 'id'],
  head: ['household_head', 'household_head_name', 'head_name', 'representative_name', 'representative', 'respondent_name', 'name', 'contact_person'],
  directAddress: ['address', 'household_address', 'location', 'street_address', 'residence'],
  addressParts: ['house_number', 'house_no', 'block_lot', 'street', 'purok', 'sitio', 'zone', 'barangay'],
  latitude: ['latitude', 'lat', 'geocoded_latitude', 'derived_latitude'],
  longitude: ['longitude', 'lng', 'lon', 'long', 'geocoded_longitude', 'derived_longitude'],
  members: ['household_members', 'members', 'member_count', 'family_members', 'family_size', 'household_size', 'number_of_members', 'no_of_members', 'num_members'],
  urgency: ['urgency', 'urgency_score', 'priority_score'],
  verification: ['verification_status', 'verification', 'validated', 'validation_status', 'status'],
  compatibleResource: ['compatible_resource', 'preferred_resource', 'needed_resource', 'resource_need', 'resource_requirement', 'relief_need', 'primary_need', 'required_resource'],
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
  compatible_resource: 'Compatible Resource',
  compatibleresource: 'Compatible Resource',
  verificationstatus: 'Verification',
  pwd: 'PWD'
};
const VULNERABILITY_PATTERN = /senior|elderly|pwd|disab|pregnan|infant|child|children|solo.?parent|lactating|medical|vulnerab|special.?need|chronic/i;
const EXTRA_INFO_PATTERN = /contact|phone|mobile|evacuation|shelter|damage|risk|hazard|flood|note|remark|income|livelihood|barangay|zone|purok|sitio/i;
const NEGATIVE_FIELD_VALUES = /^(no|none|n\/a|na|false|0|not applicable)$/i;
const AFFIRMATIVE_FIELD_VALUES = /^(yes|true|1)$/i;
const NORMALIZED_TABLE_KEYS = ['household_id', 'address', 'urgency', 'compatible_resource', 'verification', 'geocoding_status', 'latitude', 'longitude', 'validation_status'];
const MAPPING_FIELDS = [
  { key: 'householdId', label: 'Household ID', aliases: HOUSEHOLD_FIELD_ALIASES.id, required: true },
  { key: 'address', label: 'Address', aliases: HOUSEHOLD_FIELD_ALIASES.directAddress, required: false },
  { key: 'urgency', label: 'Urgency', aliases: HOUSEHOLD_FIELD_ALIASES.urgency, required: true },
  { key: 'compatibleResource', label: 'Required Resource', aliases: HOUSEHOLD_FIELD_ALIASES.compatibleResource, required: true },
  { key: 'verification', label: 'Verification', aliases: HOUSEHOLD_FIELD_ALIASES.verification, required: true },
  { key: 'latitude', label: 'Latitude', aliases: HOUSEHOLD_FIELD_ALIASES.latitude, required: false },
  { key: 'longitude', label: 'Longitude', aliases: HOUSEHOLD_FIELD_ALIASES.longitude, required: false }
];

function getHeaderCandidates(headers, aliases) {
  const aliasSet = new Set(aliases.map(normalizeFieldName));
  return headers.filter(header => aliasSet.has(normalizeFieldName(header)));
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
    if (candidates.length > 1 && !mapping[field.key]) issues.push({ field: field.key, level: 'error', message: `${field.label} has multiple possible columns. Select the correct one.` });
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

function parseCoordinate(value) {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
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
  return 'Approximate';
}

async function geocodeAddress(address) {
  const query = normalizeAddressQuery(address);
  if (!query) return { status: 'Unresolved' };
  if (state.geocodeCache[query]) return { ...state.geocodeCache[query], cached: true };
  if (typeof fetch !== 'function') return { status: 'Unresolved', reason: 'Geocoding service unavailable' };
  await waitForGeocoderSlot();
  try {
    const params = new URLSearchParams({ format: 'jsonv2', q: query, limit: '1', addressdetails: '1' });
    const response = await fetch(`${RESEARCH_CONFIG.geocoding.endpoint}?${params.toString()}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('geocoder response failed');
    const results = await response.json();
    const match = Array.isArray(results) ? results[0] : null;
    const lat = parseCoordinate(match?.lat);
    const lon = parseCoordinate(match?.lon);
    const resolved = Number.isFinite(lat) && Number.isFinite(lon)
      ? { status: classifyGeocodeResult(match), latitude: lat, longitude: lon, displayName: match.display_name || '', provider: RESEARCH_CONFIG.geocoding.provider }
      : { status: 'Unresolved' };
    state.geocodeCache[query] = resolved;
    writeGeocodeCache();
    return resolved;
  } catch (error) {
    return { status: 'Unresolved', reason: 'Geocoding service unavailable' };
  }
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

function normalizeHouseholdRow(raw, index) {
  const householdId = getMappedValue(raw, 'householdId');
  const address = getAddressFromMappedColumns(raw);
  const urgency = parseUrgencyValue(getMappedValue(raw, 'urgency'));
  const verificationRaw = getMappedValue(raw, 'verification');
  const verification = normalizeVerificationValue(verificationRaw);
  const compatibleResource = normalizeResourceRequirement(getMappedValue(raw, 'compatibleResource'));
  const latitude = parseCoordinate(getMappedValue(raw, 'latitude'));
  const longitude = parseCoordinate(getMappedValue(raw, 'longitude'));
  const row = {
    ...raw,
    household_id: householdId,
    household: householdId,
    address,
    urgency: urgency ?? '',
    compatible_resource: compatibleResource,
    verification,
    verification_status: verification,
    latitude: Number.isFinite(latitude) ? latitude : '',
    longitude: Number.isFinite(longitude) ? longitude : '',
    geocoding_status: Number.isFinite(latitude) && Number.isFinite(longitude) ? 'Provided Coordinates' : 'Pending',
    geocoding_provider: Number.isFinite(latitude) && Number.isFinite(longitude) ? 'Uploaded dataset' : '',
    validation_status: 'Pending Validation',
    _original: { ...raw },
    _sourceRow: index + 2,
    _validationReasons: []
  };
  return row;
}

function addValidationReason(row, reason) {
  if (!row._validationReasons.includes(reason)) row._validationReasons.push(reason);
}

function validateHouseholdFields(row, duplicateIds) {
  if (!hasDisplayValue(row.household_id)) addValidationReason(row, 'Missing household ID');
  if (row.household_id && duplicateIds.has(row.household_id)) addValidationReason(row, 'Duplicate household ID');
  if (!hasDisplayValue(row.address) && !hasValidCoordinates(row)) addValidationReason(row, 'Missing address');
  if (parseUrgencyValue(row.urgency) === null) addValidationReason(row, 'Invalid urgency value');
  if (!hasDisplayValue(row.compatible_resource)) addValidationReason(row, 'Missing required resource');
  else if (!isKnownResourceRequirement(row.compatible_resource)) addValidationReason(row, 'Unknown required resource');
  if (!hasDisplayValue(row.verification_status)) addValidationReason(row, 'Missing verification status');
  else if (!['verified', 'pending', 'flagged', 'rejected'].includes(String(row.verification_status).toLowerCase())) addValidationReason(row, 'Unknown verification status');
}

async function resolveHouseholdLocation(row) {
  if (hasValidCoordinates(row)) return;
  if (!hasDisplayValue(row.address)) return;
  const result = await geocodeAddress(row.address);
  if (Number.isFinite(result.latitude) && Number.isFinite(result.longitude)) {
    row.latitude = result.latitude;
    row.longitude = result.longitude;
    row.geocoding_status = result.status || 'Resolved';
    row.geocoding_provider = result.provider || RESEARCH_CONFIG.geocoding.provider;
  } else {
    row.geocoding_status = result.reason || 'Unresolved';
    addValidationReason(row, result.reason || 'Address could not be geocoded');
  }
}

function finalizeGeographyValidation(row) {
  if (!hasValidCoordinates(row)) {
    if (!row._validationReasons.some(reason => reason.includes('geocoded'))) addValidationReason(row, 'Address could not be geocoded');
    row.validation_status = 'Invalid';
    return;
  }
  row.distance_km = geoDistanceKm(RELIEF_HUB.coordinates, [Number(row.latitude), Number(row.longitude)]).toFixed(4);
  if (!isInsideResearchAreaRow(row)) addValidationReason(row, 'Outside configured research area');
  row.validation_status = row._validationReasons.length ? 'Invalid' : isPending(row) ? 'Pending Verification' : 'Valid';
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
  return {
    totalRows: rows.length,
    validHouseholds: validRows.length,
    eligibleHouseholds: rows.filter(row => !row._validationReasons.length && isVerified(row)).length,
    pendingVerification: rows.filter(row => !row._validationReasons.length && isPending(row)).length,
    invalidRows: rows.filter(row => row._validationReasons.length).length,
    addressesResolved: resolvedRows.length,
    addressesUnresolved: rows.length - resolvedRows.length,
    insideResearchArea: resolvedRows.filter(isInsideResearchAreaRow).length
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
  for (let index = 0; index < normalizedRows.length; index++) {
    const row = normalizedRows[index];
    await resolveHouseholdLocation(row);
    finalizeGeographyValidation(row);
    setValidationProgress(`Processing dataset... ${index + 1} / ${normalizedRows.length} locations checked`);
  }
  state.dataset = normalizedRows;
  state.invalidRows = normalizedRows.filter(row => row._validationReasons.length);
  state.researchDataset = normalizedRows.filter(row => !row._validationReasons.length && isVerified(row) && hasValidCoordinates(row) && isInsideResearchAreaRow(row));
  state.validation = computeValidationSummary(normalizedRows);
  state.results = {};
  state.latest = null;
  state.processing = false;
  renderDataset();
  logAllocationDiagnostics(`Dataset validation: ${state.filename}`);
  if (autoRun && state.researchDataset.length && !getRunBlockers('enhanced').length) {
    compare();
    go('compare');
    toast(`${state.validation.eligibleHouseholds} verified households validated and compared`);
  } else {
    go('dataset');
    toast(`${state.validation.validHouseholds} of ${state.validation.totalRows} households validated`);
  }
}

function getRunBlockers(mode) {
  const blockers = [];
  if (state.processing) blockers.push('Dataset is still being processed');
  if (!state.validation) blockers.push('Validate the dataset before running algorithms');
  if (!state.researchDataset.length) blockers.push('No verified households with resolved locations are eligible');
  if (state.researchDataset.length && !getActiveResources(state.researchDataset).length) blockers.push('No relief resources are configured');
  if (mode === 'enhanced') {
    const missingUrgency = state.researchDataset.filter(row => parseUrgencyValue(row.urgency) === null);
    const missingResource = state.researchDataset.filter(row => !isKnownResourceRequirement(row.compatible_resource));
    if (missingUrgency.length) blockers.push('Enhanced Algorithm cannot run because urgency data is missing or invalid');
    if (missingResource.length) blockers.push('Enhanced Algorithm cannot run because Resource Compatibility data is missing or invalid');
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

function renderColumnMappingPanel() {
  const panel = ensureDatasetPanel('column-mapping-panel', 'mapping-panel');
  if (!panel) return;
  if (!state.rawRows.length) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  state.mappingIssues = getMappingIssues(state.columnMapping);
  const issueHtml = state.mappingIssues.length
    ? `<div class="validation-issues compact">${state.mappingIssues.map(issue => `<span>${escapeHtml(issue.message)}</span>`).join('')}</div>`
    : '<p class="mapping-note">Columns were mapped confidently. Review them if the source file uses local naming conventions.</p>';
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

function renderValidationSummary() {
  const panel = ensureDatasetPanel('validation-panel', 'validation-panel');
  if (!panel) return;
  if (!state.rawRows.length) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  const summary = state.validation;
  const issues = state.invalidRows.slice(0, 12).map(row => `<div class="validation-issue-row"><strong>${escapeHtml(row.household_id || `Row ${row._sourceRow}`)}</strong><span>${escapeHtml(row._validationReasons.join('; '))}</span></div>`).join('');
  panel.innerHTML = `<div class="panel-head"><div><p class="eyebrow">Dataset validation</p><h3>Research readiness</h3></div><span class="live-label">${state.processing ? 'Processing' : summary ? 'Validated' : 'Awaiting validation'}</span></div><div class="validation-summary-grid"><div><span>Total rows</span><strong>${summary?.totalRows ?? state.rawRows.length}</strong></div><div><span>Valid households</span><strong>${summary?.validHouseholds ?? '—'}</strong></div><div><span>Pending verification</span><strong>${summary?.pendingVerification ?? '—'}</strong></div><div><span>Invalid rows</span><strong>${summary?.invalidRows ?? '—'}</strong></div><div><span>Addresses resolved</span><strong>${summary?.addressesResolved ?? '—'}</strong></div><div><span>Addresses unresolved</span><strong>${summary?.addressesUnresolved ?? '—'}</strong></div></div><p class="validation-progress" id="validation-progress">${state.processing ? 'Processing dataset...' : summary ? `${summary.eligibleHouseholds} verified households are eligible for both algorithms.` : 'Map columns, then validate the uploaded dataset.'}</p>${issues ? `<div class="validation-issues">${issues}</div>` : ''}`;
}

function getDatasetTableKeys(rows) {
  if (!rows.length) return [];
  const first = rows[0];
  if (!state.validation) return Object.keys(first).filter(key => !key.startsWith('_')).slice(0, 12);
  return NORMALIZED_TABLE_KEYS.filter(key => rows.some(row => hasDisplayValue(row[key])));
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
  if (key === 'verification' || key === 'verification_status' || key === 'validation_status') return text.replace(/\s+/g, '-');
  if (key === 'geocoding_status') return text.includes('unresolved') || text.includes('unavailable') ? 'invalid' : text.toLowerCase();
  return '';
}

function getHouseholdId(row) {
  return findDatasetField(row, HOUSEHOLD_FIELD_ALIASES.id)?.value || '';
}

function getVerificationStatus(row) {
  return findDatasetField(row, HOUSEHOLD_FIELD_ALIASES.verification)?.value || '';
}

function isPending(row) {
  return getVerificationStatus(row).trim().toLowerCase() === 'pending';
}

function hasValidCoordinates(row) {
  return Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude));
}

function isInsideResearchAreaRow(row) {
  return hasValidCoordinates(row) && isInsideResearchArea(Number(row.latitude), Number(row.longitude));
}

function householdIds(rows) {
  return rows.map(row => getHouseholdId(row.household || row) || '(missing id)');
}

function makeDiagnosticStage(stage, rows, note = '') {
  return { stage, count: rows.length, ids: householdIds(rows).join(', '), note };
}

function logAllocationDiagnostics(label, result = null, mapItems = null) {
  if (!DEBUG_ALGORITHM_DIAGNOSTICS || typeof console === 'undefined') return;
  const rows = state.dataset;
  const resolvedLocationRows = rows.filter(hasValidCoordinates);
  const unresolvedRows = rows.filter(row => !hasValidCoordinates(row));
  const verifiedRows = rows.filter(isVerified);
  const pendingRows = rows.filter(isPending);
  const insideRows = resolvedLocationRows.filter(isInsideResearchAreaRow);
  const stages = [
    makeDiagnosticStage('CSV rows loaded', rows),
    makeDiagnosticStage('Resolved location rows', resolvedLocationRows),
    makeDiagnosticStage('Unresolved address rows', unresolvedRows),
    makeDiagnosticStage('Verified households', verifiedRows),
    makeDiagnosticStage('Pending households', pendingRows),
    makeDiagnosticStage('Households inside research area', insideRows),
    makeDiagnosticStage('Households sent to algorithm', state.researchDataset),
    makeDiagnosticStage('Assignment results', result?.output?.map(item => item.household) || [], result ? `${result.mode} output rows from ${resources.length} configured relief resources` : 'not run yet'),
    makeDiagnosticStage('Households sent to map', mapItems?.map(item => item.household || item) || [], mapItems ? 'rendered marker rows' : 'not rendered yet')
  ];
  console.groupCollapsed(`[Allocation diagnostics] ${label}`);
  console.table(stages);
  stages.forEach(item => console.log(`${item.stage}: ${item.count}`, item.ids || '(none)', item.note || ''));
  const outsideRows = resolvedLocationRows.filter(row => !isInsideResearchAreaRow(row));
  if (outsideRows.length) {
    console.warn('[Allocation diagnostics] Rows outside configured Barangay 160 bounds', {
      bounds: RELIEF_HUB.bounds,
      ids: householdIds(outsideRows).join(', ')
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
  if (typeof item.resourceIndex === 'number') return resourceType(item.resourceIndex);
  const match = String(item.resource || '').match(/\(([^)]+)\)/);
  return match?.[1] || '';
}

function getCompatibilityEvaluation(item, compatibleField) {
  if (!item.assigned || !compatibleField) return '';
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
  const verificationField = findDatasetField(row, HOUSEHOLD_FIELD_ALIASES.verification);
  const compatibleField = findDatasetField(row, HOUSEHOLD_FIELD_ALIASES.compatibleResource);
  const statusField = findDatasetField(row, HOUSEHOLD_FIELD_ALIASES.assignmentStatus);
  const assignmentStatus = item.assignmentStatus || statusField?.value || (item.assigned === false ? 'Unassigned' : 'Assigned');
  const allocation = item.assigned === false ? 'Unassigned' : item.resource;

  rememberField(usedFields, idField);
  return { row, usedFields, idField, headField, membersField, urgencyField, verificationField, compatibleField, statusField, assignmentStatus, allocation };
}

function buildExistingHouseholdInfoHtml(item, hubDistance) {
  const { row, usedFields, idField, headField, membersField, urgencyField, verificationField, compatibleField, assignmentStatus, allocation } = getHouseholdCardContext(item);
  const householdId = idField?.value || 'Household';
  const urgencyMeta = urgencyField ? getUrgencyMeta(urgencyField.value) : null;
  const algorithmDetails = [];
  const datasetDetails = [];
  const lat = Number(row.latitude);
  const lon = Number(row.longitude);
  const compatibilityEvaluation = getCompatibilityEvaluation(item, compatibleField);
  const basis = item.assigned ? 'Minimum Distance' : isPending(row) ? 'Verification required before optimization' : 'No resource assigned';

  addHouseholdDetail(algorithmDetails, usedFields, 'Assigned resource', allocation);
  addHouseholdDetail(algorithmDetails, usedFields, 'Assignment basis', basis);
  addHouseholdDetail(algorithmDetails, usedFields, 'Distance from hub', `${hubDistance} km`);
  if (typeof item.value === 'number' && Number.isFinite(item.value)) addHouseholdDetail(algorithmDetails, usedFields, 'Distance cost', `${item.value.toFixed(3)} km`);
  addHouseholdDetail(algorithmDetails, usedFields, 'Verification', verificationField);
  addHouseholdDetail(algorithmDetails, usedFields, 'Assignment status', assignmentStatus);

  addHouseholdDetail(datasetDetails, usedFields, 'Representative', headField);
  addHouseholdDetail(datasetDetails, usedFields, 'Address', getAddressField(row, usedFields));
  addHouseholdDetail(datasetDetails, usedFields, 'Members', membersField);
  if (urgencyMeta) {
    addHouseholdDetail(datasetDetails, usedFields, 'Urgency score', `${urgencyMeta.urgency}/10`);
    rememberField(usedFields, urgencyField);
  }
  addHouseholdDetail(datasetDetails, usedFields, 'Required resource', compatibleField);
  addHouseholdDetail(datasetDetails, usedFields, 'Compatibility', compatibilityEvaluation);
  addHouseholdDetail(datasetDetails, usedFields, 'Location status', row.geocoding_status);
  if (Number.isFinite(lat) && Number.isFinite(lon)) addHouseholdDetail(datasetDetails, usedFields, 'Coordinates', `${lat.toFixed(5)}, ${lon.toFixed(5)}`);

  const vulnerabilities = getVulnerabilityItems(row, usedFields);
  const extraInfo = getExtraHouseholdInfo(row, usedFields);
  const stateBadge = `<span class="household-state-badge">${escapeHtml(assignmentStatus)}</span>`;
  const datasetNote = 'Dataset urgency, compatibility, and vulnerability fields are shown for inspection only; they are not used by the Standard Hungarian Algorithm.';
  const evaluationNote = compatibilityEvaluation ? 'Compatibility is an evaluation metric only and was not used by the Standard Hungarian Algorithm.' : '';
  const vulnerabilitySection = vulnerabilities.length ? `<div class="household-card-section"><span>Vulnerability</span><div class="household-chip-list">${vulnerabilities.map(item => `<b>${escapeHtml(item)}</b>`).join('')}</div><p class="household-card-note">${escapeHtml(datasetNote)}</p></div>` : '';

  return `<div class="household-card-kicker">Existing algorithm assignment</div><div class="household-card-title"><strong>${escapeHtml(householdId)}</strong>${stateBadge}</div>${renderHouseholdSection('Distance-only decision', algorithmDetails)}${renderHouseholdSection('Dataset information', datasetDetails, evaluationNote || datasetNote)}${vulnerabilitySection}${renderHouseholdSection('Additional data', extraInfo)}`;
}

function buildEnhancedHouseholdInfoHtml(item, hubDistance) {
  const { row, usedFields, idField, headField, membersField, urgencyField, verificationField, compatibleField, assignmentStatus, allocation } = getHouseholdCardContext(item);
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
  addHouseholdDetail(algorithmDetails, usedFields, 'Required resource', compatibleField);
  addHouseholdDetail(algorithmDetails, usedFields, 'Assignment basis', 'Distance + Urgency + Compatibility');
  if (typeof item.value === 'number' && Number.isFinite(item.value)) addHouseholdDetail(algorithmDetails, usedFields, 'Composite cost', item.value.toFixed(3));
  if (item.components) {
    addHouseholdDetail(algorithmDetails, usedFields, 'Distance component', item.components.distanceComponent.toFixed(3));
    addHouseholdDetail(algorithmDetails, usedFields, 'Urgency component', item.components.urgencyComponent.toFixed(3));
    addHouseholdDetail(algorithmDetails, usedFields, 'Compatibility component', item.components.compatibilityComponent.toFixed(3));
  }
  addHouseholdDetail(algorithmDetails, usedFields, 'Distance from hub', `${hubDistance} km`);
  addHouseholdDetail(algorithmDetails, usedFields, 'Verification', verificationField);

  addHouseholdDetail(datasetDetails, usedFields, 'Representative', headField);
  addHouseholdDetail(datasetDetails, usedFields, 'Address', getAddressField(row, usedFields));
  addHouseholdDetail(datasetDetails, usedFields, 'Members', membersField);
  addHouseholdDetail(datasetDetails, usedFields, 'Location status', row.geocoding_status);
  if (Number.isFinite(lat) && Number.isFinite(lon)) addHouseholdDetail(datasetDetails, usedFields, 'Coordinates', `${lat.toFixed(5)}, ${lon.toFixed(5)}`);

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

function getComputedAssignmentStatus(row, assignment) {
  if (assignment) return assignment.assignmentStatus || 'Assigned';
  const verification = getVerificationStatus(row).trim();
  if (verification.toLowerCase() === 'pending') return 'Pending Verification';
  if (verification && verification.toLowerCase() !== 'verified') return `${verification} Verification`;
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
    return { household: row, resource: '', resourceIndex: null, value: null, assigned: false, assignmentStatus: getComputedAssignmentStatus(row, null) };
  });
}

function getAssignmentMapItems(result) {
  return buildAssignmentMapItems(result);
}

function getHouseholdMarkerStyle(item, target, priorityColor) {
  const assignedColor = target === 'existing' ? '#29496b' : priorityColor;
  const base = { radius: 7, color: '#fff', weight: 2, fillColor: assignedColor, fillOpacity: .95, opacity: 1 };
  if (isPending(item.household)) return { ...base, color: target === 'existing' ? '#748397' : priorityColor, fillColor: '#fff', fillOpacity: .28, opacity: .72, dashArray: '3 3' };
  if (!item.assigned) return { ...base, fillOpacity: .5, opacity: .9, dashArray: '2 3' };
  return base;
}

function getAssignmentLineStyle(target, priorityColor) {
  return { color: target === 'existing' ? '#29496b' : priorityColor, weight: 2, opacity: .58 };
}

function getAlgorithmMapTitle(target) {
  return target === 'existing' ? 'Existing' : 'Enhanced';
}

function getAssignmentMapLegend(target) {
  return target === 'existing' ? EXISTING_MAP_LEGEND : MAP_LEGEND;
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
    map.invalidateSize({ pan: false });
    positionHouseholdInfoCard(map);
  }, 0);
  setTimeout(() => {
    map.invalidateSize({ pan: false });
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
  const bounds = [hub];
  const mapItems = getAssignmentMapItems(result);
  const mappedItems = [];
  let routeCount = 0;
  mapItems.forEach(item => {
    const lat = Number(item.household.latitude);
    const lon = Number(item.household.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !isInsideResearchArea(lat, lon)) return;
    const point = [lat, lon];
    const { color } = getUrgencyMeta(item.household.urgency);
    const hubDistance = geoDistanceKm(hub, point).toFixed(2);
    if (item.assigned) {
      window.assignmentMapLayers[target].push(L.polyline([hub, point], getAssignmentLineStyle(target, color)).addTo(map));
      routeCount += 1;
    }
    const markerStyle = getHouseholdMarkerStyle(item, target, color);
    const marker = L.circleMarker(point, markerStyle).addTo(map);
    bindHouseholdMarker(map, marker, item, target, hubDistance, markerStyle);
    window.assignmentMapLayers[target].push(marker);
    bounds.push(point);
    mappedItems.push(item);
  });
  const verifiedCount = state.dataset.filter(isVerified).length;
  const mappedNote = mappedItems.length === state.dataset.length ? '' : ` · ${mappedItems.length} mapped`;
  $(`#${target}-assignment-map-count`).textContent = `${state.dataset.length} households · ${verifiedCount} verified · ${routeCount} assigned${mappedNote}`;
  logAllocationDiagnostics(`${target} assignment map render`, result, mappedItems);
  if (mappedItems.length) map.fitBounds(bounds, { padding: [42, 42], maxZoom: MAP_ZOOM });
  else map.setView(hub, MAP_ZOOM, { animate: false });
  map.invalidateSize();
  setTimeout(() => map.invalidateSize(), 0);
}

function refreshVisibleAssignmentMaps() {
  if (!window.assignmentMaps) return;
  Object.values(window.assignmentMaps).forEach(map => {
    map.invalidateSize({ pan: false });
    positionHouseholdInfoCard(map);
  });
}

const renderResultWithMap = renderResult;
renderResult = function (result) { renderResultWithMap(result); renderAssignmentMap(result); };
const goWithMapRefresh = go;
go = function (page) {
  if (window.expandedAssignmentMap && window.expandedAssignmentMap !== page) setAssignmentMapExpanded(window.expandedAssignmentMap, false);
  goWithMapRefresh(page);
  setTimeout(refreshVisibleAssignmentMaps, 0);
};
window.addEventListener('resize', () => {
  refreshVisibleAssignmentMaps();
  if (window.expandedAssignmentMap) refreshAssignmentMapSize(window.expandedAssignmentMap);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && window.expandedAssignmentMap) setAssignmentMapExpanded(window.expandedAssignmentMap, false);
});

function renderComparisonMaps() {
  if (typeof L === 'undefined' || !state.results.existing || !state.results.enhanced) return;
  let panel = $('#comparison-map-panel');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'comparison-map-panel';
    panel.className = 'panel comparison-map-panel';
    panel.innerHTML = `<div class="panel-head"><div><p class="eyebrow">Geographic comparison</p><h3>Standard distance baseline vs enhanced weighted model</h3></div></div><div class="comparison-map-grid"><div><div class="comparison-map-head"><h4>Standard Hungarian · distance only</h4><div class="map-legend" aria-label="Standard distance-only legend">${EXISTING_MAP_LEGEND}</div></div><div id="compare-existing-map" class="relief-map"></div></div><div><div class="comparison-map-head"><h4>Enhanced Hungarian · distance + urgency + compatibility</h4><div class="map-legend" aria-label="Enhanced priority legend">${MAP_LEGEND}</div></div><div id="compare-enhanced-map" class="relief-map"></div></div></div><div class="map-foot"><span>Click a household marker to inspect its assignment. Lines are not routes.</span><strong>Same Barangay 160 research area</strong></div>`;
    $('#view-compare').insertBefore(panel, $('#compare-content'));
  }
  ['existing', 'enhanced'].forEach(target => renderComparisonMap(state.results[target], target));
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
  hideHouseholdInfoCard(map, true);
  getAssignmentMapItems(result).forEach(item => {
    const lat = Number(item.household.latitude);
    const lon = Number(item.household.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !isInsideResearchArea(lat, lon)) return;
    const point = [lat, lon];
    const { color } = getUrgencyMeta(item.household.urgency);
    const hubDistance = geoDistanceKm(hub, point).toFixed(2);
    if (item.assigned) {
      window.comparisonMapLayers[target].push(L.polyline([hub, point], getAssignmentLineStyle(target, color)).addTo(map));
    }
    const markerStyle = getHouseholdMarkerStyle(item, target, color);
    const marker = L.circleMarker(point, markerStyle).addTo(map);
    bindHouseholdMarker(map, marker, item, target, hubDistance, markerStyle);
    window.comparisonMapLayers[target].push(marker);
    bounds.push(point);
  });
  if (bounds.length > 1) map.fitBounds(bounds, { padding: [36, 36], maxZoom: MAP_ZOOM });
  else map.setView(hub, MAP_ZOOM, { animate: false });
  map.invalidateSize();
}

const compareWithMap = compare;
compare = function () { compareWithMap(); renderComparisonMaps(); setTimeout(() => { if (window.comparisonMaps) Object.values(window.comparisonMaps).forEach(map => map.invalidateSize({ pan: false })); }, 0); };
initializeApp();
