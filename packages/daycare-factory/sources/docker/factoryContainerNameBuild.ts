import { basename } from "node:path";

/**
 * Builds a stable container name based on the task directory name.
 * Expects: taskDirectory is an absolute or relative path string.
 */
export function factoryContainerNameBuild(taskDirectory: string): string {
    const slug = basename(taskDirectory)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "");

    return `daycare-factory-${slug || "build"}`;
}
