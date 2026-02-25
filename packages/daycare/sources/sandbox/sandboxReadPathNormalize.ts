const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
const CONTAINER_HOME_DIR = "/home";

/**
 * Normalizes sandbox read paths and expands `~` for host or container mode.
 * Expects: rawPath is user-provided; hostHomeDir is absolute.
 */
export function sandboxReadPathNormalize(rawPath: string, hostHomeDir: string, useContainerHome = false): string {
    const withoutAtPrefix = rawPath.startsWith("@") ? rawPath.slice(1) : rawPath;
    const normalized = withoutAtPrefix.replace(UNICODE_SPACES, " ");
    const homeDir = useContainerHome ? CONTAINER_HOME_DIR : hostHomeDir;
    if (normalized === "~") {
        return homeDir;
    }
    if (normalized.startsWith("~/")) {
        return homeDir + normalized.slice(1);
    }
    return normalized;
}
