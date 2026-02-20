import os from "node:os";
import path from "node:path";

/**
 * Resolves the default recipe auth file path.
 * Returns: ~/.dev/auth.json.
 */
export function recipeAuthPathResolve(): string {
    return path.join(os.homedir(), ".dev", "auth.json");
}
