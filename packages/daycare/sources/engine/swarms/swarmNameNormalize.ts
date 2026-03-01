const SWARM_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/;

/**
 * Normalizes and validates a swarm name for tool and nametag usage.
 * Expects: lowercase letters, numbers, hyphen, underscore; max 80 chars.
 */
export function swarmNameNormalize(name: string): string {
    const normalized = name.trim().toLowerCase();
    if (!SWARM_NAME_PATTERN.test(normalized)) {
        throw new Error(
            "Swarm name must be username-style: lowercase letters, numbers, hyphen, underscore (max 80 chars)."
        );
    }
    return normalized;
}
