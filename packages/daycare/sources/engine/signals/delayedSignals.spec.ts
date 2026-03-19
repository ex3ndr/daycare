import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { Signal, SignalGenerateInput } from "@/types";
import { configResolve } from "../../config/configResolve.js";
import { durableExecute } from "../../durable/durableExecute.js";
import { DurableLocal } from "../../durable/durableLocal.js";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { ConfigModule } from "../config/configModule.js";
import { EngineEventBus } from "../ipc/events.js";
import { DelayedSignals } from "./delayedSignals.js";

describe("DelayedSignals", () => {
    it("replaces scheduled items by repeat key and persists queue", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-delayed-signals-"));
        try {
            const config = configModuleBuild(dir);
            const storage = await storageOpenTest();
            const eventBus = new EngineEventBus();
            const signals = {
                generate: async (input: SignalGenerateInput): Promise<Signal> => ({
                    id: "signal-id",
                    type: input.type,
                    source: input.source,
                    data: input.data,
                    createdAt: Date.now()
                })
            };

            const harness = await delayedSignalsBuild({
                config,
                dataDir: dir,
                delayedSignals: storage.delayedSignals,
                eventBus,
                signals
            });
            const { delayed, durable } = harness;
            await delayed.ensureDir();
            const first = await delayed.schedule({
                type: "reminder",
                repeatKey: "job",
                deliverAt: Date.now() + 60_000,
                source: { type: "system", userId: "user-1" }
            });
            const second = await delayed.schedule({
                type: "reminder",
                repeatKey: "job",
                deliverAt: Date.now() + 120_000,
                source: { type: "system", userId: "user-1" }
            });

            expect(first.id).not.toBe(second.id);
            expect(delayed.list()).toHaveLength(1);
            expect(delayed.list()[0]?.id).toBe(second.id);

            const restoredHarness = await delayedSignalsBuild({
                config,
                dataDir: dir,
                delayedSignals: storage.delayedSignals,
                eventBus,
                signals
            });
            const { delayed: restored, durable: restoredDurable } = restoredHarness;
            await restored.ensureDir();
            expect(restored.list()).toHaveLength(1);
            expect(restored.list()[0]?.id).toBe(second.id);

            const removed = await restored.cancelByRepeatKey({
                type: "reminder",
                repeatKey: "job"
            });
            expect(removed).toBe(1);
            expect(restored.list()).toEqual([]);
            await durable.stop();
            await restoredDurable.stop();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("keeps due events scheduled when delivery fails", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-delayed-signals-"));
        try {
            const config = configModuleBuild(dir);
            const storage = await storageOpenTest();
            let attempts = 0;
            const harness = await delayedSignalsBuild({
                config,
                dataDir: dir,
                delayedSignals: storage.delayedSignals,
                eventBus: new EngineEventBus(),
                signals: {
                    generate: async () => {
                        attempts += 1;
                        throw new Error("delivery failed");
                    }
                },
                failureRetryMs: 20
            });
            const { delayed, durable } = harness;
            await delayed.start();
            await delayed.schedule({
                type: "notify.fail",
                deliverAt: Date.now() + 5,
                source: { type: "system", userId: "user-1" }
            });

            await vi.waitFor(() => {
                expect(attempts).toBeGreaterThan(0);
            });
            delayed.stop();

            expect(delayed.list()).toHaveLength(1);
            expect(delayed.list()[0]?.type).toBe("notify.fail");
            await durable.stop();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("removes events from queue only after successful delivery", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-delayed-signals-"));
        try {
            const config = configModuleBuild(dir);
            const storage = await storageOpenTest();
            const delivered: SignalGenerateInput[] = [];
            const harness = await delayedSignalsBuild({
                config,
                dataDir: dir,
                delayedSignals: storage.delayedSignals,
                eventBus: new EngineEventBus(),
                signals: {
                    generate: async (input) => {
                        delivered.push(input);
                        return {
                            id: "signal-id",
                            type: input.type,
                            source: input.source,
                            data: input.data,
                            createdAt: Date.now()
                        };
                    }
                },
                failureRetryMs: 20
            });
            const { delayed, durable } = harness;
            await delayed.start();
            await delayed.schedule({
                type: "notify.ok",
                deliverAt: Date.now() + 5,
                source: { type: "process", id: "tests", userId: "user-1" },
                data: { ok: true }
            });

            await vi.waitFor(() => {
                expect(delivered).toHaveLength(1);
            });
            delayed.stop();

            expect(delivered[0]?.type).toBe("notify.ok");
            expect(delayed.list()).toEqual([]);
            await durable.stop();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("throws a validation error when scheduled source userId is missing at runtime", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-delayed-signals-"));
        try {
            const storage = await storageOpenTest();
            const harness = await delayedSignalsBuild({
                config: configModuleBuild(dir),
                dataDir: dir,
                delayedSignals: storage.delayedSignals,
                eventBus: new EngineEventBus(),
                signals: {
                    generate: async (input) => ({
                        id: "signal-id",
                        type: input.type,
                        source: input.source,
                        data: input.data,
                        createdAt: Date.now()
                    })
                }
            });
            const { delayed, durable } = harness;
            await delayed.ensureDir();

            await expect(
                delayed.schedule({
                    type: "notify.invalid",
                    deliverAt: Date.now() + 5,
                    source: { type: "system" } as unknown as Signal["source"]
                })
            ).rejects.toThrow("Signal source userId is required");
            await durable.stop();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});

function configModuleBuild(dataDir: string): ConfigModule {
    return new ConfigModule(configResolve({ engine: { dataDir } }, path.join(dataDir, "settings.json")));
}

async function delayedSignalsBuild(options: {
    config: ConfigModule;
    dataDir: string;
    delayedSignals: Awaited<ReturnType<typeof storageOpenTest>>["delayedSignals"];
    eventBus: EngineEventBus;
    failureRetryMs?: number;
    signals: {
        generate: (input: SignalGenerateInput) => Promise<Signal>;
    };
}): Promise<{ delayed: DelayedSignals; durable: DurableLocal }> {
    let delayed!: DelayedSignals;
    const durable = new DurableLocal({
        execute: (ctx, name, input) =>
            durableExecute({
                ctx,
                delayedSignals: delayed,
                connectorRegistry: { get: () => null },
                agentPost: async () => {},
                input,
                name
            }),
        retryBaseMs: options.failureRetryMs ?? 20,
        rootDir: path.join(options.dataDir, "durable")
    });
    delayed = new DelayedSignals({
        config: options.config,
        delayedSignals: options.delayedSignals,
        durable,
        eventBus: options.eventBus,
        failureRetryMs: options.failureRetryMs,
        signals: options.signals
    });
    await durable.start();
    return { delayed, durable };
}
