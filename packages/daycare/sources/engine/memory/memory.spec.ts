import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { contextForUser } from "../agents/context.js";
import type { GraphNode } from "./graph/graphTypes.js";
import { Memory } from "./memory.js";

describe("Memory", () => {
    let usersDir: string;

    beforeEach(async () => {
        usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-memory-facade-"));
    });

    afterEach(async () => {
        await fs.rm(usersDir, { recursive: true, force: true });
    });

    it("readGraph returns virtual root and creates graph directory", async () => {
        const memory = new Memory({ usersDir });
        const ctx = contextForUser({ userId: "usr_001" });

        const tree = await memory.readGraph(ctx);

        expect(tree.root.id).toBe("__root__");
        expect(tree.root.content).toContain("Memory Graph");
        const graphDir = path.join(usersDir, "usr_001", "memory", "graph");
        const stat = await fs.stat(graphDir);
        expect(stat.isDirectory()).toBe(true);
    });

    it("readNode returns virtual root with children refs populated", async () => {
        const memory = new Memory({ usersDir });
        const ctx = contextForUser({ userId: "usr_001" });
        const child: GraphNode = {
            id: "child-1",
            frontmatter: {
                title: "Child",
                description: "Child node",
                parents: ["__root__"],
                createdAt: 1,
                updatedAt: 1
            },
            content: "body",
            refs: []
        };
        await memory.writeNode(ctx, child);

        const root = await memory.readNode(ctx, "__root__");

        expect(root).not.toBeNull();
        expect(root!.id).toBe("__root__");
        expect(root!.content).toContain("Memory Graph");
        expect(root!.refs).toContain("child-1");
    });

    it("append updates body and updatedAt while preserving frontmatter", async () => {
        const memory = new Memory({ usersDir });
        const ctx = contextForUser({ userId: "usr_001" });
        const node: GraphNode = {
            id: "node-1",
            frontmatter: {
                title: "Preference",
                description: "User preference",
                parents: ["__root__"],
                createdAt: 100,
                updatedAt: 100
            },
            content: "Initial line",
            refs: []
        };

        await memory.writeNode(ctx, node);
        await memory.append(ctx, "node-1", "Appended line");

        const updated = await memory.readNode(ctx, "node-1");
        expect(updated).not.toBeNull();
        expect(updated?.frontmatter.title).toBe("Preference");
        expect(updated?.frontmatter.description).toBe("User preference");
        expect(updated?.frontmatter.updatedAt).toBeGreaterThan(100);
        expect(updated?.content).toBe("Initial line\nAppended line");
    });
});
