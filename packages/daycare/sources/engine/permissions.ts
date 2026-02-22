import path from "node:path";

export type SessionPermissions = {
    workingDir: string;
    writeDirs: string[];
    readDirs?: string[];
};

export function normalizePermissions(value: unknown, defaultWorkingDir: string): SessionPermissions {
    let writeDirs: string[] = [];
    let readDirs: string[] = [];
    if (value && typeof value === "object") {
        const candidate = value as {
            workingDir?: unknown;
            writeDirs?: unknown;
            readDirs?: unknown;
        };
        if (typeof candidate.workingDir === "string" && candidate.workingDir.trim().length > 0) {
            if (path.isAbsolute(candidate.workingDir)) {
                if (Array.isArray(candidate.writeDirs)) {
                    writeDirs = candidate.writeDirs
                        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
                        .map((entry) => entry.trim())
                        .filter((entry) => path.isAbsolute(entry))
                        .map((entry) => path.resolve(entry));
                }
                if (Array.isArray(candidate.readDirs)) {
                    readDirs = candidate.readDirs
                        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
                        .map((entry) => entry.trim())
                        .filter((entry) => path.isAbsolute(entry))
                        .map((entry) => path.resolve(entry));
                }
                return {
                    workingDir: path.resolve(candidate.workingDir),
                    writeDirs: dedupe(writeDirs),
                    readDirs: dedupe(readDirs)
                };
            }
        }
    }
    return {
        workingDir: path.resolve(defaultWorkingDir),
        writeDirs: [],
        readDirs: []
    };
}

export function resolveWorkspacePath(workingDir: string, target: string): string {
    const resolved = path.resolve(workingDir, target);
    const relative = path.relative(workingDir, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("Path is outside the workspace.");
    }
    return resolved;
}

function dedupe(values: string[]): string[] {
    return Array.from(new Set(values));
}
