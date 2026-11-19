/* Standalone D3 city map. Compatible with your later Scrollama story/map setup. */
const $ = (s) => document.querySelector(s);
const formatNumber = d3.format(',');
const formatMoney = d3.format('$,.0f');
const selected = new Set(['temperature', 'housing', 'population']);
const metricInfo = {
  temperature: { label: 'Temperature', unit: '°C', colors: ['#70b8d4', '#d5cb8f', '#e18f65'] },
  housing: { label: 'Home value', unit: 'USD', colors: ['#7ad8bb', '#8f9ae3', '#f3a4bc'] },
  population: { label: 'Population', unit: 'people', colors: ['#73b4c7', '#8ddac0', '#e9bf83'] }
};
const wrapper = $('#map-wrapper'), svg = d3.select('#map'), tooltip = d3.select('#tooltip');
const mapRoot = svg.append('g');
const statesLayer = mapRoot.append('g');
const citiesLayer = mapRoot.append('g');
let width = 1100, height = 600, projection, path, cities = [], zoom, currentTransform = d3.zoomIdentity;
let allData = [], coordinatesFrom = '';

// Known-city backup when the online all-city coordinate reference is inaccessible.
// They are real geographic coordinates, not simulated point positions.
const seedCoords = d3.csvParse(`City,State,Latitude,Longitude
New York,New York,40.7128,-74.0060
Los Angeles,California,34.0522,-118.2437
Chicago,Illinois,41.8781,-87.6298
Houston,Texas,29.7604,-95.3698
Phoenix,Arizona,33.4484,-112.0740
Philadelphia,Pennsylvania,39.9526,-75.1652
San Antonio,Texas,29.4241,-98.4936
San Diego,California,32.7157,-117.1611
Dallas,Texas,32.7767,-96.7970
San Jose,California,37.3382,-121.8863
Austin,Texas,30.2672,-97.7431
Jacksonville,Florida,30.3322,-81.6557
Fort Worth,Texas,32.7555,-97.3308
Columbus,Ohio,39.9612,-82.9988
San Francisco,California,37.7749,-122.4194
Charlotte,North Carolina,35.2271,-80.8431
Indianapolis,Indiana,39.7684,-86.1581
Seattle,Washington,47.6062,-122.3321
Denver,Colorado,39.7392,-104.9903
Washington,District of Columbia,38.9072,-77.0369
Boston,Massachusetts,42.3601,-71.0589
El Paso,Texas,31.7619,-106.4850
Nashville,Tennessee,36.1627,-86.7816
Detroit,Michigan,42.3314,-83.0458
Oklahoma City,Oklahoma,35.4676,-97.5164
Portland,Oregon,45.5152,-122.6784
Las Vegas,Nevada,36.1699,-115.1398
Memphis,Tennessee,35.1495,-90.0490
Louisville,Kentucky,38.2527,-85.7585
Baltimore,Maryland,39.2904,-76.6122`);
const key = s => String(s ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const cityKey = (city, state) => `${key(city)}|${key(state)}`;
const valid = v => v !== null && v !== '' && v !== undefined && Number.isFinite(+v);

async function getCoordinates() {
  // Coordinate references are used ONLY for locating the cities in city_metrics.csv.
  // No additional cities from this reference enter the plotted dataset.
  const sources = [
    'https://gist.githubusercontent.com/cfanpnk/cb7118ad3a7a6ca66f128fc254d2887d/raw/uscities.csv',
    'https://raw.githubusercontent.com/kelvins/US-Cities-Database/main/csv/us_cities.csv'
  ];
  for (const url of sources) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      let rows;
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        rows = d3.csvParse(await response.text());
      }
      finally { clearTimeout(timeout); }
      if (!rows.length) throw new Error('Empty location reference');
      const mapped = rows.map(r => ({
        city: r.city || r.CITY || r.City,
        state: r.state_name || r.STATE_NAME || r.State,
        lat: +(r.lat || r.LATITUDE || r.Latitude),
        lon: +(r.lng || r.LONGITUDE || r.Longitude)
      })).filter(d => d.city && d.state && Number.isFinite(d.lat) && Number.isFinite(d.lon));
      if (mapped.length < 1000) throw new Error('Not enough usable coordinate records');
      coordinatesFrom = 'Online city-coordinate reference';
      return mapped;
    } catch (error) { console.warn('Coordinate source unavailable:',url,error); }
  }
  coordinatesFrom = 'Offline fallback coordinates (30 major cities)';
  return seedCoords.map(r => ({ city: r.City, state: r.State, lat: +r.Latitude, lon: +r.Longitude }));
}

function combineData(coords) {
  const lookup = new Map(coords.filter(d => Number.isFinite(d.lat) && Number.isFinite(d.lon))
    .map(d => [cityKey(d.city, d.state), d]));
  cities = allData.flatMap(d => {
    const match = lookup.get(cityKey(d.city, d.state));
    if (!match) return [];
    return [{ ...d, lat: match.lat, lon: match.lon }];
  });
  $('#status').textContent = `${formatNumber(cities.length)} of ${formatNumber(allData.length)} cities mapped`;
  $('#map-count').textContent = `${formatNumber(cities.length)} mapped / ${formatNumber(allData.length)} merged CSV cities · ${coordinatesFrom}`;
}

function extentFor(metric) {
  const values = cities.filter(d => valid(d[metric])).map(d => +d[metric]);
  return d3.extent(values.length ? values : [0, 1]);
}
function display(metric, value) {
  if (!valid(value)) return 'Not available';
  if (metric === 'temperature') return `${(+value).toFixed(1)} °C`;
  if (metric === 'housing') return formatMoney(+value);
  return formatNumber(+value);
}
function pointSize(d) {
  if (selected.has('population') && valid(d.population)) return d3.scaleSqrt().domain([0, 9000000]).range([2.6, 9.2]).clamp(true)(+d.population);
  return 3.4;
}
function colorFor(d) {
  const primary = ['temperature', 'housing', 'population'].find(m => selected.has(m));
  if (!primary) return '#96a8ba';
  if (!valid(d[primary])) return '#66798b';
  let [lo, hi] = extentFor(primary);
  if (primary === 'housing' || primary === 'population') {
    lo = Math.log1p(Math.max(0,lo)); hi = Math.log1p(Math.max(0,hi));
    return d3.scaleLinear().domain([lo,(lo+hi)/2,hi]).range(metricInfo[primary].colors).clamp(true)(Math.log1p(Math.max(0,+d[primary])));
  }
  return d3.scaleLinear().domain([lo,(lo+hi)/2,hi]).range(metricInfo[primary].colors).clamp(true)(+d[primary]);
}
// Render tooltip above all SVG/map layers, independent of SVG stacking.
// It is moved to <body> once and positioned in viewport coordinates.
const tooltipNode = tooltip.node();
document.body.appendChild(tooltipNode);

function hideTooltip() {
  tooltipNode.hidden = true;
}
function setTooltip(d, event) {
  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const rows = [...selected].map(metric =>
    `<div class="tt-row"><span>${metricInfo[metric].label}</span>` +
    `<b>${display(metric, d[metric])}</b></div>`
  ).join('');
  tooltip.html(
    `<div class="tt-head">${escapeHtml(d.city)}</div>` +
    `<div class="tt-state">${escapeHtml(d.state)}</div>` +
    (rows || '<div class="tt-empty">Select a metric to view statistics.</div>')
  );
  tooltipNode.hidden = false;
  const w = tooltipNode.offsetWidth, h = tooltipNode.offsetHeight;
  const x = event.clientX + 18, y = event.clientY + 16;
  tooltip.style('left', `${Math.max(6, Math.min(x, innerWidth - w - 8))}px`)
    .style('top', `${Math.max(6, Math.min(y, innerHeight - h - 8))}px`);
}

// Test pointer proximity in the *map group's local coordinates*.
// D3 inverts the group transform (including zoom and SVG viewBox scaling).
let plottedCities = [];
let hoveredCity = null;
function clearCityHover() {
  hoveredCity = null;
  citiesLayer.selectAll('.city').classed('hovered', false);
  hideTooltip();
}
function findNearbyCity(event) {
  const root = mapRoot.node();
  const ctm = root.getScreenCTM();
  if (!ctm) return null;

  // Both the mouse and projected city coordinates are now unzoomed map units.
  const [mouseX, mouseY] = d3.pointer(event, root);
  // Convert a 11-screen-pixel tolerance to the same map units, so it is
  // stable regardless of zoom or browser/CSS scaling.
  const pixelsPerUnit = Math.hypot(ctm.a, ctm.b);
  if (!pixelsPerUnit) return null;
  const threshold = 11 / pixelsPerUnit;
  let minDistanceSquared = threshold * threshold;
  let nearest = null;
  for (const city of plottedCities) {
    const dx = mouseX - city.projected[0];
    const dy = mouseY - city.projected[1];
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared < minDistanceSquared) {
      minDistanceSquared = distanceSquared;
      nearest = city;
    }
  }
  return nearest;
}
function handleCityPointer(event) {
  if (event.buttons) { clearCityHover(); return; }
  const nearest = findNearbyCity(event);
  if (nearest !== hoveredCity) {
    hoveredCity = nearest;
    // Object identity ensures that exactly one plotted dot highlights, even
    // when records share the same city name or even the same city/state.
    citiesLayer.selectAll('.city').classed('hovered', d => d === hoveredCity);
  }
  if (nearest) setTooltip(nearest, event);
  else hideTooltip();
}

// Keep city dots readable at any zoom level. Radius is in SVG units;
// multiplying by k during zoom makes the visible radius ~5.5px.
function zoomRadius(d) {
  const k = currentTransform.k;
  const desiredScreenRadius = Math.max(5.5, Math.min(8, pointSize(d)));
  return desiredScreenRadius / k;
}

function updateDots() {
  citiesLayer.selectAll('.city').attr('r', zoomRadius).attr('fill',colorFor).attr('opacity',selected.size ? 0.88 : 0.65);
  const primary = ['temperature','housing','population'].find(m => selected.has(m));
  $('#legend').textContent = primary ? `Color: ${metricInfo[primary].label.toLowerCase()} · size: ${selected.has('population') ? 'population' : 'constant'}` : 'Select a metric to display tooltips';
  hideTooltip();
}
function resize() {
  width = wrapper.clientWidth; height = wrapper.clientHeight;
  svg.attr('viewBox',`0 0 ${width} ${height}`);
  projection = d3.geoAlbersUsa().fitExtent([[25,23],[width-25,height-23]], {type:'Sphere'});
  // GeoAlbersUsa returns null for the abstract globe sphere; use US geometry in drawMap instead.
}
function drawMap(us) {
  width = wrapper.clientWidth; height = wrapper.clientHeight;
  svg.attr('viewBox',`0 0 ${width} ${height}`);
  const features = topojson.feature(us, us.objects.states);
  projection = d3.geoAlbersUsa().fitExtent([[26,20],[width-26,height-20]],features);
  path = d3.geoPath(projection);
  statesLayer.selectAll('path').data(features.features).join('path').attr('class','state').attr('d',path);
  const plot = cities.map((d, index) => ({...d, rowId: index, projected:projection([d.lon,d.lat])})).filter(d => d.projected);
  plottedCities = plot;
  citiesLayer.selectAll('circle').data(plot, d => d.rowId).join('circle')
    .attr('class','city').attr('cx',d => d.projected[0]).attr('cy',d => d.projected[1]);
  // SVG-wide proximity hit testing: works even when circles are tiny,
  // overlapping, or the cursor is just outside a circle's painted area.
  svg.on('pointermove.cityhover', handleCityPointer)
    .on('pointerleave.cityhover', () => {
      clearCityHover();
    });
  zoom = d3.zoom().scaleExtent([1,16]).on('zoom',event => {
    currentTransform = event.transform;
    mapRoot.attr('transform',currentTransform);
    citiesLayer.selectAll('.city').attr('r', zoomRadius);
    clearCityHover(); // Prevent a stale highlight after map movements.
  });
  svg.call(zoom).on('dblclick.zoom',null);
  // Verify that the newest main.js is actually running.
  console.info('[Livability map] Zoom-correct hover v4 active; plotted points:', plot.length);
  updateDots();
}
function setupControls() {
  document.querySelectorAll('[name=metric]').forEach(el => el.addEventListener('change', () => {
    if (el.checked) selected.add(el.value); else selected.delete(el.value);
    updateDots();
  }));
  $('#zoom-in').addEventListener('click', () => svg.transition().duration(220).call(zoom.scaleBy,1.6));
  $('#zoom-out').addEventListener('click', () => svg.transition().duration(220).call(zoom.scaleBy,1/1.6));
  $('#reset').addEventListener('click', () => svg.transition().duration(400).call(zoom.transform,d3.zoomIdentity));
}
async function init() {
  setupControls();
  try {
    // Data contains ONLY the exact 1,307 rows in the user's merged CSV, plus temperatures from the state projections.
    const [rows,us,coords] = await Promise.all([
      d3.csv('city_metrics.csv'),
      d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'),
      getCoordinates()
    ]);
    allData = rows;
    combineData(coords);
    drawMap(us);
  } catch (err) {
    console.error(err);
    $('#status').textContent = 'Unable to load map';
    $('#map-error').hidden = false;
    $('#map-error').textContent = 'Could not load map data. Use VS Code Live Server (not file://) and check your internet connection for the map outline.';
  }
}
init();
