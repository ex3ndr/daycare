export type EngineStatus = {
  plugins?: { id: string; pluginId: string; name: string }[];
  providers?: { id: string; name: string }[];
  connectors?: { id: string; name: string; pluginId?: string; loadedAt: string }[];
  inferenceProviders?: { id: string; name: string; label?: string }[];
  imageProviders?: { id: string; name: string; label?: string }[];
  tools?: string[];
};

export type CronTask = {
  id: string;
  name?: string;
  description?: string;
  schedule?: string;
  prompt?: string;
  agentId?: string;
  enabled?: boolean;
  deleteAfterRun?: boolean;
  lastRunAt?: string;
  taskPath?: string;
  memoryPath?: string;
  filesPath?: string;
};

export type HeartbeatTask = {
  id: string;
  title: string;
  prompt?: string;
  filePath?: string;
  lastRunAt?: string;
};

export type BackgroundAgentState = {
  agentId: string;
  name: string | null;
  parentAgentId: string | null;
  lifecycle: "active" | "sleeping" | "dead";
  status: "running" | "queued" | "idle";
  pending: number;
  updatedAt: number;
};

export type ManagedProcess = {
  id: string;
  name: string;
  command: string;
  cwd: string;
  home: string | null;
  pid: number | null;
  keepAlive: boolean;
  desiredState: "running" | "stopped";
  status: "running" | "stopped" | "exited";
  restartCount: number;
  createdAt: number;
  updatedAt: number;
  lastStartedAt: number | null;
  lastExitedAt: number | null;
  logPath: string;
};

export type SignalSource =
  | { type: "system" }
  | { type: "agent"; id: string }
  | { type: "webhook"; id?: string }
  | { type: "process"; id?: string };

export type SignalEvent = {
  id: string;
  type: string;
  source: SignalSource;
  data?: unknown;
  createdAt: number;
};

export type FileReference = {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  size: number;
};

export type MessageContext = {
  messageId?: string;
  permissionTags?: string[];
};

export type AgentDescriptor =
  | { type: "user"; connector: string; userId: string; channelId: string }
  | { type: "cron"; id: string }
  | { type: "task"; id: string }
  | { type: "system"; tag: string }
  | { type: "subagent"; id: string; parentAgentId: string; name: string }
  | { type: "app"; id: string; parentAgentId: string; name: string; appId: string }
  | {
      type: "permanent";
      id: string;
      name: string;
      description: string;
      systemPrompt: string;
      workspaceDir?: string;
    }
  | { type: "memory-agent"; id: string }
  | { type: "memory-search"; id: string; parentAgentId: string; name: string }
  | { type: "subuser"; id: string; name: string };

export type AgentConfig = {
  name?: string;
  username?: string;
  description?: string;
  systemPrompt?: string;
  workspaceDir?: string;
};

export type AgentSummary = {
  agentId: string;
  path: string | null;
  config: AgentConfig | null;
  descriptor?: AgentDescriptor;
  lifecycle: "active" | "sleeping" | "dead";
  updatedAt: number;
};

export type AssistantContentBlock =
    | { type: "text"; text: string }
    | { type: "thinking"; thinking: string }
    | { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> };

export type AgentHistoryRecord =
  | { type: "start"; at: number }
  | { type: "reset"; at: number; message?: string }
  | { type: "user_message"; at: number; text: string; files: FileReference[] }
  | {
      type: "assistant_message";
      at: number;
      content: AssistantContentBlock[];
      tokens: { provider: string; model: string; size: Record<string, number> } | null;
    }
  | {
      type: "tool_result";
      at: number;
      toolCallId: string;
      output: { toolMessage: Record<string, unknown>; files: FileReference[] };
    }
  | {
      type: "rlm_start";
      at: number;
      toolCallId: string;
      code: string;
      preamble: string;
    }
  | {
      type: "rlm_tool_call";
      at: number;
      toolCallId: string;
      snapshot: string;
      printOutput: string[];
      toolCallCount: number;
      toolName: string;
      toolArgs: unknown;
    }
  | {
      type: "rlm_tool_result";
      at: number;
      toolCallId: string;
      toolName: string;
      toolResult: string;
      toolIsError: boolean;
    }
  | {
      type: "rlm_complete";
      at: number;
      toolCallId: string;
      output: string;
      printOutput: string[];
      toolCallCount: number;
      isError: boolean;
      error?: string;
    }
  | {
      type: "assistant_rewrite";
      at: number;
      assistantAt: number;
      text: string;
      reason: "run_python_say_after_trim" | "run_python_failure_trim";
    }
  | { type: "note"; at: number; text: string };

export type MemoryNodeFrontmatter = {
  title: string;
  description: string;
  createdAt: number;
  updatedAt: number;
};

export type MemoryNode = {
  id: string;
  frontmatter: MemoryNodeFrontmatter;
  content: string;
  refs: string[];
};

export type MemoryGraph = {
  root: MemoryNode;
  children: Record<string, MemoryNode[]>;
};

export type MemoryGraphScope = "memory" | "documents";

export type EngineEvent = {
  type: string;
  payload?: {
    status?: EngineStatus;
    cron?: CronTask[];
    heartbeat?: HeartbeatTask[];
    backgroundAgents?: BackgroundAgentState[];
  };
};

type EngineStatusResponse = {
  status: EngineStatus;
};

type CronResponse = {
  tasks?: CronTask[];
};

type HeartbeatResponse = {
  tasks?: HeartbeatTask[];
};

type ProcessesResponse = {
  processes?: ManagedProcess[];
};

type ProcessResponse = {
  process?: ManagedProcess;
};

export type SignalSubscription = {
  agentId: string;
  pattern: string;
  silent: boolean;
  createdAt: number;
  updatedAt: number;
};

export type SignalGenerateInput = {
  type: string;
  source?: SignalSource;
  data?: unknown;
};

type SignalEventsResponse = {
  events?: SignalEvent[];
};

type SignalSubscriptionsResponse = {
  subscriptions?: SignalSubscription[];
};

type SignalGenerateResponse = {
  ok: boolean;
  signal?: SignalEvent;
  error?: string;
};

export type UserSummary = {
  id: string;
  isOwner: boolean;
  firstName: string | null;
  lastName: string | null;
  country: string | null;
  nametag: string;
  createdAt: number;
  updatedAt: number;
};

export type TokenStatsRow = {
  hourStart: number;
  userId: string;
  agentId: string;
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
};

export type SystemPromptScope = "global" | "user";
export type SystemPromptKind = "system" | "first_message";
export type SystemPromptCondition = "new_user" | "returning_user";

export type SystemPrompt = {
  id: string;
  scope: SystemPromptScope;
  userId: string | null;
  kind: SystemPromptKind;
  condition: SystemPromptCondition | null;
  prompt: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
};

export type SystemPromptCreateInput = {
  scope: SystemPromptScope;
  userId?: string | null;
  kind: SystemPromptKind;
  condition?: SystemPromptCondition | null;
  prompt: string;
  enabled?: boolean;
};

export type SystemPromptUpdateInput = Partial<SystemPromptCreateInput>;

type UsersResponse = {
  users?: UserSummary[];
};

type BackgroundAgentsResponse = {
  agents?: BackgroundAgentState[];
};

type AgentsResponse = {
  agents?: AgentSummary[];
};

export type SessionSummary = {
  id: string;
  agentId: string;
  createdAt: number;
  endedAt: number | null;
  resetMessage: string | null;
};

type AgentSessionsResponse = {
  sessions?: SessionSummary[];
};

type AgentHistoryResponse = {
  records?: AgentHistoryRecord[];
};

type TokenStatsResponse = {
  rows?: TokenStatsRow[];
};

type MemoryGraphResponse = {
  graph?: MemoryGraph;
};

type MemoryNodeResponse = {
  node?: MemoryNode;
};

async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchEngineStatus() {
  const data = await fetchJSON<EngineStatusResponse>("/api/v1/engine/status");
  return data.status ?? {};
}

export async function fetchUsers() {
  const data = await fetchJSON<UsersResponse>("/api/v1/engine/users");
  return data.users ?? [];
}

export async function fetchCronTasks() {
  const data = await fetchJSON<CronResponse>("/api/v1/engine/cron/tasks");
  return data.tasks ?? [];
}

export async function fetchHeartbeatTasks() {
  const data = await fetchJSON<HeartbeatResponse>("/api/v1/engine/heartbeat/tasks");
  return data.tasks ?? [];
}

export async function fetchProcesses() {
  const data = await fetchJSON<ProcessesResponse>("/api/v1/engine/processes");
  return data.processes ?? [];
}

export async function fetchProcess(processId: string) {
  const encoded = encodeURIComponent(processId);
  const data = await fetchJSON<ProcessResponse>(`/api/v1/engine/processes/${encoded}`);
  return data.process ?? null;
}

export async function generateSignal(input: SignalGenerateInput): Promise<SignalEvent> {
  const response = await fetch("/api/v1/engine/signals/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const data = (await response.json()) as SignalGenerateResponse;
  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? `Request failed: ${response.status}`);
  }
  return data.signal!;
}

export async function fetchSignalSubscriptions() {
  const data = await fetchJSON<SignalSubscriptionsResponse>("/api/v1/engine/signals/subscriptions");
  return data.subscriptions ?? [];
}

export async function fetchSignalEvents(limit = 200) {
  const query = new URLSearchParams({ limit: String(limit) });
  const data = await fetchJSON<SignalEventsResponse>(`/api/v1/engine/signals/events?${query}`);
  return data.events ?? [];
}

export async function fetchBackgroundAgents() {
  const data = await fetchJSON<BackgroundAgentsResponse>("/api/v1/engine/agents/background");
  return data.agents ?? [];
}

export async function fetchAgents() {
  const data = await fetchJSON<AgentsResponse>("/api/v1/engine/agents");
  return data.agents ?? [];
}

export async function fetchAgentSessions(agentId: string) {
  const encoded = encodeURIComponent(agentId);
  const data = await fetchJSON<AgentSessionsResponse>(`/api/v1/engine/agents/${encoded}/sessions`);
  return data.sessions ?? [];
}

export async function fetchAgentHistory(agentId: string, options?: { limit?: number; sessionId?: string }) {
  const encoded = encodeURIComponent(agentId);
  const query = new URLSearchParams();
  if (options?.limit) {
    query.set("limit", String(options.limit));
  }
  if (options?.sessionId) {
    query.set("sessionId", options.sessionId);
  }
  const data = await fetchJSON<AgentHistoryResponse>(`/api/v1/engine/agents/${encoded}/history?${query}`);
  return data.records ?? [];
}

export async function fetchTokenStats(options?: {
  from?: number;
  to?: number;
  userId?: string;
  agentId?: string;
  model?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (options?.from !== undefined) {
    query.set("from", String(options.from));
  }
  if (options?.to !== undefined) {
    query.set("to", String(options.to));
  }
  if (options?.userId) {
    query.set("userId", options.userId);
  }
  if (options?.agentId) {
    query.set("agentId", options.agentId);
  }
  if (options?.model) {
    query.set("model", options.model);
  }
  if (options?.limit !== undefined) {
    query.set("limit", String(options.limit));
  }
  const data = await fetchJSON<TokenStatsResponse>(`/api/v1/engine/token-stats?${query}`);
  return data.rows ?? [];
}

type SystemPromptsResponse = {
  prompts?: SystemPrompt[];
};

type SystemPromptResponse = {
  prompt?: SystemPrompt;
};

export async function fetchSystemPrompts() {
  const data = await fetchJSON<SystemPromptsResponse>("/api/v1/engine/system-prompts");
  return data.prompts ?? [];
}

export async function createSystemPrompt(input: SystemPromptCreateInput): Promise<SystemPrompt> {
  const response = await fetch("/api/v1/engine/system-prompts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  const data = (await response.json()) as SystemPromptResponse;
  return data.prompt!;
}

export async function updateSystemPrompt(id: string, input: SystemPromptUpdateInput): Promise<SystemPrompt> {
  const encoded = encodeURIComponent(id);
  const response = await fetch(`/api/v1/engine/system-prompts/${encoded}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  const data = (await response.json()) as SystemPromptResponse;
  return data.prompt!;
}

export async function deleteSystemPrompt(id: string): Promise<void> {
  const encoded = encodeURIComponent(id);
  const response = await fetch(`/api/v1/engine/system-prompts/${encoded}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
}

export async function fetchMemoryGraph(userId: string, options?: { scope?: MemoryGraphScope }): Promise<MemoryGraph> {
  const encoded = encodeURIComponent(userId);
  const query = new URLSearchParams();
  if (options?.scope) {
    query.set("scope", options.scope);
  }
  const suffix = query.size > 0 ? `?${query}` : "";
  const data = await fetchJSON<MemoryGraphResponse>(`/api/v1/engine/memory/${encoded}/graph${suffix}`);
  if (!data.graph) {
    throw new Error("Memory graph payload missing");
  }
  return data.graph;
}

export async function fetchMemoryNode(
  userId: string,
  nodeId: string,
  options?: { scope?: MemoryGraphScope }
): Promise<MemoryNode | null> {
  const userEncoded = encodeURIComponent(userId);
  const nodeEncoded = encodeURIComponent(nodeId);
  const query = new URLSearchParams();
  if (options?.scope) {
    query.set("scope", options.scope);
  }
  const suffix = query.size > 0 ? `?${query}` : "";
  const response = await fetch(`/api/v1/engine/memory/${userEncoded}/node/${nodeEncoded}${suffix}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  const data = (await response.json()) as MemoryNodeResponse;
  return data.node ?? null;
}
