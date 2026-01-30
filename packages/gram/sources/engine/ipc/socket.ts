import path from "node:path";

import { resolveScoutPath } from "../../paths.js";

export const DEFAULT_ENGINE_SOCKET_PATH = resolveScoutPath("scout.sock");

export function resolveEngineSocketPath(override?: string): string {
  return path.resolve(override ?? DEFAULT_ENGINE_SOCKET_PATH);
}

export function resolveRemoteEngineUrl(override?: string): string | null {
  const candidate = override ?? process.env.SCOUT_REMOTE_URL;
  if (!candidate) {
    return null;
  }
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}
