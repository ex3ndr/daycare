import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { configResolve } from "../../../config/configResolve.js";
import type { Storage } from "../../../storage/storage.js";
import { storageOpen } from "../../../storage/storageOpen.js";
import { contextForAgent } from "../../agents/context.js";
import { ConfigModule } from "../../config/configModule.js";
import { Crons } from "../../cron/crons.js";
import { Heartbeats } from "../../heartbeat/heartbeats.js";
import {
    buildTaskCreateTool,
    buildTaskDeleteTool,
    buildTaskReadTool,
    buildTaskRunTool,
    buildTaskTriggerAddTool,
    buildTaskTriggerRemoveTool,
    buildTaskUpdateTool
} from "./task.js";

const toolCall = (name: string) => ({ id: `${name}-call`, name });

describe("task tools", () => {
    const tempDirs: string[] = [];
    const storages: Storage[] = [];

    afterEach(async () => {
        await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
        tempDirs.length = 0;
        for (const storage of storages) {
            storage.db.close();
        }
        storages.length = 0;
    });

    it("creates, reads, updates, runs, and deletes a task with triggers", async () => {
        const runtime = await runtimeBuild();
        tempDirs.push(runtime.dir);
        storages.push(runtime.storage);

        const createTool = buildTaskCreateTool();
        const createResult = await createTool.execute(
            {
                title: "Daily check",
                code: "print('ok')",
                description: "Daily checks",
                cron: "0 9 * * *",
                heartbeat: true
            },
            runtime.context,
            toolCall("task_create")
        );
        const taskId = String(createResult.typedResult.taskId ?? "");
        expect(taskId).toBe("daily-check");

        const stored = await runtime.storage.tasks.findById(runtime.context.ctx, taskId);
        expect(stored?.title).toBe("Daily check");

        const readTool = buildTaskReadTool();
        const readResult = await readTool.execute({ taskId }, runtime.context, toolCall("task_read"));
        expect(readResult.typedResult.summary).toContain("Cron triggers: 1");
        expect(readResult.typedResult.summary).toContain("Heartbeat triggers: 1");

        const updateTool = buildTaskUpdateTool();
        await updateTool.execute(
            {
                taskId,
                title: "Daily check v2",
                code: "print('ok2')",
                description: "Updated"
            },
            runtime.context,
            toolCall("task_update")
        );
        const updated = await runtime.storage.tasks.findById(runtime.context.ctx, taskId);
        expect(updated?.title).toBe("Daily check v2");
        expect(updated?.code).toBe("print('ok2')");
        expect(updated?.description).toBe("Updated");

        const runTool = buildTaskRunTool();
        await runTool.execute({ taskId }, runtime.context, toolCall("task_run"));
        expect(runtime.postAndAwait).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user-1" }),
            { descriptor: { type: "system", tag: "task" } },
            expect.objectContaining({
                type: "system_message",
                origin: "task",
                execute: true
            })
        );

        const deleteTool = buildTaskDeleteTool();
        const deleteResult = await deleteTool.execute({ taskId }, runtime.context, toolCall("task_delete"));
        expect(deleteResult.typedResult.deleted).toBe(true);
        expect(await runtime.storage.tasks.findById(runtime.context.ctx, taskId)).toBeNull();
        expect((await runtime.crons.listTriggersForTask(runtime.context.ctx, taskId)).length).toBe(0);
        expect((await runtime.heartbeats.listTriggersForTask(runtime.context.ctx, taskId)).length).toBe(0);
    });

    it("reuses existing matching triggers during task_create", async () => {
        const runtime = await runtimeBuild();
        tempDirs.push(runtime.dir);
        storages.push(runtime.storage);

        const now = Date.now();
        vi.spyOn(runtime.crons, "listTriggersForTask").mockResolvedValue([
            {
                id: "cron-existing",
                taskId: "daily-check",
                userId: "user-1",
                name: "Daily check",
                description: null,
                schedule: "0 9 * * *",
                agentId: null,
                enabled: true,
                deleteAfterRun: false,
                lastRunAt: null,
                createdAt: now,
                updatedAt: now
            }
        ]);
        vi.spyOn(runtime.heartbeats, "listTriggersForTask").mockResolvedValue([
            {
                id: "heartbeat-existing",
                taskId: "daily-check",
                userId: "user-1",
                title: "Daily check",
                lastRunAt: null,
                createdAt: now,
                updatedAt: now
            }
        ]);
        const cronAddSpy = vi.spyOn(runtime.crons, "addTrigger");
        const heartbeatAddSpy = vi.spyOn(runtime.heartbeats, "addTrigger");

        const createTool = buildTaskCreateTool();
        const createResult = await createTool.execute(
            {
                title: "Daily check",
                code: "print('ok')",
                cron: "0 9 * * *",
                heartbeat: true
            },
            runtime.context,
            toolCall("task_create")
        );

        expect(String(createResult.typedResult.cronTriggerId ?? "")).toBe("cron-existing");
        expect(String(createResult.typedResult.heartbeatTriggerId ?? "")).toBe("heartbeat-existing");
        expect(cronAddSpy).not.toHaveBeenCalled();
        expect(heartbeatAddSpy).not.toHaveBeenCalled();
    });

    it("uses slug task ids from title and appends numeric suffix on collisions", async () => {
        const runtime = await runtimeBuild();
        tempDirs.push(runtime.dir);
        storages.push(runtime.storage);

        const createTool = buildTaskCreateTool();
        const first = await createTool.execute(
            {
                title: "Weekly Digest",
                code: "print('one')"
            },
            runtime.context,
            toolCall("task_create")
        );
        const second = await createTool.execute(
            {
                title: "Weekly Digest",
                code: "print('two')"
            },
            runtime.context,
            toolCall("task_create")
        );

        expect(String(first.typedResult.taskId ?? "")).toBe("weekly-digest");
        expect(String(second.typedResult.taskId ?? "")).toBe("weekly-digest-2");
    });

    it("allows the same task id for different users", async () => {
        const runtime = await runtimeBuild();
        tempDirs.push(runtime.dir);
        storages.push(runtime.storage);

        const createTool = buildTaskCreateTool();
        const first = await createTool.execute(
            {
                title: "Weekly Digest",
                code: "print('one')"
            },
            runtime.context,
            toolCall("task_create")
        );
        const userTwoContext: ToolExecutionContext = {
            ...runtime.context,
            agent: { id: "agent-2" } as ToolExecutionContext["agent"],
            ctx: contextForAgent({ userId: "user-2", agentId: "agent-2" })
        };
        const second = await createTool.execute(
            {
                title: "Weekly Digest",
                code: "print('two')"
            },
            userTwoContext,
            toolCall("task_create")
        );

        const firstTaskId = String(first.typedResult.taskId ?? "");
        const secondTaskId = String(second.typedResult.taskId ?? "");
        expect(firstTaskId).toBe("weekly-digest");
        expect(secondTaskId).toBe("weekly-digest");

        const firstStored = await runtime.storage.tasks.findById(runtime.context.ctx, firstTaskId);
        const secondStored = await runtime.storage.tasks.findById(userTwoContext.ctx, secondTaskId);
        expect(firstStored?.userId).toBe("user-1");
        expect(secondStored?.userId).toBe("user-2");
    });

    it("does not reuse a deleted task id", async () => {
        const runtime = await runtimeBuild();
        tempDirs.push(runtime.dir);
        storages.push(runtime.storage);

        const createTool = buildTaskCreateTool();
        const deleteTool = buildTaskDeleteTool();

        const first = await createTool.execute(
            {
                title: "Nightly Audit",
                code: "print('one')"
            },
            runtime.context,
            toolCall("task_create")
        );
        const firstId = String(first.typedResult.taskId ?? "");
        expect(firstId).toBe("nightly-audit");

        await deleteTool.execute({ taskId: firstId }, runtime.context, toolCall("task_delete"));

        const second = await createTool.execute(
            {
                title: "Nightly Audit",
                code: "print('two')"
            },
            runtime.context,
            toolCall("task_create")
        );
        expect(String(second.typedResult.taskId ?? "")).toBe("nightly-audit-2");
    });

    it("adds and removes triggers for an existing task", async () => {
        const runtime = await runtimeBuild();
        tempDirs.push(runtime.dir);
        storages.push(runtime.storage);

        const now = Date.now();
        await runtime.storage.tasks.create({
            id: "task-one",
            userId: "user-1",
            title: "Manual task",
            description: null,
            code: "print('manual')",
            createdAt: now,
            updatedAt: now
        });

        const addTool = buildTaskTriggerAddTool();
        const cronAddResult = await addTool.execute(
            { taskId: "task-one", type: "cron", schedule: "*/15 * * * *" },
            runtime.context,
            toolCall("task_trigger_add")
        );
        const cronTriggerId = String(cronAddResult.typedResult.cronTriggerId ?? "");
        expect(cronTriggerId).not.toBe("");

        // Duplicate cron schedule should be ignored and return the existing trigger.
        const duplicateCronAddResult = await addTool.execute(
            { taskId: "task-one", type: "cron", schedule: "*/15 * * * *" },
            runtime.context,
            toolCall("task_trigger_add")
        );
        expect(String(duplicateCronAddResult.typedResult.cronTriggerId ?? "")).toBe(cronTriggerId);

        // Different cron schedules should create additional triggers.
        await addTool.execute(
            { taskId: "task-one", type: "cron", schedule: "0 * * * *" },
            runtime.context,
            toolCall("task_trigger_add")
        );
        expect((await runtime.crons.listTriggersForTask(runtime.context.ctx, "task-one")).length).toBe(2);

        const heartbeatAddResult = await addTool.execute(
            { taskId: "task-one", type: "heartbeat" },
            runtime.context,
            toolCall("task_trigger_add")
        );
        const heartbeatTriggerId = String(heartbeatAddResult.typedResult.heartbeatTriggerId ?? "");
        expect(heartbeatTriggerId).not.toBe("");

        // Duplicate heartbeat trigger add should be ignored and return the existing trigger.
        const duplicateHeartbeatAddResult = await addTool.execute(
            { taskId: "task-one", type: "heartbeat" },
            runtime.context,
            toolCall("task_trigger_add")
        );
        expect(String(duplicateHeartbeatAddResult.typedResult.heartbeatTriggerId ?? "")).toBe(heartbeatTriggerId);
        expect((await runtime.heartbeats.listTriggersForTask(runtime.context.ctx, "task-one")).length).toBe(1);

        const removeTool = buildTaskTriggerRemoveTool();
        const cronRemoveResult = await removeTool.execute(
            { taskId: "task-one", type: "cron" },
            runtime.context,
            toolCall("task_trigger_remove")
        );
        expect(cronRemoveResult.typedResult.removed).toBe(true);
        const heartbeatRemoveResult = await removeTool.execute(
            { taskId: "task-one", type: "heartbeat" },
            runtime.context,
            toolCall("task_trigger_remove")
        );
        expect(heartbeatRemoveResult.typedResult.removed).toBe(true);
    });
});

async function runtimeBuild(): Promise<{
    dir: string;
    storage: Storage;
    crons: Crons;
    heartbeats: Heartbeats;
    context: ToolExecutionContext;
    postAndAwait: (...args: unknown[]) => Promise<unknown>;
}> {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-task-tools-"));
    const storage = storageOpen(":memory:");
    const postAndAwait = vi.fn(async () => ({ status: "completed" }));
    const eventBus = { emit: vi.fn() };
    const config = new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json")));

    const agentSystem = {
        storage,
        postAndAwait
    } as unknown as ToolExecutionContext["agentSystem"] & { crons: Crons; heartbeats: Heartbeats };

    const crons = new Crons({
        config,
        storage,
        eventBus: eventBus as never,
        agentSystem: agentSystem as never
    });
    const heartbeats = new Heartbeats({
        config,
        storage,
        eventBus: eventBus as never,
        intervalMs: 60_000,
        agentSystem: agentSystem as never
    });

    Object.assign(agentSystem, { crons, heartbeats });

    const context: ToolExecutionContext = {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: { id: "agent-1" } as unknown as ToolExecutionContext["agent"],
        ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
        source: "test",
        messageContext: { messageId: "msg-1" },
        agentSystem: agentSystem as unknown as ToolExecutionContext["agentSystem"],
        heartbeats
    };

    return { dir, storage, crons, heartbeats, context, postAndAwait };
}
