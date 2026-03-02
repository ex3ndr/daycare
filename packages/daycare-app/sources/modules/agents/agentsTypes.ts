export type AgentLifecycleState = "active" | "sleeping" | "dead";

export type AgentListItem = {
    agentId: string;
    path: string | null;
    kind: string;
    name: string | null;
    description: string | null;
    connectorName: string | null;
    foreground: boolean;
    lifecycle: AgentLifecycleState;
    createdAt: number;
    updatedAt: number;
};
