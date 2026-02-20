import type {
  AgentDescriptor,
  AgentLifecycleState,
  AgentTokenEntry,
  AgentTokenStats,
  SessionPermissions
} from "@/types";

export type DatabaseAgentRow = {
  id: string;
  type: AgentDescriptor["type"];
  descriptor: string;
  active_session_id: string | null;
  permissions: string;
  tokens: string | null;
  stats: string;
  lifecycle: AgentLifecycleState;
  created_at: number;
  updated_at: number;
};

export type DatabaseSessionRow = {
  id: string;
  agent_id: string;
  inference_session_id: string | null;
  created_at: number;
  reset_message: string | null;
};

export type DatabaseSessionHistoryRow = {
  id: number;
  session_id: string;
  type: string;
  at: number;
  data: string;
};

export type AgentDbRecord = {
  id: string;
  type: AgentDescriptor["type"];
  descriptor: AgentDescriptor;
  activeSessionId: string | null;
  permissions: SessionPermissions;
  tokens: AgentTokenEntry | null;
  stats: AgentTokenStats;
  lifecycle: AgentLifecycleState;
  createdAt: number;
  updatedAt: number;
};

export type SessionDbRecord = {
  id: string;
  agentId: string;
  inferenceSessionId: string | null;
  createdAt: number;
  resetMessage: string | null;
};
