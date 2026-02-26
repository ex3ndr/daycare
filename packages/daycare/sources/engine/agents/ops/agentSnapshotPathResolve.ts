import path from "node:path";

/**
 * Resolves the persisted checkpoint file path for an agent session.
 * Expects: snapshotId is a cuid2 value.
 */
export function agentSnapshotPathResolve(
    agentsDir: string,
    agentId: string,
    sessionId: string,
    snapshotId: string
): string {
    return path.join(agentsDir, agentId, "snapshots", sessionId, `${snapshotId}.bin`);
}
