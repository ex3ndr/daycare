import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { databaseOpen } from "../databaseOpen.js";
import { migrations } from "./_migrations.js";
import { migrationRun } from "./migrationRun.js";

describe("migrationRun", () => {
  it("applies migrations once and is idempotent", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-migration-run-"));
    const dbPath = path.join(dir, "daycare.db");
    try {
      const db = databaseOpen(dbPath);
      const firstApplied = migrationRun(db);
      const secondApplied = migrationRun(db);

      const tableRows = db
        .prepare("SELECT name FROM _migrations ORDER BY name")
        .all() as Array<{ name: string }>;
      const agentTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agents'")
        .get() as { name?: string } | undefined;
      const sessionTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
        .get() as { name?: string } | undefined;
      const historyTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='session_history'")
        .get() as { name?: string } | undefined;
      db.close();

      expect(firstApplied).toEqual(migrations.map((entry) => entry.name));
      expect(secondApplied).toEqual([]);
      expect(tableRows.map((row) => row.name)).toEqual(
        migrations.map((entry) => entry.name).sort()
      );
      expect(agentTable?.name).toBe("agents");
      expect(sessionTable?.name).toBe("sessions");
      expect(historyTable?.name).toBe("session_history");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
