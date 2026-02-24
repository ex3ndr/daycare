import path from "node:path";
import { describe, expect, it } from "vitest";

import { sandboxReadDenyPathsBuild } from "./sandboxReadDenyPathsBuild.js";

describe("sandboxReadDenyPathsBuild", () => {
    it("includes hard-deny OS home and daycare config paths", () => {
        const result = sandboxReadDenyPathsBuild({
            platform: "linux",
            homeDir: "/home/alice",
            osHomeDir: "/Users/host",
            daycareConfigDir: "/Users/host/.daycare"
        });

        expect(result).toEqual(
            expect.arrayContaining([
                path.resolve("/home/alice/.ssh"),
                path.resolve("/etc/ssh"),
                path.resolve("/Users/host"),
                path.resolve("/Users/host/.daycare")
            ])
        );
    });

    it("dedupes overlapping hard-deny paths", () => {
        const result = sandboxReadDenyPathsBuild({
            platform: "linux",
            homeDir: "/home/alice",
            osHomeDir: "/home/alice",
            daycareConfigDir: "/home/alice/.daycare"
        });

        expect(new Set(result).size).toBe(result.length);
    });

    it("still denies parent OS home when remapped home is nested under it", () => {
        const result = sandboxReadDenyPathsBuild({
            platform: "darwin",
            homeDir: "/Users/host/.dev/users/u-1/home",
            osHomeDir: "/Users/host",
            daycareConfigDir: "/Users/host/.daycare"
        });

        expect(result).toContain(path.resolve("/Users/host"));
        expect(result).toContain(path.resolve("/Users/host/.daycare"));
    });
});
