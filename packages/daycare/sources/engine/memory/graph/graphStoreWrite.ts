import { promises as fs } from "node:fs";
import path from "node:path";

import { graphNodeSerialize } from "./graphNodeSerialize.js";
import { GRAPH_ROOT_NODE_ID, type GraphNode } from "./graphTypes.js";

/**
 * Writes a single graph node markdown file to disk.
 * Expects: non-root ids are stable and safe to use as filenames. Root node is virtual and cannot be written.
 */
export async function graphStoreWrite(memoryDir: string, node: GraphNode): Promise<void> {
    if (node.id === GRAPH_ROOT_NODE_ID) {
        throw new Error("Root node is virtual and cannot be written to disk.");
    }
    await fs.mkdir(memoryDir, { recursive: true });
    const filePath = path.join(memoryDir, `${node.id}.md`);
    const serialized = graphNodeSerialize(node);
    await fs.writeFile(filePath, serialized, "utf8");
}
