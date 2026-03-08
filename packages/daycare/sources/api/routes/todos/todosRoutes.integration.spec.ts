import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { todosRouteHandle } from "./todosRoutes.js";

describe("todosRouteHandle integration", () => {
    it("supports create, update, reorder, tree, batch status, and archive flows", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForUser({ userId: "workspace-1" });

            const rootA = await routeCall({
                pathname: "/todos/create",
                method: "POST",
                body: { title: "Root A" },
                ctx,
                todos: storage.todos
            });
            const rootAId = String((rootA.payload.todo as { id: string }).id);

            const childA = await routeCall({
                pathname: "/todos/create",
                method: "POST",
                body: { title: "Child A", parentId: rootAId, status: "started" },
                ctx,
                todos: storage.todos
            });
            const childAId = String((childA.payload.todo as { id: string }).id);

            const grandchildA = await routeCall({
                pathname: "/todos/create",
                method: "POST",
                body: { title: "Grandchild A", parentId: childAId },
                ctx,
                todos: storage.todos
            });
            const grandchildAId = String((grandchildA.payload.todo as { id: string }).id);

            const rootB = await routeCall({
                pathname: "/todos/create",
                method: "POST",
                body: { title: "Root B" },
                ctx,
                todos: storage.todos
            });
            const rootBId = String((rootB.payload.todo as { id: string }).id);

            const updated = await routeCall({
                pathname: `/todos/${encodeURIComponent(childAId)}/update`,
                method: "POST",
                body: { title: "Child A updated", description: "More detail", status: "finished" },
                ctx,
                todos: storage.todos
            });
            expect(updated.statusCode).toBe(200);
            expect((updated.payload.todo as { title: string; status: string }).title).toBe("Child A updated");
            expect((updated.payload.todo as { title: string; status: string }).status).toBe("finished");

            const reorderedRoot = await routeCall({
                pathname: `/todos/${encodeURIComponent(rootBId)}/reorder`,
                method: "POST",
                body: { parentId: null, index: 0 },
                ctx,
                todos: storage.todos
            });
            expect(reorderedRoot.statusCode).toBe(200);

            const roots = await routeCall({
                pathname: "/todos",
                method: "GET",
                url: "/todos?workspaceId=workspace-1",
                ctx,
                todos: storage.todos
            });
            expect((roots.payload.todos as Array<{ id: string }>).map((todo) => todo.id)).toEqual([rootBId, rootAId]);

            const movedChild = await routeCall({
                pathname: `/todos/${encodeURIComponent(childAId)}/reorder`,
                method: "POST",
                body: { parentId: rootBId, index: 0 },
                ctx,
                todos: storage.todos
            });
            expect(movedChild.statusCode).toBe(200);

            const rootBTree = await routeCall({
                pathname: "/todos/tree",
                method: "GET",
                url: `/todos/tree?rootId=${encodeURIComponent(rootBId)}`,
                ctx,
                todos: storage.todos
            });
            expect((rootBTree.payload.todos as Array<{ id: string }>).map((todo) => todo.id)).toEqual([
                rootBId,
                childAId,
                grandchildAId
            ]);

            const batch = await routeCall({
                pathname: "/todos/batch-status",
                method: "POST",
                body: { ids: [rootBId], status: "started" },
                ctx,
                todos: storage.todos
            });
            expect(batch.statusCode).toBe(200);
            expect((batch.payload.todos as Array<{ status: string }>)[0]?.status).toBe("started");

            const archived = await routeCall({
                pathname: `/todos/${encodeURIComponent(rootBId)}/archive`,
                method: "POST",
                ctx,
                todos: storage.todos
            });
            expect(archived.statusCode).toBe(200);
            expect(archived.payload).toEqual({ ok: true });

            const archivedTree = await routeCall({
                pathname: "/todos/tree",
                method: "GET",
                url: `/todos/tree?rootId=${encodeURIComponent(rootBId)}&depth=all`,
                ctx,
                todos: storage.todos
            });
            expect((archivedTree.payload.todos as Array<{ status: string }>).map((todo) => todo.status)).toEqual([
                "abandoned",
                "abandoned",
                "abandoned"
            ]);
        } finally {
            storage.connection.close();
        }
    });
});

type RouteCallInput = {
    pathname: string;
    method: string;
    ctx: ReturnType<typeof contextForUser>;
    todos: unknown;
    body?: Record<string, unknown>;
    url?: string;
};

async function routeCall(input: RouteCallInput): Promise<{
    handled: boolean;
    statusCode: number;
    payload: Record<string, unknown>;
}> {
    let statusCode = -1;
    let payload: Record<string, unknown> = {};
    const handled = await todosRouteHandle(
        {
            method: input.method,
            url: input.url ?? input.pathname
        } as never,
        {} as never,
        input.pathname,
        {
            ctx: input.ctx,
            todos: input.todos as never,
            readJsonBody: async () => input.body ?? {},
            sendJson: (_response, code, body) => {
                statusCode = code;
                payload = body;
            }
        }
    );
    return { handled, statusCode, payload };
}
