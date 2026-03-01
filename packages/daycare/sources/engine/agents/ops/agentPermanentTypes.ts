export type PermanentAgentSummary = {
    agentId: string;
    name: string;
    description: string;
    systemPrompt: string;
    workspaceDir: string | null;
    updatedAt: number;
};
