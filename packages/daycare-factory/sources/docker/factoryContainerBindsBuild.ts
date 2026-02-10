import type { FactoryBuildPaths, FactoryConfigResolved } from "../types.js";

/**
 * Builds docker bind mount strings for task input and output folders.
 * Expects: host paths are absolute and container mount paths are absolute paths.
 */
export function factoryContainerBindsBuild(
  paths: FactoryBuildPaths,
  config: FactoryConfigResolved
): string[] {
  return [
    `${paths.taskFilePath}:${config.taskMountPath}:ro`,
    `${paths.outDirectory}:${config.outMountPath}`
  ];
}
