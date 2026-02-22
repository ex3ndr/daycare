import { describe, expect, it } from "vitest";

import { sandboxDangerousFileCheck } from "./sandboxDangerousFileCheck.js";

const dangerous = {
    files: [".bashrc", ".gitconfig", ".mcp.json"],
    directories: [".vscode", ".idea", ".claude/commands", ".git/hooks"]
};

describe("sandboxDangerousFileCheck", () => {
    it("matches dangerous basenames", () => {
        expect(sandboxDangerousFileCheck("/workspace/.bashrc", dangerous)).toBe(true);
        expect(sandboxDangerousFileCheck("/workspace/project/.gitconfig", dangerous)).toBe(true);
    });

    it("matches dangerous single-segment directories", () => {
        expect(sandboxDangerousFileCheck("/workspace/project/.vscode/settings.json", dangerous)).toBe(true);
        expect(sandboxDangerousFileCheck("/workspace/project/.idea/workspace.xml", dangerous)).toBe(true);
    });

    it("matches dangerous multi-segment directories", () => {
        expect(sandboxDangerousFileCheck("/workspace/project/.claude/commands/hello.md", dangerous)).toBe(true);
        expect(sandboxDangerousFileCheck("/workspace/project/.git/hooks/pre-commit", dangerous)).toBe(true);
    });

    it("does not match safe files", () => {
        expect(sandboxDangerousFileCheck("/workspace/project/src/index.ts", dangerous)).toBe(false);
        expect(sandboxDangerousFileCheck("/workspace/project/.git/hook/pre-commit", dangerous)).toBe(false);
    });
});
