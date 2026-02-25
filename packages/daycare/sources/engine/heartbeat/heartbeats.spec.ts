import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Context } from "@/types";

import { configResolve } from "../../config/configResolve.js";
import { Storage } from "../../storage/storage.js";
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
        const storage = Storage.open(":memory:");
        try {
            const heartbeats = new Heartbeats({
                config: new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"))),
                storage,
                eventBus: { emit: vi.fn() } as unknown as HeartbeatsOptions["eventBus"],
                agentSystem
            });
            const task = await heartbeats.addTask(contextBuild("user-a"), {
                title: "beat",
                code: "run"
            });

            await expect(heartbeats.removeTask(contextBuild("user-b"), task.id)).resolves.toBe(false);
            await expect(heartbeats.removeTask(contextBuild("user-a"), task.id)).resolves.toBe(true);
        } finally {
            storage.close();
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
        const storage = Storage.open(":memory:");
        try {
            const heartbeats = new Heartbeats({
                config: new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"))),
                storage,
                eventBus: { emit: vi.fn() } as unknown as HeartbeatsOptions["eventBus"],
                agentSystem,
                intervalMs: 60_000
            });

            await storage.heartbeatTasks.create({
                id: "hb-1",
                userId: "user-1",
                title: "beat",
                code: "check",
                lastRunAt: null,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            await heartbeats.runNow();

            expect(agentSystemMock.postAndAwait).toHaveBeenCalledWith(
                expect.objectContaining({ userId: "user-1" }),
                { descriptor: { type: "system", tag: "heartbeat" } },
                expect.objectContaining({
                    type: "system_message",
                    origin: "heartbeat",
                    execute: true
                })
            );
        } finally {
            storage.close();
        }
    });
});

function contextBuild(userId: string): Context {
    return {
        agentId: "agent-1",
        userId
    };
}
