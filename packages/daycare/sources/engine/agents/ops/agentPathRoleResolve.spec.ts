import { describe, expect, it } from "vitest";
import { agentPathRoleResolve } from "./agentPathRoleResolve.js";
import { agentPath } from "./agentPathTypes.js";

describe("agentPathRoleResolve", () => {
    it("maps path kinds to model roles", () => {
        expect(agentPathRoleResolve(agentPath("/u1/telegram"))).toBe("user");
        expect(agentPathRoleResolve(agentPath("/u1/agent/claude"))).toBe("user");
        expect(agentPathRoleResolve(agentPath("/u1/subuser/s1"))).toBe("user");
        expect(agentPathRoleResolve(agentPath("/u1/telegram/sub/0"))).toBe("subagent");
        expect(agentPathRoleResolve(agentPath("/u1/telegram/memory"))).toBe("memory");
        expect(agentPathRoleResolve(agentPath("/u1/telegram/search/0"))).toBe("memorySearch");
        expect(agentPathRoleResolve(agentPath("/u1/task/t1"))).toBe("task");
        expect(agentPathRoleResolve(agentPath("/u1/cron/daily"))).toBeNull();
        expect(agentPathRoleResolve(agentPath("/system/gc"))).toBeNull();
    });
});
