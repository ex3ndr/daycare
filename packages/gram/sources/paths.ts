import os from "node:os";
import path from "node:path";

export const DEFAULT_SCOUT_DIR = path.join(os.homedir(), ".scout");

export function resolveScoutPath(...segments: string[]): string {
  return path.join(DEFAULT_SCOUT_DIR, ...segments);
}
