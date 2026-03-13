import { describe, expect, it, vi } from "vitest";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForUser } from "../../agents/context.js";
import { taskSystemMemoryCleanupEnsure } from "./taskSystemMemoryCleanupEnsure.js";

const SYSTEM_TASK_ID = "system:memory-cleanup";

describe("taskSystemMemoryCleanupEnsure", () => {
    it("creates the reserved memory cleanup task and cron for memory-enabled users", async () => {
        const storage = await storageOpenTest();
        try {
            await storage.users.create({
                id: "user-1",
                nametag: "user-1",
                createdAt: 1,
                updatedAt: 1
            });

            const agentSystem = {
                agentIdForTarget: vi.fn(async () => "memory-agent-1")
            } as never;

            await taskSystemMemoryCleanupEnsure(storage, agentSystem);

            const ctx = contextForUser({ userId: "user-1" });
            const task = await storage.tasks.findById(ctx, SYSTEM_TASK_ID);
            const trigger = await storage.cronTasks.findById("system:user-1:memory-cleanup");

            expect(task?.title).toBe("Memory Cleanup");
            expect(trigger).toMatchObject({
                id: "system:user-1:memory-cleanup",
                taskId: SYSTEM_TASK_ID,
                schedule: "0 */12 * * *",
                timezone: "UTC",
                agentId: "memory-agent-1",
                enabled: true
            });
        } finally {
            storage.connection.close();
        }
    });

    it("refreshes system automation definitions while preserving disabled state", async () => {
        const storage = await storageOpenTest();
        try {
            await storage.users.create({
                id: "workspace-1",
                nametag: "workspace-1",
                isWorkspace: true,
                memory: true,
                createdAt: 1,
                updatedAt: 1
            });

            await storage.tasks.create({
                id: SYSTEM_TASK_ID,
                userId: "workspace-1",
                title: "Old Title",
                description: "Old description",
                code: "print('old')",
                parameters: null,
                createdAt: 2,
                updatedAt: 2
            });
            await storage.cronTasks.create({
                id: "system:workspace-1:memory-cleanup",
                taskId: SYSTEM_TASK_ID,
                userId: "workspace-1",
                schedule: "0 0 * * *",
                timezone: "America/Los_Angeles",
                agentId: "old-agent",
                enabled: false,
                deleteAfterRun: false,
                parameters: null,
                lastRunAt: null,
                createdAt: 2,
                updatedAt: 2
            });

            const agentSystem = {
                agentIdForTarget: vi.fn(async () => "memory-agent-2")
            } as never;

            await taskSystemMemoryCleanupEnsure(storage, agentSystem);

            const ctx = contextForUser({ userId: "workspace-1" });
            const task = await storage.tasks.findById(ctx, SYSTEM_TASK_ID);
            const trigger = await storage.cronTasks.findById("system:workspace-1:memory-cleanup");

            expect(task?.title).toBe("Memory Cleanup");
            expect(task?.code).toContain("Run scheduled memory maintenance now.");
            expect(trigger).toMatchObject({
                id: "system:workspace-1:memory-cleanup",
                schedule: "0 */12 * * *",
                timezone: "UTC",
                agentId: "memory-agent-2",
                enabled: false
            });
        } finally {
            storage.connection.close();
        }
    });

    it("disables the reserved cron when workspace memory is turned off", async () => {
        const storage = await storageOpenTest();
        try {
            await storage.users.create({
                id: "workspace-2",
                nametag: "workspace-2",
                isWorkspace: true,
                memory: false,
                createdAt: 1,
                updatedAt: 1
            });
            await storage.cronTasks.create({
                id: "system:workspace-2:memory-cleanup",
                taskId: SYSTEM_TASK_ID,
                userId: "workspace-2",
                schedule: "0 */12 * * *",
                timezone: "UTC",
                agentId: "memory-agent",
                enabled: true,
                deleteAfterRun: false,
                parameters: null,
                lastRunAt: null,
                createdAt: 2,
                updatedAt: 2
            });

            const agentSystem = {
                agentIdForTarget: vi.fn(async () => "memory-agent-3")
            } as never;

            await taskSystemMemoryCleanupEnsure(storage, agentSystem);

            const trigger = await storage.cronTasks.findById("system:workspace-2:memory-cleanup");
            expect(trigger?.enabled).toBe(false);
        } finally {
            storage.connection.close();
        }
    });
});
