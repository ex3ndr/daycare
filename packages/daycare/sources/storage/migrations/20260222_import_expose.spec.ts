import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260220AddUsers } from "./20260220_add_users.js";
import { migration20260222AddExpose } from "./20260222_add_expose.js";
import { migration20260222ImportExpose } from "./20260222_import_expose.js";

describe("migration20260222ImportExpose", () => {
    it("imports legacy expose endpoint files", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-import-expose-"));
        const dbPath = path.join(dir, "daycare.db");
        try {
            const endpointsDir = path.join(dir, "expose", "endpoints");
            await mkdir(endpointsDir, { recursive: true });
            await writeFile(
                path.join(endpointsDir, "ep-1.json"),
                JSON.stringify(
                    {
                        id: "ep-1",
                        target: { type: "port", port: 8080 },
                        provider: "provider-a",
                        domain: "app.example.com",
                        mode: "public",
                        auth: null,
                        createdAt: 1,
                        updatedAt: 2
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
                migration20260222AddExpose.up(db);
                migration20260222ImportExpose.up(db);

                const rows = db
                    .prepare("SELECT id, user_id, provider, domain, mode FROM expose_endpoints ORDER BY id ASC")
                    .all() as Array<{
                    id: string;
                    user_id: string;
                    provider: string;
                    domain: string;
                    mode: string;
                }>;

                expect(rows).toEqual([
                    {
                        id: "ep-1",
                        user_id: "owner-user",
                        provider: "provider-a",
                        domain: "app.example.com",
                        mode: "public"
                    }
                ]);
            } finally {
                db.close();
            }
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
