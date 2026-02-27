import { describe, expect, it } from "vitest";

import { messageFormatIncoming } from "./messageFormatIncoming.js";

describe("messageFormatIncoming", () => {
    it("wraps message text with time and ids", () => {
        const message = { text: "hello" };
        const context = { messageId: "msg-1", timezone: "UTC" };
        const result = messageFormatIncoming(message, context, new Date("2024-01-01T00:00:00Z"));

        expect(result.rawText).toBe("hello");
        expect(result.text).toContain("<timezone>UTC</timezone>");
        expect(result.text).toContain("<time>");
        expect(result.text).toContain("<message_id>msg-1</message_id>");
        expect(result.text).toContain("<message>hello</message>");
    });

    it("returns the message when no text or files", () => {
        const message = { text: null, files: [] };
        const context = {};
        const result = messageFormatIncoming(message, context, new Date());

        expect(result).toEqual(message);
    });

    it("defaults formatted time to UTC when timezone context is missing", () => {
        const message = { text: "hello" };
        const context = {};
        const result = messageFormatIncoming(message, context, new Date("2024-01-01T00:00:00Z"));

        expect(result.text).toContain("(UTC)");
        expect(result.text).not.toContain("<timezone>");
    });

    it("renders custom context enrichments as tags", () => {
        const message = { text: "hello" };
        const context = {
            enrichments: [
                { key: "timezone_change_notice", value: "Timezone updated automatically from UTC to CET." },
                { key: "profile_name_notice", value: "User first/last name are not set." }
            ]
        };
        const result = messageFormatIncoming(message, context, new Date("2024-01-01T00:00:00Z"));

        expect(result.text).toContain(
            "<timezone_change_notice>Timezone updated automatically from UTC to CET.</timezone_change_notice>"
        );
        expect(result.text).toContain("<profile_name_notice>User first/last name are not set.</profile_name_notice>");
    });
});
