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
        expect(tree.root.frontmatter.version).toBe(1);
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
                version: 1,
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

    it("writeNode sets new nodes to version=1 and creates no version files", async () => {
        const memory = new Memory({ usersDir });
        const ctx = contextForUser({ userId: "usr_001" });
        const node: GraphNode = {
            id: "node-1",
            frontmatter: {
                title: "Preference",
                description: "User preference",
                parents: ["__root__"],
                version: 999,
                createdAt: 100,
                updatedAt: 100
            },
            content: "Initial line",
            refs: []
        };

        await memory.writeNode(ctx, node);

        const written = await memory.readNode(ctx, "node-1");
        const versions = await memory.readNodeVersions(ctx, "node-1");

        expect(written).not.toBeNull();
        expect(written?.frontmatter.version).toBe(1);
        expect(versions).toEqual([]);
    });

    it("writeNode with changeDescription creates version snapshot and increments version", async () => {
        const memory = new Memory({ usersDir });
        const ctx = contextForUser({ userId: "usr_001" });
        const baseNode: GraphNode = {
            id: "node-1",
            frontmatter: {
                title: "Preference",
                description: "User preference",
                parents: ["__root__"],
                version: 1,
                createdAt: 100,
                updatedAt: 100
            },
            content: "Initial line",
            refs: ["ref-a"]
        };
        const updatedNode: GraphNode = {
            ...baseNode,
            frontmatter: {
                ...baseNode.frontmatter,
                updatedAt: 200
            },
            content: "Updated line",
            refs: ["ref-b"]
        };

        await memory.writeNode(ctx, baseNode);
        await memory.writeNode(ctx, updatedNode, { changeDescription: "Expanded details with examples" });

        const current = await memory.readNode(ctx, "node-1");
        const versions = await memory.readNodeVersions(ctx, "node-1");

        expect(current).not.toBeNull();
        expect(current?.frontmatter.version).toBe(2);
        expect(current?.content).toBe("Updated line");
        expect(versions).toHaveLength(1);
        expect(versions[0]?.frontmatter.version).toBe(1);
        expect(versions[0]?.content).toBe("Initial line");
        expect(versions[0]?.refs).toEqual(["ref-a"]);
        expect(versions[0]?.changeDescription).toBe("Expanded details with examples");
    });

    it("writeNode skips version snapshot when no meaningful fields changed", async () => {
        const memory = new Memory({ usersDir });
        const ctx = contextForUser({ userId: "usr_001" });
        const baseNode: GraphNode = {
            id: "node-1",
            frontmatter: {
                title: "Preference",
                description: "User preference",
                parents: ["__root__"],
                version: 1,
                createdAt: 100,
                updatedAt: 100
            },
            content: "Initial line",
            refs: ["ref-a"]
        };
        const noChangeNode: GraphNode = {
            ...baseNode,
            frontmatter: {
                ...baseNode.frontmatter,
                updatedAt: 101
            }
        };

        await memory.writeNode(ctx, baseNode);
        await memory.writeNode(ctx, noChangeNode, { changeDescription: "No-op rewrite" });

        const current = await memory.readNode(ctx, "node-1");
        const versions = await memory.readNodeVersions(ctx, "node-1");

        expect(current?.frontmatter.version).toBe(1);
        expect(versions).toEqual([]);
    });

    it("append with changeDescription creates a version snapshot", async () => {
        const memory = new Memory({ usersDir });
        const ctx = contextForUser({ userId: "usr_001" });
        const node: GraphNode = {
            id: "node-1",
            frontmatter: {
                title: "Preference",
                description: "User preference",
                parents: ["__root__"],
                version: 1,
                createdAt: 100,
                updatedAt: 100
            },
            content: "Initial line",
            refs: []
        };

        await memory.writeNode(ctx, node);
        await memory.append(ctx, "node-1", "Appended line", "Added extra evidence");

        const updated = await memory.readNode(ctx, "node-1");
        const versions = await memory.readNodeVersions(ctx, "node-1");

        expect(updated).not.toBeNull();
        expect(updated?.frontmatter.version).toBe(2);
        expect(updated?.content).toBe("Initial line\nAppended line");
        expect(versions).toHaveLength(1);
        expect(versions[0]?.content).toBe("Initial line");
        expect(versions[0]?.changeDescription).toBe("Added extra evidence");
    });

    it("increments version across multiple updates", async () => {
        const memory = new Memory({ usersDir });
        const ctx = contextForUser({ userId: "usr_001" });
        const initial: GraphNode = {
            id: "node-1",
            frontmatter: {
                title: "Preference",
                description: "User preference",
                parents: ["__root__"],
                version: 1,
                createdAt: 100,
                updatedAt: 100
            },
            content: "v1",
            refs: []
        };

        await memory.writeNode(ctx, initial);
        await memory.writeNode(
            ctx,
            {
                ...initial,
                frontmatter: { ...initial.frontmatter, updatedAt: 200 },
                content: "v2"
            },
            { changeDescription: "Revision 1" }
        );
        await memory.writeNode(
            ctx,
            {
                ...initial,
                frontmatter: { ...initial.frontmatter, updatedAt: 300, description: "Updated description" },
                content: "v3"
            },
            { changeDescription: "Revision 2" }
        );

        const current = await memory.readNode(ctx, "node-1");
        const versions = await memory.readNodeVersions(ctx, "node-1");

        expect(current?.frontmatter.version).toBe(3);
        expect(current?.content).toBe("v3");
        expect(versions.map((versionNode) => versionNode.frontmatter.version)).toEqual([1, 2]);
        expect(versions[0]?.content).toBe("v1");
        expect(versions[1]?.content).toBe("v2");
    });
});
