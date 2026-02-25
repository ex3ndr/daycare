import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolves the host-side absolute path to the bundled examples directory.
 * Expects: called from the built package where examples/ is a sibling of prompts/.
 */
export function bundledExamplesDirResolve(): string {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../examples");
}
