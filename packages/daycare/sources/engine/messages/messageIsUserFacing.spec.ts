import { describe, expect, it } from "vitest";

import { messageIsUserFacing } from "./messageIsUserFacing.js";

describe("messageIsUserFacing", () => {
    it("returns true for message_for_user tag", () => {
        expect(messageIsUserFacing('<message_for_user origin="a1">hello</message_for_user>')).toBe(true);
    });

    it("returns true with leading whitespace", () => {
        expect(messageIsUserFacing('  <message_for_user origin="a1">hi</message_for_user>')).toBe(true);
    });

    it("returns false for system_message tag", () => {
        expect(messageIsUserFacing("<system_message>hello</system_message>")).toBe(false);
    });

    it("returns false for plain text", () => {
        expect(messageIsUserFacing("just a normal message")).toBe(false);
    });
});
