import type { AgentSkill } from "@/types";
import { type SkillFileMetadata, skillsFilesList } from "./skillsFilesList.js";

export type SkillsListInput = {
    skills: {
        list: () => Promise<AgentSkill[]>;
    };
};

export type SkillsListResult = {
    ok: true;
    skills: Array<{
        id: string;
        name: string;
        category: string | null;
        description: string | null;
        sandbox: boolean;
        permissions: string[];
        source: AgentSkill["source"];
        pluginId?: string;
        files: SkillFileMetadata[];
    }>;
};

/**
 * Lists available skills while omitting internal sourcePath details.
 * Expects: skills facade is initialized and list() resolves metadata entries.
 */
export async function skillsList(input: SkillsListInput): Promise<SkillsListResult> {
    const listed = await input.skills.list();
    const skills = await Promise.all(
        listed.map(async (skill) => ({
            id: skill.id,
            name: skill.name,
            category: skill.category ?? null,
            description: skill.description ?? null,
            sandbox: skill.sandbox === true,
            permissions: skill.permissions ?? [],
            source: skill.source,
            ...(skill.pluginId ? { pluginId: skill.pluginId } : {}),
            files: await skillsFilesList({
                skillId: skill.id,
                sourcePath: skill.sourcePath
            })
        }))
    );
    return {
        ok: true,
        skills
    };
}
