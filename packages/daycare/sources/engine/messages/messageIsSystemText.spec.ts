import { describe, expect, it } from "vitest";

import { messageIsSystemText } from "./messageIsSystemText.js";

describe("messageIsSystemText", () => {
    it("detects system message tags", () => {
        expect(messageIsSystemText("<system_message>hi</system_message>")).toBe(true);
        expect(messageIsSystemText('  <system_message origin="system">ok</system_message>')).toBe(true);
    });

    it("returns false for other text", () => {
        expect(messageIsSystemText("hello")).toBe(false);
    });
});
