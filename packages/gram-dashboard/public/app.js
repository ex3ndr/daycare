const state = {
  status: null,
  cron: [],
  sessions: [],
  connected: false
};

const elements = {
  plugins: document.getElementById("plugins"),
  connectors: document.getElementById("connectors"),
  inference: document.getElementById("inference"),
  images: document.getElementById("images"),
  tools: document.getElementById("tools"),
  cron: document.getElementById("cron"),
  sessions: document.getElementById("sessions"),
  refresh: document.getElementById("refresh"),
  connection: document.getElementById("connection"),
  statusSummary: document.getElementById("status-summary"),
  statusDetail: document.getElementById("status-detail"),
  sessionCount: document.getElementById("session-count")
};

elements.refresh.addEventListener("click", () => {
  void refreshAll();
});

async function refreshAll() {
  await Promise.all([fetchStatus(), fetchCron(), fetchSessions()]);
  render();
}

async function fetchStatus() {
  const response = await fetch("/api/v1/engine/status");
  if (!response.ok) {
    throw new Error("Status fetch failed");
  }
  const data = await response.json();
  state.status = data.status;
}

async function fetchCron() {
  const response = await fetch("/api/v1/engine/cron/tasks");
  if (!response.ok) {
    throw new Error("Cron fetch failed");
  }
  const data = await response.json();
  state.cron = data.tasks ?? [];
}

async function fetchSessions() {
  const response = await fetch("/api/v1/engine/sessions");
  if (!response.ok) {
    throw new Error("Sessions fetch failed");
  }
  const data = await response.json();
  state.sessions = data.sessions ?? [];
}

function render() {
  renderStatus();
  renderGrid(elements.plugins, state.status?.plugins ?? [], (item) => ({
    title: item,
    meta: "loaded"
  }));
  renderGrid(elements.connectors, state.status?.connectors ?? [], (item) => ({
    title: item.id,
    meta: new Date(item.loadedAt).toLocaleTimeString()
  }));
  renderGrid(elements.inference, state.status?.inferenceProviders ?? [], (item) => ({
    title: item.id,
    meta: item.label ?? ""
  }));
  renderGrid(elements.images, state.status?.imageProviders ?? [], (item) => ({
    title: item.id,
    meta: item.label ?? ""
  }));
  renderGrid(elements.tools, state.status?.tools ?? [], (item) => ({
    title: item,
    meta: "tool"
  }));
  renderCron();
  renderSessions();
}

function renderStatus() {
  const status = state.status;
  elements.connection.textContent = state.connected ? "Live" : "Offline";
  elements.connection.classList.toggle("live", state.connected);
  if (!status) {
    elements.statusSummary.textContent = "—";
    elements.statusDetail.textContent = "Waiting for status";
    elements.sessionCount.textContent = "0";
    return;
  }
  elements.statusSummary.textContent = status.plugins?.length ?? 0;
  elements.statusDetail.textContent = "Plugins loaded";
  elements.sessionCount.textContent = String(state.sessions.length);
}

function renderGrid(container, items, formatter) {
  container.innerHTML = "";
  if (!items || items.length === 0) {
    container.appendChild(renderEmpty("None detected."));
    return;
  }
  items.forEach((item) => {
    const { title, meta } = formatter(item);
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.innerHTML = `<div class="tile__title">${title}</div><div class="tile__meta">${meta}</div>`;
    container.appendChild(tile);
  });
}

function renderCron() {
  elements.cron.innerHTML = "";
  if (state.cron.length === 0) {
    elements.cron.appendChild(renderEmpty("No cron tasks scheduled."));
    return;
  }
  state.cron.forEach((task) => {
    const item = document.createElement("div");
    item.className = "list__item";
    item.innerHTML = `
      <strong>${task.id ?? "task"}</strong>
      <span class="muted">Every ${task.everyMs}ms · ${task.once ? "once" : "repeat"}</span>
      <span class="muted">${task.message ?? task.action ?? "custom"}</span>
    `;
    elements.cron.appendChild(item);
  });
}

function renderSessions() {
  elements.sessions.innerHTML = "";
  if (state.sessions.length === 0) {
    elements.sessions.appendChild(renderEmpty("No sessions yet."));
    return;
  }
  state.sessions.forEach((session) => {
    const item = document.createElement("div");
    item.className = "list__item";
    item.innerHTML = `
      <strong>${session.sessionId}</strong>
      <span class="muted">${session.source}</span>
      <span class="muted">${session.lastMessage ?? "No message"}</span>
    `;
    elements.sessions.appendChild(item);
  });
}

function renderEmpty(text) {
  const empty = document.createElement("div");
  empty.className = "list__item muted";
  empty.textContent = text;
  return empty;
}

function connectEvents() {
  const source = new EventSource("/api/v1/engine/events");
  source.onopen = () => {
    state.connected = true;
    renderStatus();
  };
  source.onerror = () => {
    state.connected = false;
    renderStatus();
  };
  source.onmessage = async (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "init") {
      state.status = payload.payload.status;
      state.cron = payload.payload.cron ?? [];
      await fetchSessions();
      render();
      return;
    }

    switch (payload.type) {
      case "session.created":
      case "session.updated":
        await fetchSessions();
        renderSessions();
        renderStatus();
        break;
      case "cron.task.added":
      case "cron.started":
        await fetchCron();
        renderCron();
        break;
      case "plugin.loaded":
      case "plugin.unloaded":
        await fetchStatus();
        render();
        break;
      default:
        break;
    }
  };
}

await refreshAll();
connectEvents();
