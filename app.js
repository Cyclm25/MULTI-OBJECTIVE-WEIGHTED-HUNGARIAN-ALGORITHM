const resources = ['Relief-01', 'Relief-02', 'Relief-03', 'Relief-04', 'Relief-05', 'Relief-06', 'Relief-07', 'Relief-08'];
const resourceTypes = ['Water', 'Food', 'Medical', 'Shelter'];
function deriveAHPWeights() { const matrix = [[1, 1 / 3, 1 / 2], [3, 1, 2], [2, 1 / 2, 1]]; const geometricMeans = matrix.map(row => Math.pow(row.reduce((product, value) => product * value, 1), 1 / row.length)); const total = geometricMeans.reduce((sum, value) => sum + value, 0); return { distance: geometricMeans[0] / total, urgency: geometricMeans[1] / total, compatibility: geometricMeans[2] / total }; }
const state = { dataset: [], researchDataset: [], filename: '', latest: null, results: {}, history: JSON.parse(localStorage.getItem('allocation-history') || '[]'), weights: deriveAHPWeights() };
const RELIEF_HUB = { name: 'Barangay 160, Tondo, Manila', coordinates: [14.6207513, 120.97349635], bounds: [[14.6200279, 120.9729135], [14.6214747, 120.9740792]] };
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
    maxBounds: RELIEF_HUB.bounds,
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
function isInsideResearchArea(lat, lon) { return lat >= RELIEF_HUB.bounds[0][0] && lat <= RELIEF_HUB.bounds[1][0] && lon >= RELIEF_HUB.bounds[0][1] && lon <= RELIEF_HUB.bounds[1][1]; }
function isVerified(row) { return String(row.verification_status || row.verification || '').trim().toLowerCase() === 'verified'; }
function resourceType(index) { return resourceTypes[index % resourceTypes.length]; }
function isCompatible(row, resourceIndex) { return String(row.compatible_resource || '').trim().toLowerCase() === resourceType(resourceIndex).toLowerCase(); }
const $ = selector => document.querySelector(selector);
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2200); }
function go(page) { document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === `view-${page}`)); document.querySelectorAll('.nav-item[data-page]').forEach(item => item.classList.toggle('active', item.dataset.page === page)); const labels = { dashboard: 'Dashboard', dataset: 'Dataset', existing: 'Existing algorithm', enhanced: 'Enhanced algorithm', compare: 'Compare', history: 'Run history', settings: 'Settings' }; $('#page-title').textContent = labels[page]; $('#header-title').textContent = page === 'dashboard' ? 'Algorithm workspace' : labels[page]; window.scrollTo(0, 0); }
function parseCsv(text) { const lines = text.trim().split(/\r?\n/).filter(Boolean); const headers = lines.shift().split(',').map(item => item.trim()); return lines.map(line => { const values = line.split(','); return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ''])); }); }
function loadFile(file) { if (!file) return; if (file.name.toLowerCase().endsWith('.xlsx')) { toast('XLSX connector is reserved for the finalized dataset'); return; } const reader = new FileReader(); reader.onload = event => { try { const rows = parseCsv(event.target.result); if (!rows.length) throw new Error('empty'); const researchRows = rows.filter(row => isVerified(row) && isInsideResearchArea(Number(row.latitude), Number(row.longitude))); state.dataset = rows; state.researchDataset = researchRows; state.filename = file.name; renderDataset(); if (researchRows.length) { compare(); go('compare'); toast(`${researchRows.length} of ${rows.length} verified Barangay 160 records compared`); } else { go('dataset'); toast('No verified records with valid Barangay 160 coordinates were found'); } } catch (error) { toast('Could not parse this CSV'); } }; reader.readAsText(file); }
function renderDataset() { const rows = state.dataset; const keys = rows.length ? Object.keys(rows[0]) : []; $('#top-dataset').textContent = rows.length ? state.filename : 'No dataset loaded'; $('#stat-status').textContent = rows.length ? 'Ready' : 'Waiting'; $('#stat-file').textContent = rows.length ? state.filename : 'Upload a verified household CSV'; $('#stat-records').textContent = rows.length; $('#data-name').textContent = state.filename || '—'; $('#data-rows').textContent = rows.length; $('#data-cols').textContent = keys.length; $('#data-missing').textContent = rows.reduce((sum, row) => sum + keys.filter(key => !row[key]).length, 0); $('#data-head').innerHTML = keys.map(key => `<th>${key.replaceAll('_', ' ')}</th>`).join(''); renderTable(); ['#existing-input', '#enhanced-input'].forEach(selector => { if ($(selector)) $(selector).textContent = rows.length ? `${rows.length} records` : 'No dataset'; }); }
function renderTable() { const query = ($('#table-search')?.value || '').toLowerCase(); const rows = state.dataset.filter(row => JSON.stringify(row).toLowerCase().includes(query)); $('#data-body').innerHTML = rows.slice(0, 50).map(row => `<tr>${Object.entries(row).map(([key, value]) => `<td class="${key === 'verification' ? String(value).toLowerCase() : ''}">${value}</td>`).join('')}</tr>`).join(''); $('#table-count').textContent = `${rows.length} of ${state.dataset.length} records`; }
function distance(row, index) { const lat = Number(row.latitude) || 14.6; const lon = Number(row.longitude) || 120.98; return Math.abs(lat - (14.59 + index * .003)) * 1000 + Math.abs(lon - (120.975 + index * .003)) * 1000 + 2; }
function hungarian(matrix) { const n = matrix.length, m = matrix[0].length, u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0); for (let i = 1; i <= n; i++) { p[0] = i; let j0 = 0; const minv = Array(m + 1).fill(Infinity), used = Array(m + 1).fill(false); do { used[j0] = true; const i0 = p[j0]; let delta = Infinity, j1 = 0; for (let j = 1; j <= m; j++) if (!used[j]) { const cur = matrix[i0 - 1][j - 1] - u[i0] - v[j]; if (cur < minv[j]) { minv[j] = cur; way[j] = j0; } if (minv[j] < delta) { delta = minv[j]; j1 = j; } } for (let j = 0; j <= m; j++) { if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; } j0 = j1; } while (p[j0] !== 0); do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0 !== 0); } const result = Array(n); for (let j = 1; j <= m; j++) result[p[j] - 1] = j - 1; return result; }
function normalize(values) { const min = Math.min(...values), max = Math.max(...values); return max === min ? values.map(() => 0) : values.map(value => (value - min) / (max - min)); }
function makeMatrix(mode) { const rows = state.researchDataset; const activeResources = resources.slice(0, Math.min(resources.length, rows.length)); const distances = activeResources.map((_, resourceIndex) => rows.map(row => distance(row, resourceIndex))); if (mode === 'existing') return distances; const urgency = activeResources.map(() => rows.map(row => 10 - Number(row.urgency || 0))); const compatibility = activeResources.map((_, resourceIndex) => rows.map(row => isCompatible(row, resourceIndex) ? 0 : 1)); const flatDistance = normalize(distances.flat()); const flatUrgency = normalize(urgency.flat()); const flatCompatibility = normalize(compatibility.flat()); return activeResources.map((_, resourceIndex) => rows.map((__, householdIndex) => flatDistance[resourceIndex * rows.length + householdIndex] * state.weights.distance + flatUrgency[resourceIndex * rows.length + householdIndex] * state.weights.urgency + flatCompatibility[resourceIndex * rows.length + householdIndex] * state.weights.compatibility)); }
function execute(mode) { if (!state.researchDataset.length) { toast('No verified Barangay 160 households to process'); go('dataset'); return null; } const started = performance.now(); const matrix = makeMatrix(mode); const assignment = hungarian(matrix); const output = assignment.map((householdIndex, resourceIndex) => ({ resource: `${resources[resourceIndex]} (${resourceType(resourceIndex)})`, resourceIndex, household: state.researchDataset[householdIndex], value: matrix[resourceIndex][householdIndex] })); const cost = output.reduce((sum, item) => sum + item.value, 0); const compatible = output.filter(item => isCompatible(item.household, item.resourceIndex)).length; const urgent = output.filter(item => Number(item.household.urgency) >= 7); const priorityMatches = urgent.filter(item => isCompatible(item.household, item.resourceIndex)).length; const accuracy = output.length ? compatible / output.length : 0; const prioritization = urgent.length ? priorityMatches / urgent.length : 0; const result = { mode, output, cost, priorityMatches, accuracy, prioritization, duration: Math.max(.3, performance.now() - started).toFixed(2), dataset: state.filename, records: state.researchDataset.length }; state.latest = result; state.results[mode] = result; state.history.unshift({ id: `RUN-${String(Date.now()).slice(-5)}`, mode, dataset: state.filename, records: state.researchDataset.length, duration: result.duration, timestamp: new Date().toLocaleString() }); state.history = state.history.slice(0, 20); localStorage.setItem('allocation-history', JSON.stringify(state.history)); renderResult(result); renderHistory(); return result; }
function renderResult(result) { const target = result.mode === 'existing' ? '#existing-output' : '#enhanced-output'; const metrics = result.mode === 'existing' ? '#existing-metrics' : '#enhanced-metrics'; $(target).className = 'result-list'; $(target).innerHTML = result.output.map(item => `<div class="result-row"><span>${item.resource} <b>→</b> ${item.household.household_id}</span><small>urgency ${item.household.urgency} · cost ${item.value.toFixed(2)}</small></div>`).join(''); $(metrics).innerHTML = `<div><span>${result.mode === 'existing' ? 'Total assignment cost' : 'Total weighted cost'}</span><strong>${result.cost.toFixed(2)}</strong></div><div><span>Mean allocation accuracy</span><strong>${(result.accuracy * 100).toFixed(1)}%</strong></div><div><span>Prioritization efficiency</span><strong>${(result.prioritization * 100).toFixed(1)}%</strong></div><div><span>Execution time</span><strong>${result.duration} ms</strong></div>`; $(`#${result.mode}-status`).textContent = 'Complete'; $('#stat-latest').textContent = result.mode === 'existing' ? 'Baseline' : 'Enhanced'; $('#stat-latest-detail').textContent = `${result.duration} ms · ${result.records} verified records`; $('#dashboard-output').className = 'result-list'; $('#dashboard-output').innerHTML = result.output.slice(0, 5).map(item => `<div class="result-row"><span>${item.resource} <b>→</b> ${item.household.household_id}</span><small>${item.value.toFixed(2)}</small></div>`).join(''); }
function compare() { const existing = execute('existing'); const enhanced = execute('enhanced'); if (!existing || !enhanced) return; $('#compare-empty').classList.add('hidden'); $('#compare-content').classList.remove('hidden'); $('#compare-records').textContent = existing.records; $('#compare-baseline').textContent = existing.cost.toFixed(2); $('#compare-enhanced').textContent = enhanced.cost.toFixed(2); $('#compare-changed').textContent = `${(existing.accuracy * 100).toFixed(1)}% → ${(enhanced.accuracy * 100).toFixed(1)}%`; $('#compare-priority').textContent = `${(enhanced.prioritization * 100).toFixed(1)}%`; const draw = (result, target) => { $(target).innerHTML = result.output.map(item => `<div class="compare-row"><span>${item.resource} <b>→</b> ${item.household.household_id}</span><span>${item.value.toFixed(2)}</span></div>`).join(''); }; draw(existing, '#compare-existing'); draw(enhanced, '#compare-enhanced-list'); }
function renderHistory() { $('#history-list').innerHTML = state.history.length ? state.history.map(run => `<div class="history-row"><span>${run.id}</span><span>${run.mode === 'existing' ? 'Existing' : 'Enhanced'}</span><span>${run.dataset}</span><span>${run.records}</span><span>${run.duration} ms</span><span>Complete</span></div>`).join('') : '<div class="empty-output"><span>↺</span><p>No runs recorded yet.</p></div>'; }
function bind() { document.querySelectorAll('[data-page]').forEach(item => item.addEventListener('click', event => { event.preventDefault(); go(item.dataset.page); })); document.querySelectorAll('[data-page-target]').forEach(item => item.addEventListener('click', () => go(item.dataset.pageTarget))); document.querySelectorAll('[data-run]').forEach(item => item.addEventListener('click', () => { if (item.dataset.run === 'both') { compare(); go('compare'); } else { execute(item.dataset.run); go(item.dataset.run); } })); $('#file-input').addEventListener('change', event => loadFile(event.target.files[0])); $('#table-search').addEventListener('input', renderTable); $('#clear-history').addEventListener('click', () => { state.history = []; localStorage.removeItem('allocation-history'); renderHistory(); toast('History cleared'); }); }
bind(); renderDataset(); renderHistory(); ['distance', 'urgency', 'compat'].forEach(name => { const key = name === 'compat' ? 'compatibility' : name; $(`#enh-${name}`).max = '1'; $(`#enh-${name}`).step = '0.001'; $(`#enh-${name}`).value = state.weights[key]; $(`#enh-${name}`).disabled = true; $(`#enh-${name}`).title = 'Fixed AHP-derived research weight'; $(`#enh-${name}-label`).textContent = state.weights[key].toFixed(3); }); $('.threshold span').textContent = 'Fixed re-assignment threshold'; $('.threshold strong').textContent = 'Δ ≥ 2'; go(location.hash.slice(1) || 'dashboard');

function renderReliefMap() {
  if (typeof L === 'undefined') return;
  let panel = $('#relief-map-panel');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'relief-map-panel';
    panel.className = 'panel map-panel';
    panel.innerHTML = `<div class="panel-head"><div><p class="eyebrow">Research area</p><h3>${RELIEF_HUB.name} relief network</h3></div><div class="map-legend" aria-label="Household urgency legend">${MAP_LEGEND}</div></div><div id="relief-map" class="relief-map"></div><div class="map-foot"><span>Only households inside the Barangay 160 boundary are shown.</span><strong id="map-count">0 households inside research area</strong></div>`;
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
  state.researchDataset.forEach(row => {
    const lat = Number(row.latitude);
    const lon = Number(row.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !isInsideResearchArea(lat, lon)) return;
    const point = [lat, lon];
    const { urgency, color, label } = getUrgencyMeta(row.urgency);
    window.reliefLayers.push(L.polyline([hub, point], { color, weight: 2, opacity: .48, dashArray: urgency >= 7 ? '' : '5 5' }).addTo(window.reliefMap));
    window.reliefLayers.push(L.circleMarker(point, { radius: 6, color: '#fff', weight: 2, fillColor: color, fillOpacity: .95 }).addTo(window.reliefMap).bindPopup(`<strong>${row.household_id || 'Household'}</strong><br>Status: ${label}<br>Urgency: ${urgency}/10`));
    mapped.push(point);
  });
  $('#map-count').textContent = `${mapped.length} households inside research area`;
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

function renderAssignmentMap(result) {
  if (typeof L === 'undefined') return;
  const target = result.mode === 'existing' ? 'existing' : 'enhanced';
  const view = $(`#view-${target}`);
  let panel = $(`#${target}-assignment-map-panel`);
  if (!panel) {
    panel = document.createElement('section');
    panel.id = `${target}-assignment-map-panel`;
    panel.className = 'panel assignment-map-panel';
    panel.innerHTML = `<div class="panel-head"><div><p class="eyebrow">Allocation view · Barangay 160</p><h3>${target === 'existing' ? 'Existing' : 'Enhanced'} household assignments</h3></div><div class="map-legend" aria-label="Household urgency legend">${MAP_LEGEND}</div></div><div id="${target}-assignment-map" class="relief-map"></div><div class="map-foot"><span>Lines visualize assignments only; they are not delivery routes.</span><strong id="${target}-assignment-map-count">0 assignments</strong></div></div>`;
    view.appendChild(panel);
  }
  if (!window.assignmentMaps) window.assignmentMaps = {};
  if (!window.assignmentMaps[target]) {
    window.assignmentMaps[target] = createReliefMap(`${target}-assignment-map`);
  }
  const map = window.assignmentMaps[target];
  if (!window.assignmentMapLayers) window.assignmentMapLayers = {};
  if (window.assignmentMapLayers[target]) window.assignmentMapLayers[target].forEach(layer => layer.remove());
  window.assignmentMapLayers[target] = [];
  const hub = RELIEF_HUB.coordinates;
  window.assignmentMapLayers[target].push(addHubMarker(map));
  const bounds = [hub];
  let routeCount = 0;
  result.output.forEach((item, index) => {
    const lat = Number(item.household.latitude);
    const lon = Number(item.household.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !isInsideResearchArea(lat, lon)) return;
    const point = [lat, lon];
    const { urgency, color, label } = getUrgencyMeta(item.household.urgency);
    const hubDistance = geoDistanceKm(hub, point).toFixed(2);
    window.assignmentMapLayers[target].push(L.polyline([hub, point], { color, weight: 2, opacity: .58 }).addTo(map));
    window.assignmentMapLayers[target].push(L.circleMarker(point, { radius: 7, color: '#fff', weight: 2, fillColor: color, fillOpacity: .95 }).addTo(map).bindPopup(`<strong>${item.household.household_id || 'Household'}</strong><br>Status: ${label}<br>Assigned: ${item.resource}<br>Urgency: ${urgency}/10<br>Hub distance: ${hubDistance} km<br>${target === 'existing' ? 'Distance cost' : 'Weighted cost'}: ${item.value.toFixed(3)}`));
    bounds.push(point);
    routeCount += 1;
  });
  $(`#${target}-assignment-map-count`).textContent = `${routeCount} assignments inside research area`;
  if (routeCount) map.fitBounds(bounds, { padding: [42, 42], maxZoom: MAP_ZOOM });
  else map.setView(hub, MAP_ZOOM, { animate: false });
  map.invalidateSize();
  setTimeout(() => map.invalidateSize(), 0);
}

function refreshVisibleAssignmentMaps() {
  if (!window.assignmentMaps) return;
  Object.values(window.assignmentMaps).forEach(map => {
    map.invalidateSize({ pan: false });
  });
}

const renderResultWithMap = renderResult;
renderResult = function (result) { renderResultWithMap(result); renderAssignmentMap(result); };
const goWithMapRefresh = go;
go = function (page) { goWithMapRefresh(page); setTimeout(refreshVisibleAssignmentMaps, 0); };

function renderComparisonMaps() {
  if (typeof L === 'undefined' || !state.results.existing || !state.results.enhanced) return;
  let panel = $('#comparison-map-panel');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'comparison-map-panel';
    panel.className = 'panel comparison-map-panel';
    panel.innerHTML = `<div class="panel-head"><div><p class="eyebrow">Geographic comparison</p><h3>How each algorithm assigns relief goods</h3></div><div class="map-legend" aria-label="Household urgency legend">${MAP_LEGEND}</div></div><div class="comparison-map-grid"><div><h4>Existing · distance only</h4><div id="compare-existing-map" class="relief-map"></div></div><div><h4>Enhanced · weighted objectives</h4><div id="compare-enhanced-map" class="relief-map"></div></div></div><div class="map-foot"><span>Click a household marker to inspect its assignment. Lines are not routes.</span><strong>Same Barangay 160 research area</strong></div>`;
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
  result.output.forEach(item => {
    const point = [Number(item.household.latitude), Number(item.household.longitude)];
    if (!isInsideResearchArea(point[0], point[1])) return;
    const { urgency, color, label } = getUrgencyMeta(item.household.urgency);
    window.comparisonMapLayers[target].push(L.polyline([hub, point], { color, weight: 2, opacity: .58 }).addTo(map));
    window.comparisonMapLayers[target].push(L.circleMarker(point, { radius: 6, color: '#fff', weight: 2, fillColor: color, fillOpacity: .95 }).addTo(map).bindPopup(`<strong>${item.household.household_id}</strong><br>Status: ${label}<br>Assigned: ${item.resource}<br>Urgency: ${urgency}/10<br>Cost: ${item.value.toFixed(3)}`));
    bounds.push(point);
  });
  if (bounds.length > 1) map.fitBounds(bounds, { padding: [36, 36], maxZoom: MAP_ZOOM });
  else map.setView(hub, MAP_ZOOM, { animate: false });
  map.invalidateSize();
}

const compareWithMap = compare;
compare = function () { compareWithMap(); renderComparisonMaps(); setTimeout(() => { if (window.comparisonMaps) Object.values(window.comparisonMaps).forEach(map => map.invalidateSize({ pan: false })); }, 0); };
