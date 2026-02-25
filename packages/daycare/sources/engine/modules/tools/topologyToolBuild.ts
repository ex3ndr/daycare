import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { contextForUser } from "../../agents/context.js";
import { agentDescriptorLabel } from "../../agents/ops/agentDescriptorLabel.js";
import type { Channels } from "../../channels/channels.js";
import type { Crons } from "../../cron/crons.js";
import type { Exposes } from "../../expose/exposes.js";
import type { Signals } from "../../signals/signals.js";

const schema = Type.Object({}, { additionalProperties: false });

const topologyResultSchema = Type.Object(
    {
        summary: Type.String(),
        agentCount: Type.Number(),
        cronCount: Type.Number(),
        heartbeatCount: Type.Number(),
        signalSubscriptionCount: Type.Number(),
        channelCount: Type.Number(),
        exposeCount: Type.Number(),
        friendCount: Type.Number()
    },
    { additionalProperties: false }
);

type TopologyResult = {
    summary: string;
    agentCount: number;
    cronCount: number;
    heartbeatCount: number;
    signalSubscriptionCount: number;
    channelCount: number;
    exposeCount: number;
    friendCount: number;
};

const topologyReturns: ToolResultContract<TopologyResult> = {
    schema: topologyResultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the topology tool that snapshots agents, cron tasks, heartbeat tasks,
 * and signal subscriptions in one response.
 */
export function topologyTool(
    crons: Crons,
    signals: Signals,
    channels: Pick<Channels, "listForUserIds">,
    _exposes: Pick<Exposes, "list">
): ToolDefinition {
    return {
        tool: {
            name: "topology",
            description:
                "Return a full system topology snapshot (agents, cron tasks, heartbeat tasks, and signal subscriptions).",
            parameters: schema
        },
        returns: topologyReturns,
        execute: async (_args, toolContext, toolCall) => {
            const callerAgentId = toolContext.agent.id;
            const callerUserId = toolContext.ctx.userId;
            const storage = toolContext.agentSystem.storage;
            let friendCount = 0;

            // Determine if caller is a subuser (has parent)
            const callerUser = await storage.users.findById(callerUserId);
            const isSubuser = callerUser?.parentUserId != null;
            const ownerSubusers = isSubuser ? [] : await storage.users.findByParentUserId(callerUserId);

            // Owners can see their own user scope plus owned subusers. Subusers only see their own scope.
            const visibleUserIds = isSubuser ? [callerUserId] : [callerUserId, ...ownerSubusers.map((subuser) => subuser.id)];
            const visibleUserIdSet = new Set(visibleUserIds);

            const [allAgentRecords, cronTasks, heartbeatTasks, signalSubscriptions] = await Promise.all([
                storage.agents.findMany(),
                crons.listTasks(),
                toolContext.heartbeats.listTasks(),
                signals.listSubscriptions()
            ]);
            const channelEntries = channels.listForUserIds(visibleUserIds);

            const visibleAgentRecords = allAgentRecords.filter((record) => visibleUserIdSet.has(record.userId));

            const agents = visibleAgentRecords
                .slice()
                .sort((left, right) => right.updatedAt - left.updatedAt)
                .map((record) => ({
                    id: record.id,
                    type: record.descriptor.type,
                    label: agentDescriptorLabel(record.descriptor),
                    lifecycle: record.lifecycle,
                    isYou: record.id === callerAgentId
                }));

            const cronsSummary = cronTasks
                .filter((task) => visibleUserIdSet.has(task.userId))
                .slice()
                .sort((left, right) => left.id.localeCompare(right.id))
                .map((task) => ({
                    id: task.id,
                    name: task.name,
                    schedule: task.schedule,
                    enabled: task.enabled !== false,
                    agentId: task.agentId ?? null,
                    isYou: task.agentId === callerAgentId
                }));

            const heartbeats = heartbeatTasks
                .filter((task) => visibleUserIdSet.has(task.userId))
                .slice()
                .sort((left, right) => left.id.localeCompare(right.id))
                .map((task) => ({
                    id: task.id,
                    title: task.title,
                    lastRunAt: typeof task.lastRunAt === "number" ? new Date(task.lastRunAt).toISOString() : null
                }));

            const signalSubscriptionsSummary = signalSubscriptions
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

            const channelsSummary = channelEntries
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

            const exposeSummary = visibleExposeEndpoints
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

            const sections = [
                `## Agents (${agents.length})`,
                ...listAgentsLinesBuild(agents),
                "",
                `## Cron Tasks (${cronsSummary.length})`,
                ...listCronLinesBuild(cronsSummary),
                "",
                `## Heartbeat Tasks (${heartbeats.length})`,
                ...listHeartbeatLinesBuild(heartbeats),
                "",
                `## Signal Subscriptions (${signalSubscriptionsSummary.length})`,
                ...listSignalSubscriptionLines(signalSubscriptionsSummary),
                "",
                `## Channels (${channelsSummary.length})`,
                ...listChannelLinesBuild(channelsSummary),
                "",
                `## Expose Endpoints (${exposeSummary.length})`,
                ...listExposeLinesBuild(exposeSummary)
            ];

            // Add subusers section for owner users
            if (!isSubuser) {
                if (ownerSubusers.length > 0) {
                    const subuserLines = ownerSubusers.map((subuser) => {
                        const gateway = allAgentRecords.find(
                            (a) => a.descriptor.type === "subuser" && a.descriptor.id === subuser.id
                        );
                        return (
                            `${subuser.id} name="${subuser.name ?? "unnamed"}" ` +
                            `gatewayAgent=${gateway?.id ?? "none"} ` +
                            `lifecycle=${gateway?.lifecycle ?? "unknown"}`
                        );
                    });
                    sections.push("", `## Subusers (${ownerSubusers.length})`, ...subuserLines);
                }

                const friendsSection = await listFriendLinesBuild(callerUserId, storage, allAgentRecords);
                friendCount = friendsSection.count;
                sections.push("", `## Friends (${friendCount})`, ...friendsSection.lines);
            }

            const summary = sections.join("\n");

            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                details: {
                    callerAgentId,
                    agents,
                    crons: cronsSummary,
                    heartbeats,
                    signalSubscriptions: signalSubscriptionsSummary,
                    channels: channelsSummary,
                    exposes: exposeSummary
                },
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    agentCount: agents.length,
                    cronCount: cronsSummary.length,
                    heartbeatCount: heartbeats.length,
                    signalSubscriptionCount: signalSubscriptionsSummary.length,
                    channelCount: channelsSummary.length,
                    exposeCount: exposeSummary.length,
                    friendCount
                }
            };
        }
    };
}

function listAgentsLinesBuild(
    agents: Array<{ id: string; type: string; label: string; lifecycle: string; isYou: boolean }>
): string[] {
    if (agents.length === 0) {
        return ["None"];
    }

    return agents.map(
        (agent) =>
            `${agent.id}${agent.isYou ? " (You)" : ""} type=${agent.type} label="${agent.label}" lifecycle=${agent.lifecycle}`
    );
}

function listCronLinesBuild(
    cronsSummary: Array<{
        id: string;
        name: string;
        schedule: string;
        enabled: boolean;
        isYou: boolean;
    }>
): string[] {
    if (cronsSummary.length === 0) {
        return ["None"];
    }

    return cronsSummary.map(
        (task) =>
            `${task.id}: ${task.name} schedule="${task.schedule}" enabled=${task.enabled}${task.isYou ? " (You)" : ""}`
    );
}

function listHeartbeatLinesBuild(heartbeats: Array<{ id: string; title: string; lastRunAt: string | null }>): string[] {
    if (heartbeats.length === 0) {
        return ["None"];
    }

    return heartbeats.map((task) => `${task.id}: ${task.title} lastRun=${task.lastRunAt ?? "never"}`);
}

function listSignalSubscriptionLines(
    subscriptions: Array<{
        userId: string;
        agentId: string;
        pattern: string;
        silent: boolean;
        isYou: boolean;
    }>
): string[] {
    if (subscriptions.length === 0) {
        return ["None"];
    }

    return subscriptions.map(
        (subscription) =>
            `user=${subscription.userId} agent=${subscription.agentId} pattern=${subscription.pattern} silent=${subscription.silent}${subscription.isYou ? " (You)" : ""}`
    );
}

function listChannelLinesBuild(
    channels: Array<{
        id: string;
        name: string;
        leader: string;
        members: Array<{ agentId: string; username: string }>;
    }>
): string[] {
    if (channels.length === 0) {
        return ["None"];
    }

    return channels.map((channel) => {
        const members =
            channel.members.length === 0
                ? "none"
                : channel.members.map((member) => `@${member.username}(${member.agentId})`).join(", ");
        return `#${channel.name} leader=${channel.leader} members=${members}`;
    });
}

function listExposeLinesBuild(
    endpoints: Array<{
        id: string;
        domain: string;
        target: string;
        provider: string;
        mode: string;
        authenticated: boolean;
    }>
): string[] {
    if (endpoints.length === 0) {
        return ["None"];
    }

    return endpoints.map(
        (endpoint) =>
            `${endpoint.id} domain=${endpoint.domain} target=${endpoint.target} provider=${endpoint.provider} mode=${endpoint.mode} authenticated=${endpoint.authenticated}`
    );
}

async function listFriendLinesBuild(
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
                name: string | null;
            } | null>;
        };
    },
    agents: Array<{ id: string; descriptor: { type: string; id?: string } }>
): Promise<{ count: number; lines: string[] }> {
    const friendConnections = await storage.connections.findFriends(callerUserId);
    const userCache = new Map<
        string,
        { id: string; parentUserId: string | null; nametag: string | null; name: string | null }
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
            (entry): entry is { id: string; parentUserId: string | null; nametag: string; name: string | null } =>
                !!entry
        )
        .sort((left, right) => {
            const leftTag = left.nametag;
            const rightTag = right.nametag;
            return leftTag.localeCompare(rightTag);
        });

    if (friendUsers.length === 0) {
        return {
            count: 0,
            lines: ["None"]
        };
    }

    const gatewayBySubuserId = new Map(
        agents
            .filter((agent) => agent.descriptor.type === "subuser" && typeof agent.descriptor.id === "string")
            .map((agent) => [agent.descriptor.id as string, agent.id])
    );

    const lines: string[] = [];
    for (let i = 0; i < friendUsers.length; i += 1) {
        const friend = friendUsers[i]!;
        const friendTag = friend.nametag;
        lines.push(friendTag);

        const [outgoing, incoming] = await Promise.all([
            storage.connections.findConnectionsWithSubusersOf(friend.id, callerUserId),
            storage.connections.findConnectionsWithSubusersOf(callerUserId, friend.id)
        ]);

        const outgoingLines = await sharedSubuserLinesBuild({
            connections: outgoing,
            knownUserId: friend.id,
            users: storage.users,
            userCache,
            gatewayBySubuserId,
            direction: "out"
        });
        const incomingLines = await sharedSubuserLinesBuild({
            connections: incoming,
            knownUserId: callerUserId,
            users: storage.users,
            userCache,
            gatewayBySubuserId,
            direction: "in"
        });

        if (outgoingLines.length === 0 && incomingLines.length === 0) {
            lines.push("  (no shared subusers)");
        } else {
            lines.push(...outgoingLines, ...incomingLines);
        }
        if (i < friendUsers.length - 1) {
            lines.push("");
        }
    }

    return {
        count: friendUsers.length,
        lines
    };
}

async function sharedSubuserLinesBuild(options: {
    connections: Array<{ userAId: string; userBId: string; requestedA: boolean; requestedB: boolean }>;
    knownUserId: string;
    users: {
        findById: (
            id: string
        ) => Promise<{ id: string; parentUserId: string | null; nametag: string | null; name: string | null } | null>;
    };
    userCache: Map<string, { id: string; parentUserId: string | null; nametag: string | null; name: string | null }>;
    gatewayBySubuserId: Map<string, string>;
    direction: "out" | "in";
}): Promise<string[]> {
    const sorted = options.connections
        .slice()
        .sort((left, right) =>
            connectionOtherUserId(left, options.knownUserId).localeCompare(
                connectionOtherUserId(right, options.knownUserId)
            )
        );

    const lines: string[] = [];
    for (const connection of sorted) {
        const subuserId = connectionOtherUserId(connection, options.knownUserId);
        const cached = options.userCache.get(subuserId);
        const subuser = cached ?? (await options.users.findById(subuserId));
        if (!subuser) {
            continue;
        }
        options.userCache.set(subuserId, subuser);
        const subuserName = subuser.name ?? subuser.id;
        const subuserTag = subuser.nametag;
        const gateway = options.gatewayBySubuserId.get(subuserId) ?? "none";
        const status = connection.requestedA && connection.requestedB ? "active" : "pending";
        const arrow = options.direction === "out" ? "→" : "←";
        const relation = options.direction === "out" ? "shared out" : "shared in";
        lines.push(
            `  ${arrow} ${relation}: ${subuserName} (nametag=${subuserTag}) gateway=${gateway} status=${status}`
        );
    }
    return lines;
}

function connectionOtherUserId(connection: { userAId: string; userBId: string }, knownUserId: string): string {
    return connection.userAId === knownUserId ? connection.userBId : connection.userAId;
}
