import Handlebars from "handlebars";
import type { ResolvedTool } from "@/types";

import { rlmNoToolsPromptBuild } from "../../modules/rlm/rlmNoToolsPromptBuild.js";
import { toolResolvedFromTool } from "../../modules/tools/toolResolvedFromTool.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";
import { agentToolExecutionAllowlistResolve } from "./agentToolExecutionAllowlistResolve.js";
import { bundledExamplesDirResolve } from "./bundledExamplesDirResolve.js";

/**
 * Renders tool-calling guidance and concatenates optional no-tools enforcement text.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionToolCalling(context: AgentSystemPromptContext): Promise<string> {
    const availableTools = toolListVisibleResolve(context);
    const filteredTools = toolListAllowlistApply(availableTools, context);
    const isForeground = context.config?.foreground === true;
    const preferSayTool = isForeground && filteredTools.some((entry) => entry.tool.name === "say");
    const examplesDir = context.agentSystem ? "/shared/examples" : bundledExamplesDirResolve();
    const noToolsPrompt =
        filteredTools.length > 0 ? await rlmNoToolsPromptBuild(filteredTools, { isForeground, examplesDir }) : "";
    const template = await agentPromptBundledRead("SYSTEM_TOOLS.md");
    const section = Handlebars.compile(template)({ preferSayTool }).trim();
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
    if (context.path && context.config) {
        return (
            toolResolver.listResolvedToolsForAgent?.({
                ctx: context.ctx,
                path: context.path,
                config: context.config
            }) ??
            toolResolver.listToolsForAgent({
                ctx: context.ctx,
                path: context.path,
                config: context.config
            }).map(toolResolvedFromTool)
        );
    }
    return toolResolver.listResolvedTools?.() ?? toolResolver.listTools().map(toolResolvedFromTool);
}

/**
 * Applies execution allowlist filtering to the tool list.
 * Agents with restricted allowlists (e.g. memory-search) only see their allowed tools
 * in the system prompt, preventing RLM from generating stubs for inaccessible tools.
 */
function toolListAllowlistApply(tools: ResolvedTool[], context: AgentSystemPromptContext): ResolvedTool[] {
    const kind = context.config?.kind;
    if (!kind) {
        return tools;
    }
    const allowlist = agentToolExecutionAllowlistResolve(kind);
    if (!allowlist) {
        return tools;
    }
    return tools.filter((entry) => allowlist.has(entry.tool.name));
}
