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

export type VoiceTranscriptEntry = {
    id: string;
    role: "user" | "agent";
    text: string;
};

export type VoiceConversationEvent = {
    type?: string;
    user_transcription_event?: {
        user_transcript?: string;
    };
    agent_response_event?: {
        agent_response?: string;
    };
    agent_response_correction_event?: {
        corrected_agent_response?: string;
    };
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
