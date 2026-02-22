import { describe, expect, it } from "vitest";

import { sandboxDangerousFilesBuild } from "./sandboxDangerousFilesBuild.js";

describe("sandboxDangerousFilesBuild", () => {
    it("returns the sandbox runtime dangerous file patterns", () => {
        const result = sandboxDangerousFilesBuild();

        expect(result.files).toEqual([
            ".gitconfig",
            ".gitmodules",
            ".bashrc",
            ".bash_profile",
            ".zshrc",
            ".zprofile",
            ".profile",
            ".ripgreprc",
            ".mcp.json"
        ]);
    });

    it("returns the sandbox runtime dangerous directory patterns", () => {
        const result = sandboxDangerousFilesBuild();

        expect(result.directories).toEqual([".vscode", ".idea", ".claude/commands", ".claude/agents", ".git/hooks"]);
    });

    it("returns defensive copies", () => {
        const result = sandboxDangerousFilesBuild();
        result.files.push("changed");
        result.directories.push("changed");

        const next = sandboxDangerousFilesBuild();
        expect(next.files).not.toContain("changed");
        expect(next.directories).not.toContain("changed");
    });
});
