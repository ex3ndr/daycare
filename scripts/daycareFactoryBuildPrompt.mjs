import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const DEFAULT_ENVIRONMENT = "packages/daycare-factory/environments/typescript";

async function ensureTaskDirectory(taskDirectory) {
  const taskFile = resolve(taskDirectory, "TASK.md");
  await access(taskFile, constants.F_OK);
}

async function ensureEnvironmentDirectory(environmentDirectory) {
  const configFile = resolve(environmentDirectory, "daycare-factory.yaml");
  await access(configFile, constants.F_OK);
}

function runBuild(taskDirectory, environmentDirectory) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      "yarn",
      [
        "workspace",
        "daycare-factory",
        "run",
        "dev",
        "--",
        "build",
        taskDirectory,
        "--environment",
        environmentDirectory
      ],
      {
        stdio: "inherit",
        cwd: process.cwd()
      }
    );

    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`build failed with exit code ${code ?? "null"}`));
    });
  });
}

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    const taskInput = (
      await rl.question("Task folder (must contain TASK.md): ")
    ).trim();

    if (!taskInput) {
      throw new Error("task folder is required");
    }

    const environmentInput = (
      await rl.question(
        `Environment folder [${DEFAULT_ENVIRONMENT}]: `
      )
    ).trim();

    const taskDirectory = resolve(taskInput);
    const environmentDirectory = resolve(
      environmentInput || DEFAULT_ENVIRONMENT
    );

    await ensureTaskDirectory(taskDirectory);
    await ensureEnvironmentDirectory(environmentDirectory);
    await runBuild(taskDirectory, environmentDirectory);
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`factory:build failed: ${message}`);
  process.exit(1);
});
