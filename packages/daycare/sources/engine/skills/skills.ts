import type { AgentSkill } from "@/types";
import type { PluginSkillRegistration } from "./skillTypes.js";

import { skillListConfig } from "./skillListConfig.js";
import { skillListCore } from "./skillListCore.js";
import { skillListRegistered } from "./skillListRegistered.js";
import { skillListUser } from "./skillListUser.js";

type SkillsOptions = {
  configRoot: string;
  pluginSkillsList: () => PluginSkillRegistration[];
};

/**
 * Coordinates loading skill metadata from all supported roots.
 * Expects: pluginSkillsList returns current plugin registrations.
 */
export class Skills {
  private readonly configRoot: string;
  private readonly pluginSkillsList: () => PluginSkillRegistration[];

  constructor(options: SkillsOptions) {
    this.configRoot = options.configRoot;
    this.pluginSkillsList = options.pluginSkillsList;
  }

  async list(): Promise<AgentSkill[]> {
    const [coreSkills, configSkills, userSkills, pluginSkills] = await Promise.all([
      skillListCore(),
      skillListConfig(this.configRoot),
      skillListUser(),
      skillListRegistered(this.pluginSkillsList())
    ]);
    return [...coreSkills, ...configSkills, ...userSkills, ...pluginSkills];
  }
}
