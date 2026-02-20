import path from "node:path";

import { resolveDaycarePath } from "../../paths.js";

export const DEFAULT_ENGINE_SOCKET_PATH = resolveDaycarePath("daycare.sock");

export function resolveEngineSocketPath(override?: string): string {
    return path.resolve(override ?? DEFAULT_ENGINE_SOCKET_PATH);
}

export function resolveRemoteEngineUrl(override?: string): string | null {
    const candidate = override ?? process.env.DAYCARE_REMOTE_URL;
    if (!candidate) {
        return null;
    }
    const trimmed = candidate.trim();
    return trimmed.length > 0 ? trimmed : null;
}
