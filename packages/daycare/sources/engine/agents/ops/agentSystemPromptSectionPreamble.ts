import Handlebars from "handlebars";

import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders the preamble section from role metadata and current date.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionPreamble(_context: AgentSystemPromptContext = {}): Promise<string> {
    const descriptor = _context.descriptor;
    const template = await agentPromptBundledRead("SYSTEM.md");
    const parentAgentId =
        descriptor && (descriptor.type === "subagent" || descriptor.type === "app")
            ? (descriptor.parentAgentId ?? "")
            : "";
    const section = Handlebars.compile(template)({
        isForeground: descriptor?.type === "user",
        parentAgentId,
        date: new Date().toISOString().slice(0, 10)
    });
    return section.trim();
}
