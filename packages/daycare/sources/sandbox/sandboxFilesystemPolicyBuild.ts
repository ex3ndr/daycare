import path from "node:path";

import { sandboxAppsDenyPathsBuild } from "./sandboxAppsDenyPathsBuild.js";
import { sandboxSensitiveDenyPathsBuild } from "./sandboxSensitiveDenyPathsBuild.js";

type SandboxFilesystemPolicyBuildInput = {
    writeDirs: string[];
    workingDir?: string;
    homeDir?: string;
    platform?: NodeJS.Platform;
};

type SandboxFilesystemPolicy = {
    denyRead: string[];
    allowWrite: string[];
    denyWrite: string[];
};

/**
 * Builds sandbox filesystem policy with a default sensitive-path deny list.
 * Expects: permissions paths are already absolute and normalized.
 */
export function sandboxFilesystemPolicyBuild(input: SandboxFilesystemPolicyBuildInput): SandboxFilesystemPolicy {
    const allowWrite = dedupeResolvedPaths([...input.writeDirs]);

    const denyRead = dedupeResolvedPaths([
        ...sandboxSensitiveDenyPathsBuild({
            homeDir: input.homeDir,
            platform: input.platform
        }),
        ...sandboxAppsDenyPathsBuild({
            workingDir: input.workingDir ?? ""
        })
    ]);

    return {
        denyRead,
        allowWrite,
        // Keep read/write denials aligned to prevent both data exfiltration and tampering.
        denyWrite: [...denyRead]
    };
}

function dedupeResolvedPaths(values: string[]): string[] {
    const resolved = values
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((entry) => path.resolve(entry));
    return Array.from(new Set(resolved));
}
