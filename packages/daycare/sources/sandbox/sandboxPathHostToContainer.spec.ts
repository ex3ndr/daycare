import path from "node:path";
import { describe, expect, it } from "vitest";

import { sandboxPathHostToContainer } from "./sandboxPathHostToContainer.js";

describe("sandboxPathHostToContainer", () => {
    const hostHomeDir = "/data/users/u123/home";
    const hostSkillsActiveDir = "/data/users/u123/skills/active";
    const userId = "u123";

    it("rewrites host home path to container home", () => {
        const rewritten = sandboxPathHostToContainer(hostHomeDir, userId, hostHomeDir);
        expect(rewritten).toBe("/home");
    });

    it("rewrites nested host home paths", () => {
        const targetPath = path.join(hostHomeDir, "desktop", "project", "file.ts");
        const rewritten = sandboxPathHostToContainer(hostHomeDir, userId, targetPath);
        expect(rewritten).toBe("/home/desktop/project/file.ts");
    });

    it("keeps paths outside host home unchanged", () => {
        const outsidePath = "/data/users/u123/apps/app.md";
        const rewritten = sandboxPathHostToContainer(hostHomeDir, userId, outsidePath);
        expect(rewritten).toBeNull();
    });

    it("does not rewrite lookalike prefixes", () => {
        const lookalikePath = "/data/users/u123/homework/notes.txt";
        const rewritten = sandboxPathHostToContainer(hostHomeDir, userId, lookalikePath);
        expect(rewritten).toBeNull();
    });

    it("keeps relative paths unchanged", () => {
        const relativePath = "desktop/project/file.ts";
        const rewritten = sandboxPathHostToContainer(hostHomeDir, userId, relativePath);
        expect(rewritten).toBeNull();
    });

    it("rewrites active skills root to /shared/skills", () => {
        const rewritten = sandboxPathHostToContainer(hostHomeDir, userId, hostSkillsActiveDir, hostSkillsActiveDir);
        expect(rewritten).toBe("/shared/skills");
    });

    it("rewrites active skills nested paths to /shared/skills", () => {
        const targetPath = path.join(hostSkillsActiveDir, "core--deploy", "SKILL.md");
        const rewritten = sandboxPathHostToContainer(hostHomeDir, userId, targetPath, hostSkillsActiveDir);
        expect(rewritten).toBe("/shared/skills/core--deploy/SKILL.md");
    });
});
