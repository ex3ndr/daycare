export type AgentLifecycleState = "active" | "sleeping" | "dead";

export type AgentListItem = {
    agentId: string;
    lifecycle: AgentLifecycleState;
    updatedAt: number;
};
