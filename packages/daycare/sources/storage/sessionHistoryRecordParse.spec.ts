import { describe, expect, it } from "vitest";

import type { DatabaseSessionHistoryRow } from "./databaseTypes.js";
import { sessionHistoryRecordParse } from "./sessionHistoryRecordParse.js";

describe("sessionHistoryRecordParse", () => {
    it("parses valid row data", () => {
        const row: DatabaseSessionHistoryRow = {
            id: 1,
            session_id: "session-1",
            type: "user_message",
            at: 123,
            data: JSON.stringify({ message: { role: "user", content: "hello" } })
        };

        expect(sessionHistoryRecordParse(row)).toEqual({
            type: "user_message",
            at: 123,
            message: { role: "user", content: "hello" }
        });
    });

    it("returns null for invalid json", () => {
        const row: DatabaseSessionHistoryRow = {
            id: 1,
            session_id: "session-1",
            type: "user_message",
            at: 123,
            data: "{invalid"
        };

        expect(sessionHistoryRecordParse(row)).toBeNull();
    });
});
