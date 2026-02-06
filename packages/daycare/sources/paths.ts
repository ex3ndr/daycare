import os from "node:os";
import path from "node:path";

function resolveDaycareRoot(): string {
  const root = process.env.DAYCARE_ROOT_DIR?.trim();
  if (root) {
    return path.resolve(root);
  }
  return path.join(os.homedir(), ".daycare");
}

export const DEFAULT_DAYCARE_DIR = resolveDaycareRoot();

export function resolveDaycarePath(...segments: string[]): string {
  return path.join(DEFAULT_DAYCARE_DIR, ...segments);
}

export const DEFAULT_SOUL_PATH = resolveDaycarePath("SOUL.md");
export const DEFAULT_USER_PATH = resolveDaycarePath("USER.md");
