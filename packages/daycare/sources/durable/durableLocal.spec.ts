import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { contextForUser } from "../types.js";
import { DurableLocal } from "./durableLocal.js";
import type { DurableExecute } from "./durableTypes.js";

describe("DurableLocal", () => {
    it("replays scheduled jobs from disk after restart", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-durable-local-"));
        try {
            const delivered: string[] = [];
            const ctx = contextForUser({ userId: "user-1" });
            const runtime = new DurableLocal({
                execute: (async (_ctx, _name, input) => {
                    delivered.push((input as { delayedSignalId: string }).delayedSignalId);
                    return null;
                }) as DurableExecute,
                retryBaseMs: 10,
                rootDir: path.join(dir, "durable")
            });
            await runtime.schedule(ctx, "delayedSignalDeliver", { delayedSignalId: "job-1" });

            const restored = new DurableLocal({
                execute: (async (_ctx, _name, input) => {
                    delivered.push((input as { delayedSignalId: string }).delayedSignalId);
                    return null;
                }) as DurableExecute,
                retryBaseMs: 10,
                rootDir: path.join(dir, "durable")
            });
            await restored.start();

            await vi.waitFor(() => {
                expect(delivered).toEqual(["job-1"]);
            });
            await restored.stop();
        } finally {
            await rm(dir, { force: true, recursive: true });
        }
    });

    it("schedules outside durable context, calls inline inside durable context, and rejects direct call outside durable scope", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-durable-local-"));
        try {
            const delivered: string[] = [];
            const ctx = contextForUser({ userId: "user-1" });
            let runtime!: DurableLocal;
            runtime = new DurableLocal({
                execute: (async (callCtx, name, input) => {
                    const durableInput = input as { delayedSignalId: string };
                    if (durableInput.delayedSignalId === "parent") {
                        await runtime.call(callCtx, name, { delayedSignalId: "child" });
                    }
                    delivered.push(durableInput.delayedSignalId);
                    return null;
                }) as DurableExecute,
                retryBaseMs: 10,
                rootDir: path.join(dir, "durable")
            });
            await runtime.start();

            await runtime.schedule(ctx, "delayedSignalDeliver", { delayedSignalId: "scheduled" });

            await expect(
                runtime.call(ctx, "delayedSignalDeliver", {
                    delayedSignalId: "outside"
                })
            ).rejects.toThrow("Durable call requires a durable execution context.");

            await runtime.schedule(ctx, "delayedSignalDeliver", { delayedSignalId: "parent" });

            await vi.waitFor(() => {
                expect(delivered).toEqual(["scheduled", "child", "parent"]);
            });
            await runtime.stop();
        } finally {
            await rm(dir, { force: true, recursive: true });
        }
    });

    it("rejects locally scheduled durable work when the function is disabled for current roles", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-durable-local-"));
        try {
            const runtime = new DurableLocal({
                execute: (async () => null) as DurableExecute,
                roles: ["tasks"],
                retryBaseMs: 10,
                rootDir: path.join(dir, "durable")
            });

            await expect(
                runtime.schedule(contextForUser({ userId: "user-1" }), "delayedSignalDeliver", {
                    delayedSignalId: "job-1"
                })
            ).rejects.toThrow('Durable function "delayedSignalDeliver" is disabled for roles: tasks.');
        } finally {
            await rm(dir, { force: true, recursive: true });
        }
    });
});
