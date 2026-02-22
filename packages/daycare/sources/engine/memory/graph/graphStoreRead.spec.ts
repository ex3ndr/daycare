import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { graphNodeSerialize } from "./graphNodeSerialize.js";
import { graphStoreRead } from "./graphStoreRead.js";
import type { GraphNode } from "./graphTypes.js";

describe("graphStoreRead", () => {
    let memoryDir: string;

    beforeEach(async () => {
        memoryDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-graph-store-read-"));
    });

    afterEach(async () => {
        await fs.rm(memoryDir, { recursive: true, force: true });
    });

    it("reads and parses all markdown graph files", async () => {
        const rootNode: GraphNode = {
            id: "__root__",
            frontmatter: {
                title: "Memory Summary",
                description: "Root",
                createdAt: 1,
                updatedAt: 1
            },
            content: "# Memory Summary\n[[node-1]]",
            refs: ["node-1"]
        };
        const childNode: GraphNode = {
            id: "node-1",
            frontmatter: {
                title: "Node 1",
                description: "Child",
                createdAt: 2,
                updatedAt: 3
            },
            content: "Child body",
            refs: []
        };

        await fs.writeFile(path.join(memoryDir, "__root__.md"), graphNodeSerialize(rootNode), "utf8");
        await fs.writeFile(path.join(memoryDir, "node-1.md"), graphNodeSerialize(childNode), "utf8");
        await fs.writeFile(path.join(memoryDir, "ignore.txt"), "not markdown", "utf8");

        const nodes = await graphStoreRead(memoryDir);

        expect(nodes).toHaveLength(2);
        expect(nodes[0]?.id).toBe("__root__");
        expect(nodes[1]?.id).toBe("node-1");
        expect(nodes[0]?.refs).toEqual(["node-1"]);
        expect(nodes[1]?.frontmatter.title).toBe("Node 1");
    });

    it("returns empty array when memory dir does not exist", async () => {
        const missingDir = path.join(memoryDir, "missing");
        const nodes = await graphStoreRead(missingDir);
        expect(nodes).toEqual([]);
    });
});
