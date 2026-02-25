import path from "node:path";
import { describe, expect, it } from "vitest";

import { sandboxPathHostToContainerMap } from "./sandboxPathHostToContainerMap.js";

describe("sandboxPathHostToContainerMap", () => {
    const hostHomeDir = "/data/users/u123/home";
    const hostSkillsActiveDir = "/data/users/u123/skills/active";
    const hostExamplesDir = "/data/shared/examples";

    it("maps host home root and nested paths", () => {
        expect(sandboxPathHostToContainerMap(hostHomeDir, hostHomeDir)).toBe("/home");
        expect(
            sandboxPathHostToContainerMap(hostHomeDir, path.join(hostHomeDir, "desktop", "project", "file.ts"))
        ).toBe("/home/desktop/project/file.ts");
    });

    it("maps host skills and examples roots", () => {
        expect(
            sandboxPathHostToContainerMap(hostHomeDir, hostSkillsActiveDir, hostSkillsActiveDir, hostExamplesDir)
        ).toBe("/shared/skills");
        expect(
            sandboxPathHostToContainerMap(
                hostHomeDir,
                path.join(hostExamplesDir, "guide.md"),
                hostSkillsActiveDir,
                hostExamplesDir
            )
        ).toBe("/shared/examples/guide.md");
    });

    it("returns null for unmappable paths", () => {
        expect(sandboxPathHostToContainerMap(hostHomeDir, "/data/users/u123/apps/app.md")).toBeNull();
        expect(sandboxPathHostToContainerMap(hostHomeDir, "desktop/project/file.ts")).toBeNull();
        expect(sandboxPathHostToContainerMap(hostHomeDir, "/data/users/u123/homework/notes.txt")).toBeNull();
    });

    it("returns null when shared roots are missing from input mapping config", () => {
        expect(
            sandboxPathHostToContainerMap(hostHomeDir, path.join(hostSkillsActiveDir, "core", "SKILL.md"))
        ).toBeNull();
        expect(sandboxPathHostToContainerMap(hostHomeDir, path.join(hostExamplesDir, "guide.md"))).toBeNull();
    });
});
