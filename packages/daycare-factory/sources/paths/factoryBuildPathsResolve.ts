import { resolve } from "node:path";
import type { FactoryBuildPaths } from "../types.js";

/**
 * Resolves task, environment, and output paths for a build run.
 * Expects: taskDirectory and environmentDirectory are different directories.
 */
export function factoryBuildPathsResolve(
    taskDirectory: string,
    environmentDirectory: string,
    configPath: string,
    outPath: string
): FactoryBuildPaths {
    const taskDirectoryResolved = resolve(taskDirectory);
    const environmentDirectoryResolved = resolve(environmentDirectory);

    if (taskDirectoryResolved === environmentDirectoryResolved) {
        throw new Error("task directory and environment directory must be different");
    }

    return {
        taskDirectory: taskDirectoryResolved,
        environmentDirectory: environmentDirectoryResolved,
        taskFilePath: resolve(taskDirectoryResolved, "TASK.md"),
        templateDirectory: resolve(environmentDirectoryResolved, "template"),
        configPath: resolve(environmentDirectoryResolved, configPath),
        outDirectory: resolve(taskDirectoryResolved, outPath)
    };
}
