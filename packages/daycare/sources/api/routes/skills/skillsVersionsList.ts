import type { AgentSkill } from "../../../engine/skills/skillTypes.js";
import { skillVersionStateRead } from "../../../engine/skills/skillVersionStateRead.js";

export type SkillsVersionsListInput = {
    skillId: string;
    personalRoot: string;
    historyRoot: string;
    skills: {
        list: () => Promise<AgentSkill[]>;
    };
};

export type SkillsVersionsListResult =
    | {
          ok: true;
          skillId: string;
          skillName: string;
          currentVersion: number | null;
          previousVersions: Array<{
              version: number;
              updatedAt: number;
          }>;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Lists archived versions for one user skill by catalog id.
 * Expects: skillId refers to a current user skill from the authenticated caller's catalog.
 */
export async function skillsVersionsList(input: SkillsVersionsListInput): Promise<SkillsVersionsListResult> {
    const listed = await input.skills.list();
    const skill = listed.find((entry) => entry.id === input.skillId);
    if (!skill) {
        return { ok: false, error: "Skill not found." };
    }
    if (skill.source !== "user") {
        return { ok: false, error: "Only user skills have version history." };
    }

    const state = await skillVersionStateRead({
        personalRoot: input.personalRoot,
        historyRoot: input.historyRoot,
        skillName: skill.name
    });
    return {
        ok: true,
        skillId: skill.id,
        skillName: skill.name,
        currentVersion: state.currentVersion,
        previousVersions: state.previousVersions.map((entry) => ({
            version: entry.version,
            updatedAt: entry.updatedAt
        }))
    };
}
