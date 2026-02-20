import { describe, expect, it } from "vitest";

import { messageBuildUserFacing } from "./messageBuildUserFacing.js";

describe("messageBuildUserFacing", () => {
    it("wraps trimmed text with message_for_user tags and origin", () => {
        expect(messageBuildUserFacing(" hello ", "agent-1")).toBe(
            '<message_for_user origin="agent-1">hello</message_for_user>'
        );
    });

    it("preserves multiline content", () => {
        const result = messageBuildUserFacing("line1\nline2", "a");
        expect(result).toBe('<message_for_user origin="a">line1\nline2</message_for_user>');
    });
});
