import Handlebars from "handlebars";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders message formatting and delivery guidance from connector capabilities.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionFormatting(context: AgentSystemPromptContext): Promise<string> {
    const connector = context.config?.connectorName?.trim() ?? null;
    const isForeground = Boolean(context.config?.foreground && connector);
    const messageFormatPrompt = connector
        ? (context.agentSystem?.connectorRegistry?.get(connector)?.capabilities.messageFormatPrompt ?? "")
        : "";
    const template = await agentPromptBundledRead("SYSTEM_FORMATTING.md");
    const section = Handlebars.compile(template)({
        isForeground,
        messageFormatPrompt,
        workspace: context.permissions?.workingDir ?? "unknown"
    });
    return section.trim();
}
