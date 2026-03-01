import { describe, expect, it, vi } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForUser } from "../agents/context.js";
import type { WebhooksOptions } from "./webhooks.js";
import { Webhooks } from "./webhooks.js";

describe("Webhooks", () => {
    it("adds, lists, and deletes triggers with ctx scoping", async () => {
        const storage = await storageOpenTest();
        try {
            const postAndAwait = vi.fn(async () => ({ type: "system_message", responseText: null }));
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
                parameters: null,
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
            const observations = await storage.observationLog.findMany({ userId: "user-a", agentId: "agent-1" });
            expect(observations.map((entry) => entry.type)).toEqual(
                expect.arrayContaining(["webhook:added", "webhook:deleted"])
            );
            const webhookAdded = observations.find((entry) => entry.type === "webhook:added");
            expect(webhookAdded?.details).toContain('route template "/v1/webhooks/:token"');
            expect(webhookAdded?.data).toMatchObject({
                webhookId: "hook-a",
                routeTemplate: "/v1/webhooks/:token"
            });
        } finally {
            storage.connection.close();
        }
    });

    it("executes task code via agentSystem when webhook is triggered", async () => {
        const storage = await storageOpenTest();
        try {
            const postAndAwait = vi.fn(async () => ({ type: "system_message", responseText: null }));
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
                parameters: null,
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

    it("uses task descriptor target when webhook trigger has no agentId", async () => {
        const storage = await storageOpenTest();
        try {
            const postAndAwait = vi.fn(async () => ({ type: "system_message", responseText: null }));
            const webhooks = new Webhooks({
                storage,
                agentSystem: {
                    postAndAwait
                } as unknown as WebhooksOptions["agentSystem"]
            });

            await storage.tasks.create({
                id: "task-default-target",
                userId: "user-1",
                title: "Task default target",
                description: null,
                code: "print('run')",
                parameters: null,
                createdAt: 1,
                updatedAt: 1
            });
            await webhooks.addTrigger(contextBuild("user-1"), {
                taskId: "task-default-target",
                id: "hook-default-target"
            });

            await webhooks.trigger("hook-default-target");

            expect(postAndAwait).toHaveBeenCalledWith(
                expect.objectContaining({ userId: "user-1" }),
                { descriptor: { type: "task", id: "task-default-target" } },
                expect.objectContaining({
                    type: "system_message",
                    origin: "webhook",
                    execute: true
                })
            );
        } finally {
            storage.connection.close();
        }
    });

    it("throws when executable webhook execution reports responseError", async () => {
        const storage = await storageOpenTest();
        try {
            const postAndAwait = vi.fn(async () => ({
                type: "system_message" as const,
                responseText: "ignored",
                responseError: true,
                executionErrorText: "boom"
            }));
            const webhooks = new Webhooks({
                storage,
                agentSystem: {
                    postAndAwait
                } as unknown as WebhooksOptions["agentSystem"]
            });

            await storage.tasks.create({
                id: "task-failed-webhook",
                userId: "user-1",
                title: "Task failed webhook",
                description: null,
                code: "print('run')",
                parameters: null,
                createdAt: 1,
                updatedAt: 1
            });
            await webhooks.addTrigger(contextBuild("user-1"), {
                taskId: "task-failed-webhook",
                id: "hook-failed-webhook"
            });

            await expect(webhooks.trigger("hook-failed-webhook")).rejects.toThrow("boom");

            const updatedTrigger = await storage.webhookTasks.findById("hook-failed-webhook");
            expect(updatedTrigger?.lastRunAt).toBeNull();
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
                    postAndAwait: vi.fn(async () => ({ type: "system_message", responseText: null }))
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
