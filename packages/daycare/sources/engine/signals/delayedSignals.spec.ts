import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { Signal, SignalGenerateInput } from "@/types";
import { configResolve } from "../../config/configResolve.js";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { ConfigModule } from "../config/configModule.js";
import { EngineEventBus } from "../ipc/events.js";
import { DelayedSignals } from "./delayedSignals.js";

describe("DelayedSignals", () => {
    it("replaces scheduled items by repeat key and persists queue", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-delayed-signals-"));
        try {
            const config = configModuleBuild(dir);
            const storage = storageOpenTest();
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

            const delayed = new DelayedSignals({ config, eventBus, signals, delayedSignals: storage.delayedSignals });
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

            const restored = new DelayedSignals({ config, eventBus, signals, delayedSignals: storage.delayedSignals });
            await restored.ensureDir();
            expect(restored.list()).toHaveLength(1);
            expect(restored.list()[0]?.id).toBe(second.id);

            const removed = await restored.cancelByRepeatKey({
                type: "reminder",
                repeatKey: "job"
            });
            expect(removed).toBe(1);
            expect(restored.list()).toEqual([]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("keeps due events scheduled when delivery fails", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-delayed-signals-"));
        try {
            const config = configModuleBuild(dir);
            const storage = storageOpenTest();
            let attempts = 0;
            const delayed = new DelayedSignals({
                config,
                eventBus: new EngineEventBus(),
                signals: {
                    generate: async () => {
                        attempts += 1;
                        throw new Error("delivery failed");
                    }
                },
                delayedSignals: storage.delayedSignals,
                failureRetryMs: 20
            });
            await delayed.start();
            await delayed.schedule({
                type: "notify.fail",
                deliverAt: Date.now() + 5,
                source: { type: "system", userId: "user-1" }
            });

            await wait(35);
            delayed.stop();

            expect(attempts).toBeGreaterThan(0);
            expect(delayed.list()).toHaveLength(1);
            expect(delayed.list()[0]?.type).toBe("notify.fail");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("removes events from queue only after successful delivery", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-delayed-signals-"));
        try {
            const config = configModuleBuild(dir);
            const storage = storageOpenTest();
            const delivered: SignalGenerateInput[] = [];
            const delayed = new DelayedSignals({
                config,
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
                delayedSignals: storage.delayedSignals,
                failureRetryMs: 20
            });
            await delayed.start();
            await delayed.schedule({
                type: "notify.ok",
                deliverAt: Date.now() + 5,
                source: { type: "process", id: "tests", userId: "user-1" },
                data: { ok: true }
            });

            await wait(35);
            delayed.stop();

            expect(delivered).toHaveLength(1);
            expect(delivered[0]?.type).toBe("notify.ok");
            expect(delayed.list()).toEqual([]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("throws a validation error when scheduled source userId is missing at runtime", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-delayed-signals-"));
        try {
            const storage = storageOpenTest();
            const delayed = new DelayedSignals({
                config: configModuleBuild(dir),
                eventBus: new EngineEventBus(),
                signals: {
                    generate: async (input) => ({
                        id: "signal-id",
                        type: input.type,
                        source: input.source,
                        data: input.data,
                        createdAt: Date.now()
                    })
                },
                delayedSignals: storage.delayedSignals
            });
            await delayed.ensureDir();

            await expect(
                delayed.schedule({
                    type: "notify.invalid",
                    deliverAt: Date.now() + 5,
                    source: { type: "system" } as unknown as Signal["source"]
                })
            ).rejects.toThrow("Signal source userId is required");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});

function configModuleBuild(dataDir: string): ConfigModule {
    return new ConfigModule(configResolve({ engine: { dataDir } }, path.join(dataDir, "settings.json")));
}

async function wait(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
}
