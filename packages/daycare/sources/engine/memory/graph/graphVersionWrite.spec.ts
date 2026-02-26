import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GraphNode } from "./graphTypes.js";
import { graphVersionWrite } from "./graphVersionWrite.js";

describe("graphVersionWrite", () => {
    let memoryDir: string;

    beforeEach(async () => {
        memoryDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-graph-version-write-"));
    });

    afterEach(async () => {
        await fs.rm(memoryDir, { recursive: true, force: true });
    });

    it("writes a node snapshot to <nodeId>.v<version>.md with changeDescription", async () => {
        const node: GraphNode = {
            id: "node-1",
            frontmatter: {
                title: "Node 1",
                description: "Description",
                parents: ["__root__"],
                version: 2,
                createdAt: 100,
                updatedAt: 200
            },
            content: "Original node content.",
            refs: ["ref-a"]
        };

        await graphVersionWrite(memoryDir, node, "Expanded details with examples");

        const versionPath = path.join(memoryDir, "node-1.v2.md");
        const raw = await fs.readFile(versionPath, "utf8");
        const parsed = matter(raw);

        expect(parsed.content).toBe("Original node content.");
        expect(parsed.data).toMatchObject({
            title: "Node 1",
            description: "Description",
            parents: ["__root__"],
            refs: ["ref-a"],
            version: 2,
            changeDescription: "Expanded details with examples",
            createdAt: 100,
            updatedAt: 200
        });
    });
});
