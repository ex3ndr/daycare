import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260222AddSignals } from "./20260222_add_signals.js";

describe("migration20260222AddSignals", () => {
    it("creates signal tables with expected columns", () => {
        const db = databaseOpenTest();
        try {
            migration20260222AddSignals.up(db);

            const eventColumns = db.prepare("PRAGMA table_info(signals_events)").all() as Array<{ name: string }>;
            const subscriptionColumns = db.prepare("PRAGMA table_info(signals_subscriptions)").all() as Array<{
                name: string;
            }>;
            const delayedColumns = db.prepare("PRAGMA table_info(signals_delayed)").all() as Array<{ name: string }>;

            expect(eventColumns.map((column) => column.name)).toEqual([
                "id",
                "user_id",
                "type",
                "source",
                "data",
                "created_at"
            ]);
            expect(subscriptionColumns.map((column) => column.name)).toEqual([
                "id",
                "user_id",
                "agent_id",
                "pattern",
                "silent",
                "created_at",
                "updated_at"
            ]);
            expect(delayedColumns.map((column) => column.name)).toEqual([
                "id",
                "user_id",
                "type",
                "deliver_at",
                "source",
                "data",
                "repeat_key",
                "created_at",
                "updated_at"
            ]);
        } finally {
            db.close();
        }
    });
});
