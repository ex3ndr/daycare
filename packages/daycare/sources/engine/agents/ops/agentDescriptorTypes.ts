/**
 * Keep `agentDescriptorCacheKey()` in sync with this union.
 * Any new descriptor `type` must add a matching cache-key case.
 */
export type AgentDescriptor =
    | { type: "user"; connector: string; userId: string; channelId: string }
    | { type: "cron"; id: string; name?: string }
    | { type: "task"; id: string }
    | { type: "system"; tag: string }
    | {
          type: "subagent";
          id: string;
          parentAgentId: string;
          name: string;
      }
    | {
          type: "app";
          id: string;
          parentAgentId: string;
          name: string;
          systemPrompt: string;
          appId: string;
      }
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
    | {
          type: "memory-search";
          id: string;
          parentAgentId: string;
          name: string;
      }
    | {
          type: "subuser";
          id: string;
          name: string;
          systemPrompt: string;
      };

export type AgentFetchStrategy = "most-recent-foreground" | "heartbeat";
