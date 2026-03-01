import Handlebars from "handlebars";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders the preamble section from role metadata and current date.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionPreamble(_context: AgentSystemPromptContext): Promise<string> {
    const template = await agentPromptBundledRead("SYSTEM.md");
    const parentAgentId = await parentAgentIdResolve(_context);
    const section = Handlebars.compile(template)({
        isForeground: _context.config?.foreground ?? false,
        parentAgentId,
        date: new Date().toISOString().slice(0, 10)
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
