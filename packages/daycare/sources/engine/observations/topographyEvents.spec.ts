import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import {
    TOPO_EVENT_TYPES,
    TOPO_SOURCE_AGENTS,
    TOPO_SOURCE_CHANNELS,
    TOPO_SOURCE_CRONS,
    TOPO_SOURCE_EXPOSES,
    TOPO_SOURCE_FRIENDS,
    TOPO_SOURCE_SECRETS,
    TOPO_SOURCE_SIGNALS,
    TOPO_SOURCE_SUBUSERS,
    TOPO_SOURCE_TASKS,
    TOPO_SOURCE_WEBHOOKS,
    type TopographyObservationDataByType,
    type TopographyObservationType,
    topographyObservationEmit
} from "./topographyEvents.js";

type TopographyEmitCase<TType extends TopographyObservationType> = {
    type: TType;
    source:
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
    message: string;
    details: string;
    data: TopographyObservationDataByType[TType];
    scopeIds: string[];
};

function topographyEmitCase<TType extends TopographyObservationType>(
    input: TopographyEmitCase<TType>
): TopographyEmitCase<TType> {
    return input;
}

describe("topographyObservationEmit", () => {
    it("emits all typed topography events with persisted data and scope IDs", async () => {
        const storage = await storageOpenTest();
        try {
            const cases = [
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.AGENT_CREATED,
                    source: TOPO_SOURCE_AGENTS,
                    message: "Agent created: worker",
                    details: "details",
                    data: {
                        agentId: "agent-1",
                        userId: "user-1",
                        pathKind: "sub",
                        label: "worker",
                        parentAgentId: "parent-1"
                    },
                    scopeIds: ["user-1", "parent-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.AGENT_UPDATED,
                    source: TOPO_SOURCE_AGENTS,
                    message: "Agent updated: worker",
                    details: "details",
                    data: {
                        agentId: "agent-1",
                        userId: "user-1",
                        pathKind: "sub",
                        label: "worker"
                    },
                    scopeIds: ["user-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.AGENT_LIFECYCLE,
                    source: TOPO_SOURCE_AGENTS,
                    message: "Agent sleeping: worker",
                    details: "details",
                    data: {
                        agentId: "agent-1",
                        userId: "user-1",
                        lifecycle: "sleeping",
                        label: "worker"
                    },
                    scopeIds: ["user-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.TASK_CREATED,
                    source: TOPO_SOURCE_TASKS,
                    message: "Task created: backup",
                    details: "details",
                    data: { taskId: "task-1", userId: "user-1", title: "backup", description: "daily backup" },
                    scopeIds: ["user-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.TASK_UPDATED,
                    source: TOPO_SOURCE_TASKS,
                    message: "Task updated: backup",
                    details: "details",
                    data: {
                        taskId: "task-1",
                        userId: "user-1",
                        title: "backup",
                        description: "daily backup",
                        changes: ["title", "description"]
                    },
                    scopeIds: ["user-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.TASK_DELETED,
                    source: TOPO_SOURCE_TASKS,
                    message: "Task deleted: backup",
                    details: "details",
                    data: { taskId: "task-1", userId: "user-1", title: "backup" },
                    scopeIds: ["user-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.CRON_ADDED,
                    source: TOPO_SOURCE_CRONS,
                    message: "Cron added: backup",
                    details: "details",
                    data: {
                        cronId: "cron-1",
                        taskId: "task-1",
                        userId: "user-1",
                        schedule: "0 * * * *",
                        timezone: "UTC"
                    },
                    scopeIds: ["user-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.CRON_DELETED,
                    source: TOPO_SOURCE_CRONS,
                    message: "Cron deleted: backup",
                    details: "details",
                    data: { cronId: "cron-1", taskId: "task-1", userId: "user-1" },
                    scopeIds: ["user-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.CRON_ENABLED,
                    source: TOPO_SOURCE_CRONS,
                    message: "Cron enabled: backup",
                    details: "details",
                    data: { cronId: "cron-1", taskId: "task-1", userId: "user-1" },
                    scopeIds: ["user-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.CRON_DISABLED,
                    source: TOPO_SOURCE_CRONS,
                    message: "Cron disabled: backup",
                    details: "details",
                    data: { cronId: "cron-1", taskId: "task-1", userId: "user-1" },
                    scopeIds: ["user-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.WEBHOOK_ADDED,
                    source: TOPO_SOURCE_WEBHOOKS,
                    message: "Webhook added: backup",
                    details: "details",
                    data: {
                        webhookId: "wh-1",
                        taskId: "task-1",
                        userId: "user-1",
                        routeTemplate: "/v1/webhooks/:token"
                    },
                    scopeIds: ["user-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.WEBHOOK_DELETED,
                    source: TOPO_SOURCE_WEBHOOKS,
                    message: "Webhook deleted: backup",
                    details: "details",
                    data: { webhookId: "wh-1", taskId: "task-1", userId: "user-1" },
                    scopeIds: ["user-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.SIGNAL_SUBSCRIBED,
                    source: TOPO_SOURCE_SIGNALS,
                    message: "Signal subscribed: build:*",
                    details: "details",
                    data: { agentId: "agent-1", userId: "user-1", pattern: "build:*", silent: true },
                    scopeIds: ["user-1", "agent-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.SIGNAL_UNSUBSCRIBED,
                    source: TOPO_SOURCE_SIGNALS,
                    message: "Signal unsubscribed: build:*",
                    details: "details",
                    data: { agentId: "agent-1", userId: "user-1", pattern: "build:*" },
                    scopeIds: ["user-1", "agent-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.CHANNEL_CREATED,
                    source: TOPO_SOURCE_CHANNELS,
                    message: "Channel created: dev",
                    details: "details",
                    data: { channelId: "channel-1", userId: "user-1", name: "dev", leader: "leader-agent" },
                    scopeIds: ["user-1", "channel-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.CHANNEL_DELETED,
                    source: TOPO_SOURCE_CHANNELS,
                    message: "Channel deleted: dev",
                    details: "details",
                    data: { channelId: "channel-1", userId: "user-1", name: "dev", memberCount: 2 },
                    scopeIds: ["user-1", "channel-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.CHANNEL_MEMBER_JOINED,
                    source: TOPO_SOURCE_CHANNELS,
                    message: "Channel member joined: alice -> dev",
                    details: "details",
                    data: {
                        channelId: "channel-1",
                        userId: "user-1",
                        name: "dev",
                        agentId: "agent-1",
                        username: "alice"
                    },
                    scopeIds: ["user-1", "channel-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.CHANNEL_MEMBER_LEFT,
                    source: TOPO_SOURCE_CHANNELS,
                    message: "Channel member left: alice -> dev",
                    details: "details",
                    data: {
                        channelId: "channel-1",
                        userId: "user-1",
                        name: "dev",
                        agentId: "agent-1",
                        username: "alice"
                    },
                    scopeIds: ["user-1", "channel-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.EXPOSE_CREATED,
                    source: TOPO_SOURCE_EXPOSES,
                    message: "Expose created: app.example.com",
                    details: "details",
                    data: {
                        exposeId: "expose-1",
                        userId: "user-1",
                        domain: "app.example.com",
                        target: "port:3000",
                        provider: "provider-a",
                        mode: "public",
                        authenticated: true
                    },
                    scopeIds: ["user-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.EXPOSE_REMOVED,
                    source: TOPO_SOURCE_EXPOSES,
                    message: "Expose removed: app.example.com",
                    details: "details",
                    data: { exposeId: "expose-1", userId: "user-1", domain: "app.example.com" },
                    scopeIds: ["user-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.EXPOSE_UPDATED,
                    source: TOPO_SOURCE_EXPOSES,
                    message: "Expose updated: app.example.com",
                    details: "details",
                    data: {
                        exposeId: "expose-1",
                        userId: "user-1",
                        domain: "app.example.com",
                        target: "port:3000",
                        provider: "provider-a",
                        mode: "public",
                        authenticated: false
                    },
                    scopeIds: ["user-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.SECRET_ADDED,
                    source: TOPO_SOURCE_SECRETS,
                    message: "Secret added: OpenAI Key",
                    details: "details",
                    data: {
                        userId: "user-1",
                        name: "openai-key",
                        displayName: "OpenAI Key",
                        variableNames: ["OPENAI_API_KEY"]
                    },
                    scopeIds: ["user-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.SECRET_REMOVED,
                    source: TOPO_SOURCE_SECRETS,
                    message: "Secret removed: OpenAI Key",
                    details: "details",
                    data: {
                        userId: "user-1",
                        name: "openai-key",
                        displayName: "OpenAI Key"
                    },
                    scopeIds: ["user-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.SUBUSER_CREATED,
                    source: TOPO_SOURCE_SUBUSERS,
                    message: "Subuser created: helper",
                    details: "details",
                    data: {
                        subuserId: "subuser-1",
                        ownerUserId: "owner-1",
                        name: "helper",
                        nametag: "swift-owl-11",
                        gatewayAgentId: "agent-9"
                    },
                    scopeIds: ["owner-1", "subuser-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.SUBUSER_CONFIGURED,
                    source: TOPO_SOURCE_SUBUSERS,
                    message: "Subuser configured: helper",
                    details: "details",
                    data: {
                        subuserId: "subuser-1",
                        ownerUserId: "owner-1",
                        name: "helper",
                        gatewayAgentId: "agent-9"
                    },
                    scopeIds: ["owner-1", "subuser-1"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.FRIEND_REQUESTED,
                    source: TOPO_SOURCE_FRIENDS,
                    message: "Friend request sent to swift-fox-42",
                    details: "details",
                    data: { fromUserId: "user-1", toUserId: "user-2", toNametag: "swift-fox-42" },
                    scopeIds: ["user-1", "user-2"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.FRIEND_ACCEPTED,
                    source: TOPO_SOURCE_FRIENDS,
                    message: "Friend accepted: swift-fox-42",
                    details: "details",
                    data: { userAId: "user-1", userBId: "user-2", nametag: "swift-fox-42" },
                    scopeIds: ["user-1", "user-2"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.FRIEND_REMOVED,
                    source: TOPO_SOURCE_FRIENDS,
                    message: "Friend removed: swift-fox-42",
                    details: "details",
                    data: { userAId: "user-1", userBId: "user-2", nametag: "swift-fox-42" },
                    scopeIds: ["user-1", "user-2"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.FRIEND_SUBUSER_SHARED,
                    source: TOPO_SOURCE_FRIENDS,
                    message: "Subuser shared: helper -> swift-fox-42",
                    details: "details",
                    data: {
                        subuserId: "subuser-1",
                        subuserName: "helper",
                        ownerUserId: "user-1",
                        friendUserId: "user-2",
                        friendNametag: "swift-fox-42"
                    },
                    scopeIds: ["user-1", "user-2"]
                }),
                topographyEmitCase({
                    type: TOPO_EVENT_TYPES.FRIEND_SUBUSER_UNSHARED,
                    source: TOPO_SOURCE_FRIENDS,
                    message: "Subuser unshared: helper -> swift-fox-42",
                    details: "details",
                    data: {
                        subuserId: "subuser-1",
                        subuserName: "helper",
                        ownerUserId: "user-1",
                        friendUserId: "user-2",
                        friendNametag: "swift-fox-42"
                    },
                    scopeIds: ["user-1", "user-2"]
                })
            ] as const;

            for (const event of cases) {
                await topographyObservationEmit(storage.observationLog, {
                    userId: "user-1",
                    type: event.type,
                    source: event.source,
                    message: event.message,
                    details: event.details,
                    data: event.data,
                    scopeIds: event.scopeIds
                });
            }

            const observations = await storage.observationLog.findMany({ userId: "user-1", agentId: "agent-1" });
            expect(observations).toHaveLength(cases.length);

            for (const event of cases) {
                const found = observations.find((entry) => entry.type === event.type);
                expect(found).toBeDefined();
                expect(found?.source).toBe(event.source);
                expect(found?.message).toBe(event.message);
                expect(found?.details).toBe(event.details);
                expect(found?.data).toEqual(event.data);
                expect(found?.scopeIds).toEqual(event.scopeIds);
            }
        } finally {
            storage.connection.close();
        }
    });
});
