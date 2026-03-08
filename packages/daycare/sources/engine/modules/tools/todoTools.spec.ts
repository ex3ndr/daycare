import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForAgent } from "../../agents/context.js";
import { todoArchiveToolBuild } from "./todoArchiveToolBuild.js";
import { todoBatchStatusToolBuild } from "./todoBatchStatusToolBuild.js";
import { todoCreateToolBuild } from "./todoCreateToolBuild.js";
import { todoListToolBuild } from "./todoListToolBuild.js";
import { todoReorderToolBuild } from "./todoReorderToolBuild.js";
import { todoUpdateToolBuild } from "./todoUpdateToolBuild.js";

const toolCall = (name: string) => ({ id: `${name}-call`, name });

function contextBuild(storage: Awaited<ReturnType<typeof storageOpenTest>>) {
    const ctx = contextForAgent({ userId: "workspace-1", agentId: "agent-1" });
    return {
        ctx,
        storage,
        agentSystem: { storage },
        agent: {}
    } as never;
}

describe("todo tools", () => {
    it("creates and lists todos as an ASCII tree", async () => {
        const storage = await storageOpenTest();
        try {
            const context = contextBuild(storage);
            const createTool = todoCreateToolBuild();
            const listTool = todoListToolBuild();

            const root = await createTool.execute(
                { title: "Root todo", status: "unstarted" },
                context,
                toolCall("todo_create")
            );
            const rootId = root.typedResult.todoId;
            const child = await createTool.execute(
                { title: "Child todo", parentId: rootId, status: "started" },
                context,
                toolCall("todo_create")
            );
            expect(child.typedResult.status).toBe("started");

            const listed = await listTool.execute({}, context, toolCall("todo_list"));
            expect(listed.typedResult.todoCount).toBe(2);
            expect(listed.typedResult.summary).toContain(`○ Root todo [unstarted] (id: ${rootId})`);
            expect(listed.typedResult.summary).toContain(`  ● Child todo [started] (id: ${child.typedResult.todoId})`);
            expect(listTool.returns.toLLMText(listed.typedResult)).toBe(listed.typedResult.summary);
        } finally {
            storage.connection.close();
        }
    });

    it("updates, reorders, batches, and archives todos", async () => {
        const storage = await storageOpenTest();
        try {
            const context = contextBuild(storage);
            const createTool = todoCreateToolBuild();
            const updateTool = todoUpdateToolBuild();
            const reorderTool = todoReorderToolBuild();
            const batchTool = todoBatchStatusToolBuild();
            const archiveTool = todoArchiveToolBuild();
            const listTool = todoListToolBuild();

            const firstRoot = await createTool.execute({ title: "First root" }, context, toolCall("todo_create"));
            const secondRoot = await createTool.execute({ title: "Second root" }, context, toolCall("todo_create"));
            const child = await createTool.execute(
                { title: "Child", parentId: firstRoot.typedResult.todoId },
                context,
                toolCall("todo_create")
            );

            const updated = await updateTool.execute(
                { todoId: child.typedResult.todoId, title: "Child updated", status: "finished" },
                context,
                toolCall("todo_update")
            );
            expect(updated.typedResult.status).toBe("finished");

            const reordered = await reorderTool.execute(
                { todoId: child.typedResult.todoId, parentId: secondRoot.typedResult.todoId, index: 0 },
                context,
                toolCall("todo_reorder")
            );
            expect(reordered.typedResult.parentId).toBe(secondRoot.typedResult.todoId);

            const batched = await batchTool.execute(
                { ids: [secondRoot.typedResult.todoId], status: "started" },
                context,
                toolCall("todo_batch_status")
            );
            expect(batched.typedResult.updatedCount).toBe(1);
            expect(batchTool.returns.toLLMText(batched.typedResult)).toBe("Updated 1 todos to started.");

            const archived = await archiveTool.execute(
                { todoId: secondRoot.typedResult.todoId },
                context,
                toolCall("todo_archive")
            );
            expect(archived.typedResult.todoId).toBe(secondRoot.typedResult.todoId);

            const subtree = await listTool.execute(
                { rootId: secondRoot.typedResult.todoId },
                context,
                toolCall("todo_list")
            );
            expect(subtree.typedResult.summary).toContain(
                `✗ Second root [abandoned] (id: ${secondRoot.typedResult.todoId})`
            );
            expect(subtree.typedResult.summary).toContain(
                `  ✗ Child updated [abandoned] (id: ${child.typedResult.todoId})`
            );
        } finally {
            storage.connection.close();
        }
    });
});
