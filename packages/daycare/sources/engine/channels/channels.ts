import { createId } from "@paralleldrive/cuid2";

import type {
    AgentInboxItem,
    AgentPostTarget,
    Channel,
    ChannelMessage,
    ChannelSignalData,
    Context,
    Signal
} from "@/types";
import { getLogger } from "../../log.js";
import type { ChannelMessagesRepository } from "../../storage/channelMessagesRepository.js";
import type { ChannelsRepository } from "../../storage/channelsRepository.js";
import type { AgentSystem } from "../agents/agentSystem.js";
import { contextForAgent, contextForUser } from "../agents/context.js";
import type { Signals } from "../signals/signals.js";
import { channelNameNormalize } from "./channelNameNormalize.js";

const logger = getLogger("channel.facade");
const HISTORY_CONTEXT_LIMIT = 12;

type ChannelRuntimeRecord = Channel & { userId: string };

export type ChannelsOptions = {
    channels: Pick<
        ChannelsRepository,
        "create" | "findByName" | "findAll" | "update" | "delete" | "addMember" | "removeMember" | "findMembers"
    >;
    channelMessages: Pick<ChannelMessagesRepository, "create" | "findRecent">;
    signals: Pick<Signals, "subscribe" | "unsubscribe">;
    agentSystem: Pick<AgentSystem, "agentExists" | "post" | "contextForAgentId">;
};

export class Channels {
    private readonly channels: Pick<
        ChannelsRepository,
        "create" | "findByName" | "findAll" | "update" | "delete" | "addMember" | "removeMember" | "findMembers"
    >;
    private readonly channelMessages: Pick<ChannelMessagesRepository, "create" | "findRecent">;
    private readonly signals: Pick<Signals, "subscribe" | "unsubscribe">;
    private readonly agentSystem: Pick<AgentSystem, "agentExists" | "post" | "contextForAgentId">;
    private readonly items = new Map<string, ChannelRuntimeRecord>();

    constructor(options: ChannelsOptions) {
        this.channels = options.channels;
        this.channelMessages = options.channelMessages;
        this.signals = options.signals;
        this.agentSystem = options.agentSystem;
    }

    async ensureDir(): Promise<void> {
        return Promise.resolve();
    }

    /**
     * Loads channels from SQLite and replays signal subscriptions for members.
     */
    async load(): Promise<void> {
        this.items.clear();
        const channels = await this.channels.findAll();
        for (const channelRecord of channels) {
            const members = await this.channels.findMembers(channelRecord.id);
            const channel: ChannelRuntimeRecord = {
                id: channelRecord.id,
                name: channelRecord.name,
                leader: channelRecord.leader,
                userId: channelRecord.userId,
                members: members.map((member) => ({
                    agentId: member.agentId,
                    username: member.username,
                    joinedAt: member.joinedAt
                })),
                createdAt: channelRecord.createdAt,
                updatedAt: channelRecord.updatedAt
            };
            this.items.set(channel.name, cloneRuntimeChannel(channel));

            for (const member of channel.members) {
                const memberContext = await this.agentSystem.contextForAgentId(member.agentId);
                if (!memberContext) {
                    continue;
                }
                await this.signals.subscribe({
                    ctx: memberContext,
                    pattern: channelPatternBuild(channel.name),
                    silent: false
                });
            }
        }
    }

    list(): Channel[] {
        return Array.from(this.items.values())
            .map((channel) => cloneChannel(channel))
            .sort((left, right) => left.name.localeCompare(right.name));
    }

    listForUserIds(userIds: string[]): Channel[] {
        const allowedUserIds = new Set(userIds.map((userId) => userId.trim()).filter((userId) => userId.length > 0));
        return Array.from(this.items.values())
            .filter((channel) => allowedUserIds.has(channel.userId))
            .map((channel) => cloneChannel(channel))
            .sort((left, right) => left.name.localeCompare(right.name));
    }

    get(name: string): Channel | null {
        const channel = this.items.get(channelNameNormalize(name));
        if (!channel) {
            return null;
        }
        return cloneChannel(channel);
    }

    async create(ctx: Context, name: string, leaderAgentId: string): Promise<Channel> {
        const callerUserId = ctx.userId.trim();
        if (!callerUserId) {
            throw new Error("Channel caller user id is required.");
        }
        const channelName = channelNameNormalize(name);
        const leader = leaderAgentId.trim();
        if (!leader) {
            throw new Error("Channel leader agent id is required.");
        }
        const exists = await this.agentSystem.agentExists(leader);
        if (!exists) {
            throw new Error(`Leader agent not found: ${leader}`);
        }
        if (this.items.has(channelName)) {
            throw new Error(`Channel already exists: ${channelName}`);
        }

        const leaderContext = await this.agentSystem.contextForAgentId(leader);
        if (!leaderContext) {
            throw new Error(`Leader agent not found: ${leader}`);
        }
        if (leaderContext.userId !== callerUserId) {
            throw new Error(`Channel leader user scope mismatch: ${leader}`);
        }

        const now = Date.now();
        const channel: ChannelRuntimeRecord = {
            id: createId(),
            name: channelName,
            leader,
            userId: callerUserId,
            members: [],
            createdAt: now,
            updatedAt: now
        };
        await this.channels.create({
            id: channel.id,
            userId: channel.userId,
            name: channel.name,
            leader: channel.leader,
            createdAt: channel.createdAt,
            updatedAt: channel.updatedAt
        });
        this.items.set(channelName, cloneRuntimeChannel(channel));
        return cloneChannel(channel);
    }

    async delete(name: string): Promise<boolean> {
        const channelName = channelNameNormalize(name);
        const channel = this.items.get(channelName);
        if (!channel) {
            return false;
        }

        for (const member of channel.members) {
            const memberContext = await this.agentSystem.contextForAgentId(member.agentId);
            if (!memberContext) {
                continue;
            }
            await this.signals.unsubscribe({
                ctx: memberContext,
                pattern: channelPatternBuild(channelName)
            });
        }

        await this.channels.delete(channel.id);
        this.items.delete(channelName);
        return true;
    }

    async addMember(channelName: string, ctx: Context, username: string): Promise<Channel> {
        const channel = this.channelRequire(channelName);
        const normalizedUsername = usernameNormalize(username);
        const normalizedAgentId = ctx.agentId.trim();
        if (!normalizedAgentId) {
            throw new Error("Channel member agent id is required.");
        }
        const normalizedUserId = ctx.userId.trim();
        if (!normalizedUserId) {
            throw new Error("Channel member user id is required.");
        }
        const exists = await this.agentSystem.agentExists(normalizedAgentId);
        if (!exists) {
            throw new Error(`Agent not found: ${normalizedAgentId}`);
        }
        if (normalizedUserId !== channel.userId) {
            throw new Error(`Agent user scope mismatch for #${channel.name}: ${normalizedAgentId}`);
        }

        const taken = channel.members.find(
            (member) => member.username === normalizedUsername && member.agentId !== normalizedAgentId
        );
        if (taken) {
            throw new Error(`Username already taken in #${channel.name}: @${normalizedUsername}`);
        }

        const now = Date.now();
        const existingIndex = channel.members.findIndex((member) => member.agentId === normalizedAgentId);
        if (existingIndex >= 0) {
            const current = channel.members[existingIndex];
            channel.members[existingIndex] = {
                agentId: normalizedAgentId,
                username: normalizedUsername,
                joinedAt: current?.joinedAt ?? now
            };
        } else {
            channel.members.push({
                agentId: normalizedAgentId,
                username: normalizedUsername,
                joinedAt: now
            });
        }

        channel.updatedAt = now;
        await this.channels.addMember(channel.id, {
            userId: normalizedUserId,
            agentId: normalizedAgentId,
            username: normalizedUsername,
            joinedAt: channel.members.find((entry) => entry.agentId === normalizedAgentId)?.joinedAt ?? now
        });
        await this.channels.update(channel.id, { updatedAt: channel.updatedAt });
        this.items.set(channel.name, cloneRuntimeChannel(channel));

        await this.signals.subscribe({
            ctx: contextForAgent({ userId: normalizedUserId, agentId: normalizedAgentId }),
            pattern: channelPatternBuild(channel.name),
            silent: false
        });
        return cloneChannel(channel);
    }

    async removeMember(channelName: string, ctx: Context): Promise<boolean> {
        const channel = this.channelRequire(channelName);
        const normalizedAgentId = ctx.agentId.trim();
        if (!normalizedAgentId) {
            throw new Error("Channel member agent id is required.");
        }
        const nextMembers = channel.members.filter((member) => member.agentId !== normalizedAgentId);
        if (nextMembers.length === channel.members.length) {
            return false;
        }

        channel.members = nextMembers;
        channel.updatedAt = Date.now();
        await this.channels.removeMember(channel.id, normalizedAgentId);
        await this.channels.update(channel.id, { updatedAt: channel.updatedAt });
        this.items.set(channel.name, cloneRuntimeChannel(channel));

        const normalizedUserId = ctx.userId.trim();
        await this.signals.unsubscribe({
            ctx: contextForAgent({ userId: normalizedUserId, agentId: normalizedAgentId }),
            pattern: channelPatternBuild(channel.name)
        });
        return true;
    }

    async send(
        ctx: Context,
        channelName: string,
        senderUsername: string,
        text: string,
        mentions: string[]
    ): Promise<{ message: ChannelMessage; deliveredAgentIds: string[] }> {
        const channel = this.channelRequire(channelName);
        const callerUserId = ctx.userId.trim();
        if (!callerUserId) {
            throw new Error("Channel sender user id is required.");
        }
        if (callerUserId !== channel.userId) {
            throw new Error(`Channel user scope mismatch for #${channel.name}.`);
        }
        const sender = usernameNormalize(senderUsername);
        const body = text.trim();
        if (!body) {
            throw new Error("Channel message text is required.");
        }
        const normalizedMentions = mentionListNormalize(mentions);
        const createdAt = Date.now();
        const message: ChannelMessage = {
            id: createId(),
            channelName: channel.name,
            senderUsername: sender,
            text: body,
            mentions: normalizedMentions,
            createdAt
        };

        await this.channelMessages.create({
            id: message.id,
            channelId: channel.id,
            userId: channel.userId,
            senderUsername: message.senderUsername,
            text: message.text,
            mentions: [...message.mentions],
            createdAt: message.createdAt
        });

        channel.updatedAt = createdAt;
        await this.channels.update(channel.id, { updatedAt: channel.updatedAt });
        this.items.set(channel.name, cloneRuntimeChannel(channel));

        const mentionTargets = channel.members
            .filter((member) => normalizedMentions.includes(member.username))
            .map((member) => member.agentId);
        const deliveredAgentIds = Array.from(new Set([channel.leader, ...mentionTargets]));
        const history = await this.getHistory(ctx, channel.name, HISTORY_CONTEXT_LIMIT);
        const signalType = channelSignalTypeBuild(channel.name);
        const senderMember = channel.members.find((member) => member.username === sender) ?? null;
        const signal: Signal = {
            id: createId(),
            type: signalType,
            source: senderMember
                ? { type: "agent", id: senderMember.agentId, userId: channel.userId }
                : { type: "system", userId: channel.userId },
            data: channelSignalDataBuild(message, history),
            createdAt
        };

        await Promise.all(
            deliveredAgentIds.map((targetAgentId) =>
                this.agentSystem.post(
                    contextForUser({ userId: channel.userId }),
                    { agentId: targetAgentId } satisfies AgentPostTarget,
                    {
                        type: "signal",
                        signal,
                        subscriptionPattern: signalType
                    } satisfies AgentInboxItem
                )
            )
        );

        logger.info(
            {
                channelName: channel.name,
                sender,
                mentionCount: normalizedMentions.length,
                deliveredCount: deliveredAgentIds.length
            },
            "event: Channel message delivered"
        );

        return {
            message,
            deliveredAgentIds
        };
    }

    async getHistory(ctx: Context, channelName: string, limit?: number): Promise<ChannelMessage[]> {
        const channel = this.channelRequire(channelName);
        const callerUserId = ctx.userId.trim();
        if (!callerUserId) {
            throw new Error("Channel history user id is required.");
        }
        if (callerUserId !== channel.userId) {
            throw new Error(`Channel user scope mismatch for #${channel.name}.`);
        }
        const rows = await this.channelMessages.findRecent(contextForUserId(channel.userId), channel.id, limit);
        return rows.map((row) => ({
            id: row.id,
            channelName: channel.name,
            senderUsername: row.senderUsername,
            text: row.text,
            mentions: [...row.mentions],
            createdAt: row.createdAt
        }));
    }

    private channelRequire(name: string): ChannelRuntimeRecord {
        const channelName = channelNameNormalize(name);
        const channel = this.items.get(channelName);
        if (!channel) {
            throw new Error(`Channel not found: ${channelName}`);
        }
        return channel;
    }
}

function channelPatternBuild(channelName: string): string {
    return `channel.${channelName}:*`;
}

function channelSignalTypeBuild(channelName: string): string {
    return `channel.${channelName}:message`;
}

function mentionListNormalize(mentions: string[]): string[] {
    return Array.from(
        new Set(
            mentions
                .map((mention) => mention.trim())
                .filter((mention) => mention.length > 0)
                .map((mention) => usernameNormalize(mention))
        )
    );
}

function usernameNormalize(username: string): string {
    const normalized = username.trim().replace(/^@+/, "").toLowerCase();
    if (!normalized) {
        throw new Error("Username is required.");
    }
    return normalized;
}

function channelSignalDataBuild(message: ChannelMessage, history: ChannelMessage[]): ChannelSignalData {
    return {
        channelName: message.channelName,
        messageId: message.id,
        senderUsername: message.senderUsername,
        text: message.text,
        mentions: [...message.mentions],
        createdAt: message.createdAt,
        history: history.map((entry) => ({ ...entry, mentions: [...entry.mentions] }))
    };
}

function cloneRuntimeChannel(channel: ChannelRuntimeRecord): ChannelRuntimeRecord {
    return {
        ...channel,
        members: channel.members.map((member) => ({ ...member }))
    };
}

function cloneChannel(channel: ChannelRuntimeRecord): Channel {
    return {
        id: channel.id,
        name: channel.name,
        leader: channel.leader,
        members: channel.members.map((member) => ({ ...member })),
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt
    };
}

function contextForUserId(userId: string): Context {
    return contextForUser({ userId });
}
