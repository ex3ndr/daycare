import type { AgentDescriptor, SessionPermissions } from "@/types";
import type { AgentSystem } from "../agentSystem.js";

export type AgentSystemPromptAgentSystem = Pick<
    AgentSystem,
    "config" | "pluginManager" | "toolResolver" | "connectorRegistry" | "crons"
>;

export type AgentSystemPromptContext = {
    model?: string;
    provider?: string;
    permissions?: SessionPermissions;
    agentSystem?: AgentSystemPromptAgentSystem;
    descriptor?: AgentDescriptor;
};
