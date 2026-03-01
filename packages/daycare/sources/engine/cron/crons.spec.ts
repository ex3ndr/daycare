import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Context } from "@/types";

import { configResolve } from "../../config/configResolve.js";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForAgent } from "../agents/context.js";
import { agentPathTask } from "../agents/ops/agentPathBuild.js";
import { ConfigModule } from "../config/configModule.js";
import { Crons, type CronsOptions } from "./crons.js";

describe("Crons", () => {
    const tempDirs: string[] = [];

    afterEach(async () => {
        await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
        tempDirs.length = 0;
    });

    it("requires ctx for add/delete and scopes deletion by ctx user", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-crons-add-delete-"));
        tempDirs.push(dir);
        const agentSystem = agentSystemMockBuild(dir);
        const storage = await storageOpenTest();
        try {
            const crons = new Crons({
                config: new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"))),
                storage,
                eventBus: { emit: vi.fn() } as unknown as CronsOptions["eventBus"],
                agentSystem
            });
            const ctxA = contextBuild("user-a");
            const ctxB = contextBuild("user-b");
            await storage.tasks.create({
                id: "task-scoped",
                userId: "user-a",
                title: "Scoped task",
                description: null,
                code: "Run scoped task",
                parameters: null,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            const task = await crons.addTask(ctxA, {
                taskId: "task-scoped",
                schedule: "* * * * *"
            });

            await expect(crons.deleteTask(ctxB, task.id)).resolves.toBe(false);
            await expect(crons.deleteTask(ctxA, task.id)).resolves.toBe(true);
            const observations = await storage.observationLog.findMany({ userId: "user-a", agentId: "agent-1" });
            expect(observations.map((entry) => entry.type)).toEqual(
                expect.arrayContaining(["cron:added", "cron:deleted"])
            );
        } finally {
            storage.connection.close();
        }
    });

    it("emits cron enabled/disabled observations", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-crons-enabled-disabled-"));
        tempDirs.push(dir);
        const storage = await storageOpenTest();
        const agentSystem = agentSystemMockBuild(dir);
        try {
            const crons = new Crons({
                config: new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"))),
                storage,
                eventBus: { emit: vi.fn() } as unknown as CronsOptions["eventBus"],
                agentSystem
            });
            const ctx = contextBuild("user-a");
            await storage.tasks.create({
                id: "task-enabled",
                userId: "user-a",
                title: "enabled-task",
                description: null,
                code: "run",
                parameters: null,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            const created = await crons.addTask(ctx, {
                taskId: "task-enabled",
                schedule: "*/5 * * * *"
            });
            await expect(crons.disableTask(ctx, created.id)).resolves.toBe(true);
            await expect(crons.enableTask(ctx, created.id)).resolves.toBe(true);
            const observations = await storage.observationLog.findMany({ userId: "user-a", agentId: "agent-1" });
            expect(observations.map((entry) => entry.type)).toEqual(
                expect.arrayContaining(["cron:disabled", "cron:enabled"])
            );
        } finally {
            storage.connection.close();
        }
    });

    it("routes cron runs through the shared taskExecutions facade", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-crons-execute-"));
        tempDirs.push(dir);
        const dispatch = vi.fn();
        const agentSystem = agentSystemMockBuild(dir, { dispatch });
        const storage = await storageOpenTest();
        try {
            const crons = new Crons({
                config: new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"))),
                storage,
                eventBus: { emit: vi.fn() } as unknown as CronsOptions["eventBus"],
                agentSystem
            });

            const callback = (
                crons as unknown as {
                    scheduler: {
                        onTask?: (
                            task: {
                                triggerId: string;
                                taskId: string;
                                taskVersion?: number;
                                taskName: string;
                                timezone: string;
                                agentId?: string;
                                userId?: string;
                                inputs?: Record<string, unknown>;
                            },
                            messageContext: { messageId?: string; timezone?: string }
                        ) => Promise<void>;
                    };
                }
            ).scheduler.onTask;
            expect(callback).toBeTypeOf("function");

            const messageContext = { messageId: "msg-1" };
            await callback?.(
                {
                    triggerId: "trigger-1",
                    taskId: "task-1",
                    taskVersion: 5,
                    taskName: "Nightly sync",
                    timezone: "UTC",
                    userId: "user-1",
                    inputs: { env: "prod" }
                },
                messageContext
            );

            expect(dispatch).toHaveBeenCalledWith({
                userId: "user-1",
                source: "cron",
                taskId: "task-1",
                taskVersion: 5,
                target: { path: agentPathTask("user-1", "task-1") },
                text: "[cron]\ntriggerId: trigger-1\ntaskId: task-1\ntaskName: Nightly sync\ntimezone: UTC",
                parameters: { env: "prod" },
                context: messageContext
            });
        } finally {
            storage.connection.close();
        }
    });

    it("does not post cron-specific failure messages from cron facade", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-crons-failure-report-"));
        tempDirs.push(dir);
        const agentSystem = agentSystemMockBuild(dir);
        const storage = await storageOpenTest();
        try {
            const crons = new Crons({
                config: new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"))),
                storage,
                eventBus: { emit: vi.fn() } as unknown as CronsOptions["eventBus"],
                agentSystem
            });
            const errorCallback = (
                crons as unknown as {
                    scheduler: {
                        onError?: (error: unknown, triggerId: string) => Promise<void>;
                    };
                }
            ).scheduler.onError;
            expect(errorCallback).toBeTypeOf("function");

            await errorCallback!(new Error("boom"), "trigger-failure");
            expect(agentSystem.post).not.toHaveBeenCalled();
        } finally {
            storage.connection.close();
        }
    });
});

function contextBuild(userId: string): Context {
    return contextForAgent({ userId, agentId: "agent-1" });
}

function agentSystemMockBuild(
    dir: string,
    options: { dispatch?: ReturnType<typeof vi.fn> } = {}
): CronsOptions["agentSystem"] & { post: ReturnType<typeof vi.fn> } {
    const dispatch = options.dispatch ?? vi.fn();
    return {
        ownerUserIdEnsure: vi.fn(async () => "owner"),
        userHomeForUserId: vi.fn((userId: string) => ({ home: path.join(dir, "users", userId, "home") })),
        post: vi.fn(async () => {}),
        taskExecutions: {
            dispatch
        }
    } as unknown as CronsOptions["agentSystem"] & { post: ReturnType<typeof vi.fn> };
}
