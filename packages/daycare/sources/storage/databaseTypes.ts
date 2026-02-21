import type {
    AgentDescriptor,
    AgentLifecycleState,
    AgentTokenEntry,
    AgentTokenStats,
    ExecGateDefinition,
    ExposeEndpointAuth,
    ExposeMode,
    ExposeTarget,
    SessionPermissions
} from "@/types";
import type { SignalSource } from "../engine/signals/signalTypes.js";

export type DatabaseAgentRow = {
    id: string;
    user_id: string;
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
    userId: string;
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

export type DatabaseCronTaskRow = {
    id: string;
    task_uid: string;
    user_id: string;
    name: string;
    description: string | null;
    schedule: string;
    prompt: string;
    agent_id: string | null;
    gate: string | null;
    enabled: number;
    delete_after_run: number;
    last_run_at: number | null;
    created_at: number;
    updated_at: number;
};

export type CronTaskDbRecord = {
    id: string;
    taskUid: string;
    userId: string;
    name: string;
    description: string | null;
    schedule: string;
    prompt: string;
    agentId: string | null;
    gate: ExecGateDefinition | null;
    enabled: boolean;
    deleteAfterRun: boolean;
    lastRunAt: number | null;
    createdAt: number;
    updatedAt: number;
};

export type DatabaseHeartbeatTaskRow = {
    id: string;
    user_id: string;
    title: string;
    prompt: string;
    gate: string | null;
    last_run_at: number | null;
    created_at: number;
    updated_at: number;
};

export type HeartbeatTaskDbRecord = {
    id: string;
    userId: string;
    title: string;
    prompt: string;
    gate: ExecGateDefinition | null;
    lastRunAt: number | null;
    createdAt: number;
    updatedAt: number;
};

export type DatabaseSignalEventRow = {
    id: string;
    user_id: string;
    type: string;
    source: string;
    data: string | null;
    created_at: number;
};

export type SignalEventDbRecord = {
    id: string;
    userId: string;
    type: string;
    source: SignalSource;
    data: unknown;
    createdAt: number;
};

export type DatabaseSignalSubscriptionRow = {
    id: string;
    user_id: string;
    agent_id: string;
    pattern: string;
    silent: number;
    created_at: number;
    updated_at: number;
};

export type SignalSubscriptionDbRecord = {
    id: string;
    userId: string;
    agentId: string;
    pattern: string;
    silent: boolean;
    createdAt: number;
    updatedAt: number;
};

export type DatabaseDelayedSignalRow = {
    id: string;
    user_id: string;
    type: string;
    deliver_at: number;
    source: string;
    data: string | null;
    repeat_key: string | null;
    created_at: number;
    updated_at: number;
};

export type DelayedSignalDbRecord = {
    id: string;
    userId: string;
    type: string;
    deliverAt: number;
    source: SignalSource;
    data: unknown;
    repeatKey: string | null;
    createdAt: number;
    updatedAt: number;
};

export type DatabaseChannelRow = {
    id: string;
    user_id: string;
    name: string;
    leader: string;
    created_at: number;
    updated_at: number;
};

export type ChannelDbRecord = {
    id: string;
    userId: string;
    name: string;
    leader: string;
    createdAt: number;
    updatedAt: number;
};

export type DatabaseChannelMemberRow = {
    id: number;
    channel_id: string;
    user_id: string;
    agent_id: string;
    username: string;
    joined_at: number;
};

export type ChannelMemberDbRecord = {
    id: number;
    channelId: string;
    userId: string;
    agentId: string;
    username: string;
    joinedAt: number;
};

export type DatabaseChannelMessageRow = {
    id: string;
    channel_id: string;
    user_id: string;
    sender_username: string;
    text: string;
    mentions: string;
    created_at: number;
};

export type ChannelMessageDbRecord = {
    id: string;
    channelId: string;
    userId: string;
    senderUsername: string;
    text: string;
    mentions: string[];
    createdAt: number;
};

export type DatabaseExposeEndpointRow = {
    id: string;
    user_id: string;
    target: string;
    provider: string;
    domain: string;
    mode: ExposeMode;
    auth: string | null;
    created_at: number;
    updated_at: number;
};

export type ExposeEndpointDbRecord = {
    id: string;
    userId: string;
    target: ExposeTarget;
    provider: string;
    domain: string;
    mode: ExposeMode;
    auth: ExposeEndpointAuth | null;
    createdAt: number;
    updatedAt: number;
};

export type DatabaseProcessRow = {
    id: string;
    user_id: string;
    name: string;
    command: string;
    cwd: string;
    home: string | null;
    env: string;
    package_managers: string;
    allowed_domains: string;
    allow_local_binding: number;
    permissions: string;
    owner: string | null;
    keep_alive: number;
    desired_state: "running" | "stopped";
    status: "running" | "stopped" | "exited";
    pid: number | null;
    boot_time_ms: number | null;
    restart_count: number;
    restart_failure_count: number;
    next_restart_at: number | null;
    settings_path: string;
    log_path: string;
    created_at: number;
    updated_at: number;
    last_started_at: number | null;
    last_exited_at: number | null;
};

export type ProcessOwnerDbRecord = {
    type: "plugin";
    id: string;
};

export type ProcessDbRecord = {
    id: string;
    userId: string;
    name: string;
    command: string;
    cwd: string;
    home: string | null;
    env: Record<string, string>;
    packageManagers: string[];
    allowedDomains: string[];
    allowLocalBinding: boolean;
    permissions: SessionPermissions;
    owner: ProcessOwnerDbRecord | null;
    keepAlive: boolean;
    desiredState: "running" | "stopped";
    status: "running" | "stopped" | "exited";
    pid: number | null;
    bootTimeMs: number | null;
    restartCount: number;
    restartFailureCount: number;
    nextRestartAt: number | null;
    settingsPath: string;
    logPath: string;
    createdAt: number;
    updatedAt: number;
    lastStartedAt: number | null;
    lastExitedAt: number | null;
};

export type DatabaseUserRow = {
    id: string;
    is_owner: number;
    created_at: number;
    updated_at: number;
};

export type DatabaseUserConnectorKeyRow = {
    id: number;
    user_id: string;
    connector_key: string;
};

export type UserDbRecord = {
    id: string;
    isOwner: boolean;
    createdAt: number;
    updatedAt: number;
};

export type UserConnectorKeyDbRecord = {
    id: number;
    userId: string;
    connectorKey: string;
};

export type UserWithConnectorKeysDbRecord = UserDbRecord & {
    connectorKeys: UserConnectorKeyDbRecord[];
};

export type SessionDbRecord = {
    id: string;
    agentId: string;
    inferenceSessionId: string | null;
    createdAt: number;
    resetMessage: string | null;
};

export type CreateUserInput = {
    id?: string;
    isOwner?: boolean;
    createdAt?: number;
    updatedAt?: number;
    connectorKey?: string;
};

export type UpdateUserInput = {
    isOwner?: boolean;
    createdAt?: number;
    updatedAt?: number;
};

export type CreateSessionInput = {
    agentId: string;
    inferenceSessionId?: string | null;
    createdAt?: number;
    resetMessage?: string | null;
};

export type CreateAgentInput = {
    record: AgentDbRecord;
    session?: Omit<CreateSessionInput, "agentId">;
};
