export type AgentDescriptor =
    | { type: "user"; connector: string; userId: string; channelId: string }
    | { type: "cron"; id: string; name?: string }
    | { type: "task"; id: string }
    | { type: "system"; tag: string }
    | { type: "subagent"; id: string; parentAgentId: string; name: string }
    | {
          type: "permanent";
          id: string;
          name: string;
          username?: string;
          description: string;
          systemPrompt: string;
          workspaceDir?: string;
      }
    | { type: "memory-agent"; id: string }
    | { type: "memory-search"; id: string; parentAgentId: string; name: string }
    | { type: "swarm"; id: string };

export type AgentLifecycleState = "active" | "sleeping" | "dead";

export type AgentListItem = {
    agentId: string;
    descriptor: AgentDescriptor;
    lifecycle: AgentLifecycleState;
    updatedAt: number;
};
