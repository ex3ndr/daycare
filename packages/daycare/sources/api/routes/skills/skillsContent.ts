import { promises as fs } from "node:fs";
import type { AgentSkill } from "@/types";

export type SkillsContentInput = {
    skillId: string;
    skills: {
        list: () => Promise<AgentSkill[]>;
    };
};

export type SkillsContentResult =
    | {
          ok: true;
          skill: {
              id: string;
              name: string;
              description: string | null;
          };
          content: string;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Resolves one skill by id and returns its markdown source content.
 * Expects: skill id is a non-empty string.
 */
export async function skillsContent(input: SkillsContentInput): Promise<SkillsContentResult> {
    const skillId = input.skillId.trim();
    if (!skillId) {
        return { ok: false, error: "skillId is required." };
    }

    const listed = await input.skills.list();
    const skill = listed.find((entry) => entry.id === skillId);
    if (!skill) {
        return { ok: false, error: "Skill not found." };
    }

    try {
        const content = await fs.readFile(skill.sourcePath, "utf8");
        return {
            ok: true,
            skill: {
                id: skill.id,
                name: skill.name,
                description: skill.description ?? null
            },
            content
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to read skill content.";
        return { ok: false, error: message };
    }
}
