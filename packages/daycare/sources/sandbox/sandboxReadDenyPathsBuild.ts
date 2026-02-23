import os from "node:os";
import path from "node:path";

import { DEFAULT_DAYCARE_DIR } from "../paths.js";
import { sandboxSensitiveDenyPathsBuild } from "./sandboxSensitiveDenyPathsBuild.js";

type SandboxReadDenyPathsBuildInput = {
    homeDir?: string;
    platform?: NodeJS.Platform;
    osHomeDir?: string;
    daycareConfigDir?: string;
};

/**
 * Builds read deny paths for sandbox checks.
 * Expects: paths are absolute or resolvable, and includes hard-deny OS home/config roots.
 */
export function sandboxReadDenyPathsBuild(input: SandboxReadDenyPathsBuildInput = {}): string[] {
    const osHomeDir = path.resolve(input.osHomeDir ?? os.homedir());
    const daycareConfigDir = path.resolve(input.daycareConfigDir ?? DEFAULT_DAYCARE_DIR);

    return dedupeResolvedPaths([
        ...sandboxSensitiveDenyPathsBuild({
            homeDir: input.homeDir,
            platform: input.platform
        }),
        osHomeDir,
        daycareConfigDir
    ]);
}

function dedupeResolvedPaths(values: string[]): string[] {
    const resolved = values
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((entry) => path.resolve(entry));
    return Array.from(new Set(resolved));
}
