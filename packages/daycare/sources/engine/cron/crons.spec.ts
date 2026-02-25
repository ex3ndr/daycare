import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Context } from "@/types";

import { configResolve } from "../../config/configResolve.js";
import { Storage } from "../../storage/storage.js";
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
            postAndAwait: vi.fn(async () => ({ status: "completed" }))
        } as unknown as CronsOptions["agentSystem"];
        const storage = Storage.open(":memory:");
        try {
            const crons = new Crons({
                config: new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"))),
                storage,
                eventBus: { emit: vi.fn() } as unknown as CronsOptions["eventBus"],
                agentSystem
            });
            const ctxA = contextBuild("user-a");
            const ctxB = contextBuild("user-b");
            const task = await crons.addTask(ctxA, {
                name: "Scoped task",
                schedule: "* * * * *",
                code: "Run scoped task"
            });

            await expect(crons.deleteTask(ctxB, task.id)).resolves.toBe(false);
            await expect(crons.deleteTask(ctxA, task.id)).resolves.toBe(true);
        } finally {
            storage.close();
        }
    });

    it("posts executable system_message for cron task runs", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-crons-execute-"));
        tempDirs.push(dir);

        const agentSystemMock = {
            ownerUserIdEnsure: vi.fn(async () => "owner"),
            userHomeForUserId: vi.fn((userId: string) => ({ home: path.join(dir, "users", userId, "home") })),
            postAndAwait: vi.fn(async () => ({ type: "system_message", responseText: null }))
        };
        const agentSystem = agentSystemMock as unknown as CronsOptions["agentSystem"];
        const storage = Storage.open(":memory:");
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
                                taskId: string;
                                taskUid: string;
                                taskName: string;
                                code: string;
                                agentId?: string;
                                userId?: string;
                            },
                            messageContext: { messageId?: string }
                        ) => Promise<void>;
                    };
                }
            ).scheduler.onTask;
            expect(callback).toBeTypeOf("function");

            const messageContext = { messageId: "msg-1" };
            await callback?.(
                {
                    taskId: "task-1",
                    taskUid: "uid-1",
                    taskName: "Nightly sync",
                    code: "Run checks",
                    userId: "user-1"
                },
                messageContext
            );

            expect(agentSystemMock.postAndAwait).toHaveBeenCalledWith(
                expect.objectContaining({ userId: "user-1", hasAgentId: false }),
                { descriptor: { type: "system", tag: "cron" } },
                expect.objectContaining({
                    type: "system_message",
                    origin: "cron",
                    execute: true,
                    context: messageContext
                })
            );
        } finally {
            storage.close();
        }
    });
});

function contextBuild(userId: string): Context {
    return contextForAgent({ userId, agentId: "agent-1" });
}
