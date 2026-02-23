import os from "node:os";
import path from "node:path";

import { DEFAULT_DAYCARE_DIR } from "../paths.js";

type SandboxReadBoundaryDenyPathsBuildInput = {
    osHomeDir?: string;
    daycareConfigDir?: string;
};

/**
 * Builds broad read boundary deny paths.
 * Expects: these roots may be bypassed only by explicit read allowlists.
 */
export function sandboxReadBoundaryDenyPathsBuild(input: SandboxReadBoundaryDenyPathsBuildInput = {}): string[] {
    const osHomeDir = path.resolve(input.osHomeDir ?? os.homedir());
    const daycareConfigDir = path.resolve(input.daycareConfigDir ?? DEFAULT_DAYCARE_DIR);

    return dedupeResolvedPaths([osHomeDir, daycareConfigDir]);
}

function dedupeResolvedPaths(values: string[]): string[] {
    const resolved = values
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((entry) => path.resolve(entry));
    return Array.from(new Set(resolved));
}
