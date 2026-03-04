import { describe, expect, it } from "vitest";
import { chatSessionSelect } from "./chatSessionSelect";

describe("chatSessionSelect", () => {
    it("returns the same empty view reference for null or missing agent", () => {
        const sessions = {
            "agent-1": {
                agentId: "agent-1",
                history: [{ type: "note" as const, at: 1000, text: "hello" }],
                loading: false,
                sending: false,
                error: null,
                lastPollAt: 1000
            }
        };

        const nullAgent = chatSessionSelect(sessions, null);
        const missingAgent = chatSessionSelect(sessions, "missing");

        expect(nullAgent).toBe(missingAgent);
    });

    it("returns the existing session object reference for active agent", () => {
        const existingSession = {
            agentId: "agent-1",
            history: [{ type: "user_message" as const, at: 1000, text: "ping" }],
            loading: false,
            sending: true,
            error: null,
            lastPollAt: 1000
        };
        const sessions = {
            "agent-1": existingSession
        };

        const selected = chatSessionSelect(sessions, "agent-1");
        expect(selected).toBe(existingSession);
    });
});
