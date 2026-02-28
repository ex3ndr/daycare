import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { AgentState, SessionPermissions, ToolExecutionContext } from "@/types";
import { configResolve } from "../../../config/configResolve.js";
import { databaseMigrate } from "../../../storage/databaseMigrate.js";
import type { CronTaskDbRecord } from "../../../storage/databaseTypes.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import { contextForAgent } from "../../agents/context.js";
import { agentDescriptorWrite } from "../../agents/ops/agentDescriptorWrite.js";
import { agentStateWrite } from "../../agents/ops/agentStateWrite.js";
import type { Crons } from "../../cron/crons.js";
import type { HeartbeatDefinition } from "../../heartbeat/heartbeatTypes.js";
import { permissionBuildUser } from "../../permissions/permissionBuildUser.js";
import type { Signals } from "../../signals/signals.js";
import type { SignalSubscription } from "../../signals/signalTypes.js";
import { UserHome } from "../../users/userHome.js";
import { topologyTool } from "./topologyToolBuild.js";

const toolCall = { id: "tool-1", name: "topology" };

describe("topologyTool", () => {
    it("returns empty sections when no topology entries exist", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-topology-tool-"));
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir, db: { autoMigrate: false } }
                },
                path.join(dir, "settings.json")
            );
            const storage = storageResolve(config);
            await databaseMigrate(storage.connection);

            const tool = topologyTool(
                { listTasks: async () => [] } as unknown as Crons,
                { listSubscriptions: async () => [] } as unknown as Signals,
                { listForUserIds: (_userIds: string[]) => [] } as never,
                { list: async () => [] } as never
            );
            const result = await tool.execute(
                {},
                contextBuild(config, {
                    callerAgentId: "agent-caller",
                    callerUserId: "user-1",
                    heartbeatTasks: []
                }),
                toolCall
            );

            expect(result.toolMessage.isError).toBe(false);
            expect(result.typedResult).toMatchObject({
                agents: [],
                tasks: [],
                signalSubscriptions: [],
                channels: [],
                exposes: [],
                subusers: [],
                friends: [],
                agentCount: 0,
                taskCount: 0,
                cronCount: 0,
                heartbeatCount: 0,
                signalSubscriptionCount: 0,
                channelCount: 0,
                exposeCount: 0,
                friendCount: 0
            });

            const details = result.toolMessage.details as
                | {
                      callerAgentId: string;
                      agents: unknown[];
                      tasks: unknown[];
                      signalSubscriptions: unknown[];
                      channels: unknown[];
                      exposes: unknown[];
                      friends: unknown[];
                  }
                | undefined;
            expect(details).toEqual({
                callerAgentId: "agent-caller",
                agents: [],
                tasks: [],
                signalSubscriptions: [],
                channels: [],
                exposes: [],
                friends: [],
                subusers: [],
                agentCount: 0,
                taskCount: 0,
                cronCount: 0,
                heartbeatCount: 0,
                signalSubscriptionCount: 0,
                channelCount: 0,
                exposeCount: 0,
                friendCount: 0
            });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("returns populated topology with expected section formatting", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-topology-tool-"));
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir, db: { autoMigrate: false } }
                },
                path.join(dir, "settings.json")
            );
            const storage = storageResolve(config);
            await databaseMigrate(storage.connection);

            const permissions = permissionBuildUser(new UserHome(config.usersDir, "user-1"));
            const callerCtx = contextForAgent({ userId: "user-1", agentId: "agent-caller" });
            await agentDescriptorWrite(
                storage,
                callerCtx,
                {
                    type: "subagent",
                    id: "agent-caller",
                    parentAgentId: "agent-other",
                    name: "monitor"
                },
                permissions
            );
            await agentStateWrite(config, callerCtx, stateBuild(permissions, 50));

            const otherCtx = contextForAgent({ userId: "user-1", agentId: "agent-other" });
            await agentDescriptorWrite(storage, otherCtx, { type: "system", tag: "cron" }, permissions);
            await agentStateWrite(config, otherCtx, stateBuild(permissions, 10));
            await storage.exposeEndpoints.create({
                id: "expose-1",
                userId: "user-1",
                target: { type: "port", port: 8080 },
                provider: "provider-a",
                domain: "app.example.com",
                mode: "public",
                auth: null,
                createdAt: 1,
                updatedAt: 1
            });
            await topologyTaskCreate(storage, "user-1", "cleanup-task", "Cleanup");
            await topologyTaskCreate(storage, "user-1", "daily-report-task", "Daily Report");
            await topologyTaskCreate(storage, "user-1", "task-check-health", "Health Check");

            const tool = topologyTool(
                {
                    listTasks: async () => [
                        cronTaskBuild({ id: "cleanup", name: "Cleanup", schedule: "0 0 * * 0", enabled: false }),
                        cronTaskBuild({
                            id: "daily-report",
                            name: "Daily Report",
                            schedule: "0 9 * * *",
                            enabled: true,
                            agentId: "agent-caller"
                        })
                    ]
                } as unknown as Crons,
                {
                    listSubscriptions: async () => [
                        signalSubscriptionBuild({
                            userId: "user-1",
                            agentId: "agent-other",
                            pattern: "deploy:done",
                            silent: false
                        }),
                        signalSubscriptionBuild({
                            userId: "user-1",
                            agentId: "agent-caller",
                            pattern: "build:*",
                            silent: true
                        }),
                        signalSubscriptionBuild({
                            userId: "user-2",
                            agentId: "agent-secret",
                            pattern: "secret:*",
                            silent: false
                        })
                    ]
                } as unknown as Signals,
                {
                    listForUserIds: (_userIds: string[]) => [
                        {
                            id: "channel-dev",
                            name: "dev",
                            leader: "agent-other",
                            members: [{ agentId: "agent-caller", username: "monitor", joinedAt: 1 }],
                            createdAt: 1,
                            updatedAt: 1
                        }
                    ]
                } as never,
                {
                    list: async () => []
                } as never
            );

            const result = await tool.execute(
                {},
                contextBuild(config, {
                    callerAgentId: "agent-third",
                    callerUserId: "user-1",
                    heartbeatTasks: [
                        {
                            id: "check-health",
                            taskId: "task-check-health",
                            userId: "user-1",
                            title: "Health Check",
                            lastRunAt: Date.parse("2025-01-15T10:00:00Z"),
                            createdAt: 1,
                            updatedAt: 1
                        }
                    ]
                }),
                toolCall
            );

            expect(result.typedResult.agentCount).toBe(2);
            expect(result.typedResult.cronCount).toBe(2);
            expect(result.typedResult.heartbeatCount).toBe(1);
            expect(result.typedResult.signalSubscriptionCount).toBe(2);
            expect(result.typedResult.channelCount).toBe(1);
            expect(result.typedResult.exposeCount).toBe(1);
            expect(result.typedResult.friendCount).toBe(0);

            expect(result.typedResult.agents).toEqual([
                { id: "agent-caller", type: "subagent", label: "monitor", lifecycle: "active", isYou: false },
                { id: "agent-other", type: "system", label: "cron", lifecycle: "active", isYou: false }
            ]);

            const dailyReportTask = result.typedResult.tasks.find((task) => task.id === "daily-report-task");
            expect(dailyReportTask?.triggers.cron[0]).toMatchObject({
                id: "daily-report",
                schedule: "0 9 * * *",
                timezone: "UTC",
                name: "Daily Report"
            });
            const heartbeatTask = result.typedResult.tasks.find((task) => task.id === "task-check-health");
            expect(heartbeatTask?.triggers.heartbeat[0]).toMatchObject({
                id: "check-health",
                title: "Health Check",
                lastRunAt: Date.parse("2025-01-15T10:00:00Z")
            });

            expect(
                result.typedResult.signalSubscriptions.some(
                    (subscription) => subscription.agentId === "agent-other" && subscription.pattern === "deploy:done"
                )
            ).toBe(true);
            expect(
                result.typedResult.signalSubscriptions.some((subscription) => subscription.pattern === "secret:*")
            ).toBe(false);
            expect(result.typedResult.channels[0]).toEqual({
                id: "channel-dev",
                name: "dev",
                leader: "agent-other",
                members: [{ agentId: "agent-caller", username: "monitor" }]
            });
            expect(result.typedResult.exposes[0]).toEqual({
                id: "expose-1",
                domain: "app.example.com",
                target: "port:8080",
                provider: "provider-a",
                mode: "public",
                authenticated: false
            });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("hides memory and dead agents from topology by default", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-topology-filter-defaults-"));
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir, db: { autoMigrate: false } }
                },
                path.join(dir, "settings.json")
            );

            const storage = storageResolve(config);
            await databaseMigrate(storage.connection);
            const permissions = permissionBuildUser(new UserHome(config.usersDir, "user-1"));

            const activeCtx = contextForAgent({ userId: "user-1", agentId: "agent-active" });
            await agentDescriptorWrite(
                storage,
                activeCtx,
                { type: "subagent", id: "visible", parentAgentId: "agent-root", name: "visible" },
                permissions
            );
            await agentStateWrite(config, activeCtx, stateBuild(permissions, 100));

            const memoryCtx = contextForAgent({ userId: "user-1", agentId: "agent-memory" });
            await agentDescriptorWrite(storage, memoryCtx, { type: "memory-agent", id: "memory-1" }, permissions);
            await agentStateWrite(config, memoryCtx, stateBuild(permissions, 90));

            const deadCtx = contextForAgent({ userId: "user-1", agentId: "agent-dead" });
            await agentDescriptorWrite(
                storage,
                deadCtx,
                { type: "subagent", id: "gone", parentAgentId: "agent-root", name: "gone" },
                permissions
            );
            await agentStateWrite(config, deadCtx, stateBuild(permissions, 80, "dead"));

            const tool = topologyTool(
                { listTasks: async () => [] } as unknown as Crons,
                { listSubscriptions: async () => [] } as unknown as Signals,
                { listForUserIds: (_userIds: string[]) => [] } as never,
                { list: async () => [] } as never
            );

            const result = await tool.execute(
                {},
                contextBuild(config, {
                    callerAgentId: "agent-active",
                    callerUserId: "user-1",
                    heartbeatTasks: []
                }),
                toolCall
            );

            expect(result.typedResult.agentCount).toBe(1);
            expect(result.typedResult.agents).toEqual([
                { id: "agent-active", type: "subagent", label: "visible", lifecycle: "active", isYou: true }
            ]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("subuser agent sees only their own agents and crons in topology", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-topology-subuser-"));
        const config = configResolve(
            { engine: { dataDir: dir, db: { autoMigrate: false } } },
            path.join(dir, "settings.json")
        );
        const storage = storageResolve(config);
        await databaseMigrate(storage.connection);
        try {
            // Find the owner user (created by bootstrap migration)
            const owner = await storage.users.findOwner();
            const ownerUserId = owner!.id;

            // Create a subuser
            await storage.users.create({ id: "subuser-1", parentUserId: ownerUserId, name: "my-app" });

            // Create agents for both users
            const ownerHome = new UserHome(config.usersDir, ownerUserId);
            const subuserHome = new UserHome(config.usersDir, "subuser-1");
            const ownerPerms = permissionBuildUser(ownerHome);
            const subuserPerms = permissionBuildUser(subuserHome);

            const ownerCtx = contextForAgent({ userId: ownerUserId, agentId: "owner-agent" });
            await agentDescriptorWrite(
                storage,
                ownerCtx,
                { type: "user", connector: "telegram", userId: "u1", channelId: "c1" },
                ownerPerms
            );
            await agentStateWrite(config, ownerCtx, stateBuild(ownerPerms, 100));

            const subuserCtx = contextForAgent({ userId: "subuser-1", agentId: "subuser-gateway" });
            await agentDescriptorWrite(
                storage,
                subuserCtx,
                { type: "subuser", id: "subuser-1", name: "my-app", systemPrompt: "Hello" },
                subuserPerms
            );
            await agentStateWrite(config, subuserCtx, stateBuild(subuserPerms, 50));
            await topologyTaskCreate(storage, "subuser-1", "subuser-cron-task", "Subuser Cron");

            const tool = topologyTool(
                {
                    listTasks: async () => [
                        cronTaskBuild({ id: "owner-cron", name: "Owner Cron", schedule: "0 0 * * *", enabled: true }),
                        {
                            ...cronTaskBuild({
                                id: "subuser-cron",
                                name: "Subuser Cron",
                                schedule: "0 6 * * *",
                                enabled: true
                            }),
                            userId: "subuser-1"
                        }
                    ]
                } as unknown as Crons,
                { listSubscriptions: async () => [] } as unknown as Signals,
                { listForUserIds: (_userIds: string[]) => [] } as never,
                { list: async () => [] } as never
            );

            // Call topology as the subuser's agent
            const result = await tool.execute(
                {},
                contextBuild(config, {
                    callerAgentId: "subuser-gateway",
                    callerUserId: "subuser-1",
                    heartbeatTasks: []
                }),
                toolCall
            );

            expect(result.typedResult.agents).toHaveLength(1);
            expect(result.typedResult.agents[0]?.id).toBe("subuser-gateway");
            expect(result.typedResult.tasks).toHaveLength(1);
            expect(result.typedResult.tasks[0]?.id).toBe("subuser-cron-task");
            expect(result.typedResult.tasks[0]?.triggers.cron[0]?.id).toBe("subuser-cron");
            expect(result.typedResult.subusers).toEqual([]);
            expect(result.typedResult.friends).toEqual([]);
        } finally {
            storage.connection.close();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("owner user sees subusers section in topology", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-topology-owner-subusers-"));
        const config = configResolve(
            { engine: { dataDir: dir, db: { autoMigrate: false } } },
            path.join(dir, "settings.json")
        );
        const storage = storageResolve(config);
        await databaseMigrate(storage.connection);
        try {
            // Find the owner user
            const owner = await storage.users.findOwner();
            const ownerUserId = owner!.id;

            // Create subusers
            await storage.users.create({ id: "sub-a", parentUserId: ownerUserId, name: "app-a" });
            await storage.users.create({ id: "sub-b", parentUserId: ownerUserId, name: "app-b" });

            // Create gateway agents
            const ownerHome = new UserHome(config.usersDir, ownerUserId);
            const ownerPerms = permissionBuildUser(ownerHome);

            const ownerCtx = contextForAgent({ userId: ownerUserId, agentId: "owner-main" });
            await agentDescriptorWrite(
                storage,
                ownerCtx,
                { type: "user", connector: "telegram", userId: "u1", channelId: "c1" },
                ownerPerms
            );
            await agentStateWrite(config, ownerCtx, stateBuild(ownerPerms, 100));

            const subAPerms = permissionBuildUser(new UserHome(config.usersDir, "sub-a"));
            const subACtx = contextForAgent({ userId: "sub-a", agentId: "gateway-a" });
            await agentDescriptorWrite(
                storage,
                subACtx,
                { type: "subuser", id: "sub-a", name: "app-a", systemPrompt: "Prompt A" },
                subAPerms
            );
            await agentStateWrite(config, subACtx, stateBuild(subAPerms, 50));

            const subBPerms = permissionBuildUser(new UserHome(config.usersDir, "sub-b"));
            const subBCtx = contextForAgent({ userId: "sub-b", agentId: "gateway-b" });
            await agentDescriptorWrite(
                storage,
                subBCtx,
                { type: "subuser", id: "sub-b", name: "app-b", systemPrompt: "Prompt B" },
                subBPerms
            );
            await agentStateWrite(config, subBCtx, stateBuild(subBPerms, 50));

            const tool = topologyTool(
                { listTasks: async () => [] } as unknown as Crons,
                { listSubscriptions: async () => [] } as unknown as Signals,
                { listForUserIds: (_userIds: string[]) => [] } as never,
                { list: async () => [] } as never
            );

            // Call topology as the owner's agent
            const result = await tool.execute(
                {},
                contextBuild(config, {
                    callerAgentId: "owner-main",
                    callerUserId: ownerUserId,
                    heartbeatTasks: []
                }),
                toolCall
            );

            expect(result.typedResult.agentCount).toBe(3);
            expect(result.typedResult.subusers).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ id: "sub-a", name: "app-a", gatewayAgentId: "gateway-a" }),
                    expect.objectContaining({ id: "sub-b", name: "app-b", gatewayAgentId: "gateway-b" })
                ])
            );
            expect(result.typedResult.friendCount).toBe(0);
        } finally {
            storage.connection.close();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("filters topology sections to caller user scope", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-topology-user-scope-"));
        const config = configResolve(
            { engine: { dataDir: dir, db: { autoMigrate: false } } },
            path.join(dir, "settings.json")
        );
        const storage = storageResolve(config);
        await databaseMigrate(storage.connection);
        try {
            const owner = await storage.users.findOwner();
            const ownerUserId = owner!.id;
            await storage.users.create({ id: "other-user", nametag: "other-user-tag" });

            const ownerPerms = permissionBuildUser(new UserHome(config.usersDir, ownerUserId));
            const otherPerms = permissionBuildUser(new UserHome(config.usersDir, "other-user"));

            const ownerCtx = contextForAgent({ userId: ownerUserId, agentId: "owner-main" });
            const otherCtx = contextForAgent({ userId: "other-user", agentId: "other-main" });

            await agentDescriptorWrite(
                storage,
                ownerCtx,
                { type: "user", connector: "telegram", userId: "owner-telegram", channelId: "owner-channel" },
                ownerPerms
            );
            await agentDescriptorWrite(
                storage,
                otherCtx,
                { type: "user", connector: "telegram", userId: "other-telegram", channelId: "other-channel" },
                otherPerms
            );
            await agentStateWrite(config, ownerCtx, stateBuild(ownerPerms, 100));
            await agentStateWrite(config, otherCtx, stateBuild(otherPerms, 200));

            await storage.exposeEndpoints.create({
                id: "owner-expose",
                userId: ownerUserId,
                target: { type: "port", port: 3001 },
                provider: "provider-a",
                domain: "owner.example.com",
                mode: "public",
                auth: null,
                createdAt: 1,
                updatedAt: 1
            });
            await storage.exposeEndpoints.create({
                id: "other-expose",
                userId: "other-user",
                target: { type: "port", port: 3002 },
                provider: "provider-a",
                domain: "other.example.com",
                mode: "public",
                auth: null,
                createdAt: 2,
                updatedAt: 2
            });
            await topologyTaskCreate(storage, ownerUserId, "owner-cron-task", "Owner Cron");
            await topologyTaskCreate(storage, ownerUserId, "owner-heartbeat-task", "Owner Heartbeat");

            const tool = topologyTool(
                {
                    listTasks: async () => [
                        {
                            ...cronTaskBuild({
                                id: "owner-cron",
                                name: "Owner Cron",
                                schedule: "0 6 * * *",
                                enabled: true,
                                agentId: "owner-main"
                            }),
                            taskId: "owner-cron-task",
                            userId: ownerUserId
                        },
                        {
                            ...cronTaskBuild({
                                id: "other-cron",
                                name: "Other Cron",
                                schedule: "0 7 * * *",
                                enabled: true,
                                agentId: "other-main"
                            }),
                            taskId: "other-cron-task",
                            userId: "other-user"
                        }
                    ]
                } as unknown as Crons,
                {
                    listSubscriptions: async () => [
                        signalSubscriptionBuild({
                            userId: ownerUserId,
                            agentId: "owner-main",
                            pattern: "owner:*",
                            silent: false
                        }),
                        signalSubscriptionBuild({
                            userId: "other-user",
                            agentId: "other-main",
                            pattern: "other:*",
                            silent: false
                        })
                    ]
                } as unknown as Signals,
                {
                    listForUserIds: (userIds: string[]) => {
                        const channels = [];
                        if (userIds.includes(ownerUserId)) {
                            channels.push({
                                id: "channel-owner",
                                name: "owner",
                                leader: "owner-main",
                                members: [{ agentId: "owner-main", username: "owner", joinedAt: 1 }],
                                createdAt: 1,
                                updatedAt: 1
                            });
                        }
                        if (userIds.includes("other-user")) {
                            channels.push({
                                id: "channel-other",
                                name: "other",
                                leader: "other-main",
                                members: [{ agentId: "other-main", username: "other", joinedAt: 1 }],
                                createdAt: 2,
                                updatedAt: 2
                            });
                        }
                        return channels;
                    }
                } as never,
                {
                    list: async () => [
                        {
                            id: "expose-other-legacy",
                            target: { type: "port", port: 9999 },
                            provider: "provider-a",
                            domain: "legacy-other.example.com",
                            mode: "public",
                            auth: null,
                            createdAt: 1,
                            updatedAt: 1
                        }
                    ]
                } as never
            );

            const result = await tool.execute(
                {},
                contextBuild(config, {
                    callerAgentId: "owner-main",
                    callerUserId: ownerUserId,
                    heartbeatTasks: [
                        {
                            id: "owner-heartbeat",
                            taskId: "owner-heartbeat-task",
                            userId: ownerUserId,
                            title: "Owner Heartbeat",
                            lastRunAt: null,
                            createdAt: 1,
                            updatedAt: 1
                        },
                        {
                            id: "other-heartbeat",
                            taskId: "other-heartbeat-task",
                            userId: "other-user",
                            title: "Other Heartbeat",
                            lastRunAt: null,
                            createdAt: 2,
                            updatedAt: 2
                        }
                    ]
                }),
                toolCall
            );

            expect(result.typedResult.agents.map((agent) => agent.id)).toEqual(["owner-main"]);
            expect(result.typedResult.tasks.map((task) => task.id).sort()).toEqual(
                ["owner-cron-task", "owner-heartbeat-task"].sort()
            );
            expect(result.typedResult.tasks.some((task) => task.id === "other-cron-task")).toBe(false);
            expect(result.typedResult.tasks.some((task) => task.id === "other-heartbeat-task")).toBe(false);
            expect(result.typedResult.signalSubscriptions).toEqual([
                { userId: ownerUserId, agentId: "owner-main", pattern: "owner:*", silent: false, isYou: true }
            ]);
            expect(result.typedResult.channels).toEqual([
                {
                    id: "channel-owner",
                    name: "owner",
                    leader: "owner-main",
                    members: [{ agentId: "owner-main", username: "owner" }]
                }
            ]);
            expect(result.typedResult.exposes).toEqual([
                {
                    id: "owner-expose",
                    domain: "owner.example.com",
                    target: "port:3001",
                    provider: "provider-a",
                    mode: "public",
                    authenticated: false
                }
            ]);
        } finally {
            storage.connection.close();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("renders friends with outgoing/incoming shared subusers and pending markers", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-topology-friends-sharing-"));
        const config = configResolve(
            { engine: { dataDir: dir, db: { autoMigrate: false } } },
            path.join(dir, "settings.json")
        );
        const storage = storageResolve(config);
        await databaseMigrate(storage.connection);
        try {
            await storage.users.create({ id: "alice", nametag: "happy-penguin-42" });
            await storage.users.create({ id: "bob", nametag: "swift-fox-42" });
            await storage.users.create({
                id: "alice-sub-active",
                parentUserId: "alice",
                name: "helper",
                nametag: "cool-cat-11"
            });
            await storage.users.create({
                id: "alice-sub-pending",
                parentUserId: "alice",
                name: "assistant",
                nametag: "lazy-dog-55"
            });
            await storage.users.create({
                id: "bob-sub-active",
                parentUserId: "bob",
                name: "bob-helper",
                nametag: "smart-owl-22"
            });

            await storage.connections.upsertRequest("alice", "bob", 100);
            await storage.connections.upsertRequest("bob", "alice", 200);
            await storage.connections.upsertRequest("alice-sub-active", "bob", 300);
            await storage.connections.upsertRequest("bob", "alice-sub-active", 400);
            await storage.connections.upsertRequest("alice-sub-pending", "bob", 500);
            await storage.connections.upsertRequest("bob-sub-active", "alice", 600);
            await storage.connections.upsertRequest("alice", "bob-sub-active", 700);

            const aliceActivePerms = permissionBuildUser(new UserHome(config.usersDir, "alice-sub-active"));
            const alicePendingPerms = permissionBuildUser(new UserHome(config.usersDir, "alice-sub-pending"));
            const bobActivePerms = permissionBuildUser(new UserHome(config.usersDir, "bob-sub-active"));
            await storage.agents.create({
                id: "gateway-alice-active",
                userId: "alice-sub-active",
                type: "subuser",
                descriptor: { type: "subuser", id: "alice-sub-active", name: "helper", systemPrompt: "prompt" },
                activeSessionId: null,
                permissions: aliceActivePerms,
                tokens: null,
                stats: {},
                lifecycle: "active",
                createdAt: 1,
                updatedAt: 1
            });
            await storage.agents.create({
                id: "gateway-alice-pending",
                userId: "alice-sub-pending",
                type: "subuser",
                descriptor: { type: "subuser", id: "alice-sub-pending", name: "assistant", systemPrompt: "prompt" },
                activeSessionId: null,
                permissions: alicePendingPerms,
                tokens: null,
                stats: {},
                lifecycle: "active",
                createdAt: 2,
                updatedAt: 2
            });
            await storage.agents.create({
                id: "gateway-bob-active",
                userId: "bob-sub-active",
                type: "subuser",
                descriptor: { type: "subuser", id: "bob-sub-active", name: "bob-helper", systemPrompt: "prompt" },
                activeSessionId: null,
                permissions: bobActivePerms,
                tokens: null,
                stats: {},
                lifecycle: "active",
                createdAt: 3,
                updatedAt: 3
            });

            const tool = topologyTool(
                { listTasks: async () => [] } as unknown as Crons,
                { listSubscriptions: async () => [] } as unknown as Signals,
                { listForUserIds: (_userIds: string[]) => [] } as never,
                { list: async () => [] } as never
            );

            const result = await tool.execute(
                {},
                contextBuild(config, {
                    callerAgentId: "alice-main",
                    callerUserId: "alice",
                    heartbeatTasks: []
                }),
                toolCall
            );

            expect(result.typedResult.friends).toHaveLength(1);
            expect(result.typedResult.friends[0]).toMatchObject({
                userId: "bob",
                nametag: "swift-fox-42"
            });
            expect(result.typedResult.friends[0]?.sharedOut).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        subuserId: "alice-sub-active",
                        subuserNametag: "cool-cat-11",
                        gatewayAgentId: "gateway-alice-active",
                        status: "active"
                    }),
                    expect.objectContaining({
                        subuserId: "alice-sub-pending",
                        subuserNametag: "lazy-dog-55",
                        gatewayAgentId: "gateway-alice-pending",
                        status: "pending"
                    })
                ])
            );
            expect(result.typedResult.friends[0]?.sharedIn).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        subuserId: "bob-sub-active",
                        subuserNametag: "smart-owl-22",
                        gatewayAgentId: "gateway-bob-active",
                        status: "active"
                    })
                ])
            );
            expect(result.typedResult.friendCount).toBe(1);
        } finally {
            storage.connection.close();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("marks caller-owned items with (You) and isYou=true", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-topology-tool-"));
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir, db: { autoMigrate: false } }
                },
                path.join(dir, "settings.json")
            );
            const storage = storageResolve(config);
            await databaseMigrate(storage.connection);

            const permissions = permissionBuildUser(new UserHome(config.usersDir, "user-1"));
            const callerCtx = contextForAgent({ userId: "user-1", agentId: "agent-caller" });
            await agentDescriptorWrite(
                storage,
                callerCtx,
                {
                    type: "user",
                    connector: "telegram",
                    userId: "u1",
                    channelId: "c1"
                },
                permissions
            );
            await agentStateWrite(config, callerCtx, stateBuild(permissions, 100));
            await topologyTaskCreate(storage, "user-1", "daily-report-task", "Daily Report");
            await topologyTaskCreate(storage, "user-1", "task-check-health", "Health Check");

            const tool = topologyTool(
                {
                    listTasks: async () => [
                        cronTaskBuild({
                            id: "daily-report",
                            name: "Daily Report",
                            schedule: "0 9 * * *",
                            enabled: true,
                            agentId: "agent-caller"
                        })
                    ]
                } as unknown as Crons,
                {
                    listSubscriptions: async () => [
                        signalSubscriptionBuild({
                            userId: "user-1",
                            agentId: "agent-caller",
                            pattern: "build:*",
                            silent: true
                        })
                    ]
                } as unknown as Signals,
                {
                    listForUserIds: (_userIds: string[]) => []
                } as never,
                { list: async () => [] } as never
            );

            const result = await tool.execute(
                {},
                contextBuild(config, {
                    callerAgentId: "agent-caller",
                    callerUserId: "user-1",
                    heartbeatTasks: [
                        {
                            id: "check-health",
                            taskId: "task-check-health",
                            userId: "user-1",
                            title: "Health Check",
                            lastRunAt: null,
                            createdAt: 1,
                            updatedAt: 1
                        }
                    ]
                }),
                toolCall
            );

            expect(result.typedResult.agents[0]?.isYou).toBe(true);
            const cronTrigger = result.typedResult.tasks
                .flatMap((task) => task.triggers.cron)
                .find((trigger) => trigger.id === "daily-report");
            expect(cronTrigger?.isYou).toBe(true);
            expect(result.typedResult.signalSubscriptions[0]?.isYou).toBe(true);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});

function contextBuild(
    config: ReturnType<typeof configResolve>,
    options: {
        callerAgentId: string;
        callerUserId: string;
        heartbeatTasks: HeartbeatDefinition[];
    }
): ToolExecutionContext {
    const storage = storageResolve(config);
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: { id: options.callerAgentId } as unknown as ToolExecutionContext["agent"],
        ctx: contextForAgent({ userId: options.callerUserId, agentId: options.callerAgentId }),
        source: "test",
        messageContext: {},
        agentSystem: {
            config: { current: config },
            storage
        } as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: {
            listTasks: async () => options.heartbeatTasks
        } as unknown as ToolExecutionContext["heartbeats"]
    };
}

function stateBuild(
    permissions: SessionPermissions,
    updatedAt: number,
    lifecycle: AgentState["state"] = "active"
): AgentState {
    return {
        context: { messages: [] },
        permissions,
        tokens: null,
        stats: {},
        createdAt: updatedAt,
        updatedAt,
        state: lifecycle
    };
}

function cronTaskBuild(input: {
    id: string;
    name: string;
    schedule: string;
    timezone?: string;
    enabled: boolean;
    agentId?: string;
}): CronTaskDbRecord {
    return {
        id: input.id,
        taskId: `${input.id}-task`,
        userId: "user-1",
        name: input.name,
        description: null,
        schedule: input.schedule,
        timezone: input.timezone ?? "UTC",
        enabled: input.enabled,
        deleteAfterRun: false,
        lastRunAt: null,
        agentId: input.agentId ?? null,
        createdAt: 1,
        updatedAt: 1
    };
}

async function topologyTaskCreate(
    storage: ReturnType<typeof storageResolve>,
    userId: string,
    taskId: string,
    title: string
): Promise<void> {
    await storage.tasks.create({
        id: taskId,
        userId,
        title,
        description: null,
        code: "print('ok')",
        createdAt: 1,
        updatedAt: 1
    });
}

function signalSubscriptionBuild(input: {
    userId: string;
    agentId: string;
    pattern: string;
    silent: boolean;
}): SignalSubscription {
    return {
        ctx: { userId: input.userId, agentId: input.agentId },
        pattern: input.pattern,
        silent: input.silent,
        createdAt: 1,
        updatedAt: 1
    };
}
