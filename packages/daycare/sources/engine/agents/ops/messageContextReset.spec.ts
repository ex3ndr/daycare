import { describe, it, expect } from "vitest";
import { messageContextReset } from "./messageContextReset.js";

describe("messageContextReset", () => {
  it("returns compaction message", () => {
    const result = messageContextReset({ kind: "compaction" });
    expect(result).toBe("⏳ Compacting session context. I'll continue shortly.");
  });

  it("returns manual reset message", () => {
    const result = messageContextReset({ kind: "manual" });
    expect(result).toBe("🔄 Session reset.");
  });

  it("returns overflow message without tokens", () => {
    const result = messageContextReset({ kind: "overflow" });
    expect(result).toBe("⚠️ Session reset — context overflow. Please resend your last message.");
  });

  it("returns overflow message with token count", () => {
    const result = messageContextReset({ kind: "overflow", estimatedTokens: 153_200 });
    expect(result).toBe("⚠️ Session reset — context overflow (~153k tokens). Please resend your last message.");
  });

  it("omits token count when zero", () => {
    const result = messageContextReset({ kind: "overflow", estimatedTokens: 0 });
    expect(result).toBe("⚠️ Session reset — context overflow. Please resend your last message.");
  });
});
