/**
 * Skill metadata exposed to agents and system prompts.
 */
export type AgentSkill = {
    id: string;
    name: string;
    description?: string | null;
    sandbox?: boolean;
    permissions?: string[];
    path: string;
    source: "core" | "config" | "plugin" | "user";
    pluginId?: string;
};

/**
 * Plugin registration entry for skills bundled by a plugin.
 */
export type PluginSkillRegistration = {
    pluginId: string;
    path: string;
};

/**
 * Source metadata for a skill lookup.
 */
export type SkillSource =
    | { source: "core"; root?: string }
    | { source: "config"; root?: string }
    | { source: "user"; root?: string }
    | { source: "plugin"; pluginId: string };
