import path from "node:path";
import { describe, expect, it } from "vitest";

import { sandboxSensitiveDenyPathsBuild } from "./sandboxSensitiveDenyPathsBuild.js";

describe("sandboxSensitiveDenyPathsBuild", () => {
    it("includes common and linux-specific deny paths", () => {
        const result = sandboxSensitiveDenyPathsBuild({
            platform: "linux",
            homeDir: "/home/alice"
        });

        expect(result).toEqual(
            expect.arrayContaining([
                path.resolve("/home/alice/.ssh"),
                path.resolve("/home/alice/.gnupg"),
                path.resolve("/home/alice/.config/gh"),
                path.resolve("/home/alice/.git-credentials"),
                path.resolve("/etc/ssh"),
                path.resolve("/etc/sudoers"),
                path.resolve("/etc/ssl/private"),
                path.resolve("/root/.ssh")
            ])
        );
    });

    it("includes common and macOS-specific deny paths", () => {
        const result = sandboxSensitiveDenyPathsBuild({
            platform: "darwin",
            homeDir: "/Users/alice"
        });

        expect(result).toEqual(
            expect.arrayContaining([
                path.resolve("/Users/alice/.ssh"),
                path.resolve("/Users/alice/Library/Keychains"),
                path.resolve("/Users/alice/Library/Application Support/com.apple.TCC"),
                path.resolve("/private/etc/master.passwd"),
                path.resolve("/etc/ssh")
            ])
        );
    });

    it("does not include platform-specific entries for unsupported platforms", () => {
        const result = sandboxSensitiveDenyPathsBuild({
            platform: "win32",
            homeDir: "/Users/alice"
        });

        expect(result).toContain(path.resolve("/Users/alice/.ssh"));
        expect(result).not.toContain(path.resolve("/Users/alice/Library/Keychains"));
        expect(result).not.toContain(path.resolve("/root/.ssh"));
        expect(result).not.toContain(path.resolve("/private/etc/master.passwd"));
    });

    it("dedupes resolved paths", () => {
        const result = sandboxSensitiveDenyPathsBuild({
            platform: "linux",
            homeDir: "/home/alice/."
        });

        expect(new Set(result).size).toBe(result.length);
    });
});
