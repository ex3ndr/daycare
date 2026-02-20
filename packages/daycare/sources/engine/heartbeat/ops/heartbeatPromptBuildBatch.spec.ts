import { describe, expect, it } from "vitest";

import { heartbeatPromptBuildBatch } from "./heartbeatPromptBuildBatch.js";

const buildTask = (id: string, title: string, prompt: string) => ({
    id,
    title,
    prompt,
    filePath: ""
});

describe("heartbeatPromptBuildBatch", () => {
    it("returns a single-task prompt without batching", () => {
        const task = buildTask("one", "Check mail", "Review the inbox.");
        const result = heartbeatPromptBuildBatch([task]);

        expect(result.title).toBe("Heartbeat: Check mail");
        expect(result.prompt).toBe("Review the inbox.");
    });

    it("builds a sorted batch prompt", () => {
        const first = buildTask("b", "Alpha", "Do alpha.");
        const second = buildTask("a", "Alpha", "Do alpha second.");
        const third = buildTask("c", "Bravo", "Do bravo.");

        const result = heartbeatPromptBuildBatch([third, second, first]);

        expect(result.title).toBe("Heartbeat batch (3)");
        expect(result.prompt).toContain("# Heartbeat run");
        expect(result.prompt).toContain("## 1. Alpha");
        expect(result.prompt).toContain("id: a");
        expect(result.prompt).toContain("Do alpha second.");
        expect(result.prompt).toContain("## 2. Alpha");
        expect(result.prompt).toContain("id: b");
        expect(result.prompt).toContain("## 3. Bravo");
    });
});
