import { describe, expect, it } from "vitest";

import { rlmNoToolsResultMessageBuild } from "./rlmNoToolsResultMessageBuild.js";

describe("rlmNoToolsResultMessageBuild", () => {
    it("builds a success python_result user message", () => {
        const message = rlmNoToolsResultMessageBuild({
            result: {
                output: "done",
                printOutput: ["hello"],
                toolCallCount: 1
            }
        });

        expect(message.role).toBe("user");
        expect(Array.isArray(message.content)).toBe(true);
        const text = Array.isArray(message.content) ? message.content.find((part) => part.type === "text")?.text : "";
        expect(text).toContain("<python_result>");
        expect(text).toContain("Python execution completed.");
        expect(text).toContain("</python_result>");
    });

    it("builds an error python_result user message", () => {
        const message = rlmNoToolsResultMessageBuild({
            error: new Error("boom")
        });

        const text = Array.isArray(message.content) ? message.content.find((part) => part.type === "text")?.text : "";
        expect(text).toContain("<python_result>");
        expect(text).toContain("Python execution failed: boom");
        expect(text).toContain("</python_result>");
    });
});
