import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolves the bundled core tasks directory from the source tree.
 * Expects: called from the packaged Daycare sources.
 */
export function taskCoreRootResolve(): string {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../core-tasks");
}
