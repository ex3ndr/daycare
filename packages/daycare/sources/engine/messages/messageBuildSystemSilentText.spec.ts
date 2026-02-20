import { describe, expect, it } from "vitest";

import { messageBuildSystemSilentText } from "./messageBuildSystemSilentText.js";

describe("messageBuildSystemSilentText", () => {
    it("wraps trimmed text with silent system tags", () => {
        expect(messageBuildSystemSilentText(" hello ")).toBe("<system_message_silent>hello</system_message_silent>");
    });

    it("adds origin metadata when provided", () => {
        expect(messageBuildSystemSilentText("ping", "agent-123")).toBe(
            '<system_message_silent origin="agent-123">ping</system_message_silent>'
        );
    });
});
