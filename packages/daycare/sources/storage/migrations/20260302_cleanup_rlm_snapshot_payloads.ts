import type { Migration } from "./migrationTypes.js";
import { cuid2Is } from "../../utils/cuid2Is.js";

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
            if (!parsed || typeof parsed !== "object") {
                continue;
            }
            const cleaned = migrationRlmToolCallPayloadCleanup(parsed);
            if (!cleaned.changed) {
                continue;
            }
            updateById.run(JSON.stringify(cleaned.record), row.id);
        }
    }
};

function migrationRlmToolCallPayloadCleanup(record: Record<string, unknown>): {
    changed: boolean;
    record: Record<string, unknown>;
} {
    const next = { ...record };
    let changed = false;

    if ("snapshot" in next) {
        delete next.snapshot;
        changed = true;
    }

    if ("snapshotId" in next) {
        const value = next.snapshotId;
        if (typeof value !== "string" || !cuid2Is(value)) {
            delete next.snapshotId;
            changed = true;
        }
    }

    return { changed, record: next };
}
