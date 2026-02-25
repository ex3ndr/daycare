import { describe, expect, it } from "vitest";

import { heartbeatPromptBuildBatch } from "./heartbeatPromptBuildBatch.js";

const buildTask = (id: string, title: string, prompt: string) => ({
    id,
    userId: "user-1",
    title,
    prompt,
    lastRunAt: null,
    createdAt: 1,
    updatedAt: 1
});

describe("heartbeatPromptBuildBatch", () => {
    it("wraps single-task code in run_python tags", () => {
        const task = buildTask("one", "Check mail", "print('hello')");
        const result = heartbeatPromptBuildBatch([task]);

        expect(result.title).toBe("Heartbeat: Check mail");
        expect(result.prompt).toBe("<run_python>\nprint('hello')\n</run_python>");
    });

    it("builds a sorted batch with run_python-wrapped code", () => {
        const first = buildTask("b", "Alpha", "do_alpha()");
        const second = buildTask("a", "Alpha", "do_alpha_second()");
        const third = buildTask("c", "Bravo", "do_bravo()");

        const result = heartbeatPromptBuildBatch([third, second, first]);

        expect(result.title).toBe("Heartbeat batch (3)");
        expect(result.prompt).toContain("# Heartbeat run");
        expect(result.prompt).toContain("## 1. Alpha");
        expect(result.prompt).toContain("id: a");
        expect(result.prompt).toContain("<run_python>\ndo_alpha_second()\n</run_python>");
        expect(result.prompt).toContain("## 2. Alpha");
        expect(result.prompt).toContain("id: b");
        expect(result.prompt).toContain("<run_python>\ndo_alpha()\n</run_python>");
        expect(result.prompt).toContain("## 3. Bravo");
        expect(result.prompt).toContain("<run_python>\ndo_bravo()\n</run_python>");
    });
});
