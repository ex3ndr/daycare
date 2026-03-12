export type AgentLifecycleState = "active" | "sleeping" | "dead";

export type AgentConnectorIdentity = {
    name: string;
    key: string;
};

export type AgentListItem = {
    agentId: string;
    path: string | null;
    kind: string;
    name: string | null;
    description: string | null;
    connector: AgentConnectorIdentity | null;
    foreground: boolean;
    lifecycle: AgentLifecycleState;
    createdAt: number;
    updatedAt: number;
};
