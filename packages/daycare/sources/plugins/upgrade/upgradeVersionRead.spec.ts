import { describe, expect, it } from "vitest";

import { upgradeVersionRead } from "./upgradeVersionRead.js";

describe("upgradeVersionRead", () => {
    it("reads a semantic version from package metadata", async () => {
        const version = await upgradeVersionRead();

        expect(version).toBeTruthy();
        expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });
});
