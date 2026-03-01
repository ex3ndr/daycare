import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForAgent } from "../../agents/context.js";
import { documentReadToolBuild } from "./documentReadToolBuild.js";

const toolCall = { id: "tc1", name: "document_read" };

function contextBuild(storage: Awaited<ReturnType<typeof storageOpenTest>>, readVersions: Map<string, number>) {
    return {
        ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
        storage,
        agentSystem: { storage },
        agent: {
            documentChainReadMark: (entries: Array<{ id: string; version: number }>) => {
                for (const entry of entries) {
                    readVersions.set(entry.id, entry.version);
                }
            },
            documentVersionLastRead: (documentId: string) => readVersions.get(documentId) ?? null
        }
    } as never;
}

describe("documentReadToolBuild", () => {
    it("reads a document by id with children preview", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "memory",
                slug: "memory",
                title: "Memory",
                description: "Memory root",
                body: "Root body",
                createdAt: 1,
                updatedAt: 1
            });
            await storage.documents.create(ctx, {
                id: "daily",
                slug: "daily",
                title: "Daily",
                description: "Daily notes",
                body: "One line",
                createdAt: 2,
                updatedAt: 2,
                parentId: "memory"
            });

            const tool = documentReadToolBuild();
            const result = await tool.execute({ documentId: "memory" }, contextBuild(storage, readVersions), toolCall);

            expect(result.typedResult.found).toBe(true);
            expect(result.typedResult.documentId).toBe("memory");
            expect(result.typedResult.summary).toContain("# Memory");
            expect(result.typedResult.summary).toContain("**path**: `~/memory`");
            expect(result.typedResult.summary).toContain("## Children");
            expect(result.typedResult.summary).toContain("Daily");
            expect(result.typedResult.summary).toContain("## Body");
        } finally {
            storage.connection.close();
        }
    });

    it("reads by path and includes full tree for ~/memory", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await storage.documents.create(ctx, {
                id: "memory",
                slug: "memory",
                title: "Memory",
                description: "Memory root",
                body: "Root body",
                createdAt: 1,
                updatedAt: 1
            });
            await storage.documents.create(ctx, {
                id: "user",
                slug: "user",
                title: "User",
                description: "User facts",
                body: "Prefers concise answers.",
                createdAt: 2,
                updatedAt: 2,
                parentId: "memory"
            });

            const tool = documentReadToolBuild();
            const result = await tool.execute({ path: "~/memory" }, contextBuild(storage, readVersions), toolCall);

            expect(result.typedResult.found).toBe(true);
            expect(result.typedResult.summary).toContain("## Memory Tree");
            expect(result.typedResult.summary).toContain("User");
            expect(result.typedResult.summary).toContain("Prefers concise answers");
        } finally {
            storage.connection.close();
        }
    });

    it("lists root documents when no selector is provided", async () => {
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
                id: "work",
                slug: "work",
                title: "Work",
                description: "Work docs",
                body: "",
                createdAt: 2,
                updatedAt: 2
            });

            const tool = documentReadToolBuild();
            const result = await tool.execute({}, contextBuild(storage, readVersions), toolCall);

            expect(result.typedResult.found).toBe(true);
            expect(result.typedResult.summary).toContain("# Root Documents");
            expect(result.typedResult.summary).toContain("Memory");
            expect(result.typedResult.summary).toContain("Work");
        } finally {
            storage.connection.close();
        }
    });

    it("returns not found for unknown path", async () => {
        const storage = await storageOpenTest();
        const readVersions = new Map<string, number>();
        try {
            const tool = documentReadToolBuild();
            const result = await tool.execute({ path: "~/missing" }, contextBuild(storage, readVersions), toolCall);

            expect(result.typedResult.found).toBe(false);
            expect(result.typedResult.summary).toContain("not found");
        } finally {
            storage.connection.close();
        }
    });

    it("marks the full root-to-target chain as read", async () => {
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
                description: "User",
                body: "",
                createdAt: 2,
                updatedAt: 2,
                parentId: "memory"
            });
            await storage.documents.create(ctx, {
                id: "prefs",
                slug: "prefs",
                title: "Prefs",
                description: "Prefs",
                body: "",
                createdAt: 3,
                updatedAt: 3,
                parentId: "user"
            });

            const tool = documentReadToolBuild();
            const result = await tool.execute(
                { path: "~/memory/user/prefs" },
                contextBuild(storage, readVersions),
                toolCall
            );
            expect(result.typedResult.found).toBe(true);
            expect(readVersions.get("memory")).toBe(1);
            expect(readVersions.get("user")).toBe(1);
            expect(readVersions.get("prefs")).toBe(1);
        } finally {
            storage.connection.close();
        }
    });
});
