import Handlebars from "handlebars";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import { agentPromptResolve } from "./agentPromptResolve.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders autonomous-operation guidance and optional per-agent prompt block.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionAutonomousOperation(context: AgentSystemPromptContext): Promise<string> {
    const parentAgentId = await parentAgentIdResolve(context);
    const agentPrompt = context.path ? (await agentPromptResolve(context.path, context.config)).agentPrompt : "";
    const template = await agentPromptBundledRead("SYSTEM_AGENCY.md");
    const section = Handlebars.compile(template)({
        isForeground: context.config?.foreground ?? false,
        parentAgentId,
        agentPrompt
    });
    return section.trim();
}

async function parentAgentIdResolve(context: AgentSystemPromptContext): Promise<string> {
    if (!context.config) {
        return "";
    }
    const kind = context.config.kind ?? "agent";
    if (kind !== "sub" && kind !== "search") {
        return "";
    }
    return context.config.parentAgentId ?? "";
}
