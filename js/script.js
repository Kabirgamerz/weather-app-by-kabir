/* ============================================
   ATMOSFERA — script.js
   Features:
   - Custom cursor + trail
   - Canvas particle system (weather-aware)
   - 3D orb color transitions
   - API fetch with async/await
   - 5-day forecast
   - Geolocation
   - °C/°F toggle
   - Error handling + loading
   - Live clock
   - Dynamic weather worlds
   ============================================ */

const API_KEY  = "bd5e378503939ddaee76f12ad7a97608"; /* ← paste your OpenWeatherMap key */
const BASE_URL = "https://api.openweathermap.org/data/2.5";

let currentUnit = "metric";
let lastCity    = "";
let lastData    = null;

/* ============================================
   CUSTOM CURSOR
   ============================================ */
function initCursor() {
  const cursor      = document.getElementById('cursor');
  const cursorTrail = document.getElementById('cursorTrail');
  if (!cursor || !cursorTrail) return;

  let mouseX = 0, mouseY = 0;
  let trailX = 0, trailY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursor.style.left = mouseX + 'px';
    cursor.style.top  = mouseY + 'px';
  });

  /* Trail lags behind for depth effect */
  function animateTrail() {
    trailX += (mouseX - trailX) * 0.12;
    trailY += (mouseY - trailY) * 0.12;
    cursorTrail.style.left = trailX + 'px';
    cursorTrail.style.top  = trailY + 'px';
    requestAnimationFrame(animateTrail);
  }
  animateTrail();

  /* Scale up on interactive elements */
  document.querySelectorAll('button, a, input').forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursor.style.width  = '20px';
      cursor.style.height = '20px';
      cursor.style.opacity = '0.6';
    });
    el.addEventListener('mouseleave', () => {
      cursor.style.width  = '12px';
      cursor.style.height = '12px';
      cursor.style.opacity = '1';
    });
  });
}

/* ============================================
   PARTICLE SYSTEM — canvas-based
   Particles change based on weather condition
   ============================================ */
let particles = [];
let particleType = 'stars'; /* stars | rain | snow | dust */
let animFrameId;

function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function spawnParticle() {
    const types = {
      stars: { x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: 0, vy: 0, size: Math.random() * 2 + 0.5, opacity: Math.random() * 0.8 + 0.2, twinkle: Math.random() * Math.PI * 2, life: 1 },
      rain:  { x: Math.random() * canvas.width, y: -20, vx: -1.5, vy: Math.random() * 14 + 8, size: Math.random() * 1.5 + 0.5, opacity: Math.random() * 0.4 + 0.2, life: 1 },
      snow:  { x: Math.random() * canvas.width, y: -10, vx: Math.random() * 2 - 1, vy: Math.random() * 2 + 0.8, size: Math.random() * 4 + 2, opacity: Math.random() * 0.7 + 0.3, wobble: Math.random() * Math.PI * 2, life: 1 },
      dust:  { x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: Math.random() * 0.6 - 0.3, vy: -Math.random() * 0.4, size: Math.random() * 3 + 1, opacity: Math.random() * 0.3 + 0.1, life: 1 },
    };
    return types[particleType] || types.stars;
  }

  /* Init pool */
  const counts = { stars: 120, rain: 180, snow: 100, dust: 80 };
  particles = Array.from({ length: counts[particleType] || 120 }, spawnParticle);

  /* Get particle color from CSS variable */
  function getParticleColor(opacity) {
    const style = getComputedStyle(document.documentElement);
    const raw = style.getPropertyValue('--particle').trim() || '#bfdbfe';
    /* Convert hex to rgba */
    if (raw.startsWith('#')) {
      const r = parseInt(raw.slice(1,3),16);
      const g = parseInt(raw.slice(3,5),16);
      const b = parseInt(raw.slice(5,7),16);
      return `rgba(${r},${g},${b},${opacity})`;
    }
    return raw;
  }

  function drawParticle(p) {
    ctx.save();
    const color = getParticleColor(p.opacity);

    if (particleType === 'stars') {
      /* Twinkling stars */
      const twinkleOpacity = p.opacity * (0.6 + 0.4 * Math.sin(p.twinkle));
      ctx.fillStyle = getParticleColor(twinkleOpacity);
      ctx.shadowBlur = 6;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();

    } else if (particleType === 'rain') {
      /* Rain streaks */
      ctx.strokeStyle = color;
      ctx.lineWidth = p.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 3, p.y + p.vy * 3);
      ctx.stroke();

    } else if (particleType === 'snow') {
      /* Snowflakes */
      ctx.fillStyle = getParticleColor(p.opacity);
      ctx.shadowBlur = 8;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();

    } else if (particleType === 'dust') {
      /* Floating dust motes */
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function updateParticle(p) {
    if (particleType === 'stars') {
      p.twinkle += 0.04;
    } else if (particleType === 'rain') {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y > canvas.height + 20) {
        p.x = Math.random() * canvas.width;
        p.y = -20;
      }
    } else if (particleType === 'snow') {
      p.wobble += 0.03;
      p.x += p.vx + Math.sin(p.wobble) * 0.5;
      p.y += p.vy;
      if (p.y > canvas.height + 20) {
        p.x = Math.random() * canvas.width;
        p.y = -10;
      }
    } else if (particleType === 'dust') {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -10) p.y = canvas.height + 10;
      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;
    }
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { drawParticle(p); updateParticle(p); });
    animFrameId = requestAnimationFrame(loop);
  }

  if (animFrameId) cancelAnimationFrame(animFrameId);
  loop();
}

function setParticleType(condition, isDay) {
  const prev = particleType;
  if (condition === 'Rain' || condition === 'Drizzle') particleType = 'rain';
  else if (condition === 'Snow')                       particleType = 'snow';
  else if (['Mist','Fog','Haze','Smoke','Dust','Sand','Ash'].includes(condition)) particleType = 'dust';
  else if (condition === 'Clear' && !isDay)            particleType = 'stars';
  else                                                 particleType = 'stars';

  if (prev !== particleType) {
    const counts = { stars:120, rain:180, snow:100, dust:80 };
    const canvas = document.getElementById('particle-canvas');
    particles = Array.from({ length: counts[particleType] }, () => {
      return { x: Math.random()*(canvas?.width||1920), y: Math.random()*(canvas?.height||1080),
               vx: particleType==='rain'?-1.5:Math.random()*2-1,
               vy: particleType==='rain'?Math.random()*14+8:Math.random()*2+0.8,
               size: Math.random()*3+1, opacity: Math.random()*0.7+0.2,
               twinkle: Math.random()*Math.PI*2, wobble: Math.random()*Math.PI*2 };
    });
  }
}

/* ============================================
   WEATHER WORLD THEMES
   ============================================ */
function applyWorld(condition, isDay) {
  const worlds = ['world-sunny','world-clear-night','world-rain','world-storm','world-snow','world-clouds','world-haze'];
  document.body.classList.remove(...worlds);

  const map = {
    'Clear':        isDay ? 'world-sunny' : 'world-clear-night',
    'Clouds':       'world-clouds',
    'Rain':         'world-rain',
    'Drizzle':      'world-rain',
    'Thunderstorm': 'world-storm',
    'Snow':         'world-snow',
    'Mist':         'world-haze',
    'Fog':          'world-haze',
    'Haze':         'world-haze',
    'Smoke':        'world-haze',
    'Dust':         'world-haze',
    'Sand':         'world-haze',
    'Tornado':      'world-storm',
  };

  document.body.classList.add(map[condition] || 'world-clear-night');
  setParticleType(condition, isDay);
}

/* ============================================
   API — FETCH CURRENT WEATHER
   ============================================ */
async function fetchWeather(city) {
  showLoading();
  lastCity = city;

  const url = `${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${currentUnit}`;

  try {
    const res  = await fetch(url);
    const data = await res.json();

    if (data.cod !== 200) {
      showError(data.cod === 401
        ? '⚠️ Invalid API key — check script.js line 1'
        : '🔍 City not found — try another spelling');
      return;
    }

    lastData = data;
    renderWeather(data);

  } catch (err) {
    showError('🌐 Network error — check your connection');
    console.error(err);
  } finally {
    hideLoading();
  }
}

async function fetchForecast(city) {
  const loadEl  = document.getElementById('forecastLoading');
  const gridEl  = document.getElementById('forecastGrid');
  const hourEl  = document.getElementById('hourlyRow');
  const labelEl = document.getElementById('forecastCityLabel');
  const errEl   = document.getElementById('forecastError');

  if (loadEl)  { loadEl.style.display = 'block'; }
  if (gridEl)  gridEl.innerHTML = '';
  if (errEl)   errEl.style.display = 'none';

  const url = `${BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${currentUnit}`;

  try {
    const res  = await fetch(url);
    const data = await res.json();

    if (data.cod !== '200') {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'City not found or invalid API key.'; }
      if (loadEl) loadEl.style.display = 'none';
      return;
    }

    if (labelEl) labelEl.textContent = `${data.city.name}, ${data.city.country}`;
    if (loadEl)  loadEl.style.display = 'none';

    /* Apply world theme from first entry */
    const first = data.list[0];
    applyWorld(first.weather[0].main, first.weather[0].icon.endsWith('d'));

    /* Group by day */
    const daily = {};
    data.list.forEach(e => {
      const d = e.dt_txt.split(' ')[0];
      if (!daily[d]) daily[d] = [];
      daily[d].push(e);
    });

    buildForecastCards(Object.entries(daily).slice(0,5));
    if (hourEl) buildHourly(data.list.slice(0,8));

  } catch (err) {
    if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Network error.'; }
    if (loadEl) loadEl.style.display = 'none';
  }
}

/* ============================================
   RENDER WEATHER
   ============================================ */
function renderWeather(data) {
  const unit     = currentUnit === 'metric' ? '°C' : '°F';
  const windUnit = currentUnit === 'metric' ? 'm/s' : 'mph';
  const iconCode = data.weather[0].icon;
  const isDay    = iconCode.endsWith('d');

  applyWorld(data.weather[0].main, isDay);

  const set = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  const setH = (id, v) => { const el=document.getElementById(id); if(el) el.innerHTML=v; };

  set('weatherCity',    data.name);
  set('weatherCountry', data.sys.country);
  setH('weatherTemp',  `${Math.round(data.main.temp)}<sup>${unit}</sup>`);
  set('weatherDesc',   data.weather[0].description);
  set('weatherFeels',  `Feels like ${Math.round(data.main.feels_like)}${unit}`);
  set('weatherIcon',   getEmoji(data.weather[0].id, isDay));
  set('weatherHumidity',   `${data.main.humidity}%`);
  set('weatherWind',        `${data.wind.speed} ${windUnit}`);
  set('weatherPressure',    `${data.main.pressure} hPa`);
  set('weatherVisibility',  data.visibility ? `${(data.visibility/1000).toFixed(1)} km` : 'N/A');
  set('weatherSunrise',     fmtUnix(data.sys.sunrise));
  set('weatherSunset',      fmtUnix(data.sys.sunset));

  const panel = document.getElementById('resultPanel');
  if (panel) panel.classList.add('visible');
}

/* ============================================
   BUILD FORECAST CARDS
   ============================================ */
function buildForecastCards(days) {
  const grid = document.getElementById('forecastGrid');
  if (!grid) return;

  const unit  = currentUnit === 'metric' ? '°C' : '°F';
  const today = new Date().toDateString();

  grid.innerHTML = days.map(([dateStr, entries]) => {
    const mid   = entries.find(e => e.dt_txt.includes('12:00:00')) || entries[0];
    const date  = new Date(dateStr + 'T12:00:00');
    const isT   = date.toDateString() === today;
    const minT  = Math.round(Math.min(...entries.map(e => e.main.temp_min)));
    const maxT  = Math.round(Math.max(...entries.map(e => e.main.temp_max)));

    return `
      <div class="fc-card${isT ? ' today' : ''}">
        <span class="fc-day">${isT ? 'Today' : date.toLocaleDateString('en-IN',{weekday:'short'})}</span>
        <span class="fc-date">${date.toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
        <span class="fc-icon">${getEmoji(mid.weather[0].id, true)}</span>
        <span class="fc-max">${maxT}${unit}</span>
        <span class="fc-min">↓ ${minT}${unit}</span>
        <span class="fc-desc">${mid.weather[0].description}</span>
      </div>`;
  }).join('');
}

function buildHourly(entries) {
  const row = document.getElementById('hourlyRow');
  if (!row) return;
  const unit = currentUnit === 'metric' ? '°C' : '°F';

  row.innerHTML = entries.map(e => {
    const t    = new Date(e.dt * 1000);
    const time = t.toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit',hour12:true});
    return `
      <div class="hr-card">
        <span class="hr-time">${time}</span>
        <span class="hr-icon">${getEmoji(e.weather[0].id, e.weather[0].icon.endsWith('d'))}</span>
        <span class="hr-temp">${Math.round(e.main.temp)}${unit}</span>
      </div>`;
  }).join('');
}

/* ============================================
   ERROR & LOADING
   ============================================ */
function showError(msg) {
  hideLoading();
  const toast = document.getElementById('errorToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 4000);
}

function showLoading() {
  const ov = document.getElementById('loadingOverlay');
  if (ov) ov.classList.add('visible');
}

function hideLoading() {
  const ov = document.getElementById('loadingOverlay');
  if (ov) ov.classList.remove('visible');
}

/* ============================================
   EMOJI MAP
   ============================================ */
function getEmoji(code, isDay=true) {
  if (code >= 200 && code < 300) return '⛈️';
  if (code >= 300 && code < 400) return '🌦️';
  if (code >= 500 && code < 600) return code >= 502 ? '🌧️' : '🌦️';
  if (code >= 600 && code < 700) return code === 611 ? '🌨️' : '❄️';
  if (code >= 700 && code < 800) return '🌫️';
  if (code === 800)  return isDay ? '☀️' : '🌙';
  if (code === 801)  return isDay ? '🌤️' : '☁️';
  if (code === 802)  return '⛅';
  if (code >= 803)   return '☁️';
  return '🌡️';
}

/* ============================================
   GEOLOCATION
   ============================================ */
function getLocationWeather() {
  if (!navigator.geolocation) { showError('Geolocation not supported by your browser.'); return; }
  showLoading();

  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      const url = `${BASE_URL}/weather?lat=${coords.latitude}&lon=${coords.longitude}&appid=${API_KEY}&units=${currentUnit}`;
      try {
        const res  = await fetch(url);
        const data = await res.json();
        if (data.cod !== 200) { showError('Could not get weather for your location.'); return; }
        lastCity = data.name;
        lastData = data;
        renderWeather(data);
        const inp = document.getElementById('searchInput');
        if (inp) inp.value = data.name;
      } catch { showError('Network error fetching location weather.'); }
      finally  { hideLoading(); }
    },
    err => {
      hideLoading();
      const m = { 1:'Location permission denied.', 2:'Location unavailable.', 3:'Location timeout.' };
      showError(m[err.code] || 'Could not get your location.');
    }
  );
}

/* ============================================
   UNIT TOGGLE
   ============================================ */
function toggleUnit(unit) {
  if (unit === currentUnit) return;
  currentUnit = unit;

  document.querySelectorAll('.unit-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.unit === unit);
  });

  if (lastCity) fetchWeather(lastCity);
}

/* ============================================
   SEARCH
   ============================================ */
function handleSearch(inputId = 'searchInput') {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const city = inp.value.trim();
  if (!city) { inp.focus(); return; }
  fetchWeather(city);
}

function handleForecastSearch() {
  const inp = document.getElementById('forecastSearchInput');
  if (!inp) return;
  const city = inp.value.trim();
  if (city) fetchForecast(city);
}

/* ============================================
   LIVE CLOCK
   ============================================ */
function initClock() {
  function tick() {
    const now  = new Date();
    const date = now.toLocaleDateString('en-IN', {weekday:'long',day:'numeric',month:'long',year:'numeric'});
    const time = now.toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});

    const dEl = document.getElementById('currentDate');
    const tEl = document.getElementById('currentTime');
    if (dEl) dEl.textContent = date;
    if (tEl) tEl.textContent = time;
  }
  tick();
  setInterval(tick, 1000);
}

/* ============================================
   KEYBOARD SHORTCUTS
   ============================================ */
function initKeyboard() {
  ['searchInput','forecastSearchInput'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      id === 'forecastSearchInput' ? handleForecastSearch() : handleSearch(id);
    });
  });
}

/* ============================================
   MOBILE MENU
   ============================================ */
function toggleMenu() {
  document.getElementById('hamburger')?.classList.toggle('open');
  document.getElementById('mobileMenu')?.classList.toggle('open');
}

/* ============================================
   HELPER — format unix timestamp
   ============================================ */
function fmtUnix(ts) {
  return new Date(ts * 1000).toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit',hour12:true});
}

/* ============================================
   INIT
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
  initCursor();
  initParticles();
  initClock();
  initKeyboard();

  /* Auto-load forecast page */
  if (document.getElementById('forecastGrid')) {
    fetchForecast('Mumbai');
  }
});
