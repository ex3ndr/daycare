import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { databaseOpen } from "./databaseOpen.js";

describe("databaseOpen", () => {
    it("creates the database file and enables WAL + foreign keys", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-db-open-"));
        const dbPath = path.join(dir, "daycare.db");
        try {
            const db = databaseOpen(dbPath);
            const journal = db.prepare("PRAGMA journal_mode").get() as { journal_mode?: string } | undefined;
            const foreignKeys = db.prepare("PRAGMA foreign_keys").get() as { foreign_keys?: number } | undefined;
            db.close();

            expect(journal?.journal_mode?.toLowerCase()).toBe("wal");
            expect(foreignKeys?.foreign_keys).toBe(1);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
