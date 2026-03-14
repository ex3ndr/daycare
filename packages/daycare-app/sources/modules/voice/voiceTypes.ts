export type VoiceAgentToolParameter = {
    type: string;
    description: string;
    required?: boolean;
};

export type VoiceAgentToolDefinition = {
    name: string;
    description: string;
    parameters: Record<string, VoiceAgentToolParameter>;
};

export type VoiceAgentRecord = {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    systemPrompt: string;
    tools: VoiceAgentToolDefinition[];
    settings: Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
};

export type VoiceSessionStartPayload = {
    providerId: string;
    voiceAgent: VoiceAgentRecord;
    session: {
        agentId: string;
        overrides: Record<string, unknown>;
    };
};
