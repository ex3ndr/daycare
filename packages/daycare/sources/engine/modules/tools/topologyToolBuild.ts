import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { contextForUser } from "../../agents/context.js";
import type { Channels } from "../../channels/channels.js";
import type { Crons } from "../../cron/crons.js";
import type { Exposes } from "../../expose/exposes.js";
import type { Secrets } from "../../secrets/secrets.js";
import type { Signals } from "../../signals/signals.js";

const schema = Type.Object({}, { additionalProperties: false });

const topologyAgentSchema = Type.Object(
    {
        id: Type.String(),
        type: Type.String(),
        label: Type.String(),
        lifecycle: Type.String(),
        isYou: Type.Boolean()
    },
    { additionalProperties: false }
);

const topologyCronTriggerSchema = Type.Object(
    {
        id: Type.String(),
        taskId: Type.String(),
        userId: Type.String(),
        schedule: Type.String(),
        timezone: Type.String(),
        enabled: Type.Boolean(),
        agentId: Type.Union([Type.String(), Type.Null()]),
        deleteAfterRun: Type.Boolean(),
        lastRunAt: Type.Union([Type.Number(), Type.Null()]),
        isYou: Type.Boolean()
    },
    { additionalProperties: false }
);

const topologyTaskSchema = Type.Object(
    {
        id: Type.String(),
        userId: Type.String(),
        title: Type.Union([Type.String(), Type.Null()]),
        description: Type.Union([Type.String(), Type.Null()]),
        updatedAt: Type.Union([Type.Number(), Type.Null()]),
        triggers: Type.Object(
            {
                cron: Type.Array(topologyCronTriggerSchema)
            },
            { additionalProperties: false }
        )
    },
    { additionalProperties: false }
);

const topologySignalSubscriptionSchema = Type.Object(
    {
        userId: Type.String(),
        agentId: Type.String(),
        pattern: Type.String(),
        silent: Type.Boolean(),
        isYou: Type.Boolean()
    },
    { additionalProperties: false }
);

const topologyChannelSchema = Type.Object(
    {
        id: Type.String(),
        name: Type.String(),
        leader: Type.String(),
        members: Type.Array(
            Type.Object(
                {
                    agentId: Type.String(),
                    username: Type.String()
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
);

const topologyExposeSchema = Type.Object(
    {
        id: Type.String(),
        domain: Type.String(),
        target: Type.String(),
        provider: Type.String(),
        mode: Type.String(),
        authenticated: Type.Boolean()
    },
    { additionalProperties: false }
);

const topologySecretSchema = Type.Object(
    {
        name: Type.String(),
        displayName: Type.String(),
        description: Type.String(),
        variableNames: Type.Array(Type.String())
    },
    { additionalProperties: false }
);

const topologySubuserSchema = Type.Object(
    {
        id: Type.String(),
        name: Type.Union([Type.String(), Type.Null()]),
        nametag: Type.Union([Type.String(), Type.Null()]),
        gatewayAgentId: Type.Union([Type.String(), Type.Null()]),
        gatewayLifecycle: Type.Union([Type.String(), Type.Null()])
    },
    { additionalProperties: false }
);

const topologyFriendShareSchema = Type.Object(
    {
        subuserId: Type.String(),
        subuserName: Type.String(),
        subuserNametag: Type.Union([Type.String(), Type.Null()]),
        gatewayAgentId: Type.Union([Type.String(), Type.Null()]),
        status: Type.Union([Type.Literal("active"), Type.Literal("pending")])
    },
    { additionalProperties: false }
);

const topologyFriendSchema = Type.Object(
    {
        userId: Type.String(),
        nametag: Type.Union([Type.String(), Type.Null()]),
        name: Type.Union([Type.String(), Type.Null()]),
        sharedOut: Type.Array(topologyFriendShareSchema),
        sharedIn: Type.Array(topologyFriendShareSchema)
    },
    { additionalProperties: false }
);

const topologyResultSchema = Type.Object(
    {
        agents: Type.Array(topologyAgentSchema),
        tasks: Type.Array(topologyTaskSchema),
        signalSubscriptions: Type.Array(topologySignalSubscriptionSchema),
        channels: Type.Array(topologyChannelSchema),
        exposes: Type.Array(topologyExposeSchema),
        secrets: Type.Array(topologySecretSchema),
        subusers: Type.Array(topologySubuserSchema),
        friends: Type.Array(topologyFriendSchema),
        agentCount: Type.Number(),
        taskCount: Type.Number(),
        cronCount: Type.Number(),
        signalSubscriptionCount: Type.Number(),
        channelCount: Type.Number(),
        exposeCount: Type.Number(),
        secretCount: Type.Number(),
        friendCount: Type.Number()
    },
    { additionalProperties: false }
);

type TopologyAgent = {
    id: string;
    type: string;
    label: string;
    lifecycle: string;
    isYou: boolean;
};

type TopologyCronTrigger = {
    id: string;
    taskId: string;
    userId: string;
    schedule: string;
    timezone: string;
    enabled: boolean;
    agentId: string | null;
    deleteAfterRun: boolean;
    lastRunAt: number | null;
    isYou: boolean;
};

type TopologyTask = {
    id: string;
    userId: string;
    title: string | null;
    description: string | null;
    updatedAt: number | null;
    triggers: {
        cron: TopologyCronTrigger[];
    };
};

type TopologySignalSubscription = {
    userId: string;
    agentId: string;
    pattern: string;
    silent: boolean;
    isYou: boolean;
};

type TopologyChannel = {
    id: string;
    name: string;
    leader: string;
    members: Array<{ agentId: string; username: string }>;
};

type TopologyExpose = {
    id: string;
    domain: string;
    target: string;
    provider: string;
    mode: string;
    authenticated: boolean;
};

type TopologySecret = {
    name: string;
    displayName: string;
    description: string;
    variableNames: string[];
};

type TopologySubuser = {
    id: string;
    name: string | null;
    nametag: string | null;
    gatewayAgentId: string | null;
    gatewayLifecycle: string | null;
};

type TopologyFriendShare = {
    subuserId: string;
    subuserName: string;
    subuserNametag: string | null;
    gatewayAgentId: string | null;
    status: "active" | "pending";
};

type TopologyFriend = {
    userId: string;
    nametag: string | null;
    name: string | null;
    sharedOut: TopologyFriendShare[];
    sharedIn: TopologyFriendShare[];
};

type TopologyResult = {
    agents: TopologyAgent[];
    tasks: TopologyTask[];
    signalSubscriptions: TopologySignalSubscription[];
    channels: TopologyChannel[];
    exposes: TopologyExpose[];
    secrets: TopologySecret[];
    subusers: TopologySubuser[];
    friends: TopologyFriend[];
    agentCount: number;
    taskCount: number;
    cronCount: number;
    signalSubscriptionCount: number;
    channelCount: number;
    exposeCount: number;
    secretCount: number;
    friendCount: number;
};

const topologyReturns: ToolResultContract<TopologyResult> = {
    schema: topologyResultSchema,
    toLLMText: (result) => JSON.stringify(result)
};

/**
 * Builds the topology tool that returns structured topology data for the caller scope.
 * Expects: tasks include nested cron triggers keyed by taskId.
 */
export function topologyTool(
    crons: Crons,
    signals: Signals,
    channels: Pick<Channels, "listForUserIds">,
    _exposes: Pick<Exposes, "list">,
    secrets: Pick<Secrets, "list"> = { list: async () => [] }
): ToolDefinition<typeof schema, TopologyResult> {
    return {
        tool: {
            name: "topology",
            description:
                "Return structured topology for your visible user scope. Agents exclude memory and dead entries by default. Tasks include nested cron triggers. Secrets include metadata only (no values).",
            parameters: schema
        },
        returns: topologyReturns,
        execute: async (_args, toolContext, toolCall) => {
            const callerAgentId = toolContext.agent.id;
            const callerUserId = toolContext.ctx.userId;
            const storage = toolContext.agentSystem.storage;

            // Determine if caller is a subuser (has parent)
            const callerUser = await storage.users.findById(callerUserId);
            const isSubuser = callerUser?.parentUserId != null;
            const ownerSubusers = isSubuser ? [] : await storage.users.findByParentUserId(callerUserId);

            // Owners can see their own user scope plus owned subusers. Subusers only see their own scope.
            const visibleUserIds = isSubuser
                ? [callerUserId]
                : [callerUserId, ...ownerSubusers.map((subuser) => subuser.id)];
            const visibleUserIdSet = new Set(visibleUserIds);

            const [allAgentRecords, cronTasks, signalSubscriptions] = await Promise.all([
                storage.agents.findMany(),
                crons.listTasks(),
                signals.listSubscriptions()
            ]);
            const channelEntries = channels.listForUserIds(visibleUserIds);

            const visibleAgentRecords = allAgentRecords.filter(
                (record) => visibleUserIdSet.has(record.userId) && topologyAgentVisibleByDefault(record)
            );

            const agents: TopologyAgent[] = visibleAgentRecords
                .slice()
                .sort((left, right) => right.updatedAt - left.updatedAt)
                .map((record) => {
                    const kind = topologyAgentKindResolve(record);
                    return {
                        id: record.id,
                        type: kind,
                        label: topologyAgentLabelResolve(kind, record.name),
                        lifecycle: record.lifecycle,
                        isYou: record.id === callerAgentId
                    };
                });

            const cronTriggers: TopologyCronTrigger[] = cronTasks
                .filter((task) => visibleUserIdSet.has(task.userId))
                .slice()
                .sort((left, right) => left.id.localeCompare(right.id))
                .map((task) => ({
                    id: task.id,
                    taskId: task.taskId,
                    userId: task.userId,
                    schedule: task.schedule,
                    timezone: task.timezone,
                    enabled: task.enabled !== false,
                    agentId: task.agentId ?? null,
                    deleteAfterRun: task.deleteAfterRun,
                    lastRunAt: task.lastRunAt,
                    isYou: task.agentId === callerAgentId
                }));

            const visibleTaskChunks = await Promise.all(
                visibleUserIds.map((userId) => storage.tasks.findMany(contextForUser({ userId })))
            );
            const visibleTasks = visibleTaskChunks.flat();

            const taskByKey = new Map<string, TopologyTask>();
            for (const task of visibleTasks) {
                taskByKey.set(topologyTaskKeyBuild(task.userId, task.id), {
                    id: task.id,
                    userId: task.userId,
                    title: task.title,
                    description: task.description,
                    updatedAt: task.updatedAt,
                    triggers: {
                        cron: []
                    }
                });
            }

            for (const trigger of cronTriggers) {
                const task = topologyTaskRequire(
                    taskByKey,
                    trigger.userId,
                    trigger.taskId,
                    `cron trigger ${trigger.id}`
                );
                task.triggers.cron.push(trigger);
            }
            const tasks = Array.from(taskByKey.values())
                .sort((left, right) => {
                    const leftAt = left.updatedAt ?? -1;
                    const rightAt = right.updatedAt ?? -1;
                    if (leftAt !== rightAt) {
                        return rightAt - leftAt;
                    }
                    if (left.userId !== right.userId) {
                        return left.userId.localeCompare(right.userId);
                    }
                    return left.id.localeCompare(right.id);
                })
                .map((task) => ({
                    ...task,
                    triggers: {
                        cron: task.triggers.cron.slice().sort((left, right) => left.id.localeCompare(right.id))
                    }
                }));

            const signalSubscriptionsSummary: TopologySignalSubscription[] = signalSubscriptions
                .filter((subscription) => visibleUserIdSet.has(subscription.ctx.userId))
                .slice()
                .sort((left, right) => {
                    const byUser = left.ctx.userId.localeCompare(right.ctx.userId);
                    if (byUser !== 0) {
                        return byUser;
                    }
                    const byAgent = left.ctx.agentId.localeCompare(right.ctx.agentId);
                    if (byAgent !== 0) {
                        return byAgent;
                    }
                    return left.pattern.localeCompare(right.pattern);
                })
                .map((subscription) => ({
                    userId: subscription.ctx.userId,
                    agentId: subscription.ctx.agentId,
                    pattern: subscription.pattern,
                    silent: subscription.silent,
                    isYou: subscription.ctx.agentId === callerAgentId
                }));

            const channelsSummary: TopologyChannel[] = channelEntries
                .slice()
                .sort((left, right) => left.name.localeCompare(right.name))
                .map((channel) => ({
                    id: channel.id,
                    name: channel.name,
                    leader: channel.leader,
                    members: channel.members
                        .slice()
                        .sort((left, right) => left.username.localeCompare(right.username))
                        .map((member) => ({
                            agentId: member.agentId,
                            username: member.username
                        }))
                }));

            const visibleExposeEndpointChunks = await Promise.all(
                visibleUserIds.map((userId) => storage.exposeEndpoints.findMany(contextForUser({ userId })))
            );
            const visibleExposeEndpoints = visibleExposeEndpointChunks.flat();

            const exposeSummary: TopologyExpose[] = visibleExposeEndpoints
                .slice()
                .sort((left, right) => left.createdAt - right.createdAt)
                .map((endpoint) => ({
                    id: endpoint.id,
                    domain: endpoint.domain,
                    target:
                        endpoint.target.type === "port"
                            ? `port:${endpoint.target.port}`
                            : `unix:${endpoint.target.path}`,
                    provider: endpoint.provider,
                    mode: endpoint.mode,
                    authenticated: Boolean(endpoint.auth)
                }));

            // Keep secrets scoped to caller ctx so topology and exec use the same visibility model.
            const secretEntries = await secrets.list(toolContext.ctx);
            const secretByName = new Map<string, TopologySecret>();
            for (const entry of secretEntries) {
                if (secretByName.has(entry.name)) {
                    continue;
                }
                secretByName.set(entry.name, {
                    name: entry.name,
                    displayName: entry.displayName,
                    description: entry.description,
                    variableNames: Object.keys(entry.variables).sort((left, right) => left.localeCompare(right))
                });
            }
            const secretSummary = [...secretByName.values()].sort((left, right) => left.name.localeCompare(right.name));

            const subusers: TopologySubuser[] = isSubuser
                ? []
                : ownerSubusers.map((subuser) => {
                      const gateway = allAgentRecords.find(
                          (agent) => topologyAgentKindResolve(agent) === "swarm" && agent.userId === subuser.id
                      );
                      return {
                          id: subuser.id,
                          name: userDisplayName(subuser),
                          nametag: subuser.nametag ?? null,
                          gatewayAgentId: gateway?.id ?? null,
                          gatewayLifecycle: gateway?.lifecycle ?? null
                      };
                  });

            const friends = isSubuser ? [] : await friendsListBuild(callerUserId, storage, allAgentRecords);

            const typedResult: TopologyResult = {
                agents,
                tasks,
                signalSubscriptions: signalSubscriptionsSummary,
                channels: channelsSummary,
                exposes: exposeSummary,
                secrets: secretSummary,
                subusers,
                friends,
                agentCount: agents.length,
                taskCount: tasks.length,
                cronCount: cronTriggers.length,
                signalSubscriptionCount: signalSubscriptionsSummary.length,
                channelCount: channelsSummary.length,
                exposeCount: exposeSummary.length,
                secretCount: secretSummary.length,
                friendCount: friends.length
            };

            const text = JSON.stringify(typedResult);
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text }],
                details: {
                    callerAgentId,
                    ...typedResult
                },
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult
            };
        }
    };
}

function topologyTaskRequire(
    tasksByKey: Map<string, TopologyTask>,
    userId: string,
    taskId: string,
    source: string
): TopologyTask {
    const key = topologyTaskKeyBuild(userId, taskId);
    const existing = tasksByKey.get(key);
    if (existing) {
        return existing;
    }
    throw new Error(`${source} references missing task ${taskId} for user ${userId}.`);
}

function topologyTaskKeyBuild(userId: string, taskId: string): string {
    return `${userId}:${taskId}`;
}

async function friendsListBuild(
    callerUserId: string,
    storage: {
        connections: {
            findFriends: (userId: string) => Promise<Array<{ userAId: string; userBId: string }>>;
            findConnectionsWithSubusersOf: (
                friendUserId: string,
                ownerUserId: string
            ) => Promise<Array<{ userAId: string; userBId: string; requestedA: boolean; requestedB: boolean }>>;
        };
        users: {
            findById: (id: string) => Promise<{
                id: string;
                parentUserId: string | null;
                nametag: string | null;
                firstName: string | null;
                lastName: string | null;
            } | null>;
        };
    },
    agents: Array<{ id: string; kind?: string | null; userId: string; path: string }>
): Promise<TopologyFriend[]> {
    const friendConnections = await storage.connections.findFriends(callerUserId);
    const userCache = new Map<
        string,
        {
            id: string;
            parentUserId: string | null;
            nametag: string | null;
            firstName: string | null;
            lastName: string | null;
        }
    >();

    const friendUsers = (
        await Promise.all(
            friendConnections.map(async (connection) => {
                const friendId = connection.userAId === callerUserId ? connection.userBId : connection.userAId;
                if (friendId === callerUserId) {
                    return null;
                }

                const cached = userCache.get(friendId);
                if (cached) {
                    return cached.parentUserId ? null : cached;
                }

                const user = await storage.users.findById(friendId);
                if (!user) {
                    return null;
                }
                userCache.set(friendId, user);
                if (user.parentUserId) {
                    return null;
                }
                return user;
            })
        )
    )
        .filter(
            (
                entry
            ): entry is {
                id: string;
                parentUserId: string | null;
                nametag: string | null;
                firstName: string | null;
                lastName: string | null;
            } => !!entry
        )
        .sort((left, right) => {
            const leftTag = left.nametag ?? left.id;
            const rightTag = right.nametag ?? right.id;
            return leftTag.localeCompare(rightTag);
        });

    const gatewayEntries: Array<[string, string]> = agents
        .filter((agent) => topologyAgentKindResolve(agent) === "swarm")
        .map((agent) => [agent.userId, agent.id] as [string, string]);
    const gatewayBySubuserId = new Map<string, string>(gatewayEntries);

    const friends: TopologyFriend[] = [];
    for (const friend of friendUsers) {
        const [outgoing, incoming] = await Promise.all([
            storage.connections.findConnectionsWithSubusersOf(friend.id, callerUserId),
            storage.connections.findConnectionsWithSubusersOf(callerUserId, friend.id)
        ]);

        friends.push({
            userId: friend.id,
            nametag: friend.nametag,
            name: userDisplayName(friend),
            sharedOut: await sharedSubusersBuild({
                connections: outgoing,
                knownUserId: friend.id,
                users: storage.users,
                userCache,
                gatewayBySubuserId
            }),
            sharedIn: await sharedSubusersBuild({
                connections: incoming,
                knownUserId: callerUserId,
                users: storage.users,
                userCache,
                gatewayBySubuserId
            })
        });
    }

    return friends;
}

async function sharedSubusersBuild(options: {
    connections: Array<{ userAId: string; userBId: string; requestedA: boolean; requestedB: boolean }>;
    knownUserId: string;
    users: {
        findById: (id: string) => Promise<{
            id: string;
            parentUserId: string | null;
            nametag: string | null;
            firstName: string | null;
            lastName: string | null;
        } | null>;
    };
    userCache: Map<
        string,
        {
            id: string;
            parentUserId: string | null;
            nametag: string | null;
            firstName: string | null;
            lastName: string | null;
        }
    >;
    gatewayBySubuserId: Map<string, string>;
}): Promise<TopologyFriendShare[]> {
    const sorted = options.connections
        .slice()
        .sort((left, right) =>
            connectionOtherUserId(left, options.knownUserId).localeCompare(
                connectionOtherUserId(right, options.knownUserId)
            )
        );

    const entries: TopologyFriendShare[] = [];
    for (const connection of sorted) {
        const subuserId = connectionOtherUserId(connection, options.knownUserId);
        const cached = options.userCache.get(subuserId);
        const subuser = cached ?? (await options.users.findById(subuserId));
        if (!subuser) {
            continue;
        }
        options.userCache.set(subuserId, subuser);

        entries.push({
            subuserId,
            subuserName: userDisplayName(subuser) ?? subuser.id,
            subuserNametag: subuser.nametag,
            gatewayAgentId: options.gatewayBySubuserId.get(subuserId) ?? null,
            status: connection.requestedA && connection.requestedB ? "active" : "pending"
        });
    }

    return entries;
}

function connectionOtherUserId(connection: { userAId: string; userBId: string }, knownUserId: string): string {
    return connection.userAId === knownUserId ? connection.userBId : connection.userAId;
}

function userDisplayName(user: {
    firstName: string | null;
    lastName: string | null;
    nametag: string | null;
}): string | null {
    const firstName = user.firstName?.trim() ?? "";
    const lastName = user.lastName?.trim() ?? "";
    const name = [firstName, lastName].filter((value) => value.length > 0).join(" ");
    if (name.length > 0) {
        return name;
    }
    return user.nametag ?? null;
}

function topologyAgentVisibleByDefault(record: { kind?: string | null; path: string; lifecycle: string }): boolean {
    if (record.lifecycle === "dead") {
        return false;
    }
    const kind = topologyAgentKindResolve(record);
    return kind !== "memory" && kind !== "search";
}

function topologyAgentLabelResolve(kind: string, name: string | null): string {
    const normalizedName = name?.trim();
    if (kind === "connector") {
        return "user";
    }
    if (kind === "task") {
        return `task ${normalizedName || "task"}`;
    }
    if (kind === "memory") {
        return "memory-agent";
    }
    if (kind === "search") {
        return normalizedName || "memory-search";
    }
    if (kind === "sub") {
        return normalizedName || "subagent";
    }
    if (kind === "cron") {
        return normalizedName || "cron";
    }
    return normalizedName || kind || "agent";
}

function topologyAgentKindResolve(record: { kind?: string | null; path: string }): string {
    const explicitKind = record.kind?.trim();
    if (explicitKind) {
        return explicitKind;
    }
    return "agent";
}
