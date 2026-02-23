const DEFAULT_CONTAINER_SUFFIX = "user";

/**
 * Builds a stable Docker container name for a sandbox user.
 * Expects: userId is stable across the user's agent sessions.
 */
export function dockerContainerNameBuild(userId: string): string {
    const suffix = userId
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "");

    const safeSuffix = suffix.length > 0 ? suffix : DEFAULT_CONTAINER_SUFFIX;
    return `daycare-sandbox-${safeSuffix}`;
}
