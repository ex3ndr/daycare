import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Context } from "@/types";

import { configResolve } from "../../config/configResolve.js";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForAgent } from "../agents/context.js";
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
        const agentSystem = {
            ownerUserIdEnsure: vi.fn(async () => "owner"),
            userHomeForUserId: vi.fn((userId: string) => ({ home: path.join(dir, "users", userId, "home") })),
            post: vi.fn(async () => {}),
            postAndAwait: vi.fn(async () => ({ status: "completed" }))
        } as unknown as CronsOptions["agentSystem"];
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
        const agentSystem = {
            ownerUserIdEnsure: vi.fn(async () => "owner"),
            userHomeForUserId: vi.fn((userId: string) => ({ home: path.join(dir, "users", userId, "home") })),
            postAndAwait: vi.fn(async () => ({ status: "completed" }))
        } as unknown as CronsOptions["agentSystem"];
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

    it("posts executable system_message for cron task runs", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-crons-execute-"));
        tempDirs.push(dir);

        const agentSystemMock = {
            ownerUserIdEnsure: vi.fn(async () => "owner"),
            userHomeForUserId: vi.fn((userId: string) => ({ home: path.join(dir, "users", userId, "home") })),
            post: vi.fn(async () => {}),
            postAndAwait: vi.fn(async () => ({ type: "system_message", responseText: null }))
        };
        const agentSystem = agentSystemMock as unknown as CronsOptions["agentSystem"];
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
                                taskName: string;
                                code: string;
                                timezone: string;
                                agentId?: string;
                                userId?: string;
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
                    taskName: "Nightly sync",
                    code: "Run checks",
                    timezone: "UTC",
                    userId: "user-1"
                },
                messageContext
            );

            expect(agentSystemMock.postAndAwait).toHaveBeenCalledWith(
                expect.objectContaining({ userId: "user-1", hasAgentId: false }),
                { descriptor: { type: "task", id: "task-1" } },
                expect.objectContaining({
                    type: "system_message",
                    origin: "cron",
                    execute: true,
                    context: messageContext
                })
            );
        } finally {
            storage.connection.close();
        }
    });

    it("surfaces responseError from cron system message execution", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-crons-response-error-"));
        tempDirs.push(dir);

        const agentSystemMock = {
            ownerUserIdEnsure: vi.fn(async () => "owner"),
            userHomeForUserId: vi.fn((userId: string) => ({ home: path.join(dir, "users", userId, "home") })),
            post: vi.fn(async () => {}),
            postAndAwait: vi.fn(async () => ({
                type: "system_message",
                responseText: "<exec_error>boom</exec_error>",
                responseError: true
            }))
        };
        const agentSystem = agentSystemMock as unknown as CronsOptions["agentSystem"];
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
                                taskName: string;
                                code: string;
                                timezone: string;
                                agentId?: string;
                                userId?: string;
                            },
                            messageContext: { messageId?: string; timezone?: string }
                        ) => Promise<void>;
                    };
                }
            ).scheduler.onTask;
            expect(callback).toBeTypeOf("function");

            await expect(
                callback!(
                    {
                        triggerId: "trigger-1",
                        taskId: "task-1",
                        taskName: "Nightly sync",
                        code: "Run checks",
                        timezone: "UTC",
                        userId: "user-1"
                    },
                    {}
                )
            ).rejects.toThrow("<exec_error>boom</exec_error>");
        } finally {
            storage.connection.close();
        }
    });

    it("reports cron failures via task-scoped system message with triggerId and taskId", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-crons-failure-report-"));
        tempDirs.push(dir);

        const agentSystemMock = {
            ownerUserIdEnsure: vi.fn(async () => "owner"),
            userHomeForUserId: vi.fn((userId: string) => ({ home: path.join(dir, "users", userId, "home") })),
            post: vi.fn(async () => {}),
            postAndAwait: vi.fn(async () => ({ type: "system_message", responseText: null }))
        };
        const agentSystem = agentSystemMock as unknown as CronsOptions["agentSystem"];
        const storage = await storageOpenTest();
        try {
            const now = Date.now();
            await storage.tasks.create({
                id: "task-failure",
                userId: "user-1",
                title: "Failure task",
                description: null,
                code: "print('hello')",
                parameters: null,
                createdAt: now,
                updatedAt: now
            });

            const crons = new Crons({
                config: new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"))),
                storage,
                eventBus: { emit: vi.fn() } as unknown as CronsOptions["eventBus"],
                agentSystem
            });
            const created = await crons.addTask(contextBuild("user-1"), {
                id: "trigger-failure",
                taskId: "task-failure",
                schedule: "* * * * *"
            });

            const errorCallback = (
                crons as unknown as {
                    scheduler: {
                        onError?: (error: unknown, triggerId: string) => Promise<void>;
                    };
                }
            ).scheduler.onError;
            expect(errorCallback).toBeTypeOf("function");

            await errorCallback!(new Error("boom"), created.id);

            expect(agentSystemMock.post).toHaveBeenCalledWith(
                expect.objectContaining({ userId: "user-1", hasAgentId: false }),
                { descriptor: { type: "task", id: "task-failure" } },
                expect.objectContaining({
                    type: "system_message",
                    origin: "cron:failure"
                })
            );

            const postCalls = agentSystemMock.post.mock.calls as unknown[][];
            const postedMessage = postCalls[0]?.[2] as { text?: string } | undefined;
            expect(postedMessage?.text).toContain("triggerId: trigger-failure");
            expect(postedMessage?.text).toContain("taskId: task-failure");
            expect(postedMessage?.text).toContain("Try to fix the task before the next run.");
        } finally {
            storage.connection.close();
        }
    });
});

function contextBuild(userId: string): Context {
    return contextForAgent({ userId, agentId: "agent-1" });
}
