import { describe, expect, it } from "vitest";
import { usertagGenerate } from "./usertagGenerate.js";

describe("usertagGenerate", () => {
    it("generates adjective-noun-NN format", () => {
        const tag = usertagGenerate();
        expect(tag).toMatch(/^[a-z]+-[a-z]+-[1-9][0-9]$/);
    });

    it("produces varied output across multiple calls", () => {
        const tags = new Set(Array.from({ length: 20 }, () => usertagGenerate()));
        expect(tags.size).toBeGreaterThan(1);
    });
});
