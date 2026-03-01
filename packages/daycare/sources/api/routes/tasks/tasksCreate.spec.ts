import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { tasksCreate } from "./tasksCreate.js";

describe("tasksCreate", () => {
    it("creates a task with valid input", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const callback = vi.fn(async () => ({
            id: "task-1",
            title: "Task",
            description: null,
            code: "print('hello')",
            parameters: null,
            createdAt: 1,
            updatedAt: 2
        }));

        const result = await tasksCreate({
            ctx,
            body: {
                title: "Task",
                code: "print('hello')"
            },
            tasksCreate: callback
        });

        expect(result).toEqual({
            ok: true,
            task: {
                id: "task-1",
                title: "Task",
                description: null,
                code: "print('hello')",
                parameters: null,
                createdAt: 1,
                updatedAt: 2
            }
        });
    });

    it("rejects missing required fields", async () => {
        const ctx = contextForUser({ userId: "u1" });

        await expect(
            tasksCreate({
                ctx,
                body: { code: "print('x')" },
                tasksCreate: async () => {
                    throw new Error("should not be called");
                }
            })
        ).resolves.toEqual({ ok: false, error: "title is required." });

        await expect(
            tasksCreate({
                ctx,
                body: { title: "Task", code: "   " },
                tasksCreate: async () => {
                    throw new Error("should not be called");
                }
            })
        ).resolves.toEqual({ ok: false, error: "code is required." });
    });

    it("rejects invalid parameter schema", async () => {
        const ctx = contextForUser({ userId: "u1" });

        const result = await tasksCreate({
            ctx,
            body: {
                title: "Task",
                code: "print('x')",
                parameters: [{ name: "count", type: "integer", nullable: "no" }]
            },
            tasksCreate: async () => {
                throw new Error("should not be called");
            }
        });

        expect(result).toEqual({ ok: false, error: "parameters[0].nullable must be boolean." });
    });
});
