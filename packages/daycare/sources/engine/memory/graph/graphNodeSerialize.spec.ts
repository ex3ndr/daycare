import { describe, expect, it } from "vitest";

import { graphNodeParse } from "./graphNodeParse.js";
import { graphNodeSerialize } from "./graphNodeSerialize.js";
import type { GraphNode } from "./graphTypes.js";

describe("graphNodeSerialize", () => {
    it("round-trips through parse with equivalent node structure", () => {
        const node: GraphNode = {
            id: "abc123",
            frontmatter: {
                title: "Preference",
                description: "Observed user preference",
                parents: ["__root__"],
                createdAt: 1700000000000,
                updatedAt: 1700000000500
            },
            content: "User prefers compact responses.",
            refs: []
        };

        const serialized = graphNodeSerialize(node);
        const reparsed = graphNodeParse(node.id, serialized);

        expect(reparsed).toEqual({
            ...node,
            refs: []
        });
    });

    it("preserves inline wiki links in content", () => {
        const node: GraphNode = {
            id: "node-2",
            frontmatter: {
                title: "Cross link",
                description: "Contains wiki links",
                parents: ["topic-1"],
                createdAt: 1,
                updatedAt: 2
            },
            content: "Link to [[ref-a]] and [[ref-b]] in markdown.",
            refs: ["ref-a", "ref-b"]
        };

        const serialized = graphNodeSerialize(node);
        const reparsed = graphNodeParse(node.id, serialized);

        expect(reparsed.content).toContain("[[ref-a]]");
        expect(reparsed.content).toContain("[[ref-b]]");
        expect(reparsed.refs).toEqual(["ref-a", "ref-b"]);
    });
});
