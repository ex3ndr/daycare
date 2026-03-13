import { describe, expect, it } from "vitest";
import type { AgentHistoryRecord, Context } from "@/types";
import { agentsTurns } from "./agentsTurns.js";

const ctx = { userId: "test-user" } as Context;

function userMsg(at: number, text: string): AgentHistoryRecord {
    return { type: "user_message", at, text, files: [] };
}

function assistantMsg(at: number, text: string): AgentHistoryRecord {
    return { type: "assistant_message", at, content: [{ type: "text", text }], tokens: null };
}

function note(at: number, text: string): AgentHistoryRecord {
    return { type: "note", at, text };
}

function makeHistory(records: AgentHistoryRecord[]) {
    return async () => records;
}

describe("agentsTurns", () => {
    it("returns empty turns for empty history", async () => {
        const result = await agentsTurns({
            ctx,
            agentId: "agent-1",
            agentHistoryLoad: makeHistory([])
        });
        expect(result).toEqual({ ok: true, turns: [] });
    });

    it("groups records into turns split by user_message", async () => {
        const history: AgentHistoryRecord[] = [
            userMsg(100, "hello"),
            assistantMsg(200, "hi"),
            userMsg(300, "second"),
            assistantMsg(400, "reply")
        ];
        const result = await agentsTurns({
            ctx,
            agentId: "agent-1",
            agentHistoryLoad: makeHistory(history)
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.turns).toHaveLength(2);
        expect(result.turns[0]!.id).toBe(100);
        expect(result.turns[0]!.preview).toBe("hello");
        expect(result.turns[0]!.records).toHaveLength(2);
        expect(result.turns[1]!.id).toBe(300);
        expect(result.turns[1]!.preview).toBe("second");
        expect(result.turns[1]!.records).toHaveLength(2);
    });

    it("puts pre-user records in initial turn", async () => {
        const history: AgentHistoryRecord[] = [note(50, "init"), userMsg(100, "first")];
        const result = await agentsTurns({
            ctx,
            agentId: "agent-1",
            agentHistoryLoad: makeHistory(history)
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.turns).toHaveLength(2);
        expect(result.turns[0]!.id).toBe(50);
        expect(result.turns[0]!.preview).toBe("");
        expect(result.turns[0]!.records).toHaveLength(1);
        expect(result.turns[1]!.id).toBe(100);
        expect(result.turns[1]!.preview).toBe("first");
    });

    it("rejects empty agentId", async () => {
        const result = await agentsTurns({
            ctx,
            agentId: "  ",
            agentHistoryLoad: makeHistory([])
        });
        expect(result).toEqual({ ok: false, error: "agentId is required." });
    });
});
