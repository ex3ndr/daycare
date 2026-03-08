import { describe, expect, it } from "vitest";
import { contextForUser } from "../engine/agents/context.js";
import { storageOpenTest } from "./storageOpenTest.js";
import { TodosRepository } from "./todosRepository.js";

describe("TodosRepository", () => {
    it("creates todos, finds by id, and lists children and roots", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new TodosRepository(storage.db);
            const ctx = contextForUser({ userId: "workspace-1" });

            const root = await repo.create(ctx, {
                id: "root",
                title: "Root todo",
                description: "Top level",
                status: "unstarted",
                createdAt: 10,
                updatedAt: 10
            });
            const child = await repo.create(ctx, {
                id: "child",
                parentId: root.id,
                title: "Child todo",
                status: "started",
                createdAt: 20,
                updatedAt: 20
            });

            expect(await repo.findById(ctx, root.id)).toEqual(root);
            expect(await repo.findRoots(ctx)).toEqual([root]);
            expect(await repo.findByParent(ctx, root.id)).toEqual([child]);
        } finally {
            storage.connection.close();
        }
    });

    it("limits tree depth and returns preorder traversal", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new TodosRepository(storage.db);
            const ctx = contextForUser({ userId: "workspace-1" });

            await repo.create(ctx, { id: "root", title: "Root", createdAt: 1, updatedAt: 1 });
            await repo.create(ctx, { id: "child-a", parentId: "root", title: "Child A", createdAt: 2, updatedAt: 2 });
            await repo.create(ctx, { id: "child-b", parentId: "root", title: "Child B", createdAt: 3, updatedAt: 3 });
            await repo.create(ctx, {
                id: "grandchild",
                parentId: "child-a",
                title: "Grandchild",
                createdAt: 4,
                updatedAt: 4
            });
            await repo.create(ctx, {
                id: "great-grandchild",
                parentId: "grandchild",
                title: "Great grandchild",
                createdAt: 5,
                updatedAt: 5
            });

            expect((await repo.findTree(ctx)).map((todo) => todo.id)).toEqual([
                "root",
                "child-a",
                "grandchild",
                "child-b"
            ]);
            expect((await repo.findTree(ctx, "root", 1)).map((todo) => todo.id)).toEqual([
                "root",
                "child-a",
                "child-b"
            ]);
            expect((await repo.findTree(ctx, "root")).map((todo) => todo.id)).toEqual([
                "root",
                "child-a",
                "grandchild",
                "great-grandchild",
                "child-b"
            ]);
        } finally {
            storage.connection.close();
        }
    });

    it("updates and reorders todos across sibling lists", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new TodosRepository(storage.db);
            const ctx = contextForUser({ userId: "workspace-1" });

            const parentA = await repo.create(ctx, { id: "parent-a", title: "Parent A", createdAt: 1, updatedAt: 1 });
            const parentB = await repo.create(ctx, { id: "parent-b", title: "Parent B", createdAt: 2, updatedAt: 2 });
            await repo.create(ctx, { id: "todo-1", parentId: parentA.id, title: "Todo 1", createdAt: 3, updatedAt: 3 });
            const todo2 = await repo.create(ctx, {
                id: "todo-2",
                parentId: parentA.id,
                title: "Todo 2",
                createdAt: 4,
                updatedAt: 4
            });
            await repo.create(ctx, { id: "todo-3", parentId: parentA.id, title: "Todo 3", createdAt: 5, updatedAt: 5 });

            const updated = await repo.update(ctx, todo2.id, {
                title: "Todo 2 updated",
                description: "Details",
                status: "started",
                updatedAt: 6
            });
            expect(updated.title).toBe("Todo 2 updated");
            expect(updated.description).toBe("Details");
            expect(updated.status).toBe("started");
            expect(updated.version).toBe(2);

            await repo.reorder(ctx, "todo-3", parentA.id, 0);
            expect((await repo.findByParent(ctx, parentA.id)).map((todo) => todo.id)).toEqual([
                "todo-3",
                "todo-1",
                "todo-2"
            ]);

            await repo.reorder(ctx, "todo-2", parentB.id, 0);
            expect((await repo.findByParent(ctx, parentA.id)).map((todo) => todo.id)).toEqual(["todo-3", "todo-1"]);
            expect((await repo.findByParent(ctx, parentB.id)).map((todo) => todo.id)).toEqual(["todo-2"]);
        } finally {
            storage.connection.close();
        }
    });

    it("archives descendants and applies batch status updates", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new TodosRepository(storage.db);
            const ctx = contextForUser({ userId: "workspace-1" });

            await repo.create(ctx, { id: "root", title: "Root", createdAt: 1, updatedAt: 1 });
            await repo.create(ctx, { id: "child", parentId: "root", title: "Child", createdAt: 2, updatedAt: 2 });
            await repo.create(ctx, {
                id: "grandchild",
                parentId: "child",
                title: "Grandchild",
                createdAt: 3,
                updatedAt: 3
            });
            await repo.create(ctx, { id: "other", title: "Other", createdAt: 4, updatedAt: 4 });

            await repo.archive(ctx, "root");
            expect((await repo.findTree(ctx, "root")).map((todo) => todo.status)).toEqual([
                "abandoned",
                "abandoned",
                "abandoned"
            ]);

            const batch = await repo.batchUpdateStatus(ctx, ["other"], "finished");
            expect(batch.map((todo) => todo.status)).toEqual(["finished"]);
            expect((await repo.findById(ctx, "other"))?.status).toBe("finished");
        } finally {
            storage.connection.close();
        }
    });

    it("isolates todos by workspace", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new TodosRepository(storage.db);
            const workspaceA = contextForUser({ userId: "workspace-a" });
            const workspaceB = contextForUser({ userId: "workspace-b" });

            await repo.create(workspaceA, { id: "shared", title: "A", createdAt: 1, updatedAt: 1 });
            await repo.create(workspaceB, { id: "shared", title: "B", createdAt: 2, updatedAt: 2 });

            expect((await repo.findById(workspaceA, "shared"))?.title).toBe("A");
            expect((await repo.findById(workspaceB, "shared"))?.title).toBe("B");
        } finally {
            storage.connection.close();
        }
    });
});
