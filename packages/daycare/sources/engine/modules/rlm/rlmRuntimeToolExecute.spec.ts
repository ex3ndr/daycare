import { describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { rlmRuntimeToolExecute } from "./rlmRuntimeToolExecute.js";

describe("rlmRuntimeToolExecute", () => {
    it("awaits agent execution for step() during tasks", async () => {
        const postAndAwait = vi.fn(async () => ({ type: "system_message" as const, responseText: "ok" }));

        const result = await rlmRuntimeToolExecute(
            "step",
            { prompt: "continue" },
            contextBuild({ postAndAwait }, true)
        );

        expect(result).toEqual({ handled: true, value: null });
        expect(postAndAwait).toHaveBeenCalledWith(
            expect.objectContaining({ agentId: "agent-1", userId: "user-1" }),
            { agentId: "agent-1" },
            expect.objectContaining({
                type: "system_message",
                text: "continue",
                origin: "task"
            })
        );
    });

    it("posts reset to the current agent for context_reset()", async () => {
        const postAndAwait = vi.fn(async () => ({ type: "reset" as const, ok: true }));

        const result = await rlmRuntimeToolExecute(
            "context_reset",
            { message: "fresh start" },
            contextBuild({ postAndAwait }, true)
        );

        expect(result).toEqual({ handled: true, value: null });
        expect(postAndAwait).toHaveBeenCalledWith(
            expect.objectContaining({ agentId: "agent-1", userId: "user-1" }),
            { agentId: "agent-1" },
            { type: "reset", message: "fresh start" }
        );
    });

    it("posts compact to the current agent for context_compact()", async () => {
        const postAndAwait = vi.fn(async () => ({ type: "compact" as const, ok: true }));

        const result = await rlmRuntimeToolExecute("context_compact", {}, contextBuild({ postAndAwait }, true));

        expect(result).toEqual({ handled: true, value: null });
        expect(postAndAwait).toHaveBeenCalledWith(
            expect.objectContaining({ agentId: "agent-1", userId: "user-1" }),
            { agentId: "agent-1" },
            { type: "compact" }
        );
    });

    it("throws a task-only error for step() outside task execution", async () => {
        await expect(
            rlmRuntimeToolExecute("step", { prompt: "continue" }, contextBuild({ postAndAwait: vi.fn() }, false))
        ).rejects.toThrow("step() is allowed only in tasks.");
    });

    it("throws a task-only error for context_reset() outside task execution", async () => {
        await expect(
            rlmRuntimeToolExecute("context_reset", {}, contextBuild({ postAndAwait: vi.fn() }, false))
        ).rejects.toThrow("context_reset() is allowed only in tasks.");
    });

    it("throws a task-only error for context_compact() outside task execution", async () => {
        await expect(
            rlmRuntimeToolExecute("context_compact", {}, contextBuild({ postAndAwait: vi.fn() }, false))
        ).rejects.toThrow("context_compact() is allowed only in tasks.");
    });
});

function contextBuild(
    agentSystem: Partial<ToolExecutionContext["agentSystem"]>,
    taskExecution: boolean
): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: null as unknown as ToolExecutionContext["agent"],
        ctx: { userId: "user-1", agentId: "agent-1" } as ToolExecutionContext["ctx"],
        source: "task",
        messageContext: {},
        agentSystem: agentSystem as ToolExecutionContext["agentSystem"],
        ...(taskExecution ? { taskExecution: { taskId: "task-1", taskVersion: 1 } } : {})
    };
}
