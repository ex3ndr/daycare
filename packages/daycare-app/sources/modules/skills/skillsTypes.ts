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

export type SkillVersionItem = {
    version: number;
    updatedAt: number;
};

export type SkillVersionsResult = {
    skillId: string;
    skillName: string;
    currentVersion: number | null;
    previousVersions: SkillVersionItem[];
};
