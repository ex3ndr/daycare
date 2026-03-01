import { describe, expect, it } from "vitest";
import { documentSlugNormalize } from "./documentSlugNormalize.js";

describe("documentSlugNormalize", () => {
    it("trims and returns a path-safe slug", () => {
        expect(documentSlugNormalize("  user_profile-1.2  ")).toBe("user_profile-1.2");
    });

    it("rejects empty slugs", () => {
        expect(() => documentSlugNormalize("   ")).toThrow("Document slug is required.");
    });

    it("rejects slugs containing path separators", () => {
        expect(() => documentSlugNormalize("user/profile")).toThrow("Document slug cannot contain '/'.");
    });
});
