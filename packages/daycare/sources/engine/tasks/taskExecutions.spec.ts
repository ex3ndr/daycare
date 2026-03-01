import { describe, expect, it, vi } from "vitest";
import { TaskExecutions } from "./taskExecutions.js";

describe("TaskExecutions", () => {
    it("records success for fire-and-forget dispatch", async () => {
        let resolveCall: ((value: unknown) => void) | null = null;
        const postAndAwait = vi.fn(
            () =>
                new Promise<unknown>((resolve) => {
                    resolveCall = resolve;
                })
        );
        const facade = new TaskExecutions({
            agentSystem: {
                postAndAwait
            } as never
        });

        facade.dispatch({
            userId: "user-1",
            source: "cron",
            taskId: "task-1",
            taskVersion: 3,
            target: { descriptor: { type: "task", id: "task-1" } },
            text: "[cron]"
        });

        const before = facade.listStats();
        expect(before).toHaveLength(1);
        expect(before[0]?.total.queued).toBe(1);
        expect(before[0]?.total.succeeded).toBe(0);

        const resolvePending = resolveCall as ((value: unknown) => void) | null;
        expect(resolvePending).toBeTypeOf("function");
        if (!resolvePending) {
            throw new Error("Expected pending task execution callback");
        }
        resolvePending({ type: "system_message", responseText: "ok" });
        await tick();

        expect(postAndAwait).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user-1" }),
            { descriptor: { type: "task", id: "task-1" } },
            expect.objectContaining({
                type: "system_message",
                taskId: "task-1",
                task: { id: "task-1", version: 3 }
            })
        );

        const after = facade.listStats();
        expect(after[0]?.total.succeeded).toBe(1);
        expect(after[0]?.sources.cron.succeeded).toBe(1);
    });

    it("records failures for responseError and thrown dispatch errors", async () => {
        const postAndAwait = vi
            .fn()
            .mockResolvedValueOnce({ type: "system_message", responseText: "boom", responseError: true })
            .mockRejectedValueOnce(new Error("network"));
        const facade = new TaskExecutions({
            agentSystem: {
                postAndAwait
            } as never
        });

        facade.dispatch({
            userId: "user-1",
            source: "webhook",
            taskId: "task-1",
            target: { descriptor: { type: "task", id: "task-1" } },
            text: "[webhook]"
        });
        facade.dispatch({
            userId: "user-1",
            source: "webhook",
            taskId: "task-1",
            target: { descriptor: { type: "task", id: "task-1" } },
            text: "[webhook]"
        });
        await tick();

        const stats = facade.listStats()[0];
        expect(stats?.total.queued).toBe(2);
        expect(stats?.total.failed).toBe(2);
        expect(stats?.sources.webhook.failed).toBe(2);
    });

    it("waits for completion in dispatchAndAwait and returns system_message result", async () => {
        const postAndAwait = vi.fn(async () => ({ type: "system_message" as const, responseText: "done" }));
        const facade = new TaskExecutions({
            agentSystem: {
                postAndAwait
            } as never
        });

        const result = await facade.dispatchAndAwait({
            userId: "user-1",
            source: "manual",
            taskId: "task-1",
            taskVersion: 9,
            origin: "task",
            target: { descriptor: { type: "task", id: "task-1" } },
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
