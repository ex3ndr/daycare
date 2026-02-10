import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, readFile } from "node:fs/promises";
import {
  FACTORY_BUILD_COMMAND_ENV,
  FACTORY_OUT_ENV,
  FACTORY_TASK_ENV
} from "../constants.js";
import { factoryPiAgentPromptRun } from "./factoryPiAgentPromptRun.js";

interface FactoryContainerBuildCommandDependencies {
  dockerEnvironmentIs?: () => Promise<boolean>;
  piAgentPromptRun?: (taskPath: string, outDirectory: string) => Promise<void>;
  buildCommandRun?: (
    command: string[],
    env: NodeJS.ProcessEnv
  ) => Promise<number | null>;
}

/**
 * Executes a configured build command inside a Docker container.
 * Expects: taskPath points to a readable TASK.md and build command is provided in env JSON.
 */
export async function factoryContainerBuildCommand(
  taskPath: string,
  outDirectory: string,
  dependencies: FactoryContainerBuildCommandDependencies = {}
): Promise<void> {
  const dockerEnvironmentIs =
    dependencies.dockerEnvironmentIs ?? factoryDockerEnvironmentIs;
  const piAgentPromptRun =
    dependencies.piAgentPromptRun ?? factoryPiAgentPromptRun;
  const buildCommandRun =
    dependencies.buildCommandRun ?? factoryBuildCommandRun;

  if (!(await dockerEnvironmentIs())) {
    throw new Error("internal factory command can run only inside Docker");
  }

  await access(taskPath, constants.R_OK).catch(() => {
    throw new Error(`TASK.md is not readable: ${taskPath}`);
  });
  await mkdir(outDirectory, { recursive: true });

  const buildCommand = factoryBuildCommandParse(
    process.env[FACTORY_BUILD_COMMAND_ENV]
  );
  const buildEnv: NodeJS.ProcessEnv = {
    ...process.env,
    [FACTORY_TASK_ENV]: taskPath,
    [FACTORY_OUT_ENV]: outDirectory
  };

  await piAgentPromptRun(taskPath, outDirectory);

  const exitCode = await buildCommandRun(buildCommand, buildEnv);
  if (exitCode !== 0) {
    throw new Error(`build command exited with code ${exitCode ?? -1}`);
  }
}

async function factoryDockerEnvironmentIs(): Promise<boolean> {
  const dockerenvExists = await access("/.dockerenv", constants.R_OK)
    .then(() => true)
    .catch(() => false);
  if (dockerenvExists) {
    return true;
  }

  const cgroup = await readFile("/proc/1/cgroup", "utf-8").catch(() => "");
  return /(docker|containerd|kubepods|podman)/i.test(cgroup);
}

function factoryBuildCommandParse(raw: string | undefined): string[] {
  if (!raw) {
    throw new Error(`${FACTORY_BUILD_COMMAND_ENV} is required`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `${FACTORY_BUILD_COMMAND_ENV} must be valid JSON array of strings`
    );
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    parsed.some((item) => typeof item !== "string" || item.length === 0)
  ) {
    throw new Error(
      `${FACTORY_BUILD_COMMAND_ENV} must be a non-empty string array`
    );
  }

  return parsed;
}

function factoryBuildCommandRun(
  command: string[],
  env: NodeJS.ProcessEnv
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const executable = command[0];
    if (!executable) {
      reject(new Error("build command executable is required"));
      return;
    }

    const child = spawn(executable, command.slice(1), {
      stdio: "inherit",
      env
    });

    child.once("error", reject);
    child.once("close", (code: number | null) => resolve(code));
  });
}
