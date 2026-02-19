import { describe, it, expect } from "vitest";
import { messageContextReset } from "./messageContextReset.js";

describe("messageContextReset", () => {
  it("returns compaction message", () => {
    const result = messageContextReset({ kind: "compaction" });
    expect(result).toBe("⏳ Tidying up our conversation — back in a moment!");
  });

  it("returns manual reset message", () => {
    const result = messageContextReset({ kind: "manual" });
    expect(result).toBe("🔄 Fresh start! How can I help?");
  });

  it("returns overflow message without tokens", () => {
    const result = messageContextReset({ kind: "overflow" });
    expect(result).toBe("⚠️ Our conversation got too long, so I had to start fresh. Could you repeat your last message?");
  });

  it("returns overflow message with high token count", () => {
    const result = messageContextReset({ kind: "overflow", estimatedTokens: 153_200 });
    expect(result).toBe("⚠️ Our conversation got really long, so I had to start fresh. Could you repeat your last message?");
  });

  it("returns overflow message with medium token count", () => {
    const result = messageContextReset({ kind: "overflow", estimatedTokens: 100_000 });
    expect(result).toBe("⚠️ Our conversation got quite long, so I had to start fresh. Could you repeat your last message?");
  });

  it("returns overflow message with lower token count", () => {
    const result = messageContextReset({ kind: "overflow", estimatedTokens: 50_000 });
    expect(result).toBe("⚠️ Our conversation got a bit too long, so I had to start fresh. Could you repeat your last message?");
  });

  it("returns overflow message with zero tokens", () => {
    const result = messageContextReset({ kind: "overflow", estimatedTokens: 0 });
    expect(result).toBe("⚠️ Our conversation got too long, so I had to start fresh. Could you repeat your last message?");
  });
});