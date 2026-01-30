import { promises as fs } from "node:fs";
import path from "node:path";

import type { AssistantSettings } from "../settings.js";

export type SessionPermissions = {
  workingDir: string;
};

export function resolveWorkspaceDir(
  configDir: string,
  assistant?: AssistantSettings | null
): string {
  const configured = assistant?.workspaceDir?.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? path.resolve(configured)
      : path.resolve(configDir, configured);
  }
  return path.resolve(configDir, "workspace");
}

export async function ensureWorkspaceDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export function normalizePermissions(
  value: unknown,
  defaultWorkingDir: string
): SessionPermissions {
  if (value && typeof value === "object") {
    const candidate = value as { workingDir?: unknown };
    if (typeof candidate.workingDir === "string" && candidate.workingDir.trim().length > 0) {
      if (path.isAbsolute(candidate.workingDir)) {
        return { workingDir: path.resolve(candidate.workingDir) };
      }
    }
  }
  return { workingDir: path.resolve(defaultWorkingDir) };
}

export function resolveWorkspacePath(workingDir: string, target: string): string {
  const resolved = path.resolve(workingDir, target);
  const relative = path.relative(workingDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path is outside the session workspace.");
  }
  return resolved;
}
