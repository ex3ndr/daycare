import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { tasksDelete } from "./tasksDelete.js";

describe("tasksDelete", () => {
    it("returns deleted true", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await tasksDelete({
            ctx,
            taskId: "task-1",
            tasksDelete: async () => true
        });

        expect(result).toEqual({ ok: true, deleted: true });
    });

    it("returns not found when delete callback returns false", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await tasksDelete({
            ctx,
            taskId: "task-1",
            tasksDelete: async () => false
        });

        expect(result).toEqual({ ok: false, error: "Task not found." });
    });

    it("rejects missing taskId", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await tasksDelete({
            ctx,
            taskId: " ",
            tasksDelete: async () => false
        });

        expect(result).toEqual({ ok: false, error: "taskId is required." });
    });
});
