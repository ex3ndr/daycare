import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260221DropGateColumns } from "./20260221_drop_gate_columns.js";

describe("migration20260221DropGateColumns", () => {
    it("drops gate columns when present", () => {
        const db = databaseOpenTest(":memory:");
        try {
            db.exec(`
                CREATE TABLE tasks_cron (
                    id TEXT PRIMARY KEY,
                    prompt TEXT NOT NULL,
                    gate TEXT
                );
                CREATE TABLE tasks_heartbeat (
                    id TEXT PRIMARY KEY,
                    prompt TEXT NOT NULL,
                    gate TEXT
                );
            `);

            migration20260221DropGateColumns.up(db);

            const cronColumns = db.prepare("PRAGMA table_info(tasks_cron)").all() as Array<{ name: string }>;
            const heartbeatColumns = db.prepare("PRAGMA table_info(tasks_heartbeat)").all() as Array<{ name: string }>;
            expect(cronColumns.map((column) => column.name)).not.toContain("gate");
            expect(heartbeatColumns.map((column) => column.name)).not.toContain("gate");
        } finally {
            db.close();
        }
    });

    it("is a no-op when gate columns are already absent", () => {
        const db = databaseOpenTest(":memory:");
        try {
            db.exec(`
                CREATE TABLE tasks_cron (
                    id TEXT PRIMARY KEY,
                    prompt TEXT NOT NULL
                );
                CREATE TABLE tasks_heartbeat (
                    id TEXT PRIMARY KEY,
                    prompt TEXT NOT NULL
                );
            `);

            expect(() => migration20260221DropGateColumns.up(db)).not.toThrow();
        } finally {
            db.close();
        }
    });
});
