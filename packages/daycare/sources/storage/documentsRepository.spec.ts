import { describe, expect, it } from "vitest";
import { contextForAgent } from "../engine/agents/context.js";
import { documentPathFind } from "./documentPathFind.js";
import { documentPathResolve } from "./documentPathResolve.js";
import { DocumentsRepository } from "./documentsRepository.js";
import { storageOpenTest } from "./storageOpenTest.js";

describe("DocumentsRepository", () => {
    it("supports hierarchical CRUD with path resolution and delete guard", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new DocumentsRepository(storage.db);
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });

            await repo.create(ctx, {
                id: "memory",
                slug: "memory",
                title: "Memory",
                description: "Root memory",
                body: "",
                createdAt: 1,
                updatedAt: 1
            });
            await repo.create(ctx, {
                id: "daily",
                slug: "daily",
                title: "Daily",
                description: "Daily notes",
                body: "",
                createdAt: 2,
                updatedAt: 2,
                parentId: "memory"
            });
            await repo.create(ctx, {
                id: "events",
                slug: "events",
                title: "Events",
                description: "Event notes",
                body: "[[~/memory]]",
                createdAt: 3,
                updatedAt: 3,
                parentId: "daily"
            });

            const roots = await repo.findRoots(ctx);
            expect(roots.map((entry) => entry.id)).toEqual(["memory"]);

            const children = await repo.findChildren(ctx, "memory");
            expect(children.map((entry) => entry.id)).toEqual(["daily"]);

            const bySlug = await repo.findBySlugAndParent(ctx, "daily", "memory");
            expect(bySlug?.id).toBe("daily");

            const path = await documentPathResolve(ctx, "events", repo);
            expect(path).toBe("~/memory/daily/events");

            const byPath = await documentPathFind(ctx, "~/memory/daily/events", repo);
            expect(byPath).toBe("events");

            await expect(repo.delete(ctx, "daily")).rejects.toThrow("active references");
            expect(await repo.delete(ctx, "events")).toBe(true);
            expect(await repo.delete(ctx, "daily")).toBe(true);
            expect(await repo.delete(ctx, "memory")).toBe(true);

            const deleted = await repo.findAnyById(ctx, "memory");
            expect(typeof deleted?.validTo).toBe("number");
        } finally {
            storage.connection.close();
        }
    });

    it("enforces slug uniqueness under the same parent", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new DocumentsRepository(storage.db);
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });

            await repo.create(ctx, {
                id: "memory",
                slug: "memory",
                title: "Memory",
                description: "Root memory",
                body: "",
                createdAt: 1,
                updatedAt: 1
            });
            await repo.create(ctx, {
                id: "work",
                slug: "work",
                title: "Work",
                description: "Root work",
                body: "",
                createdAt: 2,
                updatedAt: 2
            });

            await repo.create(ctx, {
                id: "daily-1",
                slug: "daily",
                title: "Daily 1",
                description: "First daily",
                body: "",
                createdAt: 3,
                updatedAt: 3,
                parentId: "memory"
            });

            await expect(
                repo.create(ctx, {
                    id: "daily-2",
                    slug: "daily",
                    title: "Daily 2",
                    description: "Second daily",
                    body: "",
                    createdAt: 4,
                    updatedAt: 4,
                    parentId: "memory"
                })
            ).rejects.toThrow("slug is already used");

            await repo.create(ctx, {
                id: "daily-3",
                slug: "daily",
                title: "Daily 3",
                description: "Third daily",
                body: "",
                createdAt: 5,
                updatedAt: 5,
                parentId: "work"
            });

            const underWork = await repo.findBySlugAndParent(ctx, "daily", "work");
            expect(underWork?.id).toBe("daily-3");
        } finally {
            storage.connection.close();
        }
    });

    it("advances document versions and rebuilds references on update", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new DocumentsRepository(storage.db);
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });

            await repo.create(ctx, {
                id: "a",
                slug: "a",
                title: "A",
                description: "A",
                body: "",
                createdAt: 1,
                updatedAt: 1
            });
            await repo.create(ctx, {
                id: "b",
                slug: "b",
                title: "B",
                description: "B",
                body: "",
                createdAt: 2,
                updatedAt: 2
            });
            await repo.create(ctx, {
                id: "c",
                slug: "c",
                title: "C",
                description: "C",
                body: "",
                createdAt: 3,
                updatedAt: 3
            });
            await repo.create(ctx, {
                id: "note",
                slug: "note",
                title: "Note",
                description: "Note",
                body: "[[c]]",
                createdAt: 4,
                updatedAt: 4,
                parentId: "a",
                linkTargetIds: ["b"]
            });

            await repo.update(ctx, "note", {
                body: "[[b]]",
                parentId: "b",
                linkTargetIds: ["a"],
                updatedAt: 10
            });

            const versions = (await storage.connection
                .prepare("SELECT version, valid_to FROM documents WHERE user_id = ? AND id = ? ORDER BY version ASC")
                .all(ctx.userId, "note")) as Array<{ version: number; valid_to: number | null }>;
            expect(versions).toEqual([
                { version: 1, valid_to: expect.any(Number) },
                { version: 2, valid_to: null }
            ]);

            const refs = (await storage.connection
                .prepare(
                    [
                        "SELECT source_version, kind, target_id",
                        "FROM document_references",
                        "WHERE user_id = ? AND source_id = ?",
                        "ORDER BY source_version ASC, kind ASC, target_id ASC"
                    ].join(" ")
                )
                .all(ctx.userId, "note")) as Array<{
                source_version: number;
                kind: string;
                target_id: string;
            }>;

            expect(refs).toEqual([
                { source_version: 1, kind: "body", target_id: "c" },
                { source_version: 1, kind: "link", target_id: "b" },
                { source_version: 1, kind: "parent", target_id: "a" },
                { source_version: 2, kind: "body", target_id: "b" },
                { source_version: 2, kind: "link", target_id: "a" },
                { source_version: 2, kind: "parent", target_id: "b" }
            ]);
        } finally {
            storage.connection.close();
        }
    });

    it("serializes concurrent updates to enforce sibling slug uniqueness", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new DocumentsRepository(storage.db);
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });

            await repo.create(ctx, {
                id: "root",
                slug: "root",
                title: "Root",
                description: "Root",
                body: "",
                createdAt: 1,
                updatedAt: 1
            });
            await repo.create(ctx, {
                id: "a",
                slug: "a",
                title: "A",
                description: "A",
                body: "",
                createdAt: 2,
                updatedAt: 2,
                parentId: "root"
            });
            await repo.create(ctx, {
                id: "b",
                slug: "b",
                title: "B",
                description: "B",
                body: "",
                createdAt: 3,
                updatedAt: 3,
                parentId: "root"
            });

            const results = await Promise.allSettled([
                repo.update(ctx, "a", { slug: "same", updatedAt: 10 }),
                repo.update(ctx, "b", { slug: "same", updatedAt: 11 })
            ]);

            expect(results.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
            expect(results.filter((entry) => entry.status === "rejected")).toHaveLength(1);

            const siblings = await repo.findChildren(ctx, "root");
            expect(siblings.filter((entry) => entry.slug === "same")).toHaveLength(1);
        } finally {
            storage.connection.close();
        }
    });

    it("rejects updates that would introduce parent cycles", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new DocumentsRepository(storage.db);
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });

            await repo.create(ctx, {
                id: "a",
                slug: "a",
                title: "A",
                description: "A",
                body: "",
                createdAt: 1,
                updatedAt: 1
            });
            await repo.create(ctx, {
                id: "b",
                slug: "b",
                title: "B",
                description: "B",
                body: "",
                createdAt: 2,
                updatedAt: 2,
                parentId: "a"
            });

            await expect(repo.update(ctx, "a", { parentId: "b", updatedAt: 3 })).rejects.toThrow("cycle");
            const parentOfA = await repo.findParentId(ctx, "a");
            expect(parentOfA).toBeNull();
        } finally {
            storage.connection.close();
        }
    });

    it("rejects path-unsafe slugs in repository create/update and lookup", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new DocumentsRepository(storage.db);
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });

            await expect(
                repo.create(ctx, {
                    id: "bad-create",
                    slug: "bad/create",
                    title: "Bad",
                    description: "Bad",
                    body: "",
                    createdAt: 1,
                    updatedAt: 1
                })
            ).rejects.toThrow("cannot contain '/'");

            await repo.create(ctx, {
                id: "good",
                slug: "good",
                title: "Good",
                description: "Good",
                body: "",
                createdAt: 2,
                updatedAt: 2
            });

            await expect(repo.update(ctx, "good", { slug: "bad/update", updatedAt: 3 })).rejects.toThrow(
                "cannot contain '/'"
            );
            await expect(repo.findBySlugAndParent(ctx, "bad/lookup", null)).rejects.toThrow("cannot contain '/'");
        } finally {
            storage.connection.close();
        }
    });

    it("round-trips path-safe slugs through resolve/find", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new DocumentsRepository(storage.db);
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });

            await repo.create(ctx, {
                id: "memory",
                slug: "memory",
                title: "Memory",
                description: "Memory",
                body: "",
                createdAt: 1,
                updatedAt: 1
            });
            await repo.create(ctx, {
                id: "user-doc",
                slug: "user_profile-1.2",
                title: "User",
                description: "User",
                body: "",
                createdAt: 2,
                updatedAt: 2,
                parentId: "memory"
            });

            const path = await documentPathResolve(ctx, "user-doc", repo);
            expect(path).toBe("~/memory/user_profile-1.2");
            expect(await documentPathFind(ctx, String(path ?? ""), repo)).toBe("user-doc");
        } finally {
            storage.connection.close();
        }
    });
});
