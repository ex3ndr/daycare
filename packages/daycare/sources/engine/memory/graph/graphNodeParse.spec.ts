import { describe, expect, it } from "vitest";

import { graphNodeParse } from "./graphNodeParse.js";

describe("graphNodeParse", () => {
    it("parses frontmatter, content, and wiki-link refs", () => {
        const raw = [
            "---",
            "title: User prefers dark mode",
            "description: UI preference observed during onboarding",
            "createdAt: 1708531200000",
            "updatedAt: 1708531300000",
            "---",
            "User mentioned dark mode.",
            "See [[abc123]] and [[def456]].",
            "Duplicate [[abc123]] link."
        ].join("\n");

        const parsed = graphNodeParse("k8a9b2c3d4e5f6g7", raw);

        expect(parsed.id).toBe("k8a9b2c3d4e5f6g7");
        expect(parsed.frontmatter).toEqual({
            title: "User prefers dark mode",
            description: "UI preference observed during onboarding",
            createdAt: 1708531200000,
            updatedAt: 1708531300000
        });
        expect(parsed.content).toContain("User mentioned dark mode.");
        expect(parsed.refs).toEqual(["abc123", "def456"]);
    });

    it("uses defaults when frontmatter is missing", () => {
        const parsed = graphNodeParse("node-1", "Plain markdown body without metadata.");

        expect(parsed.frontmatter).toEqual({
            title: "node-1",
            description: "",
            createdAt: 0,
            updatedAt: 0
        });
        expect(parsed.content).toBe("Plain markdown body without metadata.");
        expect(parsed.refs).toEqual([]);
    });

    it("handles empty body and malformed frontmatter values gracefully", () => {
        const raw = [
            "---",
            "title: ''",
            "description: 7",
            "createdAt: invalid",
            "updatedAt: 1708531200001",
            "---"
        ].join("\n");

        const parsed = graphNodeParse("__root__", raw);

        expect(parsed.frontmatter).toEqual({
            title: "Memory Summary",
            description: "Structured summary of all memories",
            createdAt: 0,
            updatedAt: 1708531200001
        });
        expect(parsed.content).toBe("");
        expect(parsed.refs).toEqual([]);
    });
});
