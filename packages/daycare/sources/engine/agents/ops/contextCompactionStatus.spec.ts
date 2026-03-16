import { describe, expect, it } from "vitest";
import type { AgentHistoryRecord } from "./agentTypes.js";
import { contextCompactionLimitsBuild } from "./contextCompactionLimitsBuild.js";
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
        const status = contextCompactionStatus(history, contextCompactionLimitsBuild({ emergencyLimit: 100 }));
        expect(status.estimatedTokens).toBe(50);
        expect(status.severity).toBe("ok");
    });

    it("returns warning and critical at thresholds", () => {
        const warningHistory = buildHistory(300); // 75 tokens
        const warningStatus = contextCompactionStatus(
            warningHistory,
            contextCompactionLimitsBuild({ emergencyLimit: 100 })
        );
        expect(warningStatus.severity).toBe("warning");

        const criticalHistory = buildHistory(360); // 90 tokens
        const criticalStatus = contextCompactionStatus(
            criticalHistory,
            contextCompactionLimitsBuild({ emergencyLimit: 100 })
        );
        expect(criticalStatus.severity).toBe("critical");
    });

    it("includes heuristic extras in the estimate", () => {
        const history = buildHistory(0);
        const status = contextCompactionStatus(history, contextCompactionLimitsBuild({ emergencyLimit: 100 }), {
            extras: { systemPrompt: "x".repeat(48) }
        });
        expect(status.estimatedTokens).toBe(12);
        expect(status.extraTokens).toBe(12);
    });

    it("uses minimumTokens as a floor for severity checks", () => {
        const history = buildHistory(0);
        const status = contextCompactionStatus(history, contextCompactionLimitsBuild({ emergencyLimit: 100 }), {
            minimumTokens: 95
        });
        expect(status.estimatedTokens).toBe(95);
        expect(status.severity).toBe("critical");
    });

    it("ignores invalid minimumTokens values", () => {
        const history = buildHistory(0);
        const status = contextCompactionStatus(history, contextCompactionLimitsBuild({ emergencyLimit: 100 }), {
            minimumTokens: Number.NaN
        });
        expect(status.estimatedTokens).toBe(0);
        expect(status.severity).toBe("ok");
    });

    it("uses explicit warning and critical limits", () => {
        const history = buildHistory(320); // 80 tokens
        const status = contextCompactionStatus(
            history,
            contextCompactionLimitsBuild({
                emergencyLimit: 100,
                warningLimit: 70,
                criticalLimit: 85
            })
        );

        expect(status.warningLimit).toBe(70);
        expect(status.criticalLimit).toBe(85);
        expect(status.severity).toBe("warning");
    });
});
