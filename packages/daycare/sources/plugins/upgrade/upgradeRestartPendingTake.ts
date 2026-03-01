import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import type { UpgradeRestartPending } from "./upgradeRestartPendingTypes.js";

/**
 * Reads and clears persisted post-restart metadata.
 * Expects: dataDir points to the plugin data directory.
 */
export async function upgradeRestartPendingTake(dataDir: string): Promise<UpgradeRestartPending | null> {
    const statePath = path.join(dataDir, "restart-pending.json");
    let raw: string;
    try {
        raw = await readFile(statePath, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return null;
        }
        throw error;
    }

    await rm(statePath, { force: true });
    return pendingParse(raw);
}

function pendingParse(value: string): UpgradeRestartPending | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(value) as unknown;
    } catch {
        return null;
    }

    if (!parsed || typeof parsed !== "object") {
        return null;
    }
    const candidate = parsed as {
        path?: unknown;
        context?: unknown;
        requestedAtMs?: unknown;
        requesterPid?: unknown;
        previousVersion?: unknown;
    };
    if (typeof candidate.requestedAtMs !== "number") {
        return null;
    }
    if (typeof candidate.requesterPid !== "number") {
        return null;
    }
    if (typeof candidate.path !== "string" || candidate.path.trim().length === 0) {
        return null;
    }
    if (!candidate.context || typeof candidate.context !== "object") {
        return null;
    }

    return {
        path: candidate.path as UpgradeRestartPending["path"],
        context: candidate.context as UpgradeRestartPending["context"],
        requestedAtMs: candidate.requestedAtMs,
        requesterPid: candidate.requesterPid,
        ...(typeof candidate.previousVersion === "string" && candidate.previousVersion.trim().length > 0
            ? { previousVersion: candidate.previousVersion.trim() }
            : {})
    };
}
