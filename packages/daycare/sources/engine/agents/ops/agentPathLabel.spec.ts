import { describe, expect, it } from "vitest";
import { agentPathLabel } from "./agentPathLabel.js";
import { agentPath } from "./agentPathTypes.js";

describe("agentPathLabel", () => {
    it("prefers configured names", () => {
        expect(agentPathLabel(agentPath("/u1/agent/claude"), { name: "Claude" })).toBe("Claude");
        expect(agentPathLabel(agentPath("/u1/agent/claude"), { name: "Claude", username: "helper" })).toBe(
            "Claude (@helper)"
        );
    });

    it("falls back to path-based defaults", () => {
        expect(agentPathLabel(agentPath("/u1/task/task-1"))).toBe("task task-1");
        expect(agentPathLabel(agentPath("/system/gc"))).toBe("gc");
        expect(agentPathLabel(agentPath("/u1/telegram"))).toBe("user");
        expect(agentPathLabel(agentPath("/u1/telegram/sub/0"))).toBe("subagent");
    });
});
