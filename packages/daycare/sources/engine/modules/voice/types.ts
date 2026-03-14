import type { Logger } from "pino";
import type { Context } from "../../agents/context.js";

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

export type VoiceAgentSettings = Record<string, unknown>;

export type VoiceSessionStartRequest = {
    voiceAgentId: string;
    systemPrompt: string;
    tools: VoiceAgentToolDefinition[];
    settings: VoiceAgentSettings;
};

export type VoiceSessionStartResult = {
    agentId: string;
    overrides: Record<string, unknown>;
};

export type VoiceSessionContext = {
    ctx: Context;
    logger: Logger;
};

export type VoiceAgentProvider = {
    id: string;
    label: string;
    startSession: (request: VoiceSessionStartRequest, context: VoiceSessionContext) => Promise<VoiceSessionStartResult>;
};
