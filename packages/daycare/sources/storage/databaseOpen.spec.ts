import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "./databaseOpenTest.js";

describe("databaseOpenTest", () => {
    it("opens in-memory and does not create a file on disk", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-db-open-"));
        const dbPath = path.join(dir, "daycare.db");
        try {
            const db = databaseOpenTest();
            const row = await db.prepare("SELECT 1 AS value").get<{ value: number }>();
            db.close();

            await expect(access(dbPath)).rejects.toThrow();
            expect(row?.value).toBe(1);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
