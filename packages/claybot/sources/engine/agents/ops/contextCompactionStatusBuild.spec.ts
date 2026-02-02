import { describe, it, expect } from "vitest";

import { contextCompactionStatusBuild } from "./contextCompactionStatusBuild.js";
import type { AgentHistoryRecord } from "./agentTypes.js";

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

describe("contextCompactionStatusBuild", () => {
  it("returns ok when under warning threshold", () => {
    const history = buildHistory(200); // 50 tokens
    const status = contextCompactionStatusBuild(history, 100);
    expect(status.estimatedTokens).toBe(50);
    expect(status.severity).toBe("ok");
  });

  it("returns warning and critical at thresholds", () => {
    const warningHistory = buildHistory(300); // 75 tokens
    const warningStatus = contextCompactionStatusBuild(warningHistory, 100);
    expect(warningStatus.severity).toBe("warning");

    const criticalHistory = buildHistory(360); // 90 tokens
    const criticalStatus = contextCompactionStatusBuild(criticalHistory, 100);
    expect(criticalStatus.severity).toBe("critical");
  });

  it("includes extra tokens in the estimate", () => {
    const history = buildHistory(0);
    const status = contextCompactionStatusBuild(history, 100, { extraTokens: 12 });
    expect(status.estimatedTokens).toBe(12);
  });
});
