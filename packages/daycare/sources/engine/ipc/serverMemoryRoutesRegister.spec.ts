import fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForUser } from "../agents/context.js";
import { graphTreeJsonBuild, serverMemoryRoutesRegister } from "./serverMemoryRoutesRegister.js";

describe("serverMemoryRoutesRegister", () => {
    let app: ReturnType<typeof fastify>;

    beforeEach(() => {
        app = fastify({ logger: false });
    });

    afterEach(async () => {
        await app.close();
    });

    it("returns graph JSON from document-backed memory", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForUser({ userId: "usr_1" });
            await storage.documents.create(ctx, {
                id: "memory",
                slug: "memory",
                title: "Memory",
                description: "Structured summary",
                body: "# Memory Summary",
                createdAt: 1,
                updatedAt: 1
            });
            await storage.documents.create(ctx, {
                id: "node-1",
                slug: "node-1",
                title: "Node 1",
                description: "Node one description",
                body: "node body",
                createdAt: 2,
                updatedAt: 3,
                parentId: "memory"
            });

            serverMemoryRoutesRegister(app, { storage });

            const response = await app.inject({
                method: "GET",
                url: "/v1/engine/memory/usr_1/graph"
            });

            expect(response.statusCode).toBe(200);
            const payload = response.json() as {
                ok: boolean;
                graph: { root: { id: string }; children: Record<string, Array<{ id: string }>> };
            };
            expect(payload.ok).toBe(true);
            expect(payload.graph.root.id).toBe("memory");
            expect(payload.graph.children.memory?.map((entry) => entry.id)).toEqual(["node-1"]);
        } finally {
            storage.connection.close();
        }
    });

    it("returns node payload and 404 for missing node", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForUser({ userId: "usr_1" });
            await storage.documents.create(ctx, {
                id: "memory",
                slug: "memory",
                title: "Memory",
                description: "Structured summary",
                body: "# Memory Summary",
                createdAt: 1,
                updatedAt: 1
            });
            await storage.documents.create(ctx, {
                id: "known",
                slug: "known",
                title: "Known",
                description: "Known node",
                body: "body",
                createdAt: 2,
                updatedAt: 2,
                parentId: "memory"
            });

            serverMemoryRoutesRegister(app, { storage });

            const found = await app.inject({
                method: "GET",
                url: "/v1/engine/memory/usr_1/node/known"
            });
            expect(found.statusCode).toBe(200);
            const foundPayload = found.json() as { ok: boolean; node: { id: string } };
            expect(foundPayload.ok).toBe(true);
            expect(foundPayload.node.id).toBe("known");

            const missing = await app.inject({
                method: "GET",
                url: "/v1/engine/memory/usr_1/node/missing"
            });
            expect(missing.statusCode).toBe(404);
            const missingPayload = missing.json() as { ok: boolean; error: string };
            expect(missingPayload.ok).toBe(false);
            expect(missingPayload.error).toContain("Node not found: missing");
        } finally {
            storage.connection.close();
        }
    });
});

describe("graphTreeJsonBuild", () => {
    it("serializes map children into plain object", () => {
        const json = graphTreeJsonBuild({
            root: {
                id: "memory",
                frontmatter: {
                    title: "Memory",
                    description: "Structured summary",
                    parents: [],
                    version: 1,
                    createdAt: 0,
                    updatedAt: 0
                },
                content: "",
                refs: []
            },
            children: new Map([
                [
                    "memory",
                    [
                        {
                            id: "child",
                            frontmatter: {
                                title: "Child",
                                description: "Child description",
                                parents: ["memory"],
                                version: 1,
                                createdAt: 0,
                                updatedAt: 0
                            },
                            content: "",
                            refs: []
                        }
                    ]
                ]
            ])
        });

        expect(json.children.memory?.[0]?.id).toBe("child");
    });
});
