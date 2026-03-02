import { describe, expect, it, vi } from "vitest";
import { agentsMessageSend } from "./agentsMessageSend";

describe("agentsMessageSend", () => {
    it("sends message with correct body", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: true })
            }))
        );

        await agentsMessageSend("http://localhost", "tok", "agent-1", "hello world");
        expect(fetch).toHaveBeenCalledWith("http://localhost/agents/agent-1/message", {
            method: "POST",
            headers: {
                authorization: "Bearer tok",
                "content-type": "application/json"
            },
            body: JSON.stringify({ text: "hello world" })
        });

        vi.unstubAllGlobals();
    });

    it("throws on error response", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: false, error: "agent not found" })
            }))
        );

        await expect(agentsMessageSend("http://localhost", "tok", "bad-id", "hi")).rejects.toThrow("agent not found");

        vi.unstubAllGlobals();
    });
});
