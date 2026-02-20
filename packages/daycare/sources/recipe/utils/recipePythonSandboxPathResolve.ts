import path from "node:path";

/**
 * Resolves the sandbox directory for recipe python execution.
 * Returns: a writable directory under sources/recipe/.sandbox/<name>.
 */
export function recipePythonSandboxPathResolve(name: string): string {
    return path.resolve(process.cwd(), "sources", "recipe", ".sandbox", name);
}
