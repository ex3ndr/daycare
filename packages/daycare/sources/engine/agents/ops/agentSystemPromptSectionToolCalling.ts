import Handlebars from "handlebars";

import { rlmNoToolsPromptBuild } from "../../modules/rlm/rlmNoToolsPromptBuild.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders tool-calling guidance and concatenates optional no-tools enforcement text.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionToolCalling(context: AgentSystemPromptContext = {}): Promise<string> {
    const config = context.agentSystem?.config?.current;
    const availableTools = toolListVisibleResolve(context);
    const isForeground = context.descriptor?.type === "user";
    const noToolsPrompt =
        config?.features.noTools && availableTools.length > 0
            ? await rlmNoToolsPromptBuild(availableTools, { isForeground })
            : "";
    const template = await agentPromptBundledRead("SYSTEM_TOOLS.md");
    const section = Handlebars.compile(template)({}).trim();
    return [section, noToolsPrompt.trim()]
        .filter((part) => part.length > 0)
        .join("\n\n")
        .trim();
}

function toolListVisibleResolve(context: AgentSystemPromptContext) {
    const toolResolver = context.agentSystem?.toolResolver;
    if (!toolResolver) {
        return [];
    }
    if (context.userId && context.agentId && context.descriptor) {
        return toolResolver.listToolsForAgent({
            userId: context.userId,
            agentId: context.agentId,
            descriptor: context.descriptor
        });
    }
    return toolResolver.listTools();
}
