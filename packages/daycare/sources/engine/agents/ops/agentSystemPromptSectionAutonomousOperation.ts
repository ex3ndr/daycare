import Handlebars from "handlebars";

import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import { agentPromptResolve } from "./agentPromptResolve.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders autonomous-operation guidance and optional per-agent prompt block.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionAutonomousOperation(
    context: AgentSystemPromptContext = {}
): Promise<string> {
    const descriptor = context.descriptor;
    const parentAgentId =
        descriptor &&
        (descriptor.type === "subagent" || descriptor.type === "app" || descriptor.type === "memory-search")
            ? (descriptor.parentAgentId ?? "")
            : "";
    const agentPrompt = descriptor ? (await agentPromptResolve(descriptor)).agentPrompt : "";
    const template = await agentPromptBundledRead("SYSTEM_AGENCY.md");
    const section = Handlebars.compile(template)({
        isForeground: descriptor?.type === "user" || descriptor?.type === "subuser",
        parentAgentId,
        agentPrompt
    });
    return section.trim();
}
