import { describe, expect, it } from "vitest";
import { validationSessionIdCreate } from "./validationSessionIdCreate.js";

describe("validationSessionIdCreate", () => {
    it("prefixes validation sessions and keeps them unique", () => {
        const first = validationSessionIdCreate("model-validation");
        const second = validationSessionIdCreate("model-validation");

        expect(first).toMatch(/^model-validation:/);
        expect(second).toMatch(/^model-validation:/);
        expect(first).not.toBe(second);
    });
});
