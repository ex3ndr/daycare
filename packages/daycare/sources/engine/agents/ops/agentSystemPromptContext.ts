import type { AgentConfig, AgentPath, Context, PluginSystemPromptResult, SessionPermissions } from "@/types";
import type { UserHome } from "../../users/userHome.js";
import type { AgentSystem } from "../agentSystem.js";

export type AgentSystemPromptAgentSystem = Pick<
    AgentSystem,
    "config" | "pluginManager" | "toolResolver" | "connectorRegistry" | "storage"
>;

export type AgentSystemPromptContext = {
    model?: string;
    provider?: string;
    ctx: Context;
    permissions?: SessionPermissions;
    agentSystem?: AgentSystemPromptAgentSystem;
    path?: AgentPath;
    config?: AgentConfig;
    userHome?: UserHome;
    pluginPrompts?: PluginSystemPromptResult[];
    /**
     * Populated during prompt rendering and forwarded with inference context.
     * Contains absolute image paths returned by plugin prompt sections.
     */
    systemPromptImages?: string[];
    /** Extra sections appended after all standard sections (e.g. configured system prompts). */
    extraSections?: string[];
};
