import { describe, expect, it } from "vitest";

import { sandboxPathContainerToHost } from "./sandboxPathContainerToHost.js";

describe("sandboxPathContainerToHost", () => {
    const hostHomeDir = "/data/users/u123/home";
    const userId = "u123";

    it("rewrites container home path to host home", () => {
        const rewritten = sandboxPathContainerToHost(hostHomeDir, userId, "/home");
        expect(rewritten).toBe("/data/users/u123/home");
    });

    it("rewrites nested container home paths", () => {
        const rewritten = sandboxPathContainerToHost(hostHomeDir, userId, "/home/desktop/project/file.ts");
        expect(rewritten).toBe("/data/users/u123/home/desktop/project/file.ts");
    });

    it("keeps non-mapped container paths unchanged", () => {
        const outsidePath = "/tmp/other/file.txt";
        const rewritten = sandboxPathContainerToHost(hostHomeDir, userId, outsidePath);
        expect(rewritten).toBe(outsidePath);
    });

    it("keeps relative paths unchanged", () => {
        const relativePath = "home/desktop/file.ts";
        const rewritten = sandboxPathContainerToHost(hostHomeDir, userId, relativePath);
        expect(rewritten).toBe(relativePath);
    });
});
