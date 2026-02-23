import Handlebars from "handlebars";

import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders agent/collaboration/scheduling guidance from permanent-agent state.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionAgentsTopologySignalsChannels(
    _context: AgentSystemPromptContext
): Promise<string> {
    const template = await agentPromptBundledRead("SYSTEM_TOPOLOGY.md");
    const section = Handlebars.compile(template)({});
    return section.trim();
}
