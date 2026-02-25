import { describe, expect, it } from "vitest";

import { sandboxReadPathNormalize } from "./sandboxReadPathNormalize.js";

describe("sandboxReadPathNormalize", () => {
    const hostHomeDir = "/home/steve/.daycare/users/u123/home";

    it("expands ~ to host home when docker mode is disabled", () => {
        expect(sandboxReadPathNormalize("~", hostHomeDir, false)).toBe(hostHomeDir);
        expect(sandboxReadPathNormalize("~/outputs/result.json", hostHomeDir, false)).toBe(
            `${hostHomeDir}/outputs/result.json`
        );
    });

    it("expands ~ to container home when docker mode is enabled", () => {
        expect(sandboxReadPathNormalize("~", hostHomeDir, true)).toBe("/home");
        expect(sandboxReadPathNormalize("~/outputs/result.json", hostHomeDir, true)).toBe(
            "/home/outputs/result.json"
        );
    });

    it("normalizes @ prefix and unicode spaces", () => {
        expect(sandboxReadPathNormalize("@./file.txt", hostHomeDir, false)).toBe("./file.txt");
        expect(sandboxReadPathNormalize("/tmp/a\u00A0b.txt", hostHomeDir, false)).toBe("/tmp/a b.txt");
    });
});
