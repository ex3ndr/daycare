import type { AgentDescriptor } from "./agentDescriptorTypes.js";

export type PermanentAgentDescriptor = Extract<AgentDescriptor, { type: "permanent" }>;

export type PermanentAgentSummary = {
    agentId: string;
    descriptor: PermanentAgentDescriptor;
    updatedAt: number;
};
