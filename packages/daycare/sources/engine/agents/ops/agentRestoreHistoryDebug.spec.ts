import { describe, expect, it } from "vitest";
import { agentRestoreHistoryDebug } from "./agentRestoreHistoryDebug.js";

describe("agentRestoreHistoryDebug", () => {
    it("summarizes the approximate rebuilt context instead of raw history bulk", () => {
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
                content: [
                    { type: "text", text: "world" },
                    {
                        type: "toolCall",
                        id: "tool-1",
                        name: "run_python",
                        arguments: { code: "print('ok')" }
                    }
                ],
                tokens: null
            },
            {
                type: "assistant_rewrite",
                at: 250,
                assistantAt: 200,
                text: "planet",
                reason: "run_python_failure_trim"
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
            recordCount: 4,
            oldestAt: 100,
            newestAt: 300,
            fileCount: 2,
            rebuilt: {
                userMessageCount: 1,
                assistantMessageCount: 1,
                toolResultCount: 1,
                assistantRewriteCount: 1,
                messageCount: 3,
                textChars: 84
            },
            skippedTypeCounts: {
                rlm_complete: 1
            },
            typeCounts: {
                user_message: 1,
                assistant_message: 1,
                assistant_rewrite: 1,
                rlm_complete: 1
            }
        });
    });
});
