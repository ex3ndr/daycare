import { describe, expect, it } from "vitest";

import { signalTypeMatchesPattern } from "./signalTypeMatchesPattern.js";

describe("signalTypeMatchesPattern", () => {
    it("matches star segments", () => {
        expect(signalTypeMatchesPattern("asdasd:mid:asdasd", "asdasd:*:asdasd")).toBe(true);
    });

    it("requires same segment count", () => {
        expect(signalTypeMatchesPattern("a:b:c", "a:*")).toBe(false);
    });

    it("matches literal segments exactly", () => {
        expect(signalTypeMatchesPattern("build:done", "build:*")).toBe(true);
        expect(signalTypeMatchesPattern("build:done", "build:failed")).toBe(false);
    });
});
