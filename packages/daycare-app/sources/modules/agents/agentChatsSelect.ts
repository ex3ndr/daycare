import type { AgentListItem } from "./agentsTypes";

/**
 * Selects direct chat agents sorted by updatedAt descending.
 * Expects: agents array from the agents store.
 */
export function agentChatsSelect(agents: AgentListItem[]): AgentListItem[] {
    return agents.filter((a) => a.kind === "direct" || a.kind === "app").sort((a, b) => b.updatedAt - a.updatedAt);
}
