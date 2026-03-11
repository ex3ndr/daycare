export type SkillSource = "core" | "config" | "plugin" | "user" | "agents" | "builtin";

export type SkillListItem = {
    id: string;
    name: string;
    category: string | null;
    description: string | null;
    sandbox: boolean;
    permissions: string[];
    source: SkillSource;
    pluginId?: string;
};
