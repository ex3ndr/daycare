import { describe, expect, it, vi } from "vitest";
import { agentsHistoryFetch } from "./agentsHistoryFetch";

describe("agentsHistoryFetch", () => {
    it("returns history records on success", async () => {
        const records = [{ type: "note" as const, at: 1000, text: "hello" }];
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: true, history: records })
            }))
        );

        const result = await agentsHistoryFetch("http://localhost", "tok", "agent-1");
        expect(result).toEqual(records);
        expect(fetch).toHaveBeenCalledWith("http://localhost/agents/agent-1/history", {
            headers: { authorization: "Bearer tok" }
        });

        vi.unstubAllGlobals();
    });

    it("throws on error response", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: false, error: "not found" })
            }))
        );

        await expect(agentsHistoryFetch("http://localhost", "tok", "bad-id")).rejects.toThrow("not found");

        vi.unstubAllGlobals();
    });

    it("encodes agentId in URL", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: true, history: [] })
            }))
        );

        await agentsHistoryFetch("http://localhost", "tok", "id/with/slashes");
        expect(fetch).toHaveBeenCalledWith("http://localhost/agents/id%2Fwith%2Fslashes/history", {
            headers: { authorization: "Bearer tok" }
        });

        vi.unstubAllGlobals();
    });
});
