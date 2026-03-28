import { describe, expect, it } from "vitest";
import { agentRestoreHistoryDebug } from "./agentRestoreHistoryDebug.js";

describe("agentRestoreHistoryDebug", () => {
    it("summarizes counts and text-heavy fields from persisted history", () => {
        const result = agentRestoreHistoryDebug([
            {
                type: "user_message",
                at: 100,
                text: "hello",
                files: [
                    { id: "f1", name: "a.txt", path: "/tmp/a.txt", mimeType: "text/plain", size: 3 },
                    { id: "f2", name: "b.txt", path: "/tmp/b.txt", mimeType: "text/plain", size: 4 }
                ]
            },
            {
                type: "assistant_message",
                at: 200,
                content: [{ type: "text", text: "world" }],
                tokens: null
            },
            {
                type: "rlm_complete",
                at: 300,
                toolCallId: "tool-1",
                output: "done",
                printOutput: ["print"],
                toolCallCount: 1,
                isError: true,
                error: "boom"
            }
        ]);

        expect(result).toEqual({
            recordCount: 3,
            oldestAt: 100,
            newestAt: 300,
            fileCount: 2,
            textChars: 23,
            typeCounts: {
                user_message: 1,
                assistant_message: 1,
                rlm_complete: 1
            }
        });
    });
});
