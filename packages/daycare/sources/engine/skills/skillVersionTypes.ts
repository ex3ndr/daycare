export type SkillVersionEntry = {
    version: number;
    path: string;
    updatedAt: number;
};

export type SkillVersionState = {
    skillName: string;
    currentPath: string;
    existingCurrentPath: string | null;
    currentVersion: number | null;
    nextVersion: number;
    previousVersions: SkillVersionEntry[];
};
