import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Context } from "@/types";

import { configResolve } from "../../config/configResolve.js";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { ConfigModule } from "../config/configModule.js";
import { Heartbeats, type HeartbeatsOptions } from "./heartbeats.js";

describe("Heartbeats", () => {
    const tempDirs: string[] = [];

    afterEach(async () => {
        await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
        tempDirs.length = 0;
    });

    it("adds and removes heartbeat tasks with ctx scoping", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-heartbeats-add-delete-"));
        tempDirs.push(dir);
        const agentSystem = {
            ownerUserIdEnsure: vi.fn(async () => "owner"),
            userHomeForUserId: vi.fn((userId: string) => ({ home: path.join(dir, "users", userId, "home") })),
            postAndAwait: vi.fn(async () => ({ status: "completed" }))
        } as unknown as HeartbeatsOptions["agentSystem"];
        const storage = await storageOpenTest();
        try {
            const heartbeats = new Heartbeats({
                config: new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"))),
                storage,
                eventBus: { emit: vi.fn() } as unknown as HeartbeatsOptions["eventBus"],
                agentSystem
            });
            await storage.tasks.create({
                id: "task-beat",
                userId: "user-a",
                title: "beat",
                description: null,
                code: "run",
                parameters: null,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            const task = await heartbeats.addTask(contextBuild("user-a"), {
                taskId: "task-beat"
            });

            await expect(heartbeats.removeTask(contextBuild("user-b"), task.id)).resolves.toBe(false);
            await expect(heartbeats.removeTask(contextBuild("user-a"), task.id)).resolves.toBe(true);
        } finally {
            storage.connection.close();
        }
    });

    it("posts executable system_message batch for heartbeat runs", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-heartbeats-execute-"));
        tempDirs.push(dir);

        const agentSystemMock = {
            ownerUserIdEnsure: vi.fn(async () => "owner"),
            userHomeForUserId: vi.fn((userId: string) => ({ home: path.join(dir, "users", userId, "home") })),
            postAndAwait: vi.fn(async () => ({ type: "system_message", responseText: null }))
        };
        const agentSystem = agentSystemMock as unknown as HeartbeatsOptions["agentSystem"];
        const storage = await storageOpenTest();
        try {
            const heartbeats = new Heartbeats({
                config: new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"))),
                storage,
                eventBus: { emit: vi.fn() } as unknown as HeartbeatsOptions["eventBus"],
                agentSystem,
                intervalMs: 60_000
            });
            await storage.tasks.create({
                id: "task-hb-1",
                userId: "user-1",
                title: "beat",
                description: null,
                code: "check",
                parameters: null,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });

            await storage.heartbeatTasks.create({
                id: "hb-1",
                taskId: "task-hb-1",
                userId: "user-1",
                title: "beat",
                parameters: null,
                lastRunAt: null,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            await heartbeats.runNow();

            expect(agentSystemMock.postAndAwait).toHaveBeenCalledWith(
                expect.objectContaining({ userId: "user-1" }),
                { descriptor: { type: "task", id: "task-hb-1" } },
                expect.objectContaining({
                    type: "system_message",
                    origin: "heartbeat",
                    execute: true
                })
            );
        } finally {
            storage.connection.close();
        }
    });

    it("routes each heartbeat trigger to its own task descriptor", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-heartbeats-per-task-"));
        tempDirs.push(dir);

        const agentSystemMock = {
            ownerUserIdEnsure: vi.fn(async () => "owner"),
            userHomeForUserId: vi.fn((userId: string) => ({ home: path.join(dir, "users", userId, "home") })),
            postAndAwait: vi.fn(async () => ({ type: "system_message", responseText: null }))
        };
        const storage = await storageOpenTest();
        try {
            const heartbeats = new Heartbeats({
                config: new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"))),
                storage,
                eventBus: { emit: vi.fn() } as unknown as HeartbeatsOptions["eventBus"],
                agentSystem: agentSystemMock as unknown as HeartbeatsOptions["agentSystem"],
                intervalMs: 60_000
            });

            const now = Date.now();
            await storage.tasks.create({
                id: "task-hb-a",
                userId: "user-1",
                title: "beat a",
                description: null,
                code: "check a",
                parameters: null,
                createdAt: now,
                updatedAt: now
            });
            await storage.tasks.create({
                id: "task-hb-b",
                userId: "user-1",
                title: "beat b",
                description: null,
                code: "check b",
                parameters: null,
                createdAt: now,
                updatedAt: now
            });
            await storage.heartbeatTasks.create({
                id: "hb-a",
                taskId: "task-hb-a",
                userId: "user-1",
                title: "beat a",
                parameters: null,
                lastRunAt: null,
                createdAt: now,
                updatedAt: now
            });
            await storage.heartbeatTasks.create({
                id: "hb-b",
                taskId: "task-hb-b",
                userId: "user-1",
                title: "beat b",
                parameters: null,
                lastRunAt: null,
                createdAt: now,
                updatedAt: now
            });

            await heartbeats.runNow();

            expect(agentSystemMock.postAndAwait).toHaveBeenCalledTimes(2);
            expect(agentSystemMock.postAndAwait).toHaveBeenCalledWith(
                expect.objectContaining({ userId: "user-1" }),
                { descriptor: { type: "task", id: "task-hb-a" } },
                expect.objectContaining({
                    type: "system_message",
                    origin: "heartbeat",
                    execute: true
                })
            );
            expect(agentSystemMock.postAndAwait).toHaveBeenCalledWith(
                expect.objectContaining({ userId: "user-1" }),
                { descriptor: { type: "task", id: "task-hb-b" } },
                expect.objectContaining({
                    type: "system_message",
                    origin: "heartbeat",
                    execute: true
                })
            );
        } finally {
            storage.connection.close();
        }
    });
});

function contextBuild(userId: string): Context {
    return {
        agentId: "agent-1",
        userId
    };
}
