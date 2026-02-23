import type { Tool } from "@mariozechner/pi-ai";
import Handlebars from "handlebars";

import { RLM_TOOL_NAME, SKIP_TOOL_NAME } from "../../modules/rlm/rlmConstants.js";
import { rlmNoToolsPromptBuild } from "../../modules/rlm/rlmNoToolsPromptBuild.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";
import { agentToolExecutionAllowlistResolve } from "./agentToolExecutionAllowlistResolve.js";

/**
 * Renders tool-calling guidance and concatenates optional no-tools enforcement text.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionToolCalling(context: AgentSystemPromptContext = {}): Promise<string> {
    const config = context.agentSystem?.config?.current;
    const availableTools = toolListVisibleResolve(context);
    const filteredTools = toolListAllowlistApply(availableTools, context);
    const isForeground = context.descriptor?.type === "user";
    const noToolsPrompt =
        config?.features.noTools && filteredTools.length > 0
            ? await rlmNoToolsPromptBuild(filteredTools, { isForeground })
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
    const visibilityCtx =
        context.ctx ??
        (context.userId && context.agentId ? { userId: context.userId, agentId: context.agentId } : null);
    if (context.descriptor && visibilityCtx) {
        return toolResolver.listToolsForAgent({
            userId: visibilityCtx.userId,
            agentId: visibilityCtx.agentId,
            descriptor: context.descriptor
        });
    }
    return toolResolver.listTools();
}

/**
 * Applies execution allowlist filtering to the tool list.
 * Agents with restricted allowlists (e.g. memory-search) only see their allowed tools
 * in the system prompt, preventing RLM from generating stubs for inaccessible tools.
 */
function toolListAllowlistApply(tools: Tool[], context: AgentSystemPromptContext): Tool[] {
    if (!context.descriptor) {
        return tools;
    }
    const rlmEnabled = context.agentSystem?.config?.current?.features?.rlm === true;
    const allowlist = agentToolExecutionAllowlistResolve(context.descriptor, { rlmEnabled });
    if (!allowlist) {
        return tools;
    }
    // Filter to only allowed tools, excluding RLM-internal tools (run_python/skip) from visibility
    return tools.filter(
        (tool) => allowlist.has(tool.name) && tool.name !== RLM_TOOL_NAME && tool.name !== SKIP_TOOL_NAME
    );
}
