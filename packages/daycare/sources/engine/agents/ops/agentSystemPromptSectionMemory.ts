import Handlebars from "handlebars";

import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders memory guidance using versioned system documents with bundled fallbacks.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionMemory(context: AgentSystemPromptContext): Promise<string> {
    const isForeground = context.config?.foreground === true;
    const systemRoot = await context.agentSystem?.storage?.documents.findBySlugAndParent(context.ctx, "system", null);
    const [soul, user, agents, tools] = await Promise.all([
        systemPromptDocumentRead(context, systemRoot?.id ?? null, "soul", "SOUL.md"),
        systemPromptDocumentRead(context, systemRoot?.id ?? null, "user", "USER.md"),
        systemPromptDocumentRead(context, systemRoot?.id ?? null, "agents", "AGENTS.md"),
        systemPromptDocumentRead(context, systemRoot?.id ?? null, "tools", "TOOLS.md")
    ]);

    const template = await agentPromptBundledRead("SYSTEM_MEMORY.md");
    const section = Handlebars.compile(template)({
        isForeground,
        workspace: context.permissions?.workingDir ?? "unknown",
        configDir: context.agentSystem?.config?.current.configDir ?? "",
        soul,
        user,
        agents,
        tools
    });
    return section.trim();
}

async function systemPromptDocumentRead(
    context: AgentSystemPromptContext,
    systemRootId: string | null,
    slug: string,
    fallbackPrompt: string
): Promise<string> {
    if (systemRootId) {
        const document = await context.agentSystem?.storage?.documents.findBySlugAndParent(
            context.ctx,
            slug,
            systemRootId
        );
        const trimmed = document?.body.trim() ?? "";
        if (trimmed.length > 0) {
            return trimmed;
        }
    }
    return (await agentPromptBundledRead(fallbackPrompt)).trim();
}
