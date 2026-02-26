import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Config } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { cuid2Is } from "../../../utils/cuid2Is.js";

type RlmSnapshotLoadOptions = {
    storage: Storage;
    config: Config;
    agentId: string;
    snapshotId: string;
};

/**
 * Loads a persisted checkpoint dump by snapshot id for the agent's active session.
 * Returns null when missing/invalid.
 */
export async function rlmSnapshotLoad(options: RlmSnapshotLoadOptions): Promise<Uint8Array | null> {
    if (!cuid2Is(options.snapshotId)) {
        return null;
    }
    const agent = await options.storage.agents.findById(options.agentId);
    const sessionId = agent?.activeSessionId;
    if (!sessionId) {
        return null;
    }
    const snapshotPath = rlmSnapshotPathResolve(options.config.agentsDir, options.agentId, sessionId, options.snapshotId);
    try {
        return await readFile(snapshotPath);
    } catch {
        return null;
    }
}

function rlmSnapshotPathResolve(agentsDir: string, agentId: string, sessionId: string, snapshotId: string): string {
    return path.join(agentsDir, agentId, "snapshots", sessionId, `${snapshotId}.bin`);
}
