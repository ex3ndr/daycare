import os from "node:os";
import path from "node:path";

import Handlebars from "handlebars";

import { skillPromptFormat } from "../../skills/skillPromptFormat.js";
import { Skills } from "../../skills/skills.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders skills by loading dynamic skill definitions from config and plugins.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionSkills(context: AgentSystemPromptContext): Promise<string> {
    const configDir = context.agentSystem?.config?.current.configDir ?? "";
    const skillsPrompt = await (async () => {
        if (!configDir) {
            return "";
        }
        const configSkillsRoot = path.join(configDir, "skills");
        const pluginManager = context.agentSystem?.pluginManager ?? { listRegisteredSkills: () => [] };
        const skills = new Skills({
            configRoot: configSkillsRoot,
            pluginManager,
            userPersonalRoot: context.userHome?.skillsPersonal,
            userActiveRoot: context.userHome?.skillsActive,
            agentsRoot: path.join(os.homedir(), ".agents", "skills")
        });
        return skillPromptFormat(await skills.list());
    })();

    const template = await agentPromptBundledRead("SYSTEM_SKILLS.md");
    const section = Handlebars.compile(template)({}).trim();
    const dynamicSkills = skillsPrompt.trim();
    return [section, dynamicSkills]
        .filter((part) => part.length > 0)
        .join("\n\n")
        .trim();
}
