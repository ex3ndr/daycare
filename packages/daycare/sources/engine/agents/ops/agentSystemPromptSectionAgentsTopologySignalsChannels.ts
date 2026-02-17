import Handlebars from "handlebars";

import { agentPermanentList } from "./agentPermanentList.js";
import { agentPermanentPrompt } from "./agentPermanentPrompt.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders agent/collaboration/scheduling guidance from permanent-agent state.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionAgentsTopologySignalsChannels(
  context: AgentSystemPromptContext = {}
): Promise<string> {
  const config = context.agentSystem?.config?.current;
  const permanentAgentsPrompt = config
    ? agentPermanentPrompt(await agentPermanentList(config))
    : "";

  const template = await agentPromptBundledRead("SYSTEM_TOPOLOGY.md");
  const section = Handlebars.compile(template)({
    permanentAgentsPrompt
  });
  return section.trim();
}
