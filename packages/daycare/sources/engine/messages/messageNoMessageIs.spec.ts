import { describe, expect, it } from "vitest";

import { messageNoMessageIs } from "./messageNoMessageIs.js";

describe("messageNoMessageIs", () => {
    it("returns true for the raw sentinel", () => {
        expect(messageNoMessageIs("NO_MESSAGE")).toBe(true);
    });

    it("trims whitespace and punctuation", () => {
        expect(messageNoMessageIs("  NO_MESSAGE  ")).toBe(true);
        expect(messageNoMessageIs("NO_MESSAGE.")).toBe(true);
    });

    it("accepts wrapped variants", () => {
        expect(messageNoMessageIs("`NO_MESSAGE`")).toBe(true);
        expect(messageNoMessageIs('"NO_MESSAGE"')).toBe(true);
        expect(messageNoMessageIs("```text\nNO_MESSAGE\n```")).toBe(true);
    });

    it("accepts NO_MESSAGE at end of message", () => {
        expect(messageNoMessageIs("Some reasoning text\n\nNO_MESSAGE")).toBe(true);
        expect(messageNoMessageIs("I have nothing to report.\nNO_MESSAGE")).toBe(true);
        expect(messageNoMessageIs("Done processing\n\nNO_MESSAGE.")).toBe(true);
    });

    it("rejects extra content", () => {
        expect(messageNoMessageIs("NO_MESSAGE please")).toBe(false);
        expect(messageNoMessageIs("no_message")).toBe(false);
        expect(messageNoMessageIs(null)).toBe(false);
    });

    it("rejects NO_MESSAGE in the middle of text", () => {
        expect(messageNoMessageIs("Before NO_MESSAGE after")).toBe(false);
        expect(messageNoMessageIs("NO_MESSAGE\nMore text after")).toBe(false);
    });
});
