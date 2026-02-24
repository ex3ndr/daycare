import { describe, expect, it } from "vitest";

import { sandboxPathContainerToHost } from "./sandboxPathContainerToHost.js";

describe("sandboxPathContainerToHost", () => {
    const hostHomeDir = "/data/users/u123/home";
    const hostSkillsActiveDir = "/data/users/u123/skills/active";
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

    it("rewrites /shared/skills path to host active skills root", () => {
        const rewritten = sandboxPathContainerToHost(hostHomeDir, userId, "/shared/skills", hostSkillsActiveDir);
        expect(rewritten).toBe(hostSkillsActiveDir);
    });

    it("rewrites nested /shared/skills paths to host active skills root", () => {
        const rewritten = sandboxPathContainerToHost(
            hostHomeDir,
            userId,
            "/shared/skills/core--deploy/SKILL.md",
            hostSkillsActiveDir
        );
        expect(rewritten).toBe("/data/users/u123/skills/active/core--deploy/SKILL.md");
    });
});
