import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_SOCKET_FILENAME = "claybot.sock";
const DEFAULT_PROD_ROOT = path.join(os.homedir(), ".claybot");
const DEFAULT_DEV_ROOT = path.join(os.homedir(), ".dev");

function resolveClaybotRoot() {
  const override = process.env.CLAYBOT_ROOT_DIR?.trim();
  if (override) {
    return path.resolve(override);
  }
  if (process.env.NODE_ENV === "development") {
    return DEFAULT_DEV_ROOT;
  }
  return DEFAULT_PROD_ROOT;
}

function resolveWorkspaceRoot(rootDir: string) {
  const parent = path.resolve(rootDir, "..");
  if (path.basename(parent) === "packages") {
    return path.resolve(parent, "..");
  }
  return rootDir;
}

async function pathExists(targetPath: string) {
  try {
    await fs.stat(targetPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function resolveSocketPath() {
  const override = process.env.CLAYBOT_ENGINE_SOCKET;
  if (override) {
    return path.resolve(override);
  }

  const rootDir = process.cwd();
  const workspaceRoot = resolveWorkspaceRoot(rootDir);
  const claybotRoot = resolveClaybotRoot();
  const defaultSocketPath = path.join(claybotRoot, DEFAULT_SOCKET_FILENAME);
  const candidates = [
    defaultSocketPath,
    path.resolve(rootDir, ".claybot", DEFAULT_SOCKET_FILENAME),
    path.resolve(workspaceRoot, ".claybot", DEFAULT_SOCKET_FILENAME),
    path.resolve(workspaceRoot, "packages", "claybot", ".claybot", DEFAULT_SOCKET_FILENAME)
  ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}
