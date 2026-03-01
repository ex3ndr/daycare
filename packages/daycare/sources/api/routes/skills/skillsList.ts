import type { AgentSkill } from "@/types";

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
        description: string | null;
        sandbox: boolean;
        permissions: string[];
        source: AgentSkill["source"];
        pluginId?: string;
    }>;
};

/**
 * Lists available skills while omitting internal sourcePath details.
 * Expects: skills facade is initialized and list() resolves metadata entries.
 */
export async function skillsList(input: SkillsListInput): Promise<SkillsListResult> {
    const listed = await input.skills.list();
    return {
        ok: true,
        skills: listed.map((skill) => ({
            id: skill.id,
            name: skill.name,
            description: skill.description ?? null,
            sandbox: skill.sandbox === true,
            permissions: skill.permissions ?? [],
            source: skill.source,
            ...(skill.pluginId ? { pluginId: skill.pluginId } : {})
        }))
    };
}
