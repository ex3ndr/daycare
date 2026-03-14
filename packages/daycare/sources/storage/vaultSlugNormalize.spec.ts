import { describe, expect, it } from "vitest";
import { vaultSlugNormalize } from "./vaultSlugNormalize.js";

describe("vaultSlugNormalize", () => {
    it("trims and returns a path-safe slug", () => {
        expect(vaultSlugNormalize("  user_profile-1.2  ")).toBe("user_profile-1.2");
    });

    it("rejects empty slugs", () => {
        expect(() => vaultSlugNormalize("   ")).toThrow("Vault slug is required.");
    });

    it("rejects slugs containing path separators", () => {
        expect(() => vaultSlugNormalize("user/profile")).toThrow("Vault slug cannot contain '/'.");
    });
});
