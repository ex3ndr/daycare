import { describe, expect, it, vi } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForUser } from "../agents/context.js";
import type { WebhooksOptions } from "./webhooks.js";
import { Webhooks } from "./webhooks.js";

describe("Webhooks", () => {
    it("adds, lists, and deletes triggers with ctx scoping", async () => {
        const storage = await storageOpenTest();
        try {
            const postAndAwait = vi.fn(async () => ({ status: "completed" }));
            const webhooks = new Webhooks({
                storage,
                agentSystem: {
                    postAndAwait
                } as unknown as WebhooksOptions["agentSystem"]
            });

            await storage.tasks.create({
                id: "task-a",
                userId: "user-a",
                title: "Task A",
                description: null,
                code: "print('a')",
                createdAt: 1,
                updatedAt: 1
            });

            const trigger = await webhooks.addTrigger(contextBuild("user-a"), {
                taskId: "task-a",
                id: "hook-a"
            });
            expect(trigger.id).toBe("hook-a");

            const listed = await webhooks.listTriggersForTask(contextBuild("user-a"), "task-a");
            expect(listed).toHaveLength(1);

            await expect(webhooks.deleteTrigger(contextBuild("user-b"), "hook-a")).resolves.toBe(false);
            await expect(webhooks.deleteTrigger(contextBuild("user-a"), "hook-a")).resolves.toBe(true);
            await expect(storage.tasks.findById(contextBuild("user-a"), "task-a")).resolves.toBeNull();
            expect(postAndAwait).not.toHaveBeenCalled();
        } finally {
            storage.connection.close();
        }
    });

    it("executes task code via agentSystem when webhook is triggered", async () => {
        const storage = await storageOpenTest();
        try {
            const postAndAwait = vi.fn(async () => ({ status: "completed" }));
            const webhooks = new Webhooks({
                storage,
                agentSystem: {
                    postAndAwait
                } as unknown as WebhooksOptions["agentSystem"]
            });

            await storage.tasks.create({
                id: "task-exec",
                userId: "user-1",
                title: "Task Exec",
                description: null,
                code: "print('run')",
                createdAt: 1,
                updatedAt: 1
            });
            await webhooks.addTrigger(contextBuild("user-1"), {
                taskId: "task-exec",
                id: "hook-exec",
                agentId: "agent-target"
            });

            await webhooks.trigger("hook-exec", { event: "push" });

            expect(postAndAwait).toHaveBeenCalledWith(
                expect.objectContaining({ userId: "user-1" }),
                { agentId: "agent-target" },
                expect.objectContaining({
                    type: "system_message",
                    origin: "webhook",
                    execute: true,
                    context: {
                        enrichments: [
                            {
                                key: "webhook_payload",
                                value: '{"event":"push"}'
                            }
                        ]
                    }
                })
            );
            const updatedTrigger = await storage.webhookTasks.findById("hook-exec");
            expect(updatedTrigger?.lastRunAt).toBeTypeOf("number");
        } finally {
            storage.connection.close();
        }
    });

    it("throws on missing webhook id", async () => {
        const storage = await storageOpenTest();
        try {
            const webhooks = new Webhooks({
                storage,
                agentSystem: {
                    postAndAwait: vi.fn(async () => ({ status: "completed" }))
                } as unknown as WebhooksOptions["agentSystem"]
            });
            await expect(webhooks.trigger("missing")).rejects.toThrow("Webhook trigger not found: missing");
        } finally {
            storage.connection.close();
        }
    });
});

function contextBuild(userId: string) {
    return contextForUser({ userId });
}
