import path from "node:path";

import { skillResolve } from "./skillResolve.js";
import { skillSort } from "./skillSort.js";
import type { AgentSkill, PluginSkillRegistration } from "./skillTypes.js";

/**
 * Lists skills registered by plugins, de-duping identical plugin/path entries.
 *
 * Expects: registration paths can be relative; they are resolved before lookup.
 */
export async function skillListRegistered(
  registrations: PluginSkillRegistration[]
): Promise<AgentSkill[]> {
  const skills: AgentSkill[] = [];
  const seen = new Set<string>();

  for (const registration of registrations) {
    const resolvedPath = path.resolve(registration.path);
    const key = `${registration.pluginId}:${resolvedPath}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const skill = await skillResolve(resolvedPath, {
      source: "plugin",
      pluginId: registration.pluginId
    });
    if (skill) {
      skills.push(skill);
    }
  }

  return skillSort(skills);
}
