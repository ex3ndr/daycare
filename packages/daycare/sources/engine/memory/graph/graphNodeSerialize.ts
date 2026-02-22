import matter from "gray-matter";

import type { GraphNode } from "./graphTypes.js";

/**
 * Serializes a graph node to markdown with YAML frontmatter.
 * Expects: node.frontmatter already normalized and content contains markdown body.
 */
export function graphNodeSerialize(node: GraphNode): string {
    const serialized = matter.stringify(node.content, {
        title: node.frontmatter.title,
        description: node.frontmatter.description,
        path: node.frontmatter.path,
        createdAt: node.frontmatter.createdAt,
        updatedAt: node.frontmatter.updatedAt
    });
    return serialized.endsWith("\n") ? serialized.slice(0, -1) : serialized;
}
