import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { tasksUpdate } from "./tasksUpdate.js";

describe("tasksUpdate", () => {
    it("updates task with partial fields", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const callback = vi.fn(async () => ({
            id: "task-1",
            title: "Updated",
            description: "desc",
            code: "print('x')",
            parameters: null,
            createdAt: 1,
            updatedAt: 2
        }));

        const result = await tasksUpdate({
            ctx,
            taskId: "task-1",
            body: { title: "Updated" },
            tasksUpdate: callback
        });

        expect(result).toEqual({
            ok: true,
            task: {
                id: "task-1",
                title: "Updated",
                description: "desc",
                code: "print('x')",
                parameters: null,
                createdAt: 1,
                updatedAt: 2
            }
        });
        expect(callback).toHaveBeenCalledWith(ctx, "task-1", { title: "Updated" });
    });

    it("rejects when no update fields provided", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await tasksUpdate({
            ctx,
            taskId: "task-1",
            body: {},
            tasksUpdate: async () => null
        });

        expect(result).toEqual({ ok: false, error: "At least one field is required." });
    });

    it("rejects invalid field types", async () => {
        const ctx = contextForUser({ userId: "u1" });

        const result = await tasksUpdate({
            ctx,
            taskId: "task-1",
            body: { title: "" },
            tasksUpdate: async () => null
        });

        expect(result).toEqual({ ok: false, error: "title must be a non-empty string." });
    });

    it("returns not found when callback returns null", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await tasksUpdate({
            ctx,
            taskId: "task-1",
            body: { title: "Updated" },
            tasksUpdate: async () => null
        });

        expect(result).toEqual({ ok: false, error: "Task not found." });
    });
});
