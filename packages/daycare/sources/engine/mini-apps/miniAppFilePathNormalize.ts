import path from "node:path";

/**
 * Normalizes one mini-app-relative file path and rejects traversal or index collisions.
 * Expects: rawPath is user-provided and may use either slash separator.
 */
export function miniAppFilePathNormalize(rawPath: string): string {
    const normalized = rawPath.trim().split("\\").join("/");
    if (!normalized) {
        throw new Error("Mini app file path is required.");
    }
    if (normalized === "index.html") {
        throw new Error('Use the "html" field for index.html updates.');
    }
    const resolved = path.posix.normalize(`/${normalized}`);
    if (resolved === "/" || resolved.endsWith("/")) {
        throw new Error(`Invalid mini app file path: ${rawPath}`);
    }
    if (resolved.includes("/../")) {
        throw new Error(`Mini app file path escapes app root: ${rawPath}`);
    }
    return resolved.slice(1);
}
