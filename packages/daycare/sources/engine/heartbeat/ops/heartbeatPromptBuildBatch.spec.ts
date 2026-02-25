import { describe, expect, it } from "vitest";

import { heartbeatPromptBuildBatch } from "./heartbeatPromptBuildBatch.js";

const buildTask = (id: string, title: string, code: string) => ({
    id,
    taskId: `task-${id}`,
    userId: "user-1",
    title,
    code,
    lastRunAt: null,
    createdAt: 1,
    updatedAt: 1
});

describe("heartbeatPromptBuildBatch", () => {
    it("returns single task code as array", () => {
        const task = buildTask("one", "Check mail", "print('hello')");
        const result = heartbeatPromptBuildBatch([task]);

        expect(result.title).toBe("Heartbeat: Check mail");
        expect(result.text).toContain("Check mail");
        expect(result.code).toEqual(["print('hello')"]);
    });

    it("builds a sorted batch with code array", () => {
        const first = buildTask("b", "Alpha", "do_alpha()");
        const second = buildTask("a", "Alpha", "do_alpha_second()");
        const third = buildTask("c", "Bravo", "do_bravo()");

        const result = heartbeatPromptBuildBatch([third, second, first]);

        expect(result.title).toBe("Heartbeat batch (3)");
        expect(result.text).toContain("# Heartbeat run");
        expect(result.text).toContain("1. Alpha (id: a)");
        expect(result.text).toContain("2. Alpha (id: b)");
        expect(result.text).toContain("3. Bravo (id: c)");
        expect(result.code).toEqual(["do_alpha_second()", "do_alpha()", "do_bravo()"]);
    });
});
