import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders the workspace todos guidance section.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionTodos(_context: AgentSystemPromptContext): Promise<string> {
    const template = await agentPromptBundledRead("SYSTEM_TODOS.md");
    return template.trim();
}
