import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { graphStoreWrite } from "./graphStoreWrite.js";
import type { GraphNode } from "./graphTypes.js";

describe("graphStoreWrite", () => {
    let memoryDir: string;

    beforeEach(async () => {
        memoryDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-graph-store-write-"));
    });

    afterEach(async () => {
        await fs.rm(memoryDir, { recursive: true, force: true });
    });

    it("rejects writing the root node", async () => {
        const node: GraphNode = {
            id: "__root__",
            frontmatter: {
                title: "Memory Summary",
                description: "Root",
                parents: [],
                createdAt: 1,
                updatedAt: 1
            },
            content: "# Memory Summary",
            refs: []
        };

        await expect(graphStoreWrite(memoryDir, node)).rejects.toThrow("virtual");
    });

    it("writes non-root node to <id>.md", async () => {
        const node: GraphNode = {
            id: "abc123",
            frontmatter: {
                title: "Node",
                description: "Desc",
                parents: ["__root__"],
                createdAt: 1,
                updatedAt: 2
            },
            content: "Body",
            refs: []
        };

        await graphStoreWrite(memoryDir, node);

        const filePath = path.join(memoryDir, "abc123.md");
        const content = await fs.readFile(filePath, "utf8");
        expect(content).toContain("title: Node");
        expect(content).toContain("parents:");
        expect(content).toContain("Body");
    });
});
