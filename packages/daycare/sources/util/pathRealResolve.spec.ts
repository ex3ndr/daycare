import { describe, expect, it } from "vitest";

import { pathRealResolve } from "./pathRealResolve.js";

describe("pathRealResolve", () => {
    const homeDir = "/home/alice";
    const workingDir = "/workspace/project";

    it("resolves absolute POSIX paths", () => {
        expect(
            pathRealResolve({
                homeDir,
                workingDir,
                targetPath: "/var/log/../tmp/output.txt"
            })
        ).toBe("/var/tmp/output.txt");
    });

    it("resolves relative paths against workingDir", () => {
        expect(
            pathRealResolve({
                homeDir,
                workingDir,
                targetPath: "../notes/todo.md"
            })
        ).toBe("/workspace/notes/todo.md");
    });

    it("resolves home shorthand paths", () => {
        expect(
            pathRealResolve({
                homeDir,
                workingDir,
                targetPath: "~"
            })
        ).toBe("/home/alice");

        expect(
            pathRealResolve({
                homeDir,
                workingDir,
                targetPath: "~/downloads/./report.pdf"
            })
        ).toBe("/home/alice/downloads/report.pdf");

        expect(
            pathRealResolve({
                homeDir,
                workingDir,
                targetPath: "~//downloads/report.pdf"
            })
        ).toBe("/home/alice/downloads/report.pdf");

        expect(
            pathRealResolve({
                homeDir,
                workingDir,
                targetPath: "~/asdasd/../asdasd"
            })
        ).toBe("/home/alice/asdasd");
    });

    it("throws for non-absolute homeDir or workingDir", () => {
        expect(() =>
            pathRealResolve({
                homeDir: "home/alice",
                workingDir,
                targetPath: "file.txt"
            })
        ).toThrow("homeDir must be an absolute POSIX path.");

        expect(() =>
            pathRealResolve({
                homeDir,
                workingDir: "workspace/project",
                targetPath: "file.txt"
            })
        ).toThrow("workingDir must be an absolute POSIX path.");
    });
});
