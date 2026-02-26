import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260220AddUsers } from "./20260220_add_users.js";
import { migration20260222AddSignals } from "./20260222_add_signals.js";
import { migration20260222ImportSignals } from "./20260222_import_signals.js";

describe("migration20260222ImportSignals", () => {
    it("imports legacy signal event and delayed files", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-import-signals-"));
        const dbPath = path.join(dir, "daycare.db");

        try {
            await mkdir(path.join(dir, "signals"), { recursive: true });
            await writeFile(
                path.join(dir, "signals", "events.jsonl"),
                `${JSON.stringify({ id: "ev-1", type: "build:ok", source: { type: "system", userId: "user-a" }, data: { ok: true }, createdAt: 10 })}\n` +
                    `${JSON.stringify({ id: "ev-2", type: "build:ok", source: { type: "system", userId: "user-1" }, data: { ok: false }, createdAt: 20 })}\n`,
                "utf8"
            );
            await writeFile(
                path.join(dir, "signals", "delayed.json"),
                JSON.stringify(
                    {
                        version: 1,
                        events: [
                            {
                                id: "delay-1",
                                type: "notify",
                                deliverAt: 30,
                                source: { type: "system", userId: "user-a" },
                                data: { a: true },
                                repeatKey: "r1",
                                createdAt: 1,
                                updatedAt: 2
                            },
                            {
                                id: "delay-2",
                                type: "notify",
                                deliverAt: 40,
                                source: { type: "system", userId: "user-1" },
                                data: { b: true },
                                createdAt: 3,
                                updatedAt: 4
                            }
                        ]
                    },
                    null,
                    2
                ),
                "utf8"
            );

            const db = databaseOpenTest();
            try {
                (db as typeof db & { __daycareDatabasePath?: string }).__daycareDatabasePath = dbPath;
                migration20260220AddUsers.up(db);
                db.prepare("INSERT INTO users (id, is_owner, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
                    "owner-user",
                    1,
                    1,
                    1
                );
                migration20260222AddSignals.up(db);
                migration20260222ImportSignals.up(db);

                const events = db
                    .prepare("SELECT id, user_id, type FROM signals_events ORDER BY id ASC")
                    .all() as Array<{
                    id: string;
                    user_id: string;
                    type: string;
                }>;
                const delayed = db
                    .prepare("SELECT id, user_id, type, repeat_key FROM signals_delayed ORDER BY id ASC")
                    .all() as Array<{
                    id: string;
                    user_id: string;
                    type: string;
                    repeat_key: string | null;
                }>;

                expect(events).toEqual([
                    { id: "ev-1", user_id: "user-a", type: "build:ok" },
                    { id: "ev-2", user_id: "user-1", type: "build:ok" }
                ]);
                expect(delayed).toEqual([
                    { id: "delay-1", user_id: "user-a", type: "notify", repeat_key: "r1" },
                    { id: "delay-2", user_id: "user-1", type: "notify", repeat_key: null }
                ]);
            } finally {
                db.close();
            }
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
