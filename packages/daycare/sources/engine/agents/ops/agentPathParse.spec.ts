import { describe, expect, it } from "vitest";
import { agentPathConnector, agentPathSearch, agentPathSub, agentPathSystem } from "./agentPathBuild.js";
import { agentPathConnectorName, agentPathKind, agentPathParent, agentPathUserId } from "./agentPathParse.js";
import { agentPath } from "./agentPathTypes.js";

describe("agentPathParse", () => {
    it("detects kinds by pattern", () => {
        expect(agentPathKind(agentPath("/u1/telegram"))).toBe("connector");
        expect(agentPathKind(agentPath("/u1/agent/claude"))).toBe("agent");
        expect(agentPathKind(agentPath("/u1/cron/daily"))).toBe("cron");
        expect(agentPathKind(agentPath("/u1/task/run"))).toBe("task");
        expect(agentPathKind(agentPath("/u1/subuser/s1"))).toBe("subuser");
        expect(agentPathKind(agentPathSystem("gc"))).toBe("system");
        expect(agentPathKind(agentPathSub(agentPathConnector("u1", "telegram"), 1))).toBe("sub");
        expect(agentPathKind(agentPath("/u1/telegram/memory"))).toBe("memory");
        expect(agentPathKind(agentPathSearch(agentPathConnector("u1", "telegram"), 3))).toBe("search");
    });

    it("extracts parent paths", () => {
        expect(agentPathParent(agentPath("/u1/telegram"))).toBeNull();
        expect(agentPathParent(agentPath("/u1/telegram/sub/0"))).toBe("/u1/telegram/sub");
        expect(agentPathParent(agentPath("/u1/telegram/memory"))).toBe("/u1/telegram");
    });

    it("extracts user ids and connector names", () => {
        expect(agentPathUserId(agentPath("/u1/telegram"))).toBe("u1");
        expect(agentPathUserId(agentPath("/system/gc"))).toBeNull();
        expect(agentPathConnectorName(agentPath("/u1/telegram"))).toBe("telegram");
        expect(agentPathConnectorName(agentPath("/u1/task/t1"))).toBeNull();
    });
});
