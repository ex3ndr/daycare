import { describe, expect, it } from "vitest";
import { agentTokenPromptUsedFromUsage } from "./agentTokenPromptUsedFromUsage.js";

describe("agentTokenPromptUsedFromUsage", () => {
    it("returns null without tokens", () => {
        expect(agentTokenPromptUsedFromUsage(null)).toBeNull();
    });

    it("returns prompt usage tokens when source is usage", () => {
        const used = agentTokenPromptUsedFromUsage({
            provider: "openai",
            model: "gpt-4.1",
            source: "usage",
            size: {
                input: 120_000,
                output: 10_000,
                cacheRead: 30_000,
                cacheWrite: 5_000,
                total: 165_000
            }
        });
        expect(used).toBe(155_000);
    });

    it("returns null for estimate source", () => {
        const used = agentTokenPromptUsedFromUsage({
            provider: "openai",
            model: "gpt-4.1",
            source: "estimate",
            size: {
                input: 120_000,
                output: 10_000,
                cacheRead: 0,
                cacheWrite: 0,
                total: 130_000
            }
        });
        expect(used).toBeNull();
    });

    it("accepts legacy tokens with cache usage but no explicit source", () => {
        const used = agentTokenPromptUsedFromUsage({
            provider: "openai",
            model: "gpt-4.1",
            size: {
                input: 100,
                output: 20,
                cacheRead: 50,
                cacheWrite: 0,
                total: 170
            }
        });
        expect(used).toBe(150);
    });

    it("rejects legacy tokens without cache usage because source is unknown", () => {
        const used = agentTokenPromptUsedFromUsage({
            provider: "openai",
            model: "gpt-4.1",
            size: {
                input: 100,
                output: 20,
                cacheRead: 0,
                cacheWrite: 0,
                total: 120
            }
        });
        expect(used).toBeNull();
    });
});
