import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260302CleanupRlmSnapshotPayloads } from "./20260302_cleanup_rlm_snapshot_payloads.js";

describe("migration20260302CleanupRlmSnapshotPayloads", () => {
    it("removes only legacy inline snapshot payloads while keeping rows", () => {
        const db = databaseOpenTest();
        try {
            db.exec(`
                CREATE TABLE session_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    at INTEGER NOT NULL,
                    data TEXT NOT NULL
                );
            `);
            db.prepare("INSERT INTO session_history (session_id, type, at, data) VALUES (?, ?, ?, ?)").run(
                "s-1",
                "rlm_tool_call",
                1,
                JSON.stringify({ snapshot: "AQID", toolName: "echo" })
            );
            db.prepare("INSERT INTO session_history (session_id, type, at, data) VALUES (?, ?, ?, ?)").run(
                "s-1",
                "rlm_tool_call",
                2,
                JSON.stringify({ snapshotId: "AQID", toolName: "echo-inline" })
            );
            db.prepare("INSERT INTO session_history (session_id, type, at, data) VALUES (?, ?, ?, ?)").run(
                "s-1",
                "rlm_tool_call",
                3,
                JSON.stringify({ snapshotId: "abc123abc123abc123abc123", toolName: "echo" })
            );
            db.prepare("INSERT INTO session_history (session_id, type, at, data) VALUES (?, ?, ?, ?)").run(
                "s-1",
                "note",
                4,
                JSON.stringify({ text: "keep me" })
            );

            migration20260302CleanupRlmSnapshotPayloads.up(db);

            const rows = db.prepare("SELECT type, data FROM session_history ORDER BY id ASC").all() as Array<{
                type: string;
                data: string;
            }>;
            expect(rows).toHaveLength(4);
            expect(rows[0]?.type).toBe("rlm_tool_call");
            expect(rows[0]?.data).not.toContain('"snapshot"');
            expect(rows[0]?.data).toContain('"toolName":"echo"');
            expect(rows[1]?.type).toBe("rlm_tool_call");
            expect(rows[1]?.data).not.toContain("snapshotId");
            expect(rows[1]?.data).toContain('"toolName":"echo-inline"');
            expect(rows[2]?.type).toBe("rlm_tool_call");
            expect(rows[2]?.data).toContain("snapshotId");
            expect(rows[3]?.type).toBe("note");
        } finally {
            db.close();
        }
    });

    it("is idempotent", () => {
        const db = databaseOpenTest();
        try {
            db.exec(`
                CREATE TABLE session_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    at INTEGER NOT NULL,
                    data TEXT NOT NULL
                );
            `);
            db.prepare("INSERT INTO session_history (session_id, type, at, data) VALUES (?, ?, ?, ?)").run(
                "s-1",
                "rlm_tool_call",
                2,
                JSON.stringify({ snapshotId: "AQID", toolName: "echo-inline" })
            );

            expect(() => migration20260302CleanupRlmSnapshotPayloads.up(db)).not.toThrow();
            expect(() => migration20260302CleanupRlmSnapshotPayloads.up(db)).not.toThrow();

            const count = db.prepare("SELECT COUNT(*) AS count FROM session_history").get() as { count: number };
            expect(count.count).toBe(1);
            const row = db.prepare("SELECT data FROM session_history LIMIT 1").get() as { data: string };
            expect(row.data).not.toContain('"snapshot"');
            expect(row.data).not.toContain('"snapshotId"');
        } finally {
            db.close();
        }
    });

    it("processes large history in batches", () => {
        const db = databaseOpenTest();
        try {
            db.exec(`
                CREATE TABLE session_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    at INTEGER NOT NULL,
                    data TEXT NOT NULL
                );
            `);

            const insert = db.prepare("INSERT INTO session_history (session_id, type, at, data) VALUES (?, ?, ?, ?)");
            for (let index = 0; index < 250; index += 1) {
                insert.run("s-batch", "rlm_tool_call", index, JSON.stringify({ snapshotId: "AQID", toolName: "echo" }));
            }
            insert.run(
                "s-batch",
                "rlm_tool_call",
                999,
                JSON.stringify({ snapshotId: "abc123abc123abc123abc123", toolName: "keep-valid" })
            );

            migration20260302CleanupRlmSnapshotPayloads.up(db);

            const stats = db
                .prepare(
                    `
                        SELECT
                            SUM(CASE WHEN data LIKE '%"snapshotId":"AQID"%' THEN 1 ELSE 0 END) AS invalid_count,
                            SUM(CASE WHEN data LIKE '%"snapshotId":"abc123abc123abc123abc123"%' THEN 1 ELSE 0 END) AS valid_count
                        FROM session_history
                        WHERE type = 'rlm_tool_call'
                    `
                )
                .get() as { invalid_count: number | null; valid_count: number | null };
            expect(stats.invalid_count ?? 0).toBe(0);
            expect(stats.valid_count ?? 0).toBe(1);
        } finally {
            db.close();
        }
    });
});
