import type { AgentSkill } from "./skillTypes.js";

/**
 * Orders skills by display name and path for stable prompt output.
 *
 * Expects: skills is any array; returns a new array sorted by name then path.
 */
export function skillSort(skills: AgentSkill[]): AgentSkill[] {
    return [...skills].sort((a, b) => {
        const nameSort = a.name.localeCompare(b.name);
        if (nameSort !== 0) {
            return nameSort;
        }
        return a.path.localeCompare(b.path);
    });
}
