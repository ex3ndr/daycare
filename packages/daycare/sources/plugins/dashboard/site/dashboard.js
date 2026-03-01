const elements = {
  refreshButton: document.getElementById("refresh-button"),
  liveChip: document.getElementById("live-chip"),
  pluginsCount: document.getElementById("plugins-count"),
  providersCount: document.getElementById("providers-count"),
  connectorsCount: document.getElementById("connectors-count"),
  toolsCount: document.getElementById("tools-count"),
  agentsCount: document.getElementById("agents-count"),
  agentsBody: document.getElementById("agents-body"),
  cronCount: document.getElementById("cron-count"),
  cronList: document.getElementById("cron-list"),
  processesCount: document.getElementById("processes-count"),
  processList: document.getElementById("process-list"),
  statusMessage: document.getElementById("status-message"),
  updatedAt: document.getElementById("updated-at")
};

const MAX_AGENTS = 12;
const MAX_LIST_ITEMS = 8;

let stream = null;

function setLiveState(connected) {
  if (!elements.liveChip) {
    return;
  }
  elements.liveChip.textContent = connected ? "Live" : "Offline";
  elements.liveChip.className = connected ? "chip chip-online" : "chip chip-offline";
}

function setStatus(text) {
  if (elements.statusMessage) {
    elements.statusMessage.textContent = text;
  }
}

function touchUpdatedAt() {
  if (!elements.updatedAt) {
    return;
  }
  elements.updatedAt.textContent = `Updated ${new Date().toLocaleTimeString()}`;
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return response.json();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pathSegments(path) {
  return String(path)
    .split("/")
    .filter((segment) => segment.length > 0);
}

function formatAgentType(path) {
  if (typeof path !== "string" || path.trim().length === 0) {
    return "unknown";
  }
  const segments = pathSegments(path);
  if (segments.length === 0) {
    return "unknown";
  }
  if (path.endsWith("/memory")) {
    return "memory-agent";
  }
  if (segments.length >= 2 && segments[segments.length - 2] === "search") {
    return "memory-search";
  }
  if (segments.length >= 2 && segments[segments.length - 2] === "sub") {
    return "subagent";
  }
  if (segments[1] === "cron") {
    return "cron";
  }
  if (segments[1] === "task") {
    return "task";
  }
  if (segments[1] === "agent") {
    if (segments[2] === "swarm") {
      return "subuser";
    }
    return "permanent";
  }
  if (segments[1] === "subuser") {
    return "subuser";
  }
  return "connection";
}

function formatTimestamp(ms) {
  if (typeof ms !== "number" || Number.isNaN(ms)) {
    return "-";
  }
  return new Date(ms).toLocaleTimeString();
}

function renderStats(status) {
  elements.pluginsCount.textContent = String(status.plugins?.length ?? 0);
  elements.providersCount.textContent = String(status.inferenceProviders?.length ?? 0);
  elements.connectorsCount.textContent = String(status.connectors?.length ?? 0);
  elements.toolsCount.textContent = String(status.tools?.length ?? 0);
}

function renderAgents(agents) {
  elements.agentsCount.textContent = String(agents.length);

  if (agents.length === 0) {
    elements.agentsBody.innerHTML = '<tr><td colspan="4" class="empty">No agents found.</td></tr>';
    return;
  }

  const rows = agents
    .slice()
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, MAX_AGENTS)
    .map((agent) => {
      const type = formatAgentType(agent.path);
      const state = agent.lifecycle ?? "unknown";
      const updated = formatTimestamp(agent.updatedAt);
      return `<tr>
        <td>${escapeHtml(agent.agentId ?? "-")}</td>
        <td>${escapeHtml(type)}</td>
        <td>${escapeHtml(state)}</td>
        <td>${escapeHtml(updated)}</td>
      </tr>`;
    })
    .join("");

  elements.agentsBody.innerHTML = rows;
}

function renderTaskList(listElement, countElement, tasks, emptyText, titleKey = "id") {
  countElement.textContent = String(tasks.length);

  if (tasks.length === 0) {
    listElement.innerHTML = `<li class="empty">${escapeHtml(emptyText)}</li>`;
    return;
  }

  listElement.innerHTML = tasks
    .slice(0, MAX_LIST_ITEMS)
    .map((task) => {
      const title = task[titleKey] || task.id || "Untitled";
      const detail = task.schedule || task.prompt || task.status || "-";
      return `<li><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></li>`;
    })
    .join("");
}

function renderProcesses(processes) {
  elements.processesCount.textContent = String(processes.length);

  if (processes.length === 0) {
    elements.processList.innerHTML = '<li class="empty">No managed processes.</li>';
    return;
  }

  elements.processList.innerHTML = processes
    .slice(0, MAX_LIST_ITEMS)
    .map((processInfo) => {
      const state = processInfo.status ?? "unknown";
      const pid = processInfo.pid ?? "-";
      return `<li><strong>${escapeHtml(processInfo.name ?? processInfo.id ?? "process")}</strong><span>${escapeHtml(
        `state=${state} pid=${pid}`
      )}</span></li>`;
    })
    .join("");
}

async function refreshDashboard() {
  setStatus("Syncing engine state...");

  try {
    const [statusPayload, agentsPayload, cronPayload, processesPayload] = await Promise.all([
      fetchJson("/api/v1/engine/status"),
      fetchJson("/api/v1/engine/agents"),
      fetchJson("/api/v1/engine/cron/tasks"),
      fetchJson("/api/v1/engine/processes")
    ]);

    renderStats(statusPayload.status ?? {});
    renderAgents(agentsPayload.agents ?? []);
    renderTaskList(
      elements.cronList,
      elements.cronCount,
      cronPayload.tasks ?? [],
      "No cron tasks.",
      "name"
    );
    renderProcesses(processesPayload.processes ?? []);

    setStatus("Engine data loaded.");
    touchUpdatedAt();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Failed to load data: ${message}`);
  }
}

function connectEventStream() {
  if (stream) {
    stream.close();
  }

  stream = new EventSource("/api/v1/engine/events");

  stream.onopen = () => {
    setLiveState(true);
  };

  stream.onerror = () => {
    setLiveState(false);
  };

  stream.onmessage = (event) => {
    let payload = null;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }

    const type = payload?.type;
    if (
      type === "init" ||
      type === "agent.created" ||
      type === "agent.reset" ||
      type === "agent.restored" ||
      type === "agent.dead" ||
      type === "plugin.loaded" ||
      type === "plugin.unloaded" ||
      type === "cron.updated"
    ) {
      void refreshDashboard();
    }
  };
}

function installHandlers() {
  elements.refreshButton?.addEventListener("click", () => {
    void refreshDashboard();
  });

  window.addEventListener("beforeunload", () => {
    if (stream) {
      stream.close();
      stream = null;
    }
  });
}

function bootstrap() {
  setLiveState(false);
  installHandlers();
  connectEventStream();
  void refreshDashboard();
}

bootstrap();
