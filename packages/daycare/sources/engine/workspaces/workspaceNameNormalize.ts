const WORKSPACE_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/;

/**
 * Normalizes and validates a workspace name for tool and nametag usage.
 * Expects: lowercase letters, numbers, hyphen, underscore; max 80 chars.
 */
export function workspaceNameNormalize(name: string): string {
    const normalized = name.trim().toLowerCase();
    if (!WORKSPACE_NAME_PATTERN.test(normalized)) {
        throw new Error(
            "Workspace name must be username-style: lowercase letters, numbers, hyphen, underscore (max 80 chars)."
        );
    }
    return normalized;
}
