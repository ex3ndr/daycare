import { getLogger } from "../../../log.js";
import { agentPromptResolve } from "./agentPromptResolve.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";
import { agentSystemPromptSectionAgentsTopologySignalsChannels } from "./agentSystemPromptSectionAgentsTopologySignalsChannels.js";
import { agentSystemPromptSectionAutonomousOperation } from "./agentSystemPromptSectionAutonomousOperation.js";
import { agentSystemPromptSectionEnvironment } from "./agentSystemPromptSectionEnvironment.js";
import { agentSystemPromptSectionFormatting } from "./agentSystemPromptSectionFormatting.js";
import { agentSystemPromptSectionMemory } from "./agentSystemPromptSectionMemory.js";
import { agentSystemPromptSectionModels } from "./agentSystemPromptSectionModels.js";
import { agentSystemPromptSectionPermissions } from "./agentSystemPromptSectionPermissions.js";
import { agentSystemPromptSectionPlugins } from "./agentSystemPromptSectionPlugins.js";
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
export async function agentSystemPrompt(context: AgentSystemPromptContext): Promise<string> {
    context.systemPromptImages = agentSystemPromptImagesResolve(context);
    const agentPromptSection = context.path
        ? await agentPromptResolve(context.path, context.config)
        : { agentPrompt: "", replaceSystemPrompt: false };
    if (agentPromptSection.replaceSystemPrompt) {
        const replaced = agentPromptSection.agentPrompt.trim();
        if (!replaced) {
            throw new Error("System prompt replacement requires a non-empty agent prompt.");
        }
        const [pluginSection, toolSection, skillsSection] = await Promise.all([
            agentSystemPromptSectionPlugins(context),
            agentSystemPromptSectionToolCalling(context),
            agentSystemPromptSectionSkills(context)
        ]);
        return [replaced, pluginSection.trim(), toolSection.trim(), skillsSection.trim()]
            .filter((section) => section.length > 0)
            .join(SECTION_SEPARATOR)
            .trim();
    }

    logger.debug("event: buildSystemPrompt rendering sections");
    const renderedSections = await Promise.all([
        agentSystemPromptSectionPreamble(context),
        agentSystemPromptSectionAutonomousOperation(context),
        agentSystemPromptSectionPermissions(context),
        agentSystemPromptSectionToolCalling(context),
        agentSystemPromptSectionAgentsTopologySignalsChannels(context),
        agentSystemPromptSectionPlugins(context),
        agentSystemPromptSectionSkills(context),
        agentSystemPromptSectionFormatting(context),
        agentSystemPromptSectionMemory(context),
        agentSystemPromptSectionEnvironment(context),
        agentSystemPromptSectionModels(context)
    ]);

    const allSections = [...renderedSections];
    if (context.extraSections) {
        for (const extra of context.extraSections) {
            allSections.push(extra);
        }
    }

    return allSections
        .map((section) => section.trim())
        .filter((section) => section.length > 0)
        .join(SECTION_SEPARATOR)
        .trim();
}

function agentSystemPromptImagesResolve(context: AgentSystemPromptContext): string[] | undefined {
    const images = (context.pluginPrompts ?? [])
        .flatMap((prompt) => prompt.images ?? [])
        .map((imagePath) => imagePath.trim())
        .filter((imagePath) => imagePath.length > 0);
    if (images.length === 0) {
        return undefined;
    }
    return Array.from(new Set(images));
}
