import { promises as fs } from "node:fs";
import path from "node:path";

import { graphNodeParse } from "./graphNodeParse.js";
import type { GraphNode } from "./graphTypes.js";

/**
 * Reads all markdown graph nodes from a memory directory.
 * Expects: files use `<id>.md` naming, with `__root__.md` reserved for the root node.
 */
export async function graphStoreRead(memoryDir: string): Promise<GraphNode[]> {
    let entries: Array<{ name: string; isFile: () => boolean }> = [];
    try {
        entries = await fs.readdir(memoryDir, { withFileTypes: true });
    } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            return [];
        }
        throw error;
    }

    const markdownFiles = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
        .map((entry) => entry.name)
        .sort();

    const nodes: GraphNode[] = [];
    for (const filename of markdownFiles) {
        const id = path.basename(filename, ".md");
        const filePath = path.join(memoryDir, filename);
        const raw = await fs.readFile(filePath, "utf8");
        nodes.push(graphNodeParse(id, raw));
    }

    return nodes;
}
