import type { AgentDescriptor, Context, SessionPermissions } from "@/types";
import type { UserHome } from "../../users/userHome.js";
import type { AgentSystem } from "../agentSystem.js";

export type AgentSystemPromptAgentSystem = Pick<
    AgentSystem,
    "config" | "pluginManager" | "toolResolver" | "connectorRegistry"
>;

export type AgentSystemPromptContext = {
    model?: string;
    provider?: string;
    ctx?: Context;
    userId?: string;
    agentId?: string;
    permissions?: SessionPermissions;
    agentSystem?: AgentSystemPromptAgentSystem;
    descriptor?: AgentDescriptor;
    userHome?: UserHome;
};
