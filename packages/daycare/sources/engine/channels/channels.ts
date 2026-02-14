import { promises as fs } from "node:fs";
import path from "node:path";

import { createId } from "@paralleldrive/cuid2";

import type { AgentInboxItem, AgentPostTarget, Channel, ChannelMessage, ChannelSignalData, Signal } from "@/types";
import { getLogger } from "../../log.js";
import type { AgentSystem } from "../agents/agentSystem.js";
import type { Signals } from "../signals/signals.js";
import {
  channelAppendMessage,
  channelLoad,
  channelNameNormalize,
  channelReadHistory,
  channelSave
} from "./channelStore.js";

const logger = getLogger("channel.facade");
const HISTORY_CONTEXT_LIMIT = 12;

export type ChannelsOptions = {
  configDir: string;
  signals: Pick<Signals, "subscribe" | "unsubscribe">;
  agentSystem: Pick<AgentSystem, "agentExists" | "post">;
};

export class Channels {
  private readonly baseDir: string;
  private readonly signals: Pick<Signals, "subscribe" | "unsubscribe">;
  private readonly agentSystem: Pick<AgentSystem, "agentExists" | "post">;
  private readonly items = new Map<string, Channel>();

  constructor(options: ChannelsOptions) {
    this.baseDir = path.join(options.configDir, "channels");
    this.signals = options.signals;
    this.agentSystem = options.agentSystem;
  }

  async ensureDir(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  /**
   * Loads channels from disk and replays signal subscriptions for members.
   * Expects: channel config directory is writable by the process.
   */
  async load(): Promise<void> {
    await this.ensureDir();
    this.items.clear();
    const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      let channel: Channel | null = null;
      try {
        channel = await channelLoad(this.baseDir, entry.name);
      } catch (error) {
        logger.warn({ channelName: entry.name, error }, "skip: Channel restore skipped");
        continue;
      }
      if (!channel) {
        continue;
      }
      this.items.set(channel.name, cloneChannel(channel));
      for (const member of channel.members) {
        this.signals.subscribe({
          agentId: member.agentId,
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

  get(name: string): Channel | null {
    const channel = this.items.get(channelNameNormalize(name));
    if (!channel) {
      return null;
    }
    return cloneChannel(channel);
  }

  async create(name: string, leaderAgentId: string): Promise<Channel> {
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
    const now = Date.now();
    const channel: Channel = {
      id: createId(),
      name: channelName,
      leader,
      members: [],
      createdAt: now,
      updatedAt: now
    };
    await channelSave(this.baseDir, channel);
    this.items.set(channelName, cloneChannel(channel));
    return channel;
  }

  async delete(name: string): Promise<boolean> {
    const channelName = channelNameNormalize(name);
    const channel = this.items.get(channelName);
    if (!channel) {
      return false;
    }
    for (const member of channel.members) {
      this.signals.unsubscribe({
        agentId: member.agentId,
        pattern: channelPatternBuild(channelName)
      });
    }
    await fs.rm(path.join(this.baseDir, channelName), { recursive: true, force: true });
    this.items.delete(channelName);
    return true;
  }

  async addMember(channelName: string, agentId: string, username: string): Promise<Channel> {
    const channel = this.channelRequire(channelName);
    const normalizedUsername = usernameNormalize(username);
    const normalizedAgentId = agentId.trim();
    if (!normalizedAgentId) {
      throw new Error("Channel member agent id is required.");
    }
    const exists = await this.agentSystem.agentExists(normalizedAgentId);
    if (!exists) {
      throw new Error(`Agent not found: ${normalizedAgentId}`);
    }

    const taken = channel.members.find(
      (member) => member.username === normalizedUsername && member.agentId !== normalizedAgentId
    );
    if (taken) {
      throw new Error(`Username already taken in #${channel.name}: @${normalizedUsername}`);
    }

    const now = Date.now();
    const existingIndex = channel.members.findIndex(
      (member) => member.agentId === normalizedAgentId
    );
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
    await channelSave(this.baseDir, channel);
    this.items.set(channel.name, cloneChannel(channel));
    this.signals.subscribe({
      agentId: normalizedAgentId,
      pattern: channelPatternBuild(channel.name),
      silent: false
    });
    return cloneChannel(channel);
  }

  async removeMember(channelName: string, agentId: string): Promise<boolean> {
    const channel = this.channelRequire(channelName);
    const normalizedAgentId = agentId.trim();
    const nextMembers = channel.members.filter((member) => member.agentId !== normalizedAgentId);
    if (nextMembers.length === channel.members.length) {
      return false;
    }
    channel.members = nextMembers;
    channel.updatedAt = Date.now();
    await channelSave(this.baseDir, channel);
    this.items.set(channel.name, cloneChannel(channel));
    this.signals.unsubscribe({
      agentId: normalizedAgentId,
      pattern: channelPatternBuild(channel.name)
    });
    return true;
  }

  async send(
    channelName: string,
    senderUsername: string,
    text: string,
    mentions: string[]
  ): Promise<{ message: ChannelMessage; deliveredAgentIds: string[] }> {
    const channel = this.channelRequire(channelName);
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

    await channelAppendMessage(this.baseDir, channel.name, message);
    channel.updatedAt = createdAt;
    await channelSave(this.baseDir, channel);
    this.items.set(channel.name, cloneChannel(channel));

    const mentionTargets = channel.members
      .filter((member) => normalizedMentions.includes(member.username))
      .map((member) => member.agentId);
    const deliveredAgentIds = Array.from(new Set([channel.leader, ...mentionTargets]));
    const history = await channelReadHistory(this.baseDir, channel.name, HISTORY_CONTEXT_LIMIT);
    const signalType = channelSignalTypeBuild(channel.name);
    const senderMember = channel.members.find((member) => member.username === sender) ?? null;
    const signal: Signal = {
      id: createId(),
      type: signalType,
      source: senderMember
        ? { type: "agent", id: senderMember.agentId }
        : { type: "system" },
      data: channelSignalDataBuild(message, history),
      createdAt
    };

    await Promise.all(
      deliveredAgentIds.map((targetAgentId) =>
        this.agentSystem.post(
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

  async getHistory(channelName: string, limit?: number): Promise<ChannelMessage[]> {
    const channel = this.channelRequire(channelName);
    return channelReadHistory(this.baseDir, channel.name, limit);
  }

  private channelRequire(name: string): Channel {
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

function channelSignalDataBuild(
  message: ChannelMessage,
  history: ChannelMessage[]
): ChannelSignalData {
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

function cloneChannel(channel: Channel): Channel {
  return {
    ...channel,
    members: channel.members.map((member) => ({ ...member }))
  };
}
