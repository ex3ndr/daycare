import fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

    it("returns graph JSON from memory facade", async () => {
        const readGraph = vi.fn(async () => ({
            root: {
                id: "__root__",
                frontmatter: {
                    title: "Memory Summary",
                    description: "Structured summary",
                    parents: [],
                    createdAt: 1,
                    updatedAt: 1
                },
                content: "# Memory Summary",
                refs: ["node-1"]
            },
            children: new Map([
                [
                    "__root__",
                    [
                        {
                            id: "node-1",
                            frontmatter: {
                                title: "Node 1",
                                description: "Node one description",
                                parents: ["__root__"],
                                createdAt: 2,
                                updatedAt: 3
                            },
                            content: "node body",
                            refs: []
                        }
                    ]
                ]
            ])
        }));

        serverMemoryRoutesRegister(app, {
            memory: {
                readGraph,
                readNode: vi.fn(async () => null)
            }
        });

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
        expect(payload.graph.root.id).toBe("__root__");
        expect(payload.graph.children.__root__?.map((entry) => entry.id)).toEqual(["node-1"]);
        expect(readGraph).toHaveBeenCalledWith(contextForUser({ userId: "usr_1" }));
    });

    it("returns node payload and 404 for missing node", async () => {
        const readNode = vi.fn(async (_ctx: unknown, nodeId: string) => {
            if (nodeId === "known") {
                return {
                    id: "known",
                    frontmatter: {
                        title: "Known",
                        description: "Known node",
                        parents: ["__root__"],
                        createdAt: 1,
                        updatedAt: 1
                    },
                    content: "body",
                    refs: []
                };
            }
            return null;
        });

        serverMemoryRoutesRegister(app, {
            memory: {
                readGraph: vi.fn(async () => ({
                    root: {
                        id: "__root__",
                        frontmatter: {
                            title: "Memory Summary",
                            description: "Structured summary",
                            parents: [],
                            createdAt: 1,
                            updatedAt: 1
                        },
                        content: "",
                        refs: []
                    },
                    children: new Map()
                })),
                readNode
            }
        });

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
    });
});

describe("graphTreeJsonBuild", () => {
    it("serializes map children into plain object", () => {
        const json = graphTreeJsonBuild({
            root: {
                id: "__root__",
                frontmatter: {
                    title: "Memory Summary",
                    description: "Structured summary",
                    parents: [],
                    createdAt: 0,
                    updatedAt: 0
                },
                content: "",
                refs: []
            },
            children: new Map([
                [
                    "__root__",
                    [
                        {
                            id: "child",
                            frontmatter: {
                                title: "Child",
                                description: "Child description",
                                parents: ["__root__"],
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

        expect(json.children.__root__?.[0]?.id).toBe("child");
    });
});
