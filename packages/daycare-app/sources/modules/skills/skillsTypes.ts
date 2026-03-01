export type SkillSource = "builtin" | "plugin" | "user";

export type SkillListItem = {
    id: string;
    name: string;
    description: string | null;
    sandbox: boolean;
    permissions: string[];
    source: SkillSource;
    pluginId?: string;
};
