import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { tasksRead } from "./tasksRead.js";

describe("tasksRead", () => {
    it("returns task with triggers", async () => {
        const ctx = contextForUser({ userId: "u1" });

        const result = await tasksRead({
            ctx,
            taskId: "task-1",
            tasksRead: async () => ({
                task: {
                    id: "task-1",
                    userId: "u1",
                    title: "Task",
                    description: null,
                    code: "print('x')",
                    parameters: null,
                    createdAt: 1,
                    updatedAt: 1
                },
                triggers: {
                    cron: [],
                    webhook: []
                }
            })
        });

        expect(result).toEqual({
            ok: true,
            task: {
                id: "task-1",
                userId: "u1",
                title: "Task",
                description: null,
                code: "print('x')",
                parameters: null,
                createdAt: 1,
                updatedAt: 1
            },
            triggers: {
                cron: [],
                webhook: []
            }
        });
    });

    it("returns not found", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await tasksRead({
            ctx,
            taskId: "task-1",
            tasksRead: async () => null
        });

        expect(result).toEqual({ ok: false, error: "Task not found." });
    });

    it("rejects missing task id", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await tasksRead({
            ctx,
            taskId: "  ",
            tasksRead: async () => null
        });

        expect(result).toEqual({ ok: false, error: "taskId is required." });
    });
});
