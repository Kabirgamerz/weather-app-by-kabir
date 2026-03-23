/* ============================================
   SKYCAST — Main JavaScript File
   js/script.js

   FEATURES:
   1.  API Configuration  — OpenWeatherMap setup
   2.  fetchWeather()     — fetch() with async/await
   3.  fetchForecast()    — 5-day forecast API call
   4.  renderWeather()    — inject data into DOM
   5.  renderForecast()   — build forecast cards
   6.  Error Handling     — invalid city message
   7.  Loading Spinner    — shown while fetching
   8.  Date & Time        — live clock display
   9.  Weather Themes     — dynamic background
   10. Weather Icons      — emoji mapped to codes
   11. Geolocation        — detect user location
   12. Unit Toggle        — °C ↔ °F conversion
   13. Mobile Menu        — hamburger toggle
   ============================================ */


/* ==================================================
   1. API CONFIGURATION
   ================================================

   HOW TO GET YOUR FREE API KEY:
   1. Go to https://openweathermap.org
   2. Click "Sign In" → "Create an Account" (free)
   3. After signing in, go to your profile → "My API Keys"
   4. Copy your default key (or create a new one)
   5. Replace "YOUR_API_KEY_HERE" below with your key

   The free plan allows:
   - 60 API calls per minute
   - Current weather endpoint
   - 5-day / 3-hour forecast endpoint
   - No credit card required

   ================================================ */
const API_KEY  = "bd5e378503939ddaee76f12ad7a97608";   /* ← PASTE YOUR KEY HERE */
const BASE_URL = "https://api.openweathermap.org/data/2.5";


/* ==================================================
   2. STATE — tracks current data
   ================================================== */
let currentUnit = "metric";   /* "metric" = °C  |  "imperial" = °F */
let lastCity    = "";         /* remember last searched city */
let lastWeatherData = null;   /* cache last API response for unit toggle */


/* ==================================================
   3. FETCH CURRENT WEATHER
   ================================================

   HOW API FETCH WORKS (step by step):
   ─────────────────────────────────
   a) Build the URL with city name + API key + units
   b) Call fetch() — this sends an HTTP GET request
   c) await means "wait for the response before continuing"
   d) .json() converts the response text → JavaScript object
   e) Check if API returned an error (status 404 = city not found)
   f) Call renderWeather() with the data object

   The JSON response looks like:
   {
     "name": "Mumbai",
     "sys": { "country": "IN", "sunrise": 1720050000, "sunset": 1720096800 },
     "main": { "temp": 31.2, "feels_like": 36, "humidity": 78, "pressure": 1008 },
     "weather": [{ "id": 801, "description": "few clouds", "icon": "02d" }],
     "wind": { "speed": 5.1, "deg": 240 },
     "visibility": 8000
   }
   ================================================ */
async function fetchWeather(city) {
  showLoading();
  lastCity = city;

  /* Build the API URL */
  const url = `${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${currentUnit}`;

  try {
    /* Step 1: Send the HTTP request */
    const response = await fetch(url);

    /* Step 2: Convert response to a JS object */
    const data = await response.json();

    /* Step 3: Check for errors */
    if (data.cod !== 200) {
      /* API returned an error — city not found or invalid key */
      showError(
        data.cod === 401
          ? "Invalid API key. Please check your API key in script.js."
          : "City not found. Please check the spelling and try again."
      );
      return;
    }

    /* Step 4: Cache data and render */
    lastWeatherData = data;
    renderWeather(data);

  } catch (error) {
    /* Network error — user is offline or API is down */
    showError("Network error. Please check your internet connection and try again.");
    console.error("Weather fetch error:", error);
  }
}


/* ==================================================
   4. FETCH 5-DAY FORECAST
   ================================================

   The forecast API returns data every 3 hours for 5 days.
   We group it by day and take the midday entry for each day.
   ================================================ */
async function fetchForecast(city) {
  const loadingEl  = document.getElementById('forecastLoading');
  const gridEl     = document.getElementById('forecastGrid');
  const hourlyEl   = document.getElementById('hourlyRow');
  const errorEl    = document.getElementById('forecastError');
  const cityLabel  = document.getElementById('forecastCityLabel');

  if (loadingEl) loadingEl.style.display = 'block';
  if (gridEl)    gridEl.innerHTML = '';
  if (errorEl)   errorEl.style.display = 'none';

  const url = `${BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${currentUnit}`;

  try {
    const response = await fetch(url);
    const data     = await response.json();

    if (data.cod !== "200") {
      if (errorEl) {
        errorEl.style.display = 'block';
        errorEl.textContent = data.cod === 401
          ? "Invalid API key."
          : "City not found. Please search again.";
      }
      if (loadingEl) loadingEl.style.display = 'none';
      return;
    }

    if (cityLabel) cityLabel.textContent = `${data.city.name}, ${data.city.country}`;
    if (loadingEl) loadingEl.style.display = 'none';

    /* Group 3-hourly entries by day date string */
    const dailyMap = {};
    data.list.forEach(entry => {
      const dateStr = entry.dt_txt.split(" ")[0]; /* "2025-07-20" */
      if (!dailyMap[dateStr]) dailyMap[dateStr] = [];
      dailyMap[dateStr].push(entry);
    });

    /* Take the entry closest to midday (12:00) for each day */
    const days = Object.entries(dailyMap).slice(0, 5);
    renderForecastCards(days);

    /* Hourly row — next 8 entries (24 hrs) */
    if (hourlyEl) renderHourly(data.list.slice(0, 8));

  } catch (error) {
    if (errorEl) { errorEl.style.display = 'block'; errorEl.textContent = "Network error. Please check your connection."; }
    if (loadingEl) loadingEl.style.display = 'none';
    console.error("Forecast fetch error:", error);
  }
}


/* ==================================================
   5. RENDER CURRENT WEATHER TO DOM
   Picks out data from the API response and injects
   it into the HTML elements by their id.
   ================================================ */
function renderWeather(data) {
  hideLoading();

  const unit    = currentUnit === "metric" ? "°C" : "°F";
  const windUnit = currentUnit === "metric" ? "m/s" : "mph";
  const iconCode = data.weather[0].icon;
  const isDay    = iconCode.endsWith('d');

  /* Set weather theme (changes background gradient) */
  applyWeatherTheme(data.weather[0].main, isDay);

  /* Helper: set inner text by element id */
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setHTML = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };

  /* City + country */
  set('weatherCity',    data.name);
  set('weatherCountry', data.sys.country);

  /* Temperature */
  setHTML('weatherTemp', `${Math.round(data.main.temp)}<sup>${unit}</sup>`);
  set('weatherDesc',   data.weather[0].description);
  set('weatherFeels',  `Feels like ${Math.round(data.main.feels_like)}${unit}`);

  /* Weather emoji icon */
  set('weatherIcon', getWeatherEmoji(data.weather[0].id, isDay));

  /* Stats */
  set('weatherHumidity',   `${data.main.humidity}%`);
  set('weatherWind',       `${data.wind.speed} ${windUnit}`);
  set('weatherPressure',   `${data.main.pressure} hPa`);
  set('weatherVisibility', data.visibility ? `${(data.visibility / 1000).toFixed(1)} km` : 'N/A');

  /* Sunrise & Sunset — convert Unix timestamp → local time */
  set('weatherSunrise', formatUnixTime(data.sys.sunrise));
  set('weatherSunset',  formatUnixTime(data.sys.sunset));

  /* Show the result card */
  const resultEl = document.getElementById('weatherResult');
  if (resultEl) resultEl.classList.add('visible');

  /* Hide no-search placeholder */
  const noSearch = document.getElementById('noSearchState');
  if (noSearch) noSearch.classList.remove('visible');
}


/* ==================================================
   6. RENDER FORECAST CARDS
   ================================================ */
function renderForecastCards(days) {
  const gridEl = document.getElementById('forecastGrid');
  if (!gridEl) return;

  const unit     = currentUnit === "metric" ? "°C" : "°F";
  const today    = new Date().toDateString();

  gridEl.innerHTML = days.map(([dateStr, entries], index) => {
    /* Pick midday entry, fallback to first */
    const midday = entries.find(e => e.dt_txt.includes("12:00:00")) || entries[0];
    const date   = new Date(dateStr + "T12:00:00");
    const isToday = date.toDateString() === today;
    const isDay  = true; /* forecasts default to day icon */

    const minTemp = Math.round(Math.min(...entries.map(e => e.main.temp_min)));
    const maxTemp = Math.round(Math.max(...entries.map(e => e.main.temp_max)));

    return `
      <div class="forecast-card glass${isToday ? ' today' : ''}">
        <span class="forecast-day">${isToday ? 'Today' : date.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
        <span class="forecast-date">${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
        <span class="forecast-icon">${getWeatherEmoji(midday.weather[0].id, isDay)}</span>
        <span class="forecast-temp">${maxTemp}${unit}</span>
        <span class="forecast-low">↓ ${minTemp}${unit}</span>
        <span class="forecast-desc">${midday.weather[0].description}</span>
      </div>
    `;
  }).join('');
}


/* Hourly strip */
function renderHourly(entries) {
  const el = document.getElementById('hourlyRow');
  if (!el) return;

  const unit = currentUnit === "metric" ? "°C" : "°F";

  el.innerHTML = entries.map(entry => {
    const time   = new Date(entry.dt * 1000);
    const hour   = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const isDay  = entry.weather[0].icon.endsWith('d');
    return `
      <div class="hourly-card glass-2">
        <span class="hourly-time">${hour}</span>
        <span class="hourly-icon">${getWeatherEmoji(entry.weather[0].id, isDay)}</span>
        <span class="hourly-temp">${Math.round(entry.main.temp)}${unit}</span>
      </div>
    `;
  }).join('');
}


/* ==================================================
   7. ERROR HANDLING
   Shows a user-friendly message when city not found
   or network fails.
   ================================================ */
function showError(message) {
  const loadingEl = document.getElementById('loadingState');
  const errorEl   = document.getElementById('errorState');
  const resultEl  = document.getElementById('weatherResult');
  const msgEl     = document.getElementById('errorMessage');

  if (loadingEl) loadingEl.classList.remove('visible');
  if (resultEl)  resultEl.classList.remove('visible');

  if (msgEl)   msgEl.textContent = message;
  if (errorEl) errorEl.classList.add('visible');
}


/* ==================================================
   8. LOADING SPINNER
   Shown while API request is in-flight.
   ================================================ */
function showLoading() {
  const loadingEl = document.getElementById('loadingState');
  const errorEl   = document.getElementById('errorState');
  const resultEl  = document.getElementById('weatherResult');
  const noSearch  = document.getElementById('noSearchState');

  if (loadingEl) loadingEl.classList.add('visible');
  if (errorEl)   errorEl.classList.remove('visible');
  if (resultEl)  resultEl.classList.remove('visible');
  if (noSearch)  noSearch.classList.remove('visible');
}

function hideLoading() {
  const loadingEl = document.getElementById('loadingState');
  if (loadingEl) loadingEl.classList.remove('visible');
}


/* ==================================================
   9. LIVE DATE & TIME DISPLAY
   Updates every second using setInterval.
   ================================================ */
function initClock() {
  function updateClock() {
    const now  = new Date();
    const date = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    const dateEl = document.getElementById('currentDate');
    const timeEl = document.getElementById('currentTime');
    if (dateEl) dateEl.textContent = date;
    if (timeEl) timeEl.textContent = time;
  }

  updateClock();
  setInterval(updateClock, 1000);
}


/* ==================================================
   10. WEATHER BACKGROUND THEMES
   Changes the CSS class on <body> based on condition.
   The CSS variables shift the gradient accordingly.
   ================================================ */
function applyWeatherTheme(condition, isDay) {
  /* Remove all existing weather classes */
  document.body.classList.remove(
    'weather-clear-day', 'weather-clear-night',
    'weather-clouds', 'weather-rain',
    'weather-thunderstorm', 'weather-snow', 'weather-haze'
  );

  /* Map API condition string to CSS class */
  const themeMap = {
    'Clear':        isDay ? 'weather-clear-day' : 'weather-clear-night',
    'Clouds':       'weather-clouds',
    'Rain':         'weather-rain',
    'Drizzle':      'weather-rain',
    'Thunderstorm': 'weather-thunderstorm',
    'Snow':         'weather-snow',
    'Mist':         'weather-haze',
    'Fog':          'weather-haze',
    'Haze':         'weather-haze',
    'Smoke':        'weather-haze',
    'Dust':         'weather-haze',
    'Sand':         'weather-haze',
    'Ash':          'weather-haze',
    'Squall':       'weather-rain',
    'Tornado':      'weather-thunderstorm'
  };

  const cls = themeMap[condition] || 'weather-clear-day';
  document.body.classList.add(cls);
}


/* ==================================================
   11. WEATHER EMOJI ICONS
   Maps OpenWeather condition codes to emojis.
   Full list: https://openweathermap.org/weather-conditions
   ================================================ */
function getWeatherEmoji(code, isDay = true) {
  if (code >= 200 && code < 300) return '⛈️';   /* Thunderstorm */
  if (code >= 300 && code < 400) return '🌦️';   /* Drizzle */
  if (code >= 500 && code < 600) {
    if (code === 511) return '🌨️';               /* Freezing rain */
    return code >= 502 ? '🌧️' : '🌧️';           /* Heavy / Light rain */
  }
  if (code >= 600 && code < 700) return '❄️';   /* Snow */
  if (code >= 700 && code < 800) return '🌫️';   /* Atmosphere (fog/haze) */
  if (code === 800) return isDay ? '☀️' : '🌙'; /* Clear */
  if (code === 801) return isDay ? '🌤️' : '☁️'; /* Few clouds */
  if (code === 802) return '⛅';                 /* Scattered clouds */
  if (code >= 803) return '☁️';                 /* Overcast */
  return '🌡️';                                  /* Fallback */
}


/* ==================================================
   12. GEOLOCATION — detect user's location
   Uses the browser's built-in Geolocation API.
   ================================================ */
function getLocationWeather() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  showLoading();

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      /* Got coordinates — fetch weather by lat/lon */
      const { latitude, longitude } = position.coords;
      const url = `${BASE_URL}/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=${currentUnit}`;

      try {
        const response = await fetch(url);
        const data     = await response.json();

        if (data.cod !== 200) { showError("Could not fetch weather for your location."); return; }

        lastCity = data.name;
        lastWeatherData = data;
        renderWeather(data);

        /* Update search input to show detected city */
        const input = document.getElementById('searchInput');
        if (input) input.value = data.name;

      } catch (err) {
        showError("Failed to fetch weather for your location. Please try again.");
      }
    },
    (error) => {
      hideLoading();
      const msgs = {
        1: "Location permission denied. Please allow location access.",
        2: "Location unavailable. Try searching manually.",
        3: "Location request timed out. Try searching manually."
      };
      showError(msgs[error.code] || "Could not determine your location.");
    }
  );
}


/* ==================================================
   13. °C / °F UNIT TOGGLE
   Converts the displayed temperature without re-fetching.
   ================================================ */
function toggleUnit(unit) {
  if (unit === currentUnit) return;
  currentUnit = unit;

  /* Update active button state */
  document.querySelectorAll('.unit-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.unit === unit);
  });

  /* Re-fetch with new unit if we have a city */
  if (lastCity) {
    fetchWeather(lastCity);
  }
}


/* ==================================================
   14. SEARCH HANDLER
   Called by the Search button and Enter key.
   ================================================ */
function handleSearch(inputId = 'searchInput') {
  const input = document.getElementById(inputId);
  if (!input) return;

  const city = input.value.trim();
  if (!city) {
    input.focus();
    input.style.borderColor = 'rgba(255,100,100,0.7)';
    setTimeout(() => input.style.borderColor = '', 1500);
    return;
  }

  fetchWeather(city);
}


/* ==================================================
   HELPER: Format Unix timestamp → "HH:MM AM/PM"
   ================================================ */
function formatUnixTime(unix) {
  return new Date(unix * 1000).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}


/* ==================================================
   MOBILE MENU
   ================================================ */
function toggleMenu() {
  document.getElementById('hamburger')?.classList.toggle('open');
  document.getElementById('mobileMenu')?.classList.toggle('open');
}


/* ==================================================
   KEYBOARD SHORTCUT — Enter to search
   ================================================ */
function initKeyboard() {
  ['searchInput', 'forecastSearchInput'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        id === 'forecastSearchInput' ? handleForecastSearch() : handleSearch(id);
      }
    });
  });
}


/* Forecast page search */
function handleForecastSearch() {
  const input = document.getElementById('forecastSearchInput');
  if (!input) return;
  const city = input.value.trim();
  if (city) fetchForecast(city);
}


/* ==================================================
   INIT — run on every page load
   ================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initClock();       /* Start live clock */
  initKeyboard();    /* Attach keyboard shortcuts */

  /* Auto-detect if we're on forecast.html */
  if (document.getElementById('forecastGrid')) {
    /* Default to a popular city on forecast page */
    fetchForecast("Mumbai");
  }

  /* Show the no-search placeholder on home page */
  const noSearch = document.getElementById('noSearchState');
  if (noSearch) noSearch.classList.add('visible');
});
