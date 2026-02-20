import { describe, expect, it } from "vitest";

import { agentDbParse } from "./agentDbParse.js";

describe("agentDbParse", () => {
    it("maps user_id to userId", () => {
        const parsed = agentDbParse({
            id: "agent-1",
            user_id: "user-1",
            type: "cron",
            descriptor: JSON.stringify({ type: "cron", id: "agent-1", name: "cron" }),
            active_session_id: null,
            permissions: JSON.stringify({
                workingDir: "/tmp",
                writeDirs: ["/tmp"],
                readDirs: ["/tmp"],
                network: false,
                events: false
            }),
            tokens: null,
            stats: JSON.stringify({}),
            lifecycle: "active",
            created_at: 1,
            updated_at: 2
        });

        expect(parsed.userId).toBe("user-1");
    });
});
