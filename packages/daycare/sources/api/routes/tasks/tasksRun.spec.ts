import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { tasksRun } from "./tasksRun.js";

describe("tasksRun", () => {
    it("returns sync output", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await tasksRun({
            ctx,
            taskId: "task-1",
            body: { sync: true },
            tasksRun: async () => ({ output: "done" })
        });

        expect(result).toEqual({ ok: true, output: "done" });
    });

    it("returns queued for async runs", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await tasksRun({
            ctx,
            taskId: "task-1",
            body: {},
            tasksRun: async () => ({ queued: true })
        });

        expect(result).toEqual({ ok: true, queued: true });
    });

    it("rejects missing task id", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await tasksRun({
            ctx,
            taskId: " ",
            body: {},
            tasksRun: async () => ({ queued: true })
        });

        expect(result).toEqual({ ok: false, error: "taskId is required." });
    });

    it("rejects invalid parameters type", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await tasksRun({
            ctx,
            taskId: "task-1",
            body: { parameters: [] },
            tasksRun: async () => ({ queued: true })
        });

        expect(result).toEqual({ ok: false, error: "parameters must be an object." });
    });

    it("returns callback errors", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await tasksRun({
            ctx,
            taskId: "task-1",
            body: {},
            tasksRun: async () => {
                throw new Error("Task not found.");
            }
        });

        expect(result).toEqual({ ok: false, error: "Task not found." });
    });
});
