import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { releaseVersionPrompt } from "./releaseVersionPrompt.js";

type PackageManifest = {
  version?: string;
};

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(scriptDirectory, "../..");
const repositoryDirectory = resolve(packageDirectory, "../..");
const packageManifestPath = resolve(packageDirectory, "package.json");
const packageManifestRelativePath = "packages/daycare/package.json";
const npmRegistry = "https://registry.npmjs.org/";

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

  commandRun("yarn", ["install", "--frozen-lockfile"], repositoryDirectory);
  commandRun("npm", ["whoami", "--registry", npmRegistry], packageDirectory);
  commandRun(
    "npm",
    ["version", nextVersion, "--no-git-tag-version", "--registry", npmRegistry],
    packageDirectory
  );
  commandRun("git", ["add", packageManifestRelativePath], repositoryDirectory);
  commandRun("git", ["commit", "-m", commitMessage], repositoryDirectory);
  commandRun("git", ["tag", tagName], repositoryDirectory);
  commandRun("git", ["push", "origin", "HEAD"], repositoryDirectory);
  commandRun("git", ["push", "origin", tagName], repositoryDirectory);
  commandRun(
    "npm",
    ["publish", "--access", "public", "--registry", npmRegistry],
    packageDirectory
  );

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
