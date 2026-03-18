import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { contextForUser } from "../types.js";
import { DurableLocal } from "./durableLocal.js";

describe("DurableLocal", () => {
    it("replays scheduled jobs from disk after restart", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-durable-local-"));
        try {
            const delivered: string[] = [];
            const ctx = contextForUser({ userId: "user-1" });
            const runtime = new DurableLocal({
                execute: async (_ctx, _name, input) => {
                    delivered.push(input.delayedSignalId);
                    return null;
                },
                retryBaseMs: 10,
                rootDir: path.join(dir, "durable")
            });
            await runtime.schedule(ctx, "delayedSignalDeliver", { delayedSignalId: "job-1" });

            const restored = new DurableLocal({
                execute: async (_ctx, _name, input) => {
                    delivered.push(input.delayedSignalId);
                    return null;
                },
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

    it("schedules outside durable context, invokes inline inside durable context, and rejects direct call outside durable scope", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-durable-local-"));
        try {
            const delivered: string[] = [];
            const ctx = contextForUser({ userId: "user-1" });
            let runtime!: DurableLocal;
            runtime = new DurableLocal({
                execute: async (callCtx, name, input) => {
                    if (input.delayedSignalId === "parent") {
                        await runtime.invoke(callCtx, name, { delayedSignalId: "child" });
                    }
                    delivered.push(input.delayedSignalId);
                    return null;
                },
                retryBaseMs: 10,
                rootDir: path.join(dir, "durable")
            });
            await runtime.start();

            await expect(
                runtime.invoke(ctx, "delayedSignalDeliver", { delayedSignalId: "scheduled" })
            ).resolves.toBeUndefined();

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
});
