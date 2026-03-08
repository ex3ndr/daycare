import { afterEach, describe, expect, it, vi } from "vitest";
import {
    chatCreate,
    chatDirectResolve,
    chatHistoryFetch,
    chatMessageSend,
    chatMessagesPoll,
    chatSupervisorBootstrapSend,
    chatSupervisorResolve
} from "./chatApi";

describe("chatCreate", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("creates an app chat agent and returns flattened shape", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({
                    ok: true,
                    agent: { agentId: "app-agent-1", initializedAt: 1700 }
                })
            }))
        );

        const created = await chatCreate("http://localhost", "tok", null, "System prompt", "Planner", "Task assistant");

        expect(created).toEqual({ agentId: "app-agent-1", initializedAt: 1700 });
        expect(fetch).toHaveBeenCalledWith("http://localhost/agents/create", {
            method: "POST",
            headers: {
                authorization: "Bearer tok",
                "content-type": "application/json"
            },
            body: JSON.stringify({
                systemPrompt: "System prompt",
                name: "Planner",
                description: "Task assistant"
            })
        });
    });

    it("throws on API error response", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: false, error: "systemPrompt is required." })
            }))
        );

        await expect(chatCreate("http://localhost", "tok", null, "")).rejects.toThrow("systemPrompt is required.");
    });
});

describe("chatHistoryFetch", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns history records on success", async () => {
        const records = [{ type: "note" as const, at: 1000, text: "hello" }];
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: true, history: records })
            }))
        );

        const result = await chatHistoryFetch("http://localhost", "tok", null, "agent-1");

        expect(result).toEqual(records);
        expect(fetch).toHaveBeenCalledWith("http://localhost/agents/agent-1/history", {
            headers: { authorization: "Bearer tok" }
        });
    });

    it("throws on API error response", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: false, error: "not found" })
            }))
        );

        await expect(chatHistoryFetch("http://localhost", "tok", null, "bad-id")).rejects.toThrow("not found");
    });
});

describe("chatDirectResolve", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns the direct agent id", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: true, agentId: "direct-1" })
            }))
        );

        const result = await chatDirectResolve("http://localhost", "tok", null);

        expect(result).toBe("direct-1");
        expect(fetch).toHaveBeenCalledWith("http://localhost/agents/direct", {
            headers: { authorization: "Bearer tok" }
        });
    });
});

describe("chatSupervisorResolve", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns the supervisor agent id", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: true, agentId: "supervisor-1" })
            }))
        );

        const result = await chatSupervisorResolve("http://localhost", "tok", null);

        expect(result).toBe("supervisor-1");
        expect(fetch).toHaveBeenCalledWith("http://localhost/agents/supervisor", {
            headers: { authorization: "Bearer tok" }
        });
    });
});

describe("chatMessageSend", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("sends message payload to the message route", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: true })
            }))
        );

        await chatMessageSend("http://localhost", "tok", null, "agent-1", "hello");

        expect(fetch).toHaveBeenCalledWith("http://localhost/agents/agent-1/message", {
            method: "POST",
            headers: {
                authorization: "Bearer tok",
                "content-type": "application/json"
            },
            body: JSON.stringify({ text: "hello" })
        });
    });

    it("throws on API error response", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: false, error: "agent not found" })
            }))
        );

        await expect(chatMessageSend("http://localhost", "tok", null, "bad-id", "hi")).rejects.toThrow(
            "agent not found"
        );
    });
});

describe("chatSupervisorBootstrapSend", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("posts bootstrap text and returns the supervisor agent id", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: true, agentId: "supervisor-1" })
            }))
        );

        const result = await chatSupervisorBootstrapSend("http://localhost", "tok", null, "Kick off planning");

        expect(result).toBe("supervisor-1");
        expect(fetch).toHaveBeenCalledWith("http://localhost/agents/supervisor/bootstrap", {
            method: "POST",
            headers: {
                authorization: "Bearer tok",
                "content-type": "application/json"
            },
            body: JSON.stringify({ text: "Kick off planning" })
        });
    });
});

describe("chatMessagesPoll", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns incremental history records", async () => {
        const records = [{ type: "user_message" as const, at: 1002, text: "hello" }];
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: true, history: records })
            }))
        );

        const result = await chatMessagesPoll("http://localhost", "tok", null, "agent-1", 1000);

        expect(result).toEqual(records);
        expect(fetch).toHaveBeenCalledWith("http://localhost/agents/agent-1/messages?after=1000", {
            headers: { authorization: "Bearer tok" }
        });
    });

    it("throws on API error response", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: false, error: "after must be a non-negative unix timestamp in milliseconds." })
            }))
        );

        await expect(chatMessagesPoll("http://localhost", "tok", null, "agent-1", -1)).rejects.toThrow(
            "after must be a non-negative unix timestamp in milliseconds."
        );
    });
});
