import path from "node:path";

export type PathRealResolveInput = {
    homeDir: string;
    workingDir: string;
    targetPath: string;
};

/**
 * Resolves a user path into an absolute POSIX path.
 * Supports absolute paths, working-dir relative paths, and home-relative `~` / `~/...` paths.
 * Expects: homeDir and workingDir are absolute POSIX paths; targetPath is non-empty.
 */
export function pathRealResolve(input: PathRealResolveInput): string {
    pathAbsoluteEnsure(input.homeDir, "homeDir");
    pathAbsoluteEnsure(input.workingDir, "workingDir");
    if (input.targetPath.length === 0) {
        throw new Error("targetPath is required.");
    }

    const homeDir = path.posix.resolve(input.homeDir);
    const workingDir = path.posix.resolve(input.workingDir);
    const targetPath = input.targetPath;

    if (targetPath === "~") {
        return homeDir;
    }

    if (targetPath.startsWith("~/")) {
        const homeRelative = targetPath.slice(2).replace(/^\/+/, "");
        return homeRelative.length === 0 ? homeDir : path.posix.resolve(homeDir, homeRelative);
    }

    if (path.posix.isAbsolute(targetPath)) {
        return path.posix.resolve(targetPath);
    }

    return path.posix.resolve(workingDir, targetPath);
}

function pathAbsoluteEnsure(value: string, name: string): void {
    if (!path.posix.isAbsolute(value)) {
        throw new Error(`${name} must be an absolute POSIX path.`);
    }
}
