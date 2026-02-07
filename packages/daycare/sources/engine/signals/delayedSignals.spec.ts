import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { Signal, SignalGenerateInput } from "@/types";
import { configResolve } from "../../config/configResolve.js";
import { ConfigModule } from "../config/configModule.js";
import { EngineEventBus } from "../ipc/events.js";
import { DelayedSignals } from "./delayedSignals.js";

describe("DelayedSignals", () => {
  it("replaces scheduled items by repeat key and persists queue", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-delayed-signals-"));
    try {
      const config = configModuleBuild(dir);
      const eventBus = new EngineEventBus();
      const signals = {
        generate: async (input: SignalGenerateInput): Promise<Signal> => ({
          id: "signal-id",
          type: input.type,
          source: input.source ?? { type: "system" },
          data: input.data,
          createdAt: Date.now()
        })
      };

      const delayed = new DelayedSignals({ config, eventBus, signals });
      await delayed.ensureDir();
      const first = await delayed.schedule({
        type: "reminder",
        repeatKey: "job",
        deliverAt: Date.now() + 60_000
      });
      const second = await delayed.schedule({
        type: "reminder",
        repeatKey: "job",
        deliverAt: Date.now() + 120_000
      });

      expect(first.id).not.toBe(second.id);
      expect(delayed.list()).toHaveLength(1);
      expect(delayed.list()[0]?.id).toBe(second.id);

      const restored = new DelayedSignals({ config, eventBus, signals });
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
        failureRetryMs: 20
      });
      await delayed.start();
      await delayed.schedule({
        type: "notify.fail",
        deliverAt: Date.now() + 5
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
              source: input.source ?? { type: "system" },
              data: input.data,
              createdAt: Date.now()
            };
          }
        },
        failureRetryMs: 20
      });
      await delayed.start();
      await delayed.schedule({
        type: "notify.ok",
        deliverAt: Date.now() + 5,
        source: { type: "process", id: "tests" },
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
});

function configModuleBuild(dataDir: string): ConfigModule {
  return new ConfigModule(
    configResolve({ engine: { dataDir } }, path.join(dataDir, "settings.json"))
  );
}

async function wait(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
