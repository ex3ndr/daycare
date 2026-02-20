import { describe, expect, it } from "vitest";
import type { AgentHistoryRecord } from "./agentTypes.js";
import { contextCompactionStatus } from "./contextCompactionStatus.js";

function buildHistory(textLength: number): AgentHistoryRecord[] {
    return [
        {
            type: "user_message",
            at: 1,
            text: "x".repeat(textLength),
            files: []
        }
    ];
}

describe("contextCompactionStatus", () => {
    it("returns ok when under warning threshold", () => {
        const history = buildHistory(200); // 50 tokens
        const status = contextCompactionStatus(history, 100);
        expect(status.estimatedTokens).toBe(50);
        expect(status.severity).toBe("ok");
    });

    it("returns warning and critical at thresholds", () => {
        const warningHistory = buildHistory(300); // 75 tokens
        const warningStatus = contextCompactionStatus(warningHistory, 100);
        expect(warningStatus.severity).toBe("warning");

        const criticalHistory = buildHistory(360); // 90 tokens
        const criticalStatus = contextCompactionStatus(criticalHistory, 100);
        expect(criticalStatus.severity).toBe("critical");
    });

    it("includes heuristic extras in the estimate", () => {
        const history = buildHistory(0);
        const status = contextCompactionStatus(history, 100, {
            extras: { systemPrompt: "x".repeat(48) }
        });
        expect(status.estimatedTokens).toBe(12);
        expect(status.extraTokens).toBe(12);
    });
});
