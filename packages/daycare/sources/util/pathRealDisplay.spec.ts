import { describe, expect, it } from "vitest";

import { pathRealDisplay } from "./pathRealDisplay.js";
import { pathRealResolve } from "./pathRealResolve.js";

describe("pathRealDisplay", () => {
    const homeDir = "/home/alice";

    it("returns home-relative paths when target is inside home", () => {
        expect(
            pathRealDisplay({
                homeDir,
                targetPath: "/home/alice/workspace/project/src/main.ts"
            })
        ).toBe("~/workspace/project/src/main.ts");

        expect(
            pathRealDisplay({
                homeDir,
                targetPath: "/home/alice"
            })
        ).toBe("~");
    });

    it("returns absolute normalized path when target is outside home", () => {
        expect(
            pathRealDisplay({
                homeDir,
                targetPath: "/var/log/../tmp/output.log"
            })
        ).toBe("/var/tmp/output.log");
    });

    it("round-trips with pathRealResolve across different working directories", () => {
        const workingDirs = ["/home/alice/workspace/project-a", "/tmp/other-project"];
        const targets = [
            "/home/alice/workspace/project/src/main.ts",
            "/home/alice/downloads/report.txt",
            "/var/tmp/output.log"
        ];

        for (const workingDir of workingDirs) {
            for (const targetPath of targets) {
                const displayPath = pathRealDisplay({
                    homeDir,
                    targetPath
                });
                expect(
                    pathRealResolve({
                        homeDir,
                        workingDir,
                        targetPath: displayPath
                    })
                ).toBe(pathRealResolve({ homeDir, workingDir, targetPath }));
            }
        }
    });

    it("throws for non-absolute homeDir and targetPath", () => {
        expect(() =>
            pathRealDisplay({
                homeDir: "home/alice",
                targetPath: "/tmp/a"
            })
        ).toThrow("homeDir must be an absolute POSIX path.");

        expect(() =>
            pathRealDisplay({
                homeDir,
                targetPath: "tmp/a"
            })
        ).toThrow("targetPath must be an absolute POSIX path.");
    });
});
