import { describe, expect, it } from "vitest";
import type { ObservationLogDbRecord } from "@/types";
import { observationLogFormat } from "./observationLogFormat.js";

describe("observationLogFormat", () => {
    it("returns empty message for no entries", () => {
        expect(observationLogFormat([], "short")).toBe("No observations found.");
        expect(observationLogFormat([], "json")).toBe("No observations found.");
        expect(observationLogFormat([], "full")).toBe("No observations found.");
    });

    it("formats short mode as one-liner per entry", () => {
        const entries = [makeEntry("obs-1", "task.created", "Task created", 1709136000000)];
        const result = observationLogFormat(entries, "short");
        expect(result).toContain("[task.created]");
        expect(result).toContain("Task created");
        expect(result).toContain("2024-02-28");
    });

    it("formats multiple short entries as separate lines", () => {
        const entries = [
            makeEntry("obs-1", "task.created", "Task A created", 1000),
            makeEntry("obs-2", "task.updated", "Task B updated", 2000)
        ];
        const result = observationLogFormat(entries, "short");
        const lines = result.split("\n");
        expect(lines).toHaveLength(2);
        expect(lines[0]).toContain("Task A created");
        expect(lines[1]).toContain("Task B updated");
    });

    it("formats json mode as JSON lines of data field", () => {
        const entries = [
            makeEntry("obs-1", "e1", "msg1", 1000, { key: "value" }),
            makeEntry("obs-2", "e2", "msg2", 2000, null)
        ];
        const result = observationLogFormat(entries, "json");
        const lines = result.split("\n");
        expect(JSON.parse(lines[0]!)).toEqual({ key: "value" });
        expect(JSON.parse(lines[1]!)).toBeNull();
    });

    it("formats full mode with all fields", () => {
        const entry = makeEntry("obs-1", "task.created", "Task created", 1000, { status: "new" });
        entry.details = "The task was created by agent-1 in response to a user request.";
        entry.source = "agent:agent-1";
        entry.scopeIds = ["task-123", "agent-1"];

        const result = observationLogFormat([entry], "full");
        expect(result).toContain("source=agent:agent-1");
        expect(result).toContain("Task created");
        expect(result).toContain("The task was created by agent-1");
        expect(result).toContain('"status":"new"');
        expect(result).toContain("scopes: task-123, agent-1");
    });

    it("full mode omits null details and data", () => {
        const entry = makeEntry("obs-1", "e1", "Short message", 1000, null);
        entry.details = null;

        const result = observationLogFormat([entry], "full");
        const lines = result.split("\n");
        // Should only have timestamp/type line and message line
        expect(lines).toHaveLength(2);
        expect(lines[1]).toBe("Short message");
    });

    it("full mode separates entries with blank lines", () => {
        const entries = [makeEntry("obs-1", "e1", "First", 1000), makeEntry("obs-2", "e2", "Second", 2000)];
        const result = observationLogFormat(entries, "full");
        expect(result).toContain("\n\n");
    });
});

function makeEntry(
    id: string,
    type: string,
    message: string,
    createdAt: number,
    data: unknown = null
): ObservationLogDbRecord {
    return {
        id,
        userId: "user-a",
        type,
        source: "system:test",
        message,
        details: null,
        data,
        scopeIds: [],
        createdAt
    };
}
