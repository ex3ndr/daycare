import type {
    AgentDescriptor,
    AgentLifecycleState,
    AgentTokenEntry,
    AgentTokenStats,
    ExposeEndpointAuth,
    ExposeMode,
    ExposeTarget,
    SessionPermissions
} from "@/types";
import type { TaskParameter } from "../engine/modules/tasks/taskParameterTypes.js";
import type { SignalSource } from "../engine/signals/signalTypes.js";

export type DatabaseAgentRow = {
    id: string;
    version: number;
    valid_from: number;
    valid_to: number | null;
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
    invalidated_at: number | null;
    processed_until: number | null;
    ended_at: number | null;
};

export type DatabaseSessionHistoryRow = {
    id: number;
    session_id: string;
    type: string;
    at: number;
    data: string;
};

export type DatabaseInboxRow = {
    id: string;
    agent_id: string;
    posted_at: number;
    type: string;
    data: string;
};

export type AgentDbRecord = {
    id: string;
    version?: number;
    validFrom?: number;
    validTo?: number | null;
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

export type InboxDbRecord = {
    id: string;
    agentId: string;
    postedAt: number;
    type: string;
    data: string;
};

export type DatabaseCronTaskRow = {
    id: string;
    version: number;
    valid_from: number;
    valid_to: number | null;
    task_id: string;
    user_id: string;
    name: string;
    description: string | null;
    schedule: string;
    timezone: string;
    agent_id: string | null;
    enabled: number;
    delete_after_run: number;
    parameters: string | null;
    last_run_at: number | null;
    created_at: number;
    updated_at: number;
};

export type CronTaskDbRecord = {
    id: string;
    version?: number;
    validFrom?: number;
    validTo?: number | null;
    taskId: string;
    userId: string;
    name: string;
    description: string | null;
    schedule: string;
    timezone: string;
    agentId: string | null;
    enabled: boolean;
    deleteAfterRun: boolean;
    parameters: Record<string, unknown> | null;
    lastRunAt: number | null;
    createdAt: number;
    updatedAt: number;
};

export type DatabaseHeartbeatTaskRow = {
    id: string;
    version: number;
    valid_from: number;
    valid_to: number | null;
    task_id: string;
    user_id: string;
    title: string;
    parameters: string | null;
    last_run_at: number | null;
    created_at: number;
    updated_at: number;
};

export type HeartbeatTaskDbRecord = {
    id: string;
    version?: number;
    validFrom?: number;
    validTo?: number | null;
    taskId: string;
    userId: string;
    title: string;
    parameters: Record<string, unknown> | null;
    lastRunAt: number | null;
    createdAt: number;
    updatedAt: number;
};

export type DatabaseWebhookTaskRow = {
    id: string;
    version: number;
    valid_from: number;
    valid_to: number | null;
    task_id: string;
    user_id: string;
    agent_id: string | null;
    last_run_at: number | null;
    created_at: number;
    updated_at: number;
};

export type WebhookTaskDbRecord = {
    id: string;
    version?: number;
    validFrom?: number;
    validTo?: number | null;
    taskId: string;
    userId: string;
    agentId: string | null;
    lastRunAt: number | null;
    createdAt: number;
    updatedAt: number;
};

export type DatabaseTaskRow = {
    id: string;
    user_id: string;
    version: number;
    valid_from: number;
    valid_to: number | null;
    title: string;
    description: string | null;
    code: string;
    parameters: string | null;
    created_at: number;
    updated_at: number;
};

export type TaskDbRecord = {
    id: string;
    userId: string;
    version?: number;
    validFrom?: number;
    validTo?: number | null;
    title: string;
    description: string | null;
    code: string;
    parameters: TaskParameter[] | null;
    createdAt: number;
    updatedAt: number;
};

export type DocumentReferenceKind = "parent" | "link" | "body";

export type DatabaseDocumentRow = {
    id: string;
    user_id: string;
    version: number;
    valid_from: number;
    valid_to: number | null;
    slug: string;
    title: string;
    description: string;
    body: string;
    created_at: number;
    updated_at: number;
};

export type DocumentDbRecord = {
    id: string;
    userId: string;
    version?: number;
    validFrom?: number;
    validTo?: number | null;
    slug: string;
    title: string;
    description: string;
    body: string;
    createdAt: number;
    updatedAt: number;
};

export type DatabaseDocumentReferenceRow = {
    id: number;
    user_id: string;
    source_id: string;
    source_version: number;
    target_id: string;
    kind: DocumentReferenceKind;
};

export type DocumentReferenceDbRecord = {
    id: number;
    userId: string;
    sourceId: string;
    sourceVersion: number;
    targetId: string;
    kind: DocumentReferenceKind;
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
    version: number;
    valid_from: number;
    valid_to: number | null;
    user_id: string;
    agent_id: string;
    pattern: string;
    silent: number;
    created_at: number;
    updated_at: number;
};

export type SignalSubscriptionDbRecord = {
    id: string;
    version?: number;
    validFrom?: number;
    validTo?: number | null;
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
    version: number;
    valid_from: number;
    valid_to: number | null;
    user_id: string;
    name: string;
    leader: string;
    created_at: number;
    updated_at: number;
};

export type ChannelDbRecord = {
    id: string;
    version?: number;
    validFrom?: number;
    validTo?: number | null;
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
    version: number;
    valid_from: number;
    valid_to: number | null;
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
    version?: number;
    validFrom?: number;
    validTo?: number | null;
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
    version: number;
    valid_from: number;
    valid_to: number | null;
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
    version?: number;
    validFrom?: number;
    validTo?: number | null;
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
    version: number;
    valid_from: number;
    valid_to: number | null;
    is_owner: number;
    parent_user_id: string | null;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
    country: string | null;
    timezone: string | null;
    nametag: string;
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
    version?: number;
    validFrom?: number;
    validTo?: number | null;
    isOwner: boolean;
    parentUserId: string | null;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    country: string | null;
    timezone: string | null;
    nametag: string;
    createdAt: number;
    updatedAt: number;
};

export type DatabaseConnectionRow = {
    user_a_id: string;
    user_b_id: string;
    version: number;
    valid_from: number;
    valid_to: number | null;
    requested_a: number;
    requested_b: number;
    requested_a_at: number | null;
    requested_b_at: number | null;
};

export type ConnectionDbRecord = {
    userAId: string;
    userBId: string;
    version?: number;
    validFrom?: number;
    validTo?: number | null;
    requestedA: boolean;
    requestedB: boolean;
    requestedAAt: number | null;
    requestedBAt: number | null;
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
    invalidatedAt: number | null;
    processedUntil: number | null;
    endedAt: number | null;
};

export type DatabaseTokenStatsHourlyRow = {
    hour_start: number;
    user_id: string;
    agent_id: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    cost: number;
};

export type TokenStatsHourlyDbRecord = {
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

export type ObservationLogDbRecord = {
    id: string;
    userId: string;
    type: string;
    source: string;
    message: string;
    details: string | null;
    data: unknown;
    scopeIds: string[];
    createdAt: number;
};

export type ObservationLogFindOptions = {
    type?: string;
    source?: string;
    scopeIds?: string[];
    afterDate?: number;
    beforeDate?: number;
    limit?: number;
    offset?: number;
};

export type ObservationLogRecentOptions = {
    type?: string;
    source?: string;
    scopeIds?: string[];
    limit?: number;
};

export type CreateUserInput = {
    id?: string;
    isOwner?: boolean;
    parentUserId?: string;
    name?: string;
    firstName?: string | null;
    lastName?: string | null;
    country?: string | null;
    timezone?: string | null;
    nametag?: string;
    createdAt?: number;
    updatedAt?: number;
    connectorKey?: string;
};

export type SystemPromptScope = "global" | "user";
export type SystemPromptKind = "system" | "first_message";
export type SystemPromptCondition = "new_user" | "returning_user";

export type DatabaseSystemPromptRow = {
    id: string;
    version: number;
    valid_from: number;
    valid_to: number | null;
    scope: SystemPromptScope;
    user_id: string | null;
    kind: SystemPromptKind;
    condition: string | null;
    prompt: string;
    enabled: number;
    created_at: number;
    updated_at: number;
};

export type SystemPromptDbRecord = {
    id: string;
    version?: number;
    validFrom?: number;
    validTo?: number | null;
    scope: SystemPromptScope;
    userId: string | null;
    kind: SystemPromptKind;
    condition: SystemPromptCondition | null;
    prompt: string;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
};

export type UpdateUserInput = {
    isOwner?: boolean;
    firstName?: string | null;
    lastName?: string | null;
    country?: string | null;
    timezone?: string | null;
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
