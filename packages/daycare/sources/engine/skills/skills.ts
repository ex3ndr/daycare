import type { AgentSkill } from "@/types";
import type { PluginManager } from "../plugins/manager.js";

import { skillListConfig } from "./skillListConfig.js";
import { skillListCore } from "./skillListCore.js";
import { skillListRegistered } from "./skillListRegistered.js";
import { skillListUser } from "./skillListUser.js";

type SkillsOptions = {
  configRoot: string;
  pluginManager: Pick<PluginManager, "listRegisteredSkills">;
};

/**
 * Coordinates loading skill metadata from all supported roots.
 * Expects: pluginManager can list currently registered plugin skills.
 */
export class Skills {
  private readonly configRoot: string;
  private readonly pluginManager: Pick<PluginManager, "listRegisteredSkills">;

  constructor(options: SkillsOptions) {
    this.configRoot = options.configRoot;
    this.pluginManager = options.pluginManager;
  }

  async list(): Promise<AgentSkill[]> {
    const [coreSkills, configSkills, userSkills, pluginSkills] = await Promise.all([
      skillListCore(),
      skillListConfig(this.configRoot),
      skillListUser(),
      skillListRegistered(this.pluginManager.listRegisteredSkills())
    ]);
    return [...coreSkills, ...configSkills, ...userSkills, ...pluginSkills];
  }
}
