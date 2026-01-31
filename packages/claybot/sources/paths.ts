import os from "node:os";
import path from "node:path";

function resolveClaybotRoot(): string {
  const root = process.env.CLAYBOT_ROOT_DIR?.trim();
  if (root) {
    return path.resolve(root);
  }
  return path.join(os.homedir(), ".claybot");
}

export const DEFAULT_CLAYBOT_DIR = resolveClaybotRoot();

export function resolveClaybotPath(...segments: string[]): string {
  return path.join(DEFAULT_CLAYBOT_DIR, ...segments);
}

export const DEFAULT_SOUL_PATH = resolveClaybotPath("SOUL.md");
export const DEFAULT_USER_PATH = resolveClaybotPath("USER.md");
