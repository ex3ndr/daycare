import { describe, expect, it, vi } from "vitest";
import { agentPathTask } from "../agents/ops/agentPathBuild.js";
import { TaskExecutionRunner } from "./taskExecutionRunner.js";

describe("TaskExecutionRunner", () => {
    it("executes task code directly and posts prompt text back to the agent", async () => {
        const agentIdForTarget = vi.fn(async () => "task-agent-1");
        const taskExecuteAndAwait = vi.fn(async () => ({
            output: "task prompt",
            errorMessage: null,
            skipTurn: false
        }));
        const post = vi.fn(async () => undefined);
        const runner = new TaskExecutionRunner({
            agentSystem: {
                agentIdForTarget,
                taskExecuteAndAwait,
                post
            } as never
        });

        const result = await runner.runAndAwait({
            userId: "user-1",
            source: "cron",
            taskId: "task-1",
            taskVersion: 2,
            target: { path: agentPathTask("user-1", "task-1") },
            text: "[cron]"
        });

        expect(taskExecuteAndAwait).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user-1" }),
            "task-agent-1",
            expect.objectContaining({
                taskId: "task-1",
                taskVersion: 2,
                source: "cron"
            })
        );
        expect(post).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user-1" }),
            { agentId: "task-agent-1" },
            expect.objectContaining({
                type: "system_message",
                text: "[cron]\n\ntask prompt",
                origin: "cron"
            })
        );
        expect(result.promptSent).toBe(true);
        expect(result.promptText).toBe("[cron]\n\ntask prompt");
    });

    it("does not post prompt text for sync runs", async () => {
        const taskExecuteAndAwait = vi.fn(async () => ({
            output: "sync output",
            errorMessage: null,
            skipTurn: false
        }));
        const post = vi.fn(async () => {
            throw new Error("post should not be called");
        });
        const runner = new TaskExecutionRunner({
            agentSystem: {
                taskExecuteAndAwait,
                post
            } as never
        });

        const result = await runner.runAndAwait({
            userId: "user-1",
            source: "manual",
            taskId: "task-1",
            target: { agentId: "task-agent-1" },
            text: "[task]",
            sync: true
        });

        expect(result.promptSent).toBe(false);
        expect(result.promptText).toBeNull();
    });
});
