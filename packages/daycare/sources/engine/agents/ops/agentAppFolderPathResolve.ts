import path from "node:path";

import type { AgentDescriptor } from "./agentDescriptorTypes.js";

/**
 * Resolves the app root folder path for app descriptors.
 * Expects: workspaceDir is absolute; non-app descriptors return null.
 */
export function agentAppFolderPathResolve(
  descriptor: AgentDescriptor,
  workspaceDir: string
): string | null {
  if (descriptor.type !== "app") {
    return null;
  }
  return path.resolve(workspaceDir, "apps", descriptor.appId);
}
