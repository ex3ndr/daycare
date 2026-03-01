export type AgentPath = string & { readonly __brand: unique symbol };

/**
 * Casts a validated path string to the AgentPath branded type.
 * Expects: raw is an absolute slash-prefixed path with at least two segments.
 */
export function agentPath(raw: string): AgentPath {
    const normalized = raw.trim();
    if (!normalized.startsWith("/")) {
        throw new Error(`Agent path must start with '/': ${raw}`);
    }
    if (normalized.includes("//")) {
        throw new Error(`Agent path must not include empty segments: ${raw}`);
    }
    const segments = normalized.split("/").filter((segment) => segment.length > 0);
    if (segments.length < 2) {
        throw new Error(`Agent path must include at least two segments: ${raw}`);
    }
    if (normalized.endsWith("/")) {
        throw new Error(`Agent path must not have a trailing slash: ${raw}`);
    }
    return normalized as AgentPath;
}
