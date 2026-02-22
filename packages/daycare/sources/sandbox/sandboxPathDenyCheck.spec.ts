import path from "node:path";
import { describe, expect, it } from "vitest";

import { sandboxPathDenyCheck } from "./sandboxPathDenyCheck.js";

describe("sandboxPathDenyCheck", () => {
    it("returns true when target is inside a denied directory", () => {
        const denied = ["/home/alice/.ssh", "/etc/ssh"];
        const target = "/home/alice/.ssh/id_rsa";

        expect(sandboxPathDenyCheck(target, denied)).toBe(true);
    });

    it("returns true when target matches a denied directory exactly", () => {
        const target = path.resolve("/etc/ssh");

        expect(sandboxPathDenyCheck(target, ["/etc/ssh"])).toBe(true);
    });

    it("returns false when target is outside denied directories", () => {
        const target = "/home/alice/projects/daycare/readme.md";

        expect(sandboxPathDenyCheck(target, ["/home/alice/.ssh", "/etc/ssh"])).toBe(false);
    });

    it("does not treat sibling directory names as contained", () => {
        const target = "/home/alice/.ssh-backup/id_rsa";

        expect(sandboxPathDenyCheck(target, ["/home/alice/.ssh"])).toBe(false);
    });
});
