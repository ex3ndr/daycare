import type { Migration } from "./migrationTypes.js";

/**
 * Removes legacy embedded VM snapshot payloads from rlm_tool_call session_history JSON blobs.
 * Expects: session_history table exists and uses JSON data blobs.
 */
export const migration20260302CleanupRlmSnapshotPayloads: Migration = {
    name: "20260302_cleanup_rlm_snapshot_payloads",
    up(db): void {
        const rows = db.prepare("SELECT id, data FROM session_history WHERE type = 'rlm_tool_call'").all() as Array<{
            id: number;
            data: string;
        }>;
        const updateById = db.prepare("UPDATE session_history SET data = ? WHERE id = ?");
        for (const row of rows) {
            let parsed: Record<string, unknown> | null = null;
            try {
                parsed = JSON.parse(row.data) as Record<string, unknown>;
            } catch {
                continue;
            }
            if (!parsed || typeof parsed !== "object" || !("snapshot" in parsed)) {
                continue;
            }
            delete parsed.snapshot;
            updateById.run(JSON.stringify(parsed), row.id);
        }
    }
};
