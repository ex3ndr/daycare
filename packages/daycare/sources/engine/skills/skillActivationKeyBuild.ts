/**
 * Builds a filesystem-safe activation key from a stable skill id.
 * Expects: skillId is a non-empty string and sanitizes to a safe path segment.
 */
export function skillActivationKeyBuild(skillId: string): string {
    const trimmed = skillId.trim();
    if (trimmed.length === 0) {
        throw new Error("Skill id is required.");
    }

    const replaced = trimmed.replaceAll(":", "--").replaceAll("/", "--");
    const sanitized = replaced.replaceAll(/[^a-zA-Z0-9._-]/g, "");
    if (sanitized.length === 0) {
        throw new Error(`Skill activation key is empty for id: ${skillId}`);
    }
    if (sanitized === "." || sanitized === "..") {
        throw new Error(`Skill activation key is invalid for id: ${skillId}`);
    }
    return sanitized;
}
