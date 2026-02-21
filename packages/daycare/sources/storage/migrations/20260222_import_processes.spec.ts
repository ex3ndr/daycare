import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { databaseOpen } from "../databaseOpen.js";
import { migration20260220AddUsers } from "./20260220_add_users.js";
import { migration20260222AddProcesses } from "./20260222_add_processes.js";
import { migration20260222ImportProcesses } from "./20260222_import_processes.js";

describe("migration20260222ImportProcesses", () => {
    it("imports legacy process records", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-import-processes-"));
        const dbPath = path.join(dir, "daycare.db");

        try {
            const processDir = path.join(dir, "processes", "p-1");
            await mkdir(processDir, { recursive: true });
            await writeFile(
                path.join(processDir, "record.json"),
                JSON.stringify(
                    {
                        version: 2,
                        id: "p-1",
                        name: "process-one",
                        command: 'node -e "1"',
                        cwd: "/tmp/workspace",
                        home: null,
                        env: { A: "1" },
                        packageManagers: ["node"],
                        allowedDomains: ["example.com"],
                        allowLocalBinding: true,
                        permissions: {
                            workingDir: "/tmp/workspace",
                            writeDirs: ["/tmp/workspace"],
                            readDirs: ["/tmp/workspace"],
                            network: true,
                            events: false
                        },
                        owner: { type: "plugin", id: "plugin-a" },
                        keepAlive: true,
                        desiredState: "running",
                        status: "running",
                        pid: 123,
                        bootTimeMs: 456,
                        restartCount: 1,
                        restartFailureCount: 0,
                        nextRestartAt: null,
                        settingsPath: "/tmp/workspace/processes/p-1/sandbox.json",
                        logPath: "/tmp/workspace/processes/p-1/process.log",
                        createdAt: 1,
                        updatedAt: 2,
                        lastStartedAt: 3,
                        lastExitedAt: null
                    },
                    null,
                    2
                ),
                "utf8"
            );

            const db = databaseOpen(dbPath);
            try {
                migration20260220AddUsers.up(db);
                db.prepare("INSERT INTO users (id, is_owner, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
                    "owner-user",
                    1,
                    1,
                    1
                );
                db.exec(`
                    CREATE TABLE agents (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL
                    );
                `);
                migration20260222AddProcesses.up(db);
                migration20260222ImportProcesses.up(db);

                const rows = db
                    .prepare(
                        "SELECT id, user_id, keep_alive, allow_local_binding, owner FROM processes ORDER BY id ASC"
                    )
                    .all() as Array<{
                    id: string;
                    user_id: string;
                    keep_alive: number;
                    allow_local_binding: number;
                    owner: string | null;
                }>;

                expect(rows).toHaveLength(1);
                expect(rows[0]?.id).toBe("p-1");
                expect(rows[0]?.user_id).toBe("owner-user");
                expect(rows[0]?.keep_alive).toBe(1);
                expect(rows[0]?.allow_local_binding).toBe(1);
                expect(rows[0]?.owner).toBe(JSON.stringify({ type: "plugin", id: "plugin-a" }));
            } finally {
                db.close();
            }
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
