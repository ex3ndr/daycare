import { describe, expect, it } from "vitest";

import {
    agentPathAgent,
    agentPathConnector,
    agentPathCron,
    agentPathMemory,
    agentPathSearch,
    agentPathSub,
    agentPathSubuser,
    agentPathSystem,
    agentPathTask
} from "./agentPathBuild.js";

describe("agentPathBuild", () => {
    it("builds root paths", () => {
        expect(agentPathConnector("u1", "telegram")).toBe("/u1/telegram");
        expect(agentPathAgent("u1", "claude")).toBe("/u1/agent/claude");
        expect(agentPathCron("u1", "daily")).toBe("/u1/cron/daily");
        expect(agentPathTask("u1", "task1")).toBe("/u1/task/task1");
        expect(agentPathSubuser("u1", "sub1")).toBe("/u1/subuser/sub1");
        expect(agentPathSystem("gc")).toBe("/system/gc");
    });

    it("builds nested paths", () => {
        const root = agentPathConnector("u1", "telegram");
        expect(agentPathSub(root, 0)).toBe("/u1/telegram/sub/0");
        expect(agentPathMemory(root)).toBe("/u1/telegram/memory");
        expect(agentPathSearch(root, 2)).toBe("/u1/telegram/search/2");
    });

    it("rejects invalid segments and indexes", () => {
        expect(() => agentPathConnector("", "telegram")).toThrow();
        expect(() => agentPathAgent("u1", "a/b")).toThrow();
        expect(() => agentPathSub(agentPathConnector("u1", "telegram"), -1)).toThrow();
    });
});
