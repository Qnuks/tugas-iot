const API_BASE_URL =
  window.APP_CONFIG?.API_BASE_URL || "http://localhost:3000";
const STORAGE_KEY = "semai-auth";
const DEFAULT_EMAIL = "admin@semai.com";
const DEFAULT_PASSWORD = "admin123";

const app = document.getElementById("app");

const state = {
  auth: loadAuth(),
  telemetry: [],
  systemStatus: null,
  actuatorMap: {
    pump: { is_on: false, mode: "manual", actuator_type: "pump" },
    fan: { is_on: false, mode: "manual", actuator_type: "fan" },
    lamp: { is_on: false, mode: "manual", actuator_type: "lamp" }
  },
  lastUpdated: null
};

let refreshTimer = null;

function loadAuth() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch (_error) {
    return null;
  }
}

function saveAuth(auth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function formatValue(value, suffix = "") {
  if (value === null || value === undefined || value === "") {
    return `--${suffix}`;
  }

  const number = Number(value);
  if (Number.isNaN(number)) {
    return `--${suffix}`;
  }

  return `${number.toFixed(1)}${suffix}`;
}

function percentageWidth(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return 0;
  return Math.max(0, Math.min(100, number));
}

function formatDateTime(value) {
  if (!value) return "--:--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return date.toLocaleString("id-ID");
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = isJson ? payload.message : "Request gagal.";
    throw new Error(message);
  }

  return payload;
}

function render() {
  if (!state.auth) {
    renderLogin();
    return;
  }

  renderDashboard();
}

function startAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  refreshTimer = setInterval(refreshDashboard, 5000);
}

function renderLogin(errorMessage = "") {
  app.innerHTML = `
    <section class="screen login-screen">
      <div class="login-card">
        <div class="brand">
          <div class="brand-badge">🌱 <span>Semai IoT</span></div>
          <div class="brand-subtitle">Greenhouse Monitoring System</div>
        </div>

        <form id="login-form">
          <div class="form-group">
            <label class="form-label" for="email">Email</label>
            <input class="input" id="email" name="email" type="email" value="${escapeHtml(DEFAULT_EMAIL)}" required />
          </div>

          <div class="form-group">
            <label class="form-label" for="password">Password</label>
            <input class="input" id="password" name="password" type="password" value="${escapeHtml(DEFAULT_PASSWORD)}" required />
          </div>

          <button class="btn btn-primary" type="submit">Login</button>
          <div class="error-text">${escapeHtml(errorMessage)}</div>
          <div class="helper-text">Gunakan akun backend default atau ganti di file <code>backend/.env</code>.</div>
        </form>
      </div>
    </section>
  `;

  document.getElementById("login-form").addEventListener("submit", handleLogin);
}

function getLatestTelemetry() {
  return state.telemetry[0] || {};
}

function getMqttStatus() {
  const mqttConnected = state.systemStatus?.mqtt?.connected;
  if (mqttConnected) {
    return { label: "MQTT Online", online: true };
  }

  return { label: "MQTT Offline", online: false };
}

function actuatorCard(title, type, rawState) {
  const item = state.actuatorMap[type] || rawState || { is_on: false, mode: "manual" };
  const checked = item.is_on ? "checked" : "";
  const stateLabel = item.is_on ? "ON" : (item.mode || "IDLE").toUpperCase();
  const stateClass = item.is_on ? "state-on" : "";

  return `
    <div class="control-card">
      <div class="control-info">
        <div class="control-name">${title}</div>
        <div class="control-state ${stateClass}">${stateLabel}</div>
      </div>
      <label class="switch">
        <input type="checkbox" data-actuator="${type}" ${checked} />
        <span class="slider"></span>
      </label>
    </div>
  `;
}

function renderDashboard() {
  const latest = getLatestTelemetry();
  const mqtt = getMqttStatus();

  app.innerHTML = `
    <section class="screen dashboard-screen">
      <div class="dashboard-shell">
        <header class="topbar">
          <div class="topbar-left">🌱 <span>Semai IoT Dashboard</span></div>
          <div class="topbar-right">
            <span class="pill ${mqtt.online ? "pill-success" : "pill-danger"}">${mqtt.label}</span>
            <span class="user-chip">${escapeHtml(state.auth.email)}</span>
            <button class="btn btn-logout" id="logout-btn">Logout</button>
          </div>
        </header>

        <main class="dashboard-content">
          <section class="cards-grid">
            <article class="metric-card">
              <div class="metric-icon">🌡️</div>
              <div>
                <div class="metric-title">Suhu Udara</div>
                <div class="metric-value">${formatValue(latest.air_temperature, "°C")}</div>
                <div class="metric-bar"><div class="metric-bar-fill" style="width:${percentageWidth(latest.air_temperature)}%"></div></div>
              </div>
            </article>

            <article class="metric-card">
              <div class="metric-icon">💧</div>
              <div>
                <div class="metric-title">Kelembapan</div>
                <div class="metric-value">${formatValue(latest.air_humidity, "%")}</div>
                <div class="metric-bar"><div class="metric-bar-fill" style="width:${percentageWidth(latest.air_humidity)}%"></div></div>
              </div>
            </article>

            <article class="metric-card">
              <div class="metric-icon">🌍</div>
              <div>
                <div class="metric-title">Kelembapan Tanah</div>
                <div class="metric-value">${formatValue(latest.soil_moisture, "%")}</div>
                <div class="metric-bar"><div class="metric-bar-fill" style="width:${percentageWidth(latest.soil_moisture)}%"></div></div>
              </div>
            </article>

            <article class="metric-card">
              <div class="metric-icon">☀️</div>
              <div>
                <div class="metric-title">Intensitas Cahaya</div>
                <div class="metric-value">${formatValue(latest.light_intensity, "%")}</div>
                <div class="metric-bar"><div class="metric-bar-fill" style="width:${percentageWidth(latest.light_intensity)}%"></div></div>
              </div>
            </article>
          </section>

          <section class="panels">
            <div class="panel">
              <h2 class="panel-title">🎮 Manual Control (Override)</h2>
              <div class="control-grid">
                ${actuatorCard("Kipas Angin", "fan")}
                ${actuatorCard("Pompa Air", "pump")}
                ${actuatorCard("Lampu LED", "lamp")}
              </div>
            </div>

            <div class="panel">
              <h2 class="panel-title">📊 Export Data</h2>
              <div class="export-row">
                <input class="date-input" id="date-start" type="date" />
                <input class="date-input" id="date-end" type="date" />
                <button class="btn btn-export" id="export-btn">Download CSV</button>
              </div>
            </div>

            <div class="panel">
              <div class="status-line">
                <span>Device: GH-001</span>
                <span>Last update: ${formatDateTime(state.lastUpdated)}</span>
              </div>
            </div>
          </section>

          <div class="footer-note">Semai IoT dashboard siap dihubungkan ke backend online.</div>
        </main>
      </div>
    </section>
  `;

  document.getElementById("logout-btn").addEventListener("click", () => {
    clearAuth();
    state.auth = null;
    render();
  });

  document.querySelectorAll("[data-actuator]").forEach((input) => {
    input.addEventListener("change", handleActuatorToggle);
  });

  document.getElementById("export-btn").addEventListener("click", handleExportCsv);
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.email.value.trim();
  const password = form.password.value;

  try {
    const result = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    state.auth = {
      email: result.data.user.email,
      token: result.data.token
    };

    saveAuth(state.auth);
    startAutoRefresh();
    render();
    await refreshDashboard();
  } catch (error) {
    renderLogin(error.message);
  }
}

async function refreshDashboard() {
  try {
    const [telemetryResult, actuatorResult, systemResult] = await Promise.all([
      apiRequest("/api/telemetry?deviceCode=GH-001&limit=10"),
      apiRequest("/api/actuators?deviceCode=GH-001"),
      apiRequest("/api/system/status")
    ]);

    state.telemetry = telemetryResult.data || [];
    state.lastUpdated = state.telemetry[0]?.recorded_at || null;
    state.systemStatus = systemResult.data || null;

    const nextActuatorMap = {
      pump: { is_on: false, mode: "manual", actuator_type: "pump" },
      fan: { is_on: false, mode: "manual", actuator_type: "fan" },
      lamp: { is_on: false, mode: "manual", actuator_type: "lamp" }
    };

    (actuatorResult.data || []).forEach((item) => {
      nextActuatorMap[item.actuator_type] = item;
    });

    state.actuatorMap = nextActuatorMap;
    renderDashboard();
  } catch (error) {
    console.error(error);
    renderDashboard();
  }
}

async function handleActuatorToggle(event) {
  const input = event.currentTarget;
  const actuatorType = input.dataset.actuator;
  const isOn = input.checked;

  try {
    await apiRequest("/api/actuators", {
      method: "POST",
      body: JSON.stringify({
        deviceCode: "GH-001",
        actuatorType,
        mode: "manual",
        isOn,
        source: "frontend",
        reason: "Manual override dari dashboard web"
      })
    });

    await refreshDashboard();
  } catch (error) {
    input.checked = !isOn;
    alert(error.message);
  }
}

function handleExportCsv() {
  const start = document.getElementById("date-start")?.value;
  const end = document.getElementById("date-end")?.value;
  const params = new URLSearchParams({
    deviceCode: "GH-001",
    limit: "500"
  });

  if (start) params.set("start", start);
  if (end) params.set("end", end);

  window.open(`${API_BASE_URL}/api/telemetry/export.csv?${params.toString()}`, "_blank");
}

render();

if (state.auth) {
  startAutoRefresh();
  refreshDashboard();
}
