import { getLogger } from "../../../log.js";
import { agentPromptResolve } from "./agentPromptResolve.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";
import { agentSystemPromptSectionAgentsTopologySignalsChannels } from "./agentSystemPromptSectionAgentsTopologySignalsChannels.js";
import { agentSystemPromptSectionAutonomousOperation } from "./agentSystemPromptSectionAutonomousOperation.js";
import { agentSystemPromptSectionEnvironment } from "./agentSystemPromptSectionEnvironment.js";
import { agentSystemPromptSectionFormatting } from "./agentSystemPromptSectionFormatting.js";
import { agentSystemPromptSectionMemory } from "./agentSystemPromptSectionMemory.js";
import { agentSystemPromptSectionPermissions } from "./agentSystemPromptSectionPermissions.js";
import { agentSystemPromptSectionPreamble } from "./agentSystemPromptSectionPreamble.js";
import { agentSystemPromptSectionSkills } from "./agentSystemPromptSectionSkills.js";
import { agentSystemPromptSectionToolCalling } from "./agentSystemPromptSectionToolCalling.js";

const logger = getLogger("agent.prompt-build");
const SECTION_SEPARATOR = "\n\n---\n\n";

export type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Builds the system prompt by concatenating deterministic rendered sections.
 * Expects: section templates exist under engine/prompts.
 */
export async function agentSystemPrompt(context: AgentSystemPromptContext = {}): Promise<string> {
    const agentPromptSection = context.descriptor
        ? await agentPromptResolve(context.descriptor)
        : { agentPrompt: "", replaceSystemPrompt: false };
    if (agentPromptSection.replaceSystemPrompt) {
        const replaced = agentPromptSection.agentPrompt.trim();
        if (!replaced) {
            throw new Error("System prompt replacement requires a non-empty agent prompt.");
        }
        return replaced;
    }

    logger.debug("event: buildSystemPrompt rendering sections");
    const renderedSections = await Promise.all([
        agentSystemPromptSectionPreamble(context),
        agentSystemPromptSectionAutonomousOperation(context),
        agentSystemPromptSectionPermissions(context),
        agentSystemPromptSectionToolCalling(context),
        agentSystemPromptSectionAgentsTopologySignalsChannels(context),
        agentSystemPromptSectionSkills(context),
        agentSystemPromptSectionFormatting(context),
        agentSystemPromptSectionMemory(context),
        agentSystemPromptSectionEnvironment(context)
    ]);

    return renderedSections
        .map((section) => section.trim())
        .filter((section) => section.length > 0)
        .join(SECTION_SEPARATOR)
        .trim();
}
