import { describe, expect, it } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { contextForAgent } from "../../agents/context.js";
import { topologyTool } from "./topologyToolBuild.js";

type TopologyStorageMock = {
    users: {
        findById: (id: string) => Promise<{
            id: string;
            parentUserId: string | null;
            nametag: string | null;
            firstName: string | null;
            lastName: string | null;
        } | null>;
        findByParentUserId: (parentUserId: string) => Promise<Array<{ id: string }>>;
    };
    agents: {
        findMany: () => Promise<
            Array<{
                id: string;
                userId: string;
                path: string;
                kind?: string | null;
                name?: string | null;
                foreground?: boolean;
                lifecycle: string;
                updatedAt: number;
            }>
        >;
    };
    tasks: {
        findMany: (ctx: { userId: string }) => Promise<
            Array<{
                id: string;
                userId: string;
                title: string | null;
                description: string | null;
                updatedAt: number | null;
            }>
        >;
    };
    connections: {
        findFriends: (userId: string) => Promise<Array<{ userAId: string; userBId: string }>>;
        findConnectionsWithSubusersOf: (
            friendUserId: string,
            ownerUserId: string
        ) => Promise<Array<{ userAId: string; userBId: string; requestedA: boolean; requestedB: boolean }>>;
    };
    exposeEndpoints: {
        findMany: (ctx: { userId: string }) => Promise<
            Array<{
                id: string;
                domain: string;
                target: { type: "port"; port: number } | { type: "unix"; path: string };
                provider: string;
                mode: string;
                auth: unknown;
                createdAt: number;
            }>
        >;
    };
};

function createToolContext(options: {
    caller: { userId: string; agentId: string };
    users: Array<{
        id: string;
        parentUserId: string | null;
        nametag?: string | null;
        firstName?: string | null;
        lastName?: string | null;
    }>;
    agents: Array<{
        id: string;
        userId: string;
        path: string;
        kind?: string | null;
        name?: string | null;
        foreground?: boolean;
        lifecycle?: string;
        updatedAt?: number;
    }>;
    tasksByUser: Record<string, Array<{ id: string; title: string; description: string | null; updatedAt: number }>>;
    cronTasks?: Array<{
        id: string;
        taskId: string;
        userId: string;
        schedule: string;
        timezone: string;
        enabled: boolean;
        agentId: string | null;
        deleteAfterRun: boolean;
        lastRunAt: number | null;
    }>;
}): {
    tool: ReturnType<typeof topologyTool>;
    context: ToolExecutionContext;
} {
    const usersById = new Map(options.users.map((user) => [user.id, user] as const));

    const storage: TopologyStorageMock = {
        users: {
            findById: async (id) => {
                const user = usersById.get(id);
                if (!user) {
                    return null;
                }
                return {
                    id: user.id,
                    parentUserId: user.parentUserId,
                    nametag: user.nametag ?? null,
                    firstName: user.firstName ?? null,
                    lastName: user.lastName ?? null
                };
            },
            findByParentUserId: async (parentUserId) =>
                options.users
                    .filter((user) => user.parentUserId === parentUserId)
                    .map((user) => ({
                        id: user.id
                    }))
        },
        agents: {
            findMany: async () =>
                options.agents.map((agent) => ({
                    id: agent.id,
                    userId: agent.userId,
                    path: agent.path,
                    kind: agent.kind ?? null,
                    name: agent.name ?? null,
                    foreground: agent.foreground ?? false,
                    lifecycle: agent.lifecycle ?? "active",
                    updatedAt: agent.updatedAt ?? 1
                }))
        },
        tasks: {
            findMany: async (ctx) =>
                (options.tasksByUser[ctx.userId] ?? []).map((task) => ({
                    id: task.id,
                    userId: ctx.userId,
                    title: task.title,
                    description: task.description,
                    updatedAt: task.updatedAt
                }))
        },
        connections: {
            findFriends: async () => [],
            findConnectionsWithSubusersOf: async () => []
        },
        exposeEndpoints: {
            findMany: async () => []
        }
    };

    const crons = {
        listTasks: async () => options.cronTasks ?? []
    };
    const signals = {
        listSubscriptions: async () => []
    };
    const channels = {
        listForUserIds: () => []
    };
    const exposes = {
        list: async () => []
    };
    const secrets = {
        list: async () => []
    };

    const tool = topologyTool(crons as never, signals as never, channels as never, exposes as never, secrets as never);
    const context: ToolExecutionContext = {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: {
            id: options.caller.agentId,
            path: `/${options.caller.userId}/telegram`,
            config: {
                kind: "connector",
                modelRole: "user",
                connectorName: "telegram",
                parentAgentId: null,
                foreground: true,
                name: null,
                description: null,
                systemPrompt: null,
                workspaceDir: null
            }
        } as unknown as ToolExecutionContext["agent"],
        ctx: contextForAgent(options.caller),
        source: "test",
        messageContext: {},
        agentSystem: { storage } as unknown as ToolExecutionContext["agentSystem"]
    };

    return { tool, context };
}

describe("topologyTool", () => {
    it("returns cron triggers nested under tasks and reports counts", async () => {
        const built = createToolContext({
            caller: { userId: "owner", agentId: "agent-owner" },
            users: [{ id: "owner", parentUserId: null }],
            agents: [
                {
                    id: "agent-owner",
                    userId: "owner",
                    path: "/owner/telegram",
                    kind: "connector",
                    foreground: true,
                    updatedAt: 5
                },
                {
                    id: "agent-memory",
                    userId: "owner",
                    path: "/owner/memory/agent-memory",
                    kind: "memory",
                    updatedAt: 6
                }
            ],
            tasksByUser: {
                owner: [{ id: "task-report", title: "Daily report", description: null, updatedAt: 20 }]
            },
            cronTasks: [
                {
                    id: "cron-report",
                    taskId: "task-report",
                    userId: "owner",
                    schedule: "0 * * * *",
                    timezone: "UTC",
                    enabled: true,
                    agentId: null,
                    deleteAfterRun: false,
                    lastRunAt: 100
                }
            ]
        });

        const result = await built.tool.execute({}, built.context, { id: "call-1", name: "topology" });

        expect(result.typedResult.agentCount).toBe(1);
        expect(result.typedResult.taskCount).toBe(1);
        expect(result.typedResult.cronCount).toBe(1);
        expect(result.typedResult.tasks[0]?.triggers.cron[0]).toMatchObject({
            id: "cron-report",
            taskId: "task-report",
            userId: "owner"
        });
    });

    it("limits topology scope to the subuser when caller is a subuser", async () => {
        const built = createToolContext({
            caller: { userId: "sub-1", agentId: "agent-sub-1" },
            users: [
                { id: "owner", parentUserId: null },
                { id: "sub-1", parentUserId: "owner" },
                { id: "sub-2", parentUserId: "owner" }
            ],
            agents: [
                { id: "agent-sub-1", userId: "sub-1", path: "/sub-1/subuser/main", kind: "subuser", updatedAt: 10 },
                { id: "agent-sub-2", userId: "sub-2", path: "/sub-2/subuser/main", kind: "subuser", updatedAt: 9 }
            ],
            tasksByUser: {
                owner: [{ id: "owner-task", title: "Owner task", description: null, updatedAt: 20 }],
                "sub-1": [{ id: "sub-task", title: "Sub task", description: null, updatedAt: 21 }],
                "sub-2": [{ id: "other-sub-task", title: "Other sub task", description: null, updatedAt: 22 }]
            },
            cronTasks: [
                {
                    id: "sub-cron",
                    taskId: "sub-task",
                    userId: "sub-1",
                    schedule: "*/30 * * * *",
                    timezone: "UTC",
                    enabled: true,
                    agentId: "agent-sub-1",
                    deleteAfterRun: false,
                    lastRunAt: null
                },
                {
                    id: "owner-cron",
                    taskId: "owner-task",
                    userId: "owner",
                    schedule: "0 * * * *",
                    timezone: "UTC",
                    enabled: true,
                    agentId: null,
                    deleteAfterRun: false,
                    lastRunAt: null
                }
            ]
        });

        const result = await built.tool.execute({}, built.context, { id: "call-2", name: "topology" });
        const taskIds = result.typedResult.tasks.map((task) => task.id);

        expect(taskIds).toEqual(["sub-task"]);
        expect(result.typedResult.cronCount).toBe(1);
        expect(result.typedResult.agents.map((agent) => agent.id)).toEqual(["agent-sub-1"]);
    });
});
