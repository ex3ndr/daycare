import type { Tool } from "@mariozechner/pi-ai";

import type { ConnectorRegistry } from "../connectorRegistry.js";
import type { ImageGenerationRegistry } from "../imageGenerationRegistry.js";
import { RLM_TOOL_NAME, SKIP_TOOL_NAME } from "../rlm/rlmConstants.js";

type ToolListOptions = {
    tools: Tool[];
    source?: string;
    agentKind?: "background" | "foreground";
    allowCronTools?: boolean;
    rlm?: boolean;
    rlmToolDescription?: string;
    noTools?: boolean;
    connectorRegistry: Pick<ConnectorRegistry, "get" | "list">;
    imageRegistry: Pick<ImageGenerationRegistry, "list">;
};

const BACKGROUND_TOOL_DENYLIST = new Set(["set_reaction", "send_file", "agent_reset", "agent_compact"]);

const FOREGROUND_TOOL_DENYLIST = new Set(["send_user_message"]);

/**
 * Builds the tool list for an agent context based on connector capabilities.
 * Expects: tool names are unique; connector registry is available for capability checks.
 */
export function toolListContextBuild(options: ToolListOptions): Tool[] {
    if (options.noTools) {
        return [];
    }

    if (options.rlm) {
        return toolListRlmBuild(options.tools, options.rlmToolDescription);
    }

    const source = options.source;
    let tools = options.tools;
    if (options.agentKind === "background") {
        tools = tools.filter((tool) => !BACKGROUND_TOOL_DENYLIST.has(tool.name));
    }
    if (options.agentKind === "foreground") {
        tools = tools.filter((tool) => !FOREGROUND_TOOL_DENYLIST.has(tool.name));
    }
    const connectorCapabilities = source ? (options.connectorRegistry.get(source)?.capabilities ?? null) : null;
    const supportsFiles = source
        ? (connectorCapabilities?.sendFiles?.modes.length ?? 0) > 0
        : options.connectorRegistry
              .list()
              .some((id) => (options.connectorRegistry.get(id)?.capabilities.sendFiles?.modes.length ?? 0) > 0);
    const supportsReactions = source
        ? connectorCapabilities?.reactions === true
        : options.connectorRegistry
              .list()
              .some((id) => options.connectorRegistry.get(id)?.capabilities.reactions === true);

    let filtered = tools;
    if (options.imageRegistry.list().length === 0) {
        filtered = filtered.filter((tool) => tool.name !== "generate_image");
    }
    return toolListFilterConnectorCapabilities(filtered, supportsFiles, supportsReactions);
}

function toolListRlmBuild(tools: Tool[], rlmToolDescription?: string): Tool[] {
    const runPython = tools.find((tool) => tool.name === RLM_TOOL_NAME);
    if (!runPython) {
        return [];
    }

    const result: Tool[] = [
        {
            ...runPython,
            description: rlmToolDescription ?? runPython.description
        }
    ];

    const skip = tools.find((tool) => tool.name === SKIP_TOOL_NAME);
    if (skip) {
        result.push(skip);
    }

    return result;
}

function toolListFilterConnectorCapabilities<T extends { name: string }>(
    tools: T[],
    supportsFiles: boolean,
    supportsReactions: boolean
): T[] {
    let filtered: T[] = tools;
    if (!supportsFiles) {
        filtered = filtered.filter((tool) => tool.name !== "send_file");
    }
    if (!supportsReactions) {
        filtered = filtered.filter((tool) => tool.name !== "set_reaction");
    }
    return filtered;
}
