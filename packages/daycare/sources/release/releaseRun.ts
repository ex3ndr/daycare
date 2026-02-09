import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { releaseVersionIsValid } from "./releaseVersionIsValid.js";

type PackageManifest = {
  version?: string;
};

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(scriptDirectory, "../..");
const repositoryDirectory = resolve(packageDirectory, "../..");
const packageManifestPath = resolve(packageDirectory, "package.json");
const packageManifestRelativePath = "packages/daycare/package.json";

/**
 * Runs the daycare-cli release flow.
 * Expects: git repository is clean; npm credentials are already configured.
 */
export async function releaseRun(): Promise<void> {
  assertWorkingTreeIsClean();

  const currentVersion = packageVersionRead();
  const nextVersion = await releaseVersionPrompt(currentVersion);
  const tagName = `daycare-cli@${nextVersion}`;
  const commitMessage = `chore(release): daycare-cli ${nextVersion}`;

  assertTagMissing(tagName);

  commandRun("npm", ["version", nextVersion, "--no-git-tag-version"], packageDirectory);
  commandRun("git", ["add", packageManifestRelativePath], repositoryDirectory);
  commandRun("git", ["commit", "-m", commitMessage], repositoryDirectory);
  commandRun("git", ["tag", tagName], repositoryDirectory);
  commandRun("git", ["push", "origin", "HEAD"], repositoryDirectory);
  commandRun("git", ["push", "origin", tagName], repositoryDirectory);
  commandRun("npm", ["publish", "--access", "public"], packageDirectory);

  console.log(`Released daycare-cli ${nextVersion} with tag ${tagName}`);
}

function packageVersionRead(): string {
  const raw = readFileSync(packageManifestPath, "utf8");
  const parsed = JSON.parse(raw) as PackageManifest;
  const version = parsed.version?.trim();

  if (!version) {
    throw new Error("Could not read current version from packages/daycare/package.json");
  }

  return version;
}

function assertWorkingTreeIsClean(): void {
  const output = commandOutput("git", ["status", "--porcelain"], repositoryDirectory);
  if (output.length > 0) {
    throw new Error(
      "Release requires a clean git working tree. Commit or stash pending changes first."
    );
  }
}

function assertTagMissing(tagName: string): void {
  const output = commandOutput(
    "git",
    ["tag", "--list", "--format=%(refname:strip=2)", tagName],
    repositoryDirectory
  );

  if (output.split("\n").some((line) => line.trim() === tagName)) {
    throw new Error(`Tag ${tagName} already exists.`);
  }
}

async function releaseVersionPrompt(currentVersion: string): Promise<string> {
  const reader = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const value = await reader.question(
      `Current version is ${currentVersion}. Enter new version: `
    );
    const version = value.trim();

    if (!version) {
      throw new Error("Version is required.");
    }
    if (!releaseVersionIsValid(version)) {
      throw new Error(`Invalid semantic version: ${version}`);
    }
    if (version === currentVersion) {
      throw new Error("New version must differ from current version.");
    }

    return version;
  } finally {
    reader.close();
  }
}

function commandRun(command: string, args: string[], cwd: string): void {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit"
  });
}

function commandOutput(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8"
  }).trim();
}

await releaseRun();
