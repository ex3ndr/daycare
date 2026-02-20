import { describe, expect, it } from "vitest";

import { releaseVersionIncrement } from "./releaseVersionIncrement.js";

describe("releaseVersionIncrement", () => {
    it("increments patch versions", () => {
        expect(releaseVersionIncrement("1.2.3", "patch")).toBe("1.2.4");
    });

    it("increments minor versions and resets patch", () => {
        expect(releaseVersionIncrement("1.2.3", "minor")).toBe("1.3.0");
    });

    it("increments major versions and resets minor and patch", () => {
        expect(releaseVersionIncrement("1.2.3", "major")).toBe("2.0.0");
    });

    it("accepts prerelease inputs and returns stable increments", () => {
        expect(releaseVersionIncrement("1.2.3-beta.1+build.42", "patch")).toBe("1.2.4");
    });

    it("throws for invalid semver values", () => {
        expect(() => releaseVersionIncrement("v1.2.3", "patch")).toThrow("Invalid semantic version: v1.2.3");
    });
});
