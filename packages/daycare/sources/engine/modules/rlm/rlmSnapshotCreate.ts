import { access, mkdir, open } from "node:fs/promises";
import path from "node:path";

import { createId } from "@paralleldrive/cuid2";
import type { Config } from "@/types";
import type { Storage } from "../../../storage/storage.js";

type RlmSnapshotCreateOptions = {
    storage: Storage;
    config: Config;
    agentId: string;
    at: number;
    snapshotDump: string;
};

/**
 * Persists an RLM checkpoint dump to the agent snapshot folder and returns cuid2 id.
 * Expects: agent exists and snapshotDump is a base64-encoded Monty dump.
 */
export async function rlmSnapshotCreate(options: RlmSnapshotCreateOptions): Promise<string> {
    const sessionId = await rlmSnapshotSessionEnsure(options.storage, options.agentId, options.at);
    const snapshotId = createId();
    const snapshotPath = rlmSnapshotPathResolve(options.config.agentsDir, options.agentId, sessionId, snapshotId);
    await rlmSnapshotWrite(snapshotPath, Buffer.from(options.snapshotDump, "base64"));
    await rlmSnapshotDatabaseSync(options.config.dbPath);
    return snapshotId;
}

async function rlmSnapshotSessionEnsure(storage: Storage, agentId: string, at: number): Promise<string> {
    const agent = await storage.agents.findById(agentId);
    if (!agent) {
        throw new Error(`Agent not found for snapshot create: ${agentId}`);
    }
    if (agent.activeSessionId) {
        return agent.activeSessionId;
    }
    const sessionId = await storage.sessions.create({
        agentId,
        createdAt: at
    });
    await storage.agents.update(agentId, {
        activeSessionId: sessionId,
        updatedAt: Math.max(agent.updatedAt, at)
    });
    return sessionId;
}

function rlmSnapshotPathResolve(agentsDir: string, agentId: string, sessionId: string, snapshotId: string): string {
    return path.join(agentsDir, agentId, "snapshots", sessionId, `${snapshotId}.bin`);
}

async function rlmSnapshotWrite(snapshotPath: string, dump: Uint8Array): Promise<void> {
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    const handle = await open(snapshotPath, "w");
    try {
        await handle.writeFile(dump);
        await handle.sync();
    } finally {
        await handle.close();
    }
    await rlmSnapshotPathSync(path.dirname(snapshotPath));
}

async function rlmSnapshotDatabaseSync(dbPath: string): Promise<void> {
    if (dbPath === ":memory:") {
        return;
    }
    await rlmSnapshotPathSyncIfExists(dbPath);
    await rlmSnapshotPathSyncIfExists(`${dbPath}-wal`);
}

async function rlmSnapshotPathSyncIfExists(targetPath: string): Promise<void> {
    try {
        await access(targetPath);
    } catch {
        return;
    }
    await rlmSnapshotPathSync(targetPath);
}

async function rlmSnapshotPathSync(targetPath: string): Promise<void> {
    const handle = await open(targetPath, "r");
    try {
        await handle.sync();
    } finally {
        await handle.close();
    }
}
