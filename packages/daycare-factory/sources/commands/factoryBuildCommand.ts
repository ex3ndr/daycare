import { mkdir } from "node:fs/promises";
import { factoryConfigRead } from "../config/factoryConfigRead.js";
import { dockerContainerRunFactory } from "../docker/dockerContainerRunFactory.js";
import { factoryOutDirectoryReset } from "../fs/factoryOutDirectoryReset.js";
import { factoryBuildPathsResolve } from "../paths/factoryBuildPathsResolve.js";
import { factoryTaskFileEnsure } from "../paths/factoryTaskFileEnsure.js";
import { factoryTemplateDirectoryEnsure } from "../paths/factoryTemplateDirectoryEnsure.js";
import type { FactoryBuildCliOptions, FactoryConfigResolved } from "../types.js";

/**
 * Builds a task by running daycare-factory inside a Docker container.
 * Expects: task has TASK.md and environment has daycare-factory.yaml/template.
 */
export async function factoryBuildCommand(
  taskDirectory: string,
  options: FactoryBuildCliOptions
): Promise<void> {
  const paths = factoryBuildPathsResolve(
    taskDirectory,
    options.environment,
    options.config,
    options.out
  );

  await factoryTaskFileEnsure(paths.taskFilePath);
  await factoryTemplateDirectoryEnsure(paths.templateDirectory);

  if (options.keepOut) {
    await mkdir(paths.outDirectory, { recursive: true });
  } else {
    await factoryOutDirectoryReset(paths.outDirectory);
  }

  const config = await factoryConfigRead(paths.configPath);
  const effectiveConfig: FactoryConfigResolved = {
    ...config,
    containerName: options.containerName ?? config.containerName,
    removeContainerOnExit: options.keepContainer
      ? false
      : config.removeContainerOnExit,
    removeExistingContainer: options.removeExisting
      ? config.removeExistingContainer
      : false
  };

  console.log(`Running factory container for ${paths.taskDirectory}`);
  await dockerContainerRunFactory({
    paths,
    config: effectiveConfig
  });

  console.log(`Build complete. Output directory: ${paths.outDirectory}`);
}
