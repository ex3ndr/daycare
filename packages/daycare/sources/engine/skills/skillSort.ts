import type { AgentSkill } from "./skillTypes.js";

/**
 * Orders skills by display name and source path for stable prompt output.
 *
 * Expects: skills is any array; returns a new array sorted by name then source path.
 */
export function skillSort(skills: AgentSkill[]): AgentSkill[] {
    return [...skills].sort((a, b) => {
        const categorySort = skillCategoryCompare(a.category, b.category);
        if (categorySort !== 0) {
            return categorySort;
        }
        const nameSort = a.name.localeCompare(b.name);
        if (nameSort !== 0) {
            return nameSort;
        }
        return a.sourcePath.localeCompare(b.sourcePath);
    });
}

function skillCategoryCompare(a: string | null | undefined, b: string | null | undefined): number {
    if (a && b) {
        return a.localeCompare(b);
    }
    if (a) {
        return -1;
    }
    if (b) {
        return 1;
    }
    return 0;
}
