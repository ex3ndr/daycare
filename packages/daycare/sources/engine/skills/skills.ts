import os from "node:os";
import path from "node:path";
import type { AgentSkill } from "@/types";
import type { PluginManager } from "../plugins/manager.js";
import { skillActivationSync } from "./skillActivationSync.js";
import { skillListAgents } from "./skillListAgents.js";
import { skillListConfig } from "./skillListConfig.js";
import { skillListCore } from "./skillListCore.js";
import { skillListRegistered } from "./skillListRegistered.js";
import { skillListUser } from "./skillListUser.js";

type SkillsOptions = {
    configRoot: string;
    pluginManager: Pick<PluginManager, "listRegisteredSkills">;
    userPersonalRoot?: string;
    userActiveRoot?: string;
    agentsRoot?: string;
};

/**
 * Coordinates loading skill metadata from all supported roots.
 * Expects: pluginManager can list currently registered plugin skills.
 */
export class Skills {
    private readonly configRoot: string;
    private readonly pluginManager: Pick<PluginManager, "listRegisteredSkills">;
    private readonly userPersonalRoot: string | undefined;
    private readonly userActiveRoot: string | undefined;
    private readonly agentsRoot: string;

    constructor(options: SkillsOptions) {
        this.configRoot = options.configRoot;
        this.pluginManager = options.pluginManager;
        this.userPersonalRoot = options.userPersonalRoot;
        this.userActiveRoot = options.userActiveRoot;
        this.agentsRoot = options.agentsRoot ?? path.join(os.homedir(), ".agents", "skills");
    }

    async list(): Promise<AgentSkill[]> {
        const [coreSkills, configSkills, userSkills, pluginSkills, agentsSkills] = await Promise.all([
            skillListCore(),
            skillListConfig(this.configRoot),
            this.userPersonalRoot ? skillListUser(this.userPersonalRoot) : Promise.resolve([]),
            skillListRegistered(this.pluginManager.listRegisteredSkills()),
            skillListAgents(this.agentsRoot)
        ]);
        return [...coreSkills, ...configSkills, ...userSkills, ...pluginSkills, ...agentsSkills];
    }

    async syncToActive(activeRoot?: string, listedSkills?: AgentSkill[]): Promise<void> {
        const resolvedActiveRoot = activeRoot ?? this.userActiveRoot;
        if (!resolvedActiveRoot) {
            return;
        }
        const skills = listedSkills ?? (await this.list());
        await skillActivationSync(skills, resolvedActiveRoot);
    }
}
