import { promises as fs } from "node:fs";
import path from "node:path";

import { graphNodeSerialize } from "./graphNodeSerialize.js";
import { GRAPH_ROOT_FILENAME, GRAPH_ROOT_NODE_ID, type GraphNode } from "./graphTypes.js";

/**
 * Writes a single graph node markdown file to disk.
 * Expects: non-root ids are stable and safe to use as filenames.
 */
export async function graphStoreWrite(memoryDir: string, node: GraphNode): Promise<void> {
    await fs.mkdir(memoryDir, { recursive: true });
    const filename = node.id === GRAPH_ROOT_NODE_ID ? GRAPH_ROOT_FILENAME : `${node.id}.md`;
    const filePath = path.join(memoryDir, filename);
    const serialized = graphNodeSerialize(node);
    await fs.writeFile(filePath, serialized, "utf8");
}
