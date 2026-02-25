import { describe, expect, it } from "vitest";

import { sandboxPathContainerToHostMap } from "./sandboxPathContainerToHostMap.js";

describe("sandboxPathContainerToHostMap", () => {
    const hostHomeDir = "/data/users/u123/home";
    const hostSkillsActiveDir = "/data/users/u123/skills/active";
    const hostExamplesDir = "/data/shared/examples";

    it("maps container home root and nested paths", () => {
        expect(sandboxPathContainerToHostMap(hostHomeDir, "/home")).toBe("/data/users/u123/home");
        expect(sandboxPathContainerToHostMap(hostHomeDir, "/home/desktop/project/file.ts")).toBe(
            "/data/users/u123/home/desktop/project/file.ts"
        );
    });

    it("maps container shared skills and examples paths", () => {
        expect(sandboxPathContainerToHostMap(hostHomeDir, "/shared/skills", hostSkillsActiveDir, hostExamplesDir)).toBe(
            hostSkillsActiveDir
        );
        expect(
            sandboxPathContainerToHostMap(
                hostHomeDir,
                "/shared/examples/guide.md",
                hostSkillsActiveDir,
                hostExamplesDir
            )
        ).toBe("/data/shared/examples/guide.md");
    });

    it("returns null for unmappable paths", () => {
        expect(sandboxPathContainerToHostMap(hostHomeDir, "/tmp/other/file.txt")).toBeNull();
        expect(sandboxPathContainerToHostMap(hostHomeDir, "home/desktop/file.ts")).toBeNull();
    });

    it("returns null when shared roots are missing from input mapping config", () => {
        expect(sandboxPathContainerToHostMap(hostHomeDir, "/shared/skills/core--deploy/SKILL.md")).toBeNull();
        expect(sandboxPathContainerToHostMap(hostHomeDir, "/shared/examples/guide.md")).toBeNull();
    });
});
