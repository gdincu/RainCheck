/* RainCheck — free-data PWA
 * Minutecast (2h): Open-Meteo minutely_15 precipitation
 * Radar (~60min): RainViewer tiles ~= Ventusky EURAD
 * 8h rain+clouds: Open-Meteo hourly (model selectable, incl. CHMI ALADIN)
 */
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

const state = {
  lat: parseFloat(store.get('rc_lat', '44.33')),
  lon: parseFloat(store.get('rc_lon', '23.80')),
  model: store.get('rc_model', 'best_match'),
};

let map, radarLayers = [], radarFrames = [], radarIdx = 0, playTimer = null;

const WMO = { 0:'Clear', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast', 45:'Fog', 48:'Fog', 51:'Light drizzle', 53:'Drizzle', 55:'Heavy drizzle', 61:'Light rain', 63:'Rain', 65:'Heavy rain', 71:'Light snow', 73:'Snow', 75:'Heavy snow', 80:'Light showers', 81:'Showers', 82:'Violent showers', 95:'Thunderstorm', 96:'Storm + hail', 99:'Storm + hail' };
const wmoIcon = (c) => c===0?'☀️':c<=2?'⛅':c===3?'☁️':c<50?'🌫️':c<70?'🌦️':c<80?'🌨️':c<83?'🌧️':'⛈️';

function fmtTime(iso) { return iso.slice(11, 16); }
function mmClass(mm) { return mm >= 1 ? 'heavy' : mm >= 0.1 ? 'wet' : ''; }

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function loadAll() {
  $('verdict').className = 'verdict loading';
  $('verdict').textContent = 'Checking…';
  $('verdictSub').textContent = 'Loading forecast…';

  const { lat, lon, model } = state;
  $('placeLabel').textContent = `${lat.toFixed(2)}, ${lon.toFixed(2)} · Craiova area`;
  const tz = 'Europe%2FBucharest';

  const hourlyURL = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code,cloud_cover,precipitation` +
    `&hourly=temperature_2m,precipitation,rain,precipitation_probability,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,weather_code` +
    `&models=${encodeURIComponent(model)}&timezone=${tz}&forecast_days=2`;
  const min15URL = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&minutely_15=precipitation,rain,weather_code&timezone=${tz}&forecast_hours=6&temporal_resolution=native`;

  try {
    const [hourly, min15, rainviewer] = await Promise.all([
      fetchJSON(hourlyURL),
      fetchJSON(min15URL),
      fetchJSON('https://api.rainviewer.com/public/weather-maps.json').catch(() => null),
    ]);
    renderNow(hourly);
    renderMinutes(min15);
    renderHourly(hourly);
    renderRadar(rainviewer);
    $('updatedAt').textContent = 'updated ' + new Date().toLocaleTimeString();
    $('modelTag').textContent = $('modelSelect').selectedOptions[0].textContent;
  } catch (e) {
    $('verdict').className = 'verdict soon';
    $('verdict').textContent = 'Offline?';
    $('verdictSub').textContent = 'Could not load Open-Meteo. Check connection and retry. (' + e.message + ')';
  }
}

function renderNow(d) {
  const c = d.current;
  $('nowTemp').textContent = Math.round(c.temperature_2m) + '°';
  $('nowDesc').textContent = (WMO[c.weather_code] ?? '') + ' ' + wmoIcon(c.weather_code);
  $('nowMeta').textContent = `Cloud ${c.cloud_cover}% · Precip ${c.precipitation} mm`;
}

function renderMinutes(d) {
  const times = d.minutely_15.time, prec = d.minutely_15.precipitation;
  const now = Date.now();
  // find index closest to now
  let start = 0, best = Infinity;
  times.forEach((t, i) => {
    const diff = Math.abs(new Date(t).getTime() - now);
    if (diff < best) { best = diff; start = i; }
  });
  const slots = [];
  for (let i = start; i < Math.min(start + 8, times.length); i++) {
    slots.push({ t: times[i], mm: prec[i] });
  }
  const WET = 0.1;
  const wetIdx = slots.findIndex((s) => s.mm >= WET);
  const verdict = $('verdict'), sub = $('verdictSub');
  if (slots[0].mm >= WET) {
    const dryAfter = slots.findIndex((s) => s.mm < WET);
    verdict.className = 'verdict rain';
    verdict.textContent = 'YES — raining';
    sub.textContent = dryAfter === -1
      ? `Raining now (${slots[0].mm} mm/15min), no break in next 2h.`
      : `Raining now, break in ~${dryAfter * 15} min.`;
  } else if (wetIdx === -1) {
    verdict.className = 'verdict dry';
    verdict.textContent = 'NO rain';
    sub.textContent = 'No rain expected in the next 2 hours.';
  } else {
    verdict.className = 'verdict soon';
    verdict.textContent = `Rain in ~${wetIdx * 15} min`;
    sub.textContent = `Dry now. First rain ${fmtTime(slots[wetIdx].t)} (${slots[wetIdx].mm} mm/15min).`;
  }

  $('minuteBars').innerHTML = slots.map((s) => {
    const h = Math.min(64, 4 + s.mm * 30);
    return `<div class="mbar ${mmClass(s.mm)}">
      <div class="t">${fmtTime(s.t)}</div>
      <div class="bar" style="height:${h}px"></div>
      <div class="v">${s.mm.toFixed(s.mm < 1 ? 2 : 1)}</div>
    </div>`;
  }).join('');
  const total = slots.reduce((a, s) => a + s.mm, 0);
  $('minuteList').innerHTML =
    `Total next 2h: <b style="color:#fff">${total.toFixed(1)} mm</b> · ` +
    slots.map((s) => `${fmtTime(s.t)} ${s.mm >= WET ? '🌧️' + s.mm.toFixed(2) : '·'}`).join(' &nbsp; ');
}

function renderHourly(d) {
  const h = d.hourly, now = Date.now();
  let start = h.time.findIndex((t) => new Date(t).getTime() >= now - 3600e3);
  if (start < 0) start = 0;
  const cards = [];
  for (let i = start; i < Math.min(start + 8, h.time.length); i++) {
    const wet = (h.precipitation[i] ?? 0) >= 0.1;
    cards.push(`<div class="hcard ${wet ? 'wet' : ''}">
      <div class="ht">${fmtTime(h.time[i])} ${wmoIcon(h.weather_code[i])}</div>
      <div class="icons">${wet ? '🌧️' : (h.cloud_cover[i] > 70 ? '☁️' : h.cloud_cover[i] > 30 ? '⛅' : '☀️')}</div>
      <div class="nums">
        <b>${(h.precipitation[i] ?? 0).toFixed(1)} mm</b> rain<br>
        prob <b>${h.precipitation_probability?.[i] ?? '–'}%</b> · ${Math.round(h.temperature_2m[i])}°<br>
        cloud <b>${h.cloud_cover[i]}%</b>
        <div class="cloudbar"><i style="width:${h.cloud_cover[i]}%"></i></div>
        <span style="font-size:.72rem">low ${h.cloud_cover_low[i]}% · mid ${h.cloud_cover_mid[i]}% · high ${h.cloud_cover_high[i]}%</span>
      </div>
    </div>`);
  }
  $('hourly').innerHTML = cards.join('');
}

// ---- Radar (RainViewer ~= EURAD) ----
function renderRadar(rv) {
  if (!rv?.radar?.past?.length) {
    $('radarTime').textContent = 'radar unavailable';
    return;
  }
  radarFrames = [...rv.radar.past, ...(rv.radar.nowcast ?? [])].slice(-14); // ~last 2h incl nowcast
  const host = rv.host;

  if (!map) {
    map = L.map('map', { zoomControl: true, minZoom: 5, maxZoom: 10 }).setView([state.lat, state.lon], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap · radar © RainViewer/EUMETNET OPERA', maxZoom: 19,
    }).addTo(map);
    L.marker([state.lat, state.lon]).addTo(map).bindPopup('You / Craiova').openPopup();
  } else {
    map.setView([state.lat, state.lon], map.getZoom());
    radarLayers.forEach((l) => map.removeLayer(l));
    radarLayers = [];
  }
  radarFrames.forEach((f) => {
    const layer = L.tileLayer(host + f.path + '/256/{z}/{x}/{y}/2/1_1.png', { opacity: 0.75, zIndex: 10, minZoom: 5, maxZoom: 10 });
    radarLayers.push(layer);
  });
  const slider = $('radarSlider');
  slider.max = radarLayers.length - 1;
  showFrame(radarLayers.length - 1);
  slider.oninput = () => { stopPlay(); showFrame(parseInt(slider.value, 10)); };
}

function showFrame(i) {
  radarLayers.forEach((l, j) => { if (map.hasLayer(l)) map.removeLayer(l); if (j === i) l.addTo(map); });
  radarIdx = i;
  $('radarSlider').value = i;
  const f = radarFrames[i];
  if (f) {
    const dt = new Date(f.time * 1000);
    $('radarTime').textContent = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
      (i >= radarFrames.length - (radarFrames.length - $('radarSlider').max) ? '' : '');
  }
}
function stopPlay() {
  if (playTimer) { clearInterval(playTimer); playTimer = null; $('playBtn').textContent = '▶ Play'; }
}
$('playBtn').onclick = () => {
  if (playTimer) return stopPlay();
  $('playBtn').textContent = '⏸ Pause';
  playTimer = setInterval(() => showFrame((radarIdx + 1) % radarLayers.length), 700);
};

// ---- Controls ----
function syncInputs() {
  $('latInput').value = state.lat.toFixed(2);
  $('lonInput').value = state.lon.toFixed(2);
  $('modelSelect').value = state.model;
}
$('refreshBtn').onclick = () => {
  state.lat = parseFloat($('latInput').value) || 44.33;
  state.lon = parseFloat($('lonInput').value) || 23.8;
  state.model = $('modelSelect').value;
  store.set('rc_lat', String(state.lat)); store.set('rc_lon', String(state.lon)); store.set('rc_model', state.model);
  loadAll();
};
$('locateBtn').onclick = () => {
  navigator.geolocation?.getCurrentPosition((p) => {
    state.lat = +p.coords.latitude.toFixed(2); state.lon = +p.coords.longitude.toFixed(2);
    syncInputs(); $('refreshBtn').click();
  }, () => alert('Geolocation denied.'), { timeout: 8000 });
};
// PWA install prompt
let deferred;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); deferred = e; $('installBtn').hidden = false;
});
$('installBtn').onclick = () => deferred?.prompt();

syncInputs();
loadAll();
setInterval(loadAll, 10 * 60 * 1000);
