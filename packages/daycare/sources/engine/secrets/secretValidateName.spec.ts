import { describe, expect, it } from "vitest";
import { secretValidateName } from "./secretValidateName.js";

describe("secretValidateName", () => {
    it("accepts kebab-case names", () => {
        expect(secretValidateName("openai-key")).toBe(true);
        expect(secretValidateName("aws-prod-2")).toBe(true);
        expect(secretValidateName("x")).toBe(true);
    });

    it("rejects invalid names", () => {
        expect(secretValidateName("OpenAI-Key")).toBe(false);
        expect(secretValidateName("openai_key")).toBe(false);
        expect(secretValidateName("openai key")).toBe(false);
        expect(secretValidateName("openai-")).toBe(false);
        expect(secretValidateName("-openai")).toBe(false);
        expect(secretValidateName("")).toBe(false);
    });
});
