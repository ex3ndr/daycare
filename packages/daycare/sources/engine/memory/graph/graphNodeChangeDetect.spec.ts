import { describe, expect, it } from "vitest";

import { graphNodeChangeDetect } from "./graphNodeChangeDetect.js";
import type { GraphNode } from "./graphTypes.js";

function nodeBase(): GraphNode {
    return {
        id: "node-1",
        frontmatter: {
            title: "Node 1",
            description: "Description",
            parents: ["__root__"],
            version: 1,
            createdAt: 100,
            updatedAt: 200
        },
        content: "Original body",
        refs: ["ref-a", "ref-b"]
    };
}

describe("graphNodeChangeDetect", () => {
    it("returns false when relevant fields are unchanged", () => {
        const node = nodeBase();
        const sameNode: GraphNode = {
            ...node,
            frontmatter: {
                ...node.frontmatter,
                parents: ["__root__"]
            },
            refs: ["ref-a", "ref-b"]
        };
        expect(graphNodeChangeDetect(node, sameNode)).toBe(false);
    });

    it("returns true when content changed", () => {
        const node = nodeBase();
        const updated: GraphNode = { ...node, content: "Updated body" };
        expect(graphNodeChangeDetect(node, updated)).toBe(true);
    });

    it("returns true when refs changed", () => {
        const node = nodeBase();
        const updated: GraphNode = { ...node, refs: ["ref-a", "ref-c"] };
        expect(graphNodeChangeDetect(node, updated)).toBe(true);
    });

    it("returns true when parents changed", () => {
        const node = nodeBase();
        const updated: GraphNode = {
            ...node,
            frontmatter: { ...node.frontmatter, parents: ["topic-1"] }
        };
        expect(graphNodeChangeDetect(node, updated)).toBe(true);
    });

    it("returns true when title or description changed", () => {
        const node = nodeBase();
        const titleUpdated: GraphNode = {
            ...node,
            frontmatter: { ...node.frontmatter, title: "Renamed" }
        };
        const descriptionUpdated: GraphNode = {
            ...node,
            frontmatter: { ...node.frontmatter, description: "Updated description" }
        };
        expect(graphNodeChangeDetect(node, titleUpdated)).toBe(true);
        expect(graphNodeChangeDetect(node, descriptionUpdated)).toBe(true);
    });

    it("returns true when multiple fields changed", () => {
        const node = nodeBase();
        const updated: GraphNode = {
            ...node,
            frontmatter: {
                ...node.frontmatter,
                title: "Renamed",
                parents: ["topic-1"]
            },
            content: "Updated body",
            refs: ["ref-z"]
        };
        expect(graphNodeChangeDetect(node, updated)).toBe(true);
    });
});
