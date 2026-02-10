import { resolve } from "node:path";
import type { FactoryBuildPaths } from "../types.js";

/**
 * Resolves task, config, and output paths for a build run.
 * Expects: taskDirectory exists; config and out paths may be relative to taskDirectory.
 */
export function factoryBuildPathsResolve(
  taskDirectory: string,
  configPath: string,
  outPath: string
): FactoryBuildPaths {
  const taskDirectoryResolved = resolve(taskDirectory);

  return {
    taskDirectory: taskDirectoryResolved,
    taskFilePath: resolve(taskDirectoryResolved, "TASK.md"),
    configPath: resolve(taskDirectoryResolved, configPath),
    outDirectory: resolve(taskDirectoryResolved, outPath)
  };
}
