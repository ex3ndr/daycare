import path from "node:path";
import { describe, expect, it } from "vitest";

import { skillActivationKeyBuild } from "./skillActivationKeyBuild.js";

describe("skillActivationKeyBuild", () => {
    it("builds activation key from core skill id", () => {
        expect(skillActivationKeyBuild("core:scheduling")).toBe("core--scheduling");
    });

    it("builds activation key from plugin skill id", () => {
        expect(skillActivationKeyBuild("plugin:telegram/helper")).toBe("plugin--telegram--helper");
    });

    it("keeps traversal-like ids confined to a single path segment", () => {
        const key = skillActivationKeyBuild("user:../pwn");
        const activeRoot = "/tmp/daycare-active";
        const targetPath = path.resolve(activeRoot, key);
        expect(path.relative(activeRoot, targetPath).startsWith("..")).toBe(false);
    });

    it("rejects empty skill ids", () => {
        expect(() => skillActivationKeyBuild("   ")).toThrow("Skill id is required.");
    });
});
