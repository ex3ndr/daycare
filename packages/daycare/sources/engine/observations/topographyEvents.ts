import type { ObservationLogDbRecord } from "@/types";
import type { ObservationLogRepository } from "../../storage/observationLogRepository.js";
import { observationEmit } from "./observationEmit.js";

export const TOPO_SOURCE_AGENTS = "system:agents";
export const TOPO_SOURCE_TASKS = "system:tasks";
export const TOPO_SOURCE_CRONS = "system:crons";
export const TOPO_SOURCE_WEBHOOKS = "system:webhooks";
export const TOPO_SOURCE_SIGNALS = "system:signals";
export const TOPO_SOURCE_CHANNELS = "system:channels";
export const TOPO_SOURCE_EXPOSES = "system:exposes";
export const TOPO_SOURCE_SECRETS = "system:secrets";
export const TOPO_SOURCE_SUBUSERS = "system:subusers";
export const TOPO_SOURCE_FRIENDS = "system:friends";

export type TopographyObservationSource =
    | typeof TOPO_SOURCE_AGENTS
    | typeof TOPO_SOURCE_TASKS
    | typeof TOPO_SOURCE_CRONS
    | typeof TOPO_SOURCE_WEBHOOKS
    | typeof TOPO_SOURCE_SIGNALS
    | typeof TOPO_SOURCE_CHANNELS
    | typeof TOPO_SOURCE_EXPOSES
    | typeof TOPO_SOURCE_SECRETS
    | typeof TOPO_SOURCE_SUBUSERS
    | typeof TOPO_SOURCE_FRIENDS;

export const TOPO_EVENT_TYPES = {
    AGENT_CREATED: "agent:created",
    AGENT_UPDATED: "agent:updated",
    AGENT_LIFECYCLE: "agent:lifecycle",
    TASK_CREATED: "task:created",
    TASK_UPDATED: "task:updated",
    TASK_DELETED: "task:deleted",
    CRON_ADDED: "cron:added",
    CRON_DELETED: "cron:deleted",
    CRON_ENABLED: "cron:enabled",
    CRON_DISABLED: "cron:disabled",
    WEBHOOK_ADDED: "webhook:added",
    WEBHOOK_DELETED: "webhook:deleted",
    SIGNAL_SUBSCRIBED: "signal:subscribed",
    SIGNAL_UNSUBSCRIBED: "signal:unsubscribed",
    CHANNEL_CREATED: "channel:created",
    CHANNEL_DELETED: "channel:deleted",
    CHANNEL_MEMBER_JOINED: "channel:member_joined",
    CHANNEL_MEMBER_LEFT: "channel:member_left",
    EXPOSE_CREATED: "expose:created",
    EXPOSE_REMOVED: "expose:removed",
    EXPOSE_UPDATED: "expose:updated",
    SECRET_ADDED: "secret:added",
    SECRET_REMOVED: "secret:removed",
    SUBUSER_CREATED: "subuser:created",
    SUBUSER_CONFIGURED: "subuser:configured",
    FRIEND_REQUESTED: "friend:requested",
    FRIEND_ACCEPTED: "friend:accepted",
    FRIEND_REMOVED: "friend:removed",
    FRIEND_SUBUSER_SHARED: "friend:subuser_shared",
    FRIEND_SUBUSER_UNSHARED: "friend:subuser_unshared"
} as const;

export type TopographyObservationType = (typeof TOPO_EVENT_TYPES)[keyof typeof TOPO_EVENT_TYPES];

export type AgentCreatedData = {
    agentId: string;
    userId: string;
    pathKind: string;
    label: string;
    parentAgentId?: string;
};

export type AgentUpdatedData = {
    agentId: string;
    userId: string;
    pathKind: string;
    label: string;
};

export type AgentLifecycleData = {
    agentId: string;
    userId: string;
    lifecycle: string;
    label: string;
};

export type TaskCreatedData = {
    taskId: string;
    userId: string;
    title: string | null;
    description: string | null;
};

export type TaskUpdatedData = {
    taskId: string;
    userId: string;
    title: string | null;
    description: string | null;
    changes: string[];
};

export type TaskDeletedData = {
    taskId: string;
    userId: string;
    title: string | null;
};

export type CronAddedData = {
    cronId: string;
    taskId: string;
    userId: string;
    name: string;
    schedule: string;
    timezone: string;
};

export type CronDeletedData = {
    cronId: string;
    taskId: string;
    userId: string;
    name: string;
};

export type CronEnabledData = {
    cronId: string;
    taskId: string;
    userId: string;
    name: string;
};

export type CronDisabledData = {
    cronId: string;
    taskId: string;
    userId: string;
    name: string;
};

export type WebhookAddedData = {
    webhookId: string;
    taskId: string;
    userId: string;
    name: string;
    routeTemplate: string;
};

export type WebhookDeletedData = {
    webhookId: string;
    taskId: string;
    userId: string;
    name: string;
};

export type SignalSubscribedData = {
    agentId: string;
    userId: string;
    pattern: string;
    silent: boolean;
};

export type SignalUnsubscribedData = {
    agentId: string;
    userId: string;
    pattern: string;
};

export type ChannelCreatedData = {
    channelId: string;
    userId: string;
    name: string;
    leader: string;
};

export type ChannelDeletedData = {
    channelId: string;
    userId: string;
    name: string;
    memberCount: number;
};

export type ChannelMemberJoinedData = {
    channelId: string;
    userId: string;
    name: string;
    agentId: string;
    username: string;
};

export type ChannelMemberLeftData = {
    channelId: string;
    userId: string;
    name: string;
    agentId: string;
    username: string;
};

export type ExposeCreatedData = {
    exposeId: string;
    userId: string;
    domain: string;
    target: string;
    provider: string;
    mode: string;
    authenticated: boolean;
};

export type ExposeRemovedData = {
    exposeId: string;
    userId: string;
    domain: string;
};

export type ExposeUpdatedData = {
    exposeId: string;
    userId: string;
    domain: string;
    target: string;
    provider: string;
    mode: string;
    authenticated: boolean;
};

export type SecretAddedData = {
    userId: string;
    name: string;
    displayName: string;
    variableNames: string[];
};

export type SecretRemovedData = {
    userId: string;
    name: string;
    displayName: string;
};

export type SubuserCreatedData = {
    subuserId: string;
    ownerUserId: string;
    name: string | null;
    nametag: string | null;
    gatewayAgentId: string | null;
};

export type SubuserConfiguredData = {
    subuserId: string;
    ownerUserId: string;
    name: string | null;
    gatewayAgentId: string;
};

export type FriendRequestedData = {
    fromUserId: string;
    toUserId: string;
    toNametag: string | null;
};

export type FriendAcceptedData = {
    userAId: string;
    userBId: string;
    nametag: string | null;
};

export type FriendRemovedData = {
    userAId: string;
    userBId: string;
    nametag: string | null;
};

export type FriendSubuserSharedData = {
    subuserId: string;
    subuserName: string;
    ownerUserId: string;
    friendUserId: string;
    friendNametag: string | null;
};

export type FriendSubuserUnsharedData = {
    subuserId: string;
    subuserName: string;
    ownerUserId: string;
    friendUserId: string;
    friendNametag: string | null;
};

export type TopographyObservationDataByType = {
    "agent:created": AgentCreatedData;
    "agent:updated": AgentUpdatedData;
    "agent:lifecycle": AgentLifecycleData;
    "task:created": TaskCreatedData;
    "task:updated": TaskUpdatedData;
    "task:deleted": TaskDeletedData;
    "cron:added": CronAddedData;
    "cron:deleted": CronDeletedData;
    "cron:enabled": CronEnabledData;
    "cron:disabled": CronDisabledData;
    "webhook:added": WebhookAddedData;
    "webhook:deleted": WebhookDeletedData;
    "signal:subscribed": SignalSubscribedData;
    "signal:unsubscribed": SignalUnsubscribedData;
    "channel:created": ChannelCreatedData;
    "channel:deleted": ChannelDeletedData;
    "channel:member_joined": ChannelMemberJoinedData;
    "channel:member_left": ChannelMemberLeftData;
    "expose:created": ExposeCreatedData;
    "expose:removed": ExposeRemovedData;
    "expose:updated": ExposeUpdatedData;
    "secret:added": SecretAddedData;
    "secret:removed": SecretRemovedData;
    "subuser:created": SubuserCreatedData;
    "subuser:configured": SubuserConfiguredData;
    "friend:requested": FriendRequestedData;
    "friend:accepted": FriendAcceptedData;
    "friend:removed": FriendRemovedData;
    "friend:subuser_shared": FriendSubuserSharedData;
    "friend:subuser_unshared": FriendSubuserUnsharedData;
};

export type TopographyObservationEmitInput<TType extends TopographyObservationType> = {
    userId: string;
    type: TType;
    source: TopographyObservationSource;
    message: string;
    details?: string | null;
    data: TopographyObservationDataByType[TType];
    scopeIds?: string[];
};

/**
 * Emits a typed topology observation with strong type/data pairing guarantees.
 * Expects: `type` and `data` match via TopographyObservationDataByType.
 */
export async function topographyObservationEmit<TType extends TopographyObservationType>(
    repository: ObservationLogRepository,
    input: TopographyObservationEmitInput<TType>
): Promise<ObservationLogDbRecord> {
    return observationEmit(repository, {
        userId: input.userId,
        type: input.type,
        source: input.source,
        message: input.message,
        details: input.details ?? null,
        data: input.data,
        scopeIds: input.scopeIds ?? []
    });
}
