import { describe, expect, it, vi } from "vitest";
import { TaskExecutions } from "./taskExecutions.js";

describe("TaskExecutions", () => {
    it("records success for fire-and-forget dispatch", async () => {
        let resolveCall: ((value: unknown) => void) | null = null;
        const runAndAwait = vi.fn(
            () =>
                new Promise<unknown>((resolve) => {
                    resolveCall = resolve;
                })
        );
        const facade = new TaskExecutions({
            runner: {
                runAndAwait
            } as never
        });

        facade.dispatch({
            userId: "user-1",
            source: "cron",
            taskId: "task-1",
            taskVersion: 3,
            target: { agentId: "task-agent-1" },
            text: "[cron]"
        });
        await tick();

        const before = facade.listStats();
        expect(before).toHaveLength(1);
        expect(before[0]?.total.queued).toBe(1);
        expect(before[0]?.total.succeeded).toBe(0);

        const resolvePending = resolveCall as ((value: unknown) => void) | null;
        expect(resolvePending).toBeTypeOf("function");
        if (!resolvePending) {
            throw new Error("Expected pending task execution callback");
        }
        resolvePending({ output: "ok", errorMessage: null, skipTurn: false, promptSent: true, promptText: "ok" });
        await tick();

        expect(runAndAwait).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: "user-1",
                taskId: "task-1",
                taskVersion: 3,
                source: "cron"
            })
        );

        const after = facade.listStats();
        expect(after[0]?.total.succeeded).toBe(1);
        expect(after[0]?.sources.cron.succeeded).toBe(1);
    });

    it("records failures for responseError and thrown dispatch errors", async () => {
        const runAndAwait = vi
            .fn()
            .mockResolvedValueOnce({
                output: "<exec_error>boom</exec_error>",
                errorMessage: "boom",
                skipTurn: false,
                promptSent: true,
                promptText: "<exec_error>boom</exec_error>"
            })
            .mockRejectedValueOnce(new Error("network"));
        const facade = new TaskExecutions({
            runner: {
                runAndAwait
            } as never
        });

        facade.dispatch({
            userId: "user-1",
            source: "webhook",
            taskId: "task-1",
            target: { agentId: "task-agent-1" },
            text: "[webhook]"
        });
        facade.dispatch({
            userId: "user-1",
            source: "webhook",
            taskId: "task-1",
            target: { agentId: "task-agent-1" },
            text: "[webhook]"
        });
        await tick();

        const stats = facade.listStats()[0];
        expect(stats?.total.queued).toBe(2);
        expect(stats?.total.failed).toBe(2);
        expect(stats?.sources.webhook.failed).toBe(2);
    });

    it("waits for completion in dispatchAndAwait and returns system_message result", async () => {
        const runAndAwait = vi.fn(async () => ({
            output: "done",
            errorMessage: null,
            skipTurn: false,
            promptSent: false,
            promptText: null
        }));
        const facade = new TaskExecutions({
            runner: {
                runAndAwait
            } as never
        });

        const result = await facade.dispatchAndAwait({
            userId: "user-1",
            source: "manual",
            taskId: "task-1",
            taskVersion: 9,
            origin: "task",
            target: { agentId: "task-agent-1" },
            text: "[task]",
            sync: true
        });

        expect(result.type).toBe("system_message");
        expect(result.responseText).toBe("done");
        const stats = facade.listStats()[0];
        expect(stats?.total.queued).toBe(1);
        expect(stats?.total.succeeded).toBe(1);
        expect(stats?.sources.manual.succeeded).toBe(1);
    });
});

async function tick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
}
