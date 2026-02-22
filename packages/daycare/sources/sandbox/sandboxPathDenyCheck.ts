import fs from "node:fs";
import path from "node:path";

import { isWithinSecure } from "./pathResolveSecure.js";

/**
 * Checks whether a target path is contained in any denied directory path.
 * Expects: target and denyPaths are absolute or resolvable paths.
 */
export function sandboxPathDenyCheck(target: string, denyPaths: string[]): boolean {
    const resolvedTarget = existingPathResolve(target);
    for (const denyPath of denyPaths) {
        if (isWithinSecure(existingPathResolve(denyPath), resolvedTarget)) {
            return true;
        }
    }
    return false;
}

function existingPathResolve(target: string): string {
    const resolved = path.resolve(target);
    try {
        return fs.realpathSync(resolved);
    } catch {
        return resolved;
    }
}
