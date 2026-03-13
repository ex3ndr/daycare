import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForAgent } from "../../agents/context.js";
import { documentReadToolBuild } from "./documentReadToolBuild.js";
import { documentWriteToolBuild } from "./documentWriteToolBuild.js";

const toolCall = { id: "tc1", name: "vault_write" };
const readToolCall = { id: "tc-read", name: "vault_read" };

function contextBuild(
    storage: Awaited<ReturnType<typeof storageOpenTest>>,
    readVersions: Map<string, number>,
    agentKind: "agent" | "memory" | "compactor" = "agent",
    input?: { path?: string; name?: string }
) {
    return {
        ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
        storage,
        agentSystem: { storage },
        agent: {
            path: input?.path ?? "/user-1/agent/helper",
            config: {
                kind: agentKind,
                name: input?.name ?? null
            },
            documentChainReadMark: (entries: Array<{ id: string; version: number }>) => {
                for (const entry of entries) {
                    readVersions.set(entry.id, entry.version);
                }
            },
            documentVersionLastRead: (vaultId: string) => readVersions.get(vaultId) ?? null
        }
    } as never;
}

describe("documentWriteToolBuild", () => {
    it("creates a vault entry when vaultId is omitted", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const tool = documentWriteToolBuild();
            const result = await tool.execute(
                {
                    slug: "memory",
                    title: "Memory",
                    description: "Memory root",
                    body: "Root body"
                },
                contextBuild(storage, readVersions),
                toolCall
            );

            expect(result.typedResult.version).toBe(1);
            const createdId = String(result.typedResult.vaultId ?? "");
            const created = await storage.documents.findById(
                contextForAgent({ userId: "user-1", agentId: "agent-1" }),
                createdId
            );
            expect(created?.slug).toBe("memory");
            expect(created?.title).toBe("Memory");
        } finally {
            storage.connection.close();
        }
    });

    it("updates a vault entry when vaultId is provided", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "doc-1",
                slug: "memory",
                title: "Memory",
                description: "Memory root",
                body: "v1",
                createdAt: 1,
                updatedAt: 1
            });

            const tool = documentWriteToolBuild();
            const result = await tool.execute(
                {
                    vaultId: "doc-1",
                    slug: "memory",
                    title: "Memory Updated",
                    description: "Memory root updated",
                    body: "v2"
                },
                contextBuild(storage, readVersions),
                toolCall
            );

            expect(result.typedResult.vaultId).toBe("doc-1");
            expect(result.typedResult.version).toBe(2);
            const updated = await storage.documents.findById(ctx, "doc-1");
            expect(updated?.title).toBe("Memory Updated");
            expect(updated?.body).toBe("v2");
        } finally {
            storage.connection.close();
        }
    });

    it("creates with parentPath", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "memory",
                slug: "memory",
                title: "Memory",
                description: "Memory root",
                body: "",
                createdAt: 1,
                updatedAt: 1
            });

            const readTool = documentReadToolBuild();
            await readTool.execute({ path: "vault://memory" }, contextBuild(storage, readVersions), readToolCall);

            const tool = documentWriteToolBuild();
            const result = await tool.execute(
                {
                    slug: "user",
                    title: "User",
                    description: "User facts",
                    body: "Prefers concise answers.",
                    parentPath: "vault://memory"
                },
                contextBuild(storage, readVersions),
                toolCall
            );

            const parentId = await storage.documents.findParentId(ctx, String(result.typedResult.vaultId ?? ""));
            expect(parentId).toBe("memory");
        } finally {
            storage.connection.close();
        }
    });

    it("returns validation errors for invalid parent arguments", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "memory",
                slug: "memory",
                title: "Memory",
                description: "Memory root",
                body: "",
                createdAt: 1,
                updatedAt: 1
            });

            const tool = documentWriteToolBuild();
            await expect(
                tool.execute(
                    {
                        slug: "user",
                        title: "User",
                        description: "User facts",
                        body: "x",
                        parentPath: "vault://missing"
                    },
                    contextBuild(storage, readVersions),
                    toolCall
                )
            ).rejects.toThrow("Parent path not found");

            await expect(
                tool.execute(
                    {
                        slug: "user",
                        title: "User",
                        description: "User facts",
                        body: "x",
                        parentId: "different-parent",
                        parentPath: "vault://memory"
                    },
                    contextBuild(storage, readVersions),
                    toolCall
                )
            ).rejects.toThrow("different vault entries");
        } finally {
            storage.connection.close();
        }
    });

    it("rejects path-unsafe slugs", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const tool = documentWriteToolBuild();
            await expect(
                tool.execute(
                    {
                        slug: "user/profile",
                        title: "User",
                        description: "User facts",
                        body: "x"
                    },
                    contextBuild(storage, readVersions),
                    toolCall
                )
            ).rejects.toThrow("cannot contain '/'");
        } finally {
            storage.connection.close();
        }
    });

    it("rejects attach when the parent chain was not read", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "memory",
                slug: "memory",
                title: "Memory",
                description: "Memory root",
                body: "",
                createdAt: 1,
                updatedAt: 1
            });
            await storage.documents.create(ctx, {
                id: "user",
                slug: "user",
                title: "User",
                description: "User node",
                body: "",
                createdAt: 2,
                updatedAt: 2,
                parentId: "memory"
            });

            // Simulate a partial read marker: parent read but root missing.
            readVersions.set("user", 1);
            const tool = documentWriteToolBuild();
            await expect(
                tool.execute(
                    {
                        slug: "prefs",
                        title: "Prefs",
                        description: "Prefs",
                        body: "",
                        parentPath: "vault://memory/user"
                    },
                    contextBuild(storage, readVersions),
                    toolCall
                )
            ).rejects.toThrow("Parent vault chain must be read before attach");
        } finally {
            storage.connection.close();
        }
    });

    it("rejects attach when a chain document changed after read", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "memory",
                slug: "memory",
                title: "Memory",
                description: "Memory root",
                body: "",
                createdAt: 1,
                updatedAt: 1
            });
            await storage.documents.create(ctx, {
                id: "user",
                slug: "user",
                title: "User",
                description: "User node",
                body: "",
                createdAt: 2,
                updatedAt: 2,
                parentId: "memory"
            });

            const readTool = documentReadToolBuild();
            await readTool.execute({ path: "vault://memory/user" }, contextBuild(storage, readVersions), readToolCall);
            await storage.documents.update(ctx, "user", { body: "changed", updatedAt: 3 });

            const tool = documentWriteToolBuild();
            await expect(
                tool.execute(
                    {
                        slug: "prefs",
                        title: "Prefs",
                        description: "Prefs",
                        body: "",
                        parentPath: "vault://memory/user"
                    },
                    contextBuild(storage, readVersions),
                    toolCall
                )
            ).rejects.toThrow("Parent vault chain changed since last read");
        } finally {
            storage.connection.close();
        }
    });

    it("rejects creating a non-memory root document for memory-agents", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const tool = documentWriteToolBuild();
            await expect(
                tool.execute(
                    {
                        slug: "notes",
                        title: "Notes",
                        description: "General notes",
                        body: "x"
                    },
                    contextBuild(storage, readVersions, "memory"),
                    toolCall
                )
            ).rejects.toThrow(
                "Memory agents can only write inside vault://memory. Compactor agents may also update vault://system/memory/agent and vault://system/memory/compactor."
            );
        } finally {
            storage.connection.close();
        }
    });

    it("requires firstName frontmatter for documents under vault://people", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "people",
                slug: "people",
                title: "People",
                description: "People root",
                body: "",
                createdAt: 1,
                updatedAt: 1
            });

            const readTool = documentReadToolBuild();
            await readTool.execute({ path: "vault://people" }, contextBuild(storage, readVersions), readToolCall);

            const tool = documentWriteToolBuild();
            await expect(
                tool.execute(
                    {
                        slug: "ada",
                        title: "Ada",
                        description: "Person profile",
                        body: "# Ada",
                        parentPath: "vault://people"
                    },
                    contextBuild(storage, readVersions),
                    toolCall
                )
            ).rejects.toThrow("firstName");
        } finally {
            storage.connection.close();
        }
    });

    it("accepts valid frontmatter for documents under vault://people", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "people",
                slug: "people",
                title: "People",
                description: "People root",
                body: "",
                createdAt: 1,
                updatedAt: 1
            });

            const readTool = documentReadToolBuild();
            await readTool.execute({ path: "vault://people" }, contextBuild(storage, readVersions), readToolCall);

            const tool = documentWriteToolBuild();
            const result = await tool.execute(
                {
                    slug: "ada",
                    title: "Ada",
                    description: "Person profile",
                    body: "---\nfirstName: Ada\nlastName: Lovelace\n---\nMathematician.",
                    parentPath: "vault://people"
                },
                contextBuild(storage, readVersions),
                toolCall
            );

            const parentId = await storage.documents.findParentId(ctx, String(result.typedResult.vaultId ?? ""));
            expect(parentId).toBe("people");
        } finally {
            storage.connection.close();
        }
    });

    it("allows memory-agent writes under vault://memory", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "memory",
                slug: "memory",
                title: "Memory",
                description: "Memory root",
                body: "",
                createdAt: 1,
                updatedAt: 1
            });

            const readTool = documentReadToolBuild();
            await readTool.execute(
                { path: "vault://memory" },
                contextBuild(storage, readVersions, "memory"),
                readToolCall
            );

            const tool = documentWriteToolBuild();
            const result = await tool.execute(
                {
                    slug: "user",
                    title: "User",
                    description: "User facts",
                    body: "Prefers concise answers.",
                    parentPath: "vault://memory"
                },
                contextBuild(storage, readVersions, "memory"),
                toolCall
            );

            const parentId = await storage.documents.findParentId(ctx, String(result.typedResult.vaultId ?? ""));
            expect(parentId).toBe("memory");
        } finally {
            storage.connection.close();
        }
    });

    it("allows compactor-agent updates to vault://system/memory/agent", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "system",
                slug: "system",
                title: "System",
                description: "System root",
                body: "",
                createdAt: 1,
                updatedAt: 1
            });
            await storage.documents.create(ctx, {
                id: "system-memory",
                slug: "memory",
                title: "Memory",
                description: "Memory policy",
                body: "v1",
                createdAt: 2,
                updatedAt: 2,
                parentId: "system"
            });
            await storage.documents.create(ctx, {
                id: "system-memory-agent",
                slug: "agent",
                title: "Memory Agent",
                description: "Agent prompt",
                body: "v1",
                createdAt: 3,
                updatedAt: 3,
                parentId: "system-memory"
            });

            const readTool = documentReadToolBuild();
            await readTool.execute(
                { path: "vault://system/memory/agent" },
                contextBuild(storage, readVersions, "compactor", {
                    path: "/user-1/compactor/agent-1",
                    name: "memory-compactor"
                }),
                readToolCall
            );

            const tool = documentWriteToolBuild();
            await tool.execute(
                {
                    vaultId: "system-memory-agent",
                    slug: "agent",
                    title: "Memory Agent",
                    description: "Agent prompt",
                    body: "v2"
                },
                contextBuild(storage, readVersions, "compactor", {
                    path: "/user-1/compactor/agent-1",
                    name: "memory-compactor"
                }),
                toolCall
            );

            const updated = await storage.documents.findById(ctx, "system-memory-agent");
            expect(updated?.body).toBe("v2");
        } finally {
            storage.connection.close();
        }
    });

    it("rejects regular memory-agent updates to vault://system/memory prompts", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "system",
                slug: "system",
                title: "System",
                description: "System root",
                body: "",
                createdAt: 1,
                updatedAt: 1
            });
            await storage.documents.create(ctx, {
                id: "system-memory",
                slug: "memory",
                title: "Memory",
                description: "Memory policy",
                body: "v1",
                createdAt: 2,
                updatedAt: 2,
                parentId: "system"
            });
            await storage.documents.create(ctx, {
                id: "system-memory-agent",
                slug: "agent",
                title: "Memory Agent",
                description: "Agent prompt",
                body: "v1",
                createdAt: 3,
                updatedAt: 3,
                parentId: "system-memory"
            });

            const tool = documentWriteToolBuild();
            await expect(
                tool.execute(
                    {
                        vaultId: "system-memory-agent",
                        slug: "agent",
                        title: "Memory Agent",
                        description: "Agent prompt",
                        body: "v2"
                    },
                    contextBuild(storage, readVersions, "memory"),
                    toolCall
                )
            ).rejects.toThrow(
                "Memory agents can only write inside vault://memory. Compactor agents may also update vault://system/memory/agent and vault://system/memory/compactor."
            );
        } finally {
            storage.connection.close();
        }
    });

    it("rejects memory-agent updates for documents outside vault://memory", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "notes",
                slug: "notes",
                title: "Notes",
                description: "General notes",
                body: "v1",
                createdAt: 1,
                updatedAt: 1
            });

            const tool = documentWriteToolBuild();
            await expect(
                tool.execute(
                    {
                        vaultId: "notes",
                        slug: "notes",
                        title: "Notes Updated",
                        description: "General notes",
                        body: "v2"
                    },
                    contextBuild(storage, readVersions, "memory"),
                    toolCall
                )
            ).rejects.toThrow(
                "Memory agents can only write inside vault://memory. Compactor agents may also update vault://system/memory/agent and vault://system/memory/compactor."
            );
        } finally {
            storage.connection.close();
        }
    });
});
