import path from "node:path";

export type PathRealDisplayInput = {
    homeDir: string;
    targetPath: string;
};

/**
 * Converts an absolute POSIX path into a user-facing path form.
 * Returns home-relative `~`/`~/...` when under home, else absolute path.
 * Expects: homeDir and targetPath are absolute POSIX paths.
 */
export function pathRealDisplay(input: PathRealDisplayInput): string {
    pathAbsoluteEnsure(input.homeDir, "homeDir");
    pathAbsoluteEnsure(input.targetPath, "targetPath");

    const homeDir = path.posix.resolve(input.homeDir);
    const targetPath = path.posix.resolve(input.targetPath);

    if (pathWithin(homeDir, targetPath)) {
        const relative = path.posix.relative(homeDir, targetPath);
        return relative.length > 0 ? `~/${relative}` : "~";
    }

    return targetPath;
}

function pathAbsoluteEnsure(value: string, name: string): void {
    if (!path.posix.isAbsolute(value)) {
        throw new Error(`${name} must be an absolute POSIX path.`);
    }
}

function pathWithin(base: string, target: string): boolean {
    const relative = path.posix.relative(base, target);
    return relative.length === 0 || (!relative.startsWith("..") && !path.posix.isAbsolute(relative));
}
