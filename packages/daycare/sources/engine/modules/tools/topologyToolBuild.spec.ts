import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { AgentState, ToolExecutionContext } from "@/types";
import { configResolve } from "../../../config/configResolve.js";
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
                    engine: { dataDir: dir }
                },
                path.join(dir, "settings.json")
            );

            const tool = topologyTool(
                { listTasks: async () => [] } as unknown as Crons,
                { listSubscriptions: async () => [] } as unknown as Signals,
                { list: () => [] } as never,
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
            const text = contentText(result.toolMessage.content);
            expect(text).toContain("## Agents (0)");
            expect(text).toContain("## Cron Tasks (0)");
            expect(text).toContain("## Heartbeat Tasks (0)");
            expect(text).toContain("## Signal Subscriptions (0)");
            expect(text).toContain("## Channels (0)");
            expect(text).toContain("## Expose Endpoints (0)");

            const details = result.toolMessage.details as
                | {
                      callerAgentId: string;
                      agents: unknown[];
                      crons: unknown[];
                      heartbeats: unknown[];
                      signalSubscriptions: unknown[];
                      channels: unknown[];
                      exposes: unknown[];
                  }
                | undefined;
            expect(details).toEqual({
                callerAgentId: "agent-caller",
                agents: [],
                crons: [],
                heartbeats: [],
                signalSubscriptions: [],
                channels: [],
                exposes: []
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
                    engine: { dataDir: dir }
                },
                path.join(dir, "settings.json")
            );

            const permissions = permissionBuildUser(new UserHome(config.usersDir, "user-1"));
            const callerCtx = contextForAgent({ userId: "user-1", agentId: "agent-caller" });
            await agentDescriptorWrite(
                storageResolve(config),
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
            await agentDescriptorWrite(
                storageResolve(config),
                otherCtx,
                {
                    type: "system",
                    tag: "cron"
                },
                permissions
            );
            await agentStateWrite(config, otherCtx, stateBuild(permissions, 10));

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
                    list: () => [
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
                    list: async () => [
                        {
                            id: "expose-1",
                            target: { type: "port", port: 8080 },
                            provider: "provider-a",
                            domain: "app.example.com",
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
                    callerAgentId: "agent-third",
                    callerUserId: "user-1",
                    heartbeatTasks: [
                        {
                            id: "check-health",
                            userId: "user-1",
                            title: "Health Check",
                            prompt: "Check status",
                            lastRunAt: Date.parse("2025-01-15T10:00:00Z"),
                            createdAt: 1,
                            updatedAt: 1
                        }
                    ]
                }),
                toolCall
            );

            const text = contentText(result.toolMessage.content);
            expect(text).toContain("## Agents (2)");
            expect(text).toContain('agent-caller type=subagent label="monitor" lifecycle=active');
            expect(text).toContain("## Cron Tasks (2)");
            expect(text).toContain('daily-report: Daily Report schedule="0 9 * * *" enabled=true');
            expect(text).toContain("## Heartbeat Tasks (1)");
            expect(text).toContain("check-health: Health Check lastRun=2025-01-15T10:00:00.000Z");
            expect(text).toContain("## Signal Subscriptions (2)");
            expect(text).toContain("user=user-1 agent=agent-other pattern=deploy:done silent=false");
            expect(text).not.toContain("user=user-2 agent=agent-secret pattern=secret:* silent=false");
            expect(text).toContain("## Channels (1)");
            expect(text).toContain("#dev leader=agent-other members=@monitor(agent-caller)");
            expect(text).toContain("## Expose Endpoints (1)");
            expect(text).toContain(
                "expose-1 domain=app.example.com target=port:8080 provider=provider-a mode=public authenticated=false"
            );

            const details = result.toolMessage.details as
                | {
                      agents: Array<{ id: string }>;
                      crons: Array<{ id: string }>;
                      heartbeats: Array<{ id: string }>;
                      signalSubscriptions: Array<{ agentId: string }>;
                      channels: Array<{ id: string }>;
                      exposes: Array<{ id: string }>;
                  }
                | undefined;
            expect(details?.agents).toHaveLength(2);
            expect(details?.crons).toHaveLength(2);
            expect(details?.heartbeats).toHaveLength(1);
            expect(details?.signalSubscriptions).toHaveLength(2);
            expect(details?.channels).toHaveLength(1);
            expect(details?.exposes).toHaveLength(1);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("subuser agent sees only their own agents and crons in topology", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-topology-subuser-"));
        const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
        const storage = storageResolve(config);
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
                { list: () => [] } as never,
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

            const text = contentText(result.toolMessage.content);
            // Subuser sees only their own agent
            expect(text).toContain("## Agents (1)");
            expect(text).toContain("subuser-gateway");
            expect(text).not.toContain("owner-agent");
            // Subuser sees only their own cron tasks
            expect(text).toContain("## Cron Tasks (1)");
            expect(text).toContain("subuser-cron");
            expect(text).not.toContain("owner-cron");
            // No subusers section for subuser agents
            expect(text).not.toContain("## Subusers");
        } finally {
            storage.close();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("owner user sees subusers section in topology", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-topology-owner-subusers-"));
        const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
        const storage = storageResolve(config);
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
                { list: () => [] } as never,
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

            const text = contentText(result.toolMessage.content);
            // Owner sees all agents (including subuser gateways)
            expect(text).toContain("## Agents (3)");
            // Owner sees subusers section
            expect(text).toContain("## Subusers (2)");
            expect(text).toContain('sub-a name="app-a" gatewayAgent=gateway-a');
            expect(text).toContain('sub-b name="app-b" gatewayAgent=gateway-b');
        } finally {
            storage.close();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("marks caller-owned items with (You) and isYou=true", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-topology-tool-"));
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir }
                },
                path.join(dir, "settings.json")
            );

            const permissions = permissionBuildUser(new UserHome(config.usersDir, "user-1"));
            const callerCtx = contextForAgent({ userId: "user-1", agentId: "agent-caller" });
            await agentDescriptorWrite(
                storageResolve(config),
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
                    list: () => []
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
                            userId: "user-1",
                            title: "Health Check",
                            prompt: "Check status",
                            lastRunAt: null,
                            createdAt: 1,
                            updatedAt: 1
                        }
                    ]
                }),
                toolCall
            );

            const text = contentText(result.toolMessage.content);
            expect(text).toContain("agent-caller (You) type=user");
            expect(text).toContain("enabled=true (You)");
            expect(text).toContain("silent=true (You)");
            expect(text).not.toContain("check-health: Health Check lastRun=never (You)");

            const details = result.toolMessage.details as
                | {
                      agents: Array<{ isYou: boolean }>;
                      crons: Array<{ isYou: boolean }>;
                      signalSubscriptions: Array<{ isYou: boolean }>;
                  }
                | undefined;
            expect(details?.agents[0]?.isYou).toBe(true);
            expect(details?.crons[0]?.isYou).toBe(true);
            expect(details?.signalSubscriptions[0]?.isYou).toBe(true);
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
        fileStore: null as unknown as ToolExecutionContext["fileStore"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        permissions: permissionBuildUser(new UserHome(config.usersDir, options.callerUserId)),
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

function stateBuild(permissions: ToolExecutionContext["permissions"], updatedAt: number): AgentState {
    return {
        context: { messages: [] },
        permissions,
        tokens: null,
        stats: {},
        createdAt: updatedAt,
        updatedAt,
        state: "active"
    };
}

function cronTaskBuild(input: {
    id: string;
    name: string;
    schedule: string;
    enabled: boolean;
    agentId?: string;
}): CronTaskDbRecord {
    return {
        id: input.id,
        taskUid: `${input.id}-uid`,
        userId: "user-1",
        name: input.name,
        description: null,
        schedule: input.schedule,
        prompt: "prompt",
        enabled: input.enabled,
        deleteAfterRun: false,
        lastRunAt: null,
        agentId: input.agentId ?? null,
        createdAt: 1,
        updatedAt: 1
    };
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

function contentText(content: unknown): string {
    if (!Array.isArray(content)) {
        return "";
    }
    return content
        .filter((item) => {
            if (typeof item !== "object" || item === null) {
                return false;
            }
            return (item as { type?: unknown }).type === "text";
        })
        .map((item) => (item as { text?: unknown }).text)
        .filter((value): value is string => typeof value === "string")
        .join("\n");
}
