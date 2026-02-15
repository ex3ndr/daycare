import type { Tool } from "@mariozechner/pi-ai";
import type { AgentSkill } from "@/types";

import type { ConnectorRegistry } from "../connectorRegistry.js";
import type { ImageGenerationRegistry } from "../imageGenerationRegistry.js";
import { RLM_TOOL_NAME } from "../rlm/rlmConstants.js";
import { rlmToolDescriptionBuild } from "../rlm/rlmToolDescriptionBuild.js";

type ToolListOptions = {
  tools: Tool[];
  skills?: AgentSkill[];
  source?: string;
  agentKind?: "background" | "foreground";
  allowCronTools?: boolean;
  rlm?: boolean;
  connectorRegistry: Pick<ConnectorRegistry, "get" | "list">;
  imageRegistry: Pick<ImageGenerationRegistry, "list">;
};

const BACKGROUND_TOOL_DENYLIST = new Set([
  "set_reaction",
  "send_file"
]);

/**
 * Builds the tool list for an agent context based on connector capabilities.
 * Expects: tool names are unique; connector registry is available for capability checks.
 */
export function toolListContextBuild(options: ToolListOptions): Tool[] {
  if (options.rlm) {
    return toolListRlmBuild(options.tools, options.skills ?? []);
  }

  const source = options.source;
  let tools = options.tools;
  if (source && source !== "cron" && !options.allowCronTools) {
    tools = tools.filter(
      (tool) => tool.name !== "cron_read_memory" && tool.name !== "cron_write_memory"
    );
  }
  if (options.agentKind === "background") {
    tools = tools.filter((tool) => !BACKGROUND_TOOL_DENYLIST.has(tool.name));
  }
  const connectorCapabilities = source
    ? options.connectorRegistry.get(source)?.capabilities ?? null
    : null;
  const supportsFiles = source
    ? (connectorCapabilities?.sendFiles?.modes.length ?? 0) > 0
    : options
        .connectorRegistry
        .list()
        .some(
          (id) =>
            (options.connectorRegistry.get(id)?.capabilities.sendFiles?.modes.length ?? 0) > 0
        );
  const supportsReactions = source
    ? connectorCapabilities?.reactions === true
    : options
        .connectorRegistry
        .list()
        .some((id) => options.connectorRegistry.get(id)?.capabilities.reactions === true);

  let filtered = tools;
  if (options.imageRegistry.list().length === 0) {
    filtered = filtered.filter((tool) => tool.name !== "generate_image");
  }
  return toolListFilterConnectorCapabilities(filtered, supportsFiles, supportsReactions);
}

function toolListRlmBuild(tools: Tool[], skills: AgentSkill[]): Tool[] {
  const runPython = tools.find((tool) => tool.name === RLM_TOOL_NAME);
  if (!runPython) {
    return [];
  }

  return [
    {
      ...runPython,
      description: rlmToolDescriptionBuild(tools, skills)
    }
  ];
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
