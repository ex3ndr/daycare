import { describe, expect, it } from "vitest";

import { sandboxPathContainerToHost } from "./sandboxPathContainerToHost.js";

describe("sandboxPathContainerToHost", () => {
    const hostHomeDir = "/data/users/u123/home";
    const userId = "u123";

    it("rewrites container home path to host home", () => {
        const rewritten = sandboxPathContainerToHost(hostHomeDir, userId, "/home/u123");
        expect(rewritten).toBe("/data/users/u123/home");
    });

    it("rewrites nested container home paths", () => {
        const rewritten = sandboxPathContainerToHost(hostHomeDir, userId, "/home/u123/desktop/project/file.ts");
        expect(rewritten).toBe("/data/users/u123/home/desktop/project/file.ts");
    });

    it("keeps non-mapped container paths unchanged", () => {
        const outsidePath = "/tmp/other/file.txt";
        const rewritten = sandboxPathContainerToHost(hostHomeDir, userId, outsidePath);
        expect(rewritten).toBe(outsidePath);
    });

    it("does not rewrite lookalike user ids", () => {
        const lookalikePath = "/home/u1234/desktop/file.ts";
        const rewritten = sandboxPathContainerToHost(hostHomeDir, userId, lookalikePath);
        expect(rewritten).toBe(lookalikePath);
    });

    it("keeps relative paths unchanged", () => {
        const relativePath = "home/u123/desktop/file.ts";
        const rewritten = sandboxPathContainerToHost(hostHomeDir, userId, relativePath);
        expect(rewritten).toBe(relativePath);
    });
});
