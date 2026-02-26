import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "./databaseOpenTest.js";

describe("databaseOpenTest", () => {
    it("opens in-memory and enables foreign keys", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-db-open-"));
        const dbPath = path.join(dir, "daycare.db");
        try {
            const db = databaseOpenTest();
            const foreignKeys = db.prepare("PRAGMA foreign_keys").get() as { foreign_keys?: number } | undefined;
            db.close();

            await expect(access(dbPath)).rejects.toThrow();
            expect(foreignKeys?.foreign_keys).toBe(1);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
