import { describe, expect, it } from "vitest";

import type { AgentHistoryRecord, FileReference } from "@/types";
import { contextEstimateTokens } from "./contextEstimateTokens.js";

describe("contextEstimateTokens", () => {
    it("estimates tokens from user and assistant records", () => {
        const userText = "abcd";
        const assistantText = "hello!";

        const history: AgentHistoryRecord[] = [
            { type: "user_message", at: 1, text: userText, files: [] },
            {
                type: "assistant_message",
                at: 2,
                text: assistantText,
                files: [],
                tokens: null
            }
        ];

        const symbols = userText.length + assistantText.length;
        const expected = Math.ceil(symbols / 4);

        expect(contextEstimateTokens(history)).toBe(expected);
    });

    it("uses fixed estimate for image attachments", () => {
        const imageFile: FileReference = {
            id: "f1",
            name: "image.png",
            path: "/tmp/image.png",
            mimeType: "image/png",
            size: 123
        };
        const user: AgentHistoryRecord = {
            type: "user_message",
            at: 1,
            text: "see image",
            files: [imageFile]
        };
        const assistant: AgentHistoryRecord = {
            type: "assistant_message",
            at: 2,
            text: "ack",
            files: [imageFile],
            tokens: null
        };

        const estimated = contextEstimateTokens([user, assistant]);
        expect(estimated).toBeGreaterThan(Math.ceil(("see image".length + "ack".length) / 4));
    });
});
