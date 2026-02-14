import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

import type { ToolDefinition } from "@/types";
import { agentDescriptorLabel } from "../../agents/ops/agentDescriptorLabel.js";
import { agentList } from "../../agents/ops/agentList.js";
import type { Channels } from "../../channels/channels.js";
import type { Crons } from "../../cron/crons.js";
import type { Signals } from "../../signals/signals.js";

const schema = Type.Object({}, { additionalProperties: false });

/**
 * Builds the topology tool that snapshots agents, cron tasks, heartbeat tasks,
 * and signal subscriptions in one response.
 */
export function topologyToolBuild(
  crons: Crons,
  signals: Signals,
  channels: Pick<Channels, "list">
): ToolDefinition {
  return {
    tool: {
      name: "topology",
      description:
        "Return a full system topology snapshot (agents, cron tasks, heartbeat tasks, and signal subscriptions).",
      parameters: schema
    },
    execute: async (_args, toolContext, toolCall) => {
      const callerAgentId = toolContext.agent.id;

      const [agentEntries, cronTasks, heartbeatTasks] = await Promise.all([
        agentList(toolContext.agentSystem.config.current),
        crons.listTasks(),
        toolContext.heartbeats.listTasks()
      ]);
      const signalSubscriptions = signals.listSubscriptions();
      const channelEntries = channels.list();

      const agents = agentEntries
        .slice()
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .map((entry) => ({
          id: entry.agentId,
          type: entry.descriptor.type,
          label: agentDescriptorLabel(entry.descriptor),
          lifecycle: entry.lifecycle,
          isYou: entry.agentId === callerAgentId
        }));

      const cronsSummary = cronTasks
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
        .slice()
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((task) => ({
          id: task.id,
          title: task.title,
          lastRunAt: task.lastRunAt ?? null
        }));

      const signalSubscriptionsSummary = signalSubscriptions
        .slice()
        .sort((left, right) => {
          const byAgent = left.agentId.localeCompare(right.agentId);
          if (byAgent !== 0) {
            return byAgent;
          }
          return left.pattern.localeCompare(right.pattern);
        })
        .map((subscription) => ({
          agentId: subscription.agentId,
          pattern: subscription.pattern,
          silent: subscription.silent,
          isYou: subscription.agentId === callerAgentId
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

      const text = [
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
        ...listSignalSubscriptionLinesBuild(signalSubscriptionsSummary),
        "",
        `## Channels (${channelsSummary.length})`,
        ...listChannelLinesBuild(channelsSummary)
      ].join("\n");

      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text }],
        details: {
          callerAgentId,
          agents,
          crons: cronsSummary,
          heartbeats,
          signalSubscriptions: signalSubscriptionsSummary,
          channels: channelsSummary
        },
        isError: false,
        timestamp: Date.now()
      };

      return { toolMessage, files: [] };
    }
  };
}

function listAgentsLinesBuild(
  agents: Array<{ id: string; type: string; label: string; lifecycle: string; isYou: boolean }>
): string[] {
  if (agents.length === 0) {
    return ["None"];
  }

  return agents.map((agent) =>
    `${agent.id}${agent.isYou ? " (You)" : ""} type=${agent.type} label=\"${agent.label}\" lifecycle=${agent.lifecycle}`
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

  return cronsSummary.map((task) =>
    `${task.id}: ${task.name} schedule=\"${task.schedule}\" enabled=${task.enabled}${task.isYou ? " (You)" : ""}`
  );
}

function listHeartbeatLinesBuild(
  heartbeats: Array<{ id: string; title: string; lastRunAt: string | null }>
): string[] {
  if (heartbeats.length === 0) {
    return ["None"];
  }

  return heartbeats.map((task) =>
    `${task.id}: ${task.title} lastRun=${task.lastRunAt ?? "never"}`
  );
}

function listSignalSubscriptionLinesBuild(
  subscriptions: Array<{ agentId: string; pattern: string; silent: boolean; isYou: boolean }>
): string[] {
  if (subscriptions.length === 0) {
    return ["None"];
  }

  return subscriptions.map((subscription) =>
    `agent=${subscription.agentId} pattern=${subscription.pattern} silent=${subscription.silent}${subscription.isYou ? " (You)" : ""}`
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
    const members = channel.members.length === 0
      ? "none"
      : channel.members
          .map((member) => `@${member.username}(${member.agentId})`)
          .join(", ");
    return `#${channel.name} leader=${channel.leader} members=${members}`;
  });
}
