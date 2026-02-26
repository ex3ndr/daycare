import { promises as fs } from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import type { GraphNode } from "./graphTypes.js";

/**
 * Writes a version snapshot file for a graph node as `<nodeId>.v<N>.md`.
 * Expects: node.frontmatter.version is the version being snapshotted.
 */
export async function graphVersionWrite(memoryDir: string, node: GraphNode, changeDescription: string): Promise<void> {
    const normalizedDescription = changeDescription.trim();
    if (normalizedDescription.length === 0) {
        throw new Error("changeDescription is required to write a node version.");
    }

    await fs.mkdir(memoryDir, { recursive: true });
    const versionFilePath = path.join(memoryDir, `${node.id}.v${node.frontmatter.version}.md`);
    const serialized = matter.stringify(node.content, {
        title: node.frontmatter.title,
        description: node.frontmatter.description,
        parents: node.frontmatter.parents,
        refs: node.refs,
        version: node.frontmatter.version,
        changeDescription: normalizedDescription,
        createdAt: node.frontmatter.createdAt,
        updatedAt: node.frontmatter.updatedAt
    });
    await fs.writeFile(versionFilePath, serialized.endsWith("\n") ? serialized.slice(0, -1) : serialized, "utf8");
}
