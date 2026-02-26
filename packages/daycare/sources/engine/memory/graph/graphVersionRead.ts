import { promises as fs } from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import { graphNodeParse } from "./graphNodeParse.js";
import { GRAPH_VERSION_FILE_PATTERN, type GraphNodeVersion } from "./graphTypes.js";

/**
 * Reads all version snapshots for a node from `<nodeId>.v<N>.md` files.
 * Expects: files are stored in the same graph directory as active node files.
 */
export async function graphVersionRead(memoryDir: string, nodeId: string): Promise<GraphNodeVersion[]> {
    let entries: Array<{ name: string; isFile: () => boolean }> = [];
    try {
        entries = await fs.readdir(memoryDir, { withFileTypes: true });
    } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            return [];
        }
        throw error;
    }

    const versionFiles = entries
        .filter((entry) => entry.isFile())
        .map((entry) => {
            const match = GRAPH_VERSION_FILE_PATTERN.exec(entry.name);
            if (!match || match[1] !== nodeId) {
                return null;
            }
            return {
                filename: entry.name,
                version: Number.parseInt(match[2] ?? "", 10)
            };
        })
        .filter((entry): entry is { filename: string; version: number } => entry !== null)
        .sort((left, right) => left.version - right.version);

    const versions: GraphNodeVersion[] = [];
    for (const versionFile of versionFiles) {
        const filePath = path.join(memoryDir, versionFile.filename);
        const raw = await fs.readFile(filePath, "utf8");
        const parsedNode = graphNodeParse(nodeId, raw);
        versions.push({
            ...parsedNode,
            frontmatter: {
                ...parsedNode.frontmatter,
                version: versionFile.version
            },
            changeDescription: graphVersionChangeDescriptionRead(raw)
        });
    }

    return versions;
}

function graphVersionChangeDescriptionRead(raw: string): string {
    try {
        const parsed = matter(raw);
        const value = (parsed.data as { changeDescription?: unknown }).changeDescription;
        if (typeof value === "string") {
            return value.trim();
        }
    } catch {
        // Fall through to empty description.
    }
    return "";
}
