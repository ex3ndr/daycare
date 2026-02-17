import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";
import { createId } from "@paralleldrive/cuid2";

import type { AgentDescriptor } from "@/types";
import { configResolve } from "../../config/configResolve.js";
import { AuthStore } from "../../auth/store.js";
import { FileStore } from "../../files/store.js";
import type { Crons } from "../cron/crons.js";
import { ConfigModule } from "../config/configModule.js";
import { ConnectorRegistry } from "../modules/connectorRegistry.js";
import { ImageGenerationRegistry } from "../modules/imageGenerationRegistry.js";
import { ToolResolver } from "../modules/toolResolver.js";
import type { InferenceRouter } from "../modules/inference/router.js";
import type { PluginManager } from "../plugins/manager.js";
import type { Heartbeats } from "../heartbeat/heartbeats.js";
import { EngineEventBus } from "../ipc/events.js";
import { DelayedSignals } from "../signals/delayedSignals.js";
import { Signals } from "../signals/signals.js";
import { AgentSystem } from "./agentSystem.js";
import { agentStateRead } from "./ops/agentStateRead.js";
import { agentStateWrite } from "./ops/agentStateWrite.js";

const POISON_PILL_DELAY_MS = 3_600_000;
const POISON_PILL_REPEAT_KEY = "lifecycle-poison-pill";

describe("AgentSystem", () => {
  it("schedules poison-pill one hour after a subagent sleeps", async () => {
    vi.useFakeTimers();
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
    let delayedSignals: DelayedSignals | null = null;
    try {
      vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
      const harness = await harnessCreate(dir);
      delayedSignals = harness.delayedSignals;
      await harness.agentSystem.load();
      await harness.agentSystem.start();

      const agentId = await subagentCreate(harness.agentSystem, harness.eventBus);
      const poison = delayedSignals
        .list()
        .find((event) => event.type === `agent:${agentId}:poison-pill`);

      expect(poison).toBeTruthy();
      expect(poison?.repeatKey).toBe(POISON_PILL_REPEAT_KEY);
      expect(poison?.deliverAt).toBe(Date.now() + POISON_PILL_DELAY_MS);
    } finally {
      delayedSignals?.stop();
      vi.useRealTimers();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("cancels and reschedules poison-pill when a sleeping subagent wakes", async () => {
    vi.useFakeTimers();
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
    let delayedSignals: DelayedSignals | null = null;
    try {
      vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
      const harness = await harnessCreate(dir);
      delayedSignals = harness.delayedSignals;
      await harness.agentSystem.load();
      await harness.agentSystem.start();

      const agentId = await subagentCreate(harness.agentSystem, harness.eventBus);
      const signalType = `agent:${agentId}:poison-pill`;
      const firstSchedule = delayedSignals.list().find((event) => event.type === signalType);
      expect(firstSchedule).toBeTruthy();

      vi.setSystemTime(new Date("2025-01-01T00:30:00.000Z"));
      await harness.agentSystem.postAndAwait(
        { agentId },
        { type: "reset", message: "wake and sleep again" }
      );

      const poisonSignals = delayedSignals.list().filter((event) => event.type === signalType);
      expect(poisonSignals).toHaveLength(1);
      expect(poisonSignals[0]?.deliverAt).toBe(Date.now() + POISON_PILL_DELAY_MS);
      expect(poisonSignals[0]?.deliverAt).toBeGreaterThan(firstSchedule?.deliverAt ?? 0);
    } finally {
      delayedSignals?.stop();
      vi.useRealTimers();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not schedule poison-pill for non-subagent agents", async () => {
    vi.useFakeTimers();
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
    let delayedSignals: DelayedSignals | null = null;
    try {
      const harness = await harnessCreate(dir);
      delayedSignals = harness.delayedSignals;
      await harness.agentSystem.load();
      await harness.agentSystem.start();

      const agentId = createId();
      const descriptor: AgentDescriptor = { type: "cron", id: agentId, name: "cron-worker" };
      await harness.agentSystem.postAndAwait(
        { descriptor },
        { type: "reset", message: "init cron" }
      );

      expect(
        delayedSignals.list().some((event) => event.type === `agent:${agentId}:poison-pill`)
      ).toBe(false);
    } finally {
      delayedSignals?.stop();
      vi.useRealTimers();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("marks sleeping subagents dead when the poison-pill signal fires", async () => {
    vi.useFakeTimers();
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
    let delayedSignals: DelayedSignals | null = null;
    try {
      const harness = await harnessCreate(dir);
      delayedSignals = harness.delayedSignals;
      await delayedSignals.start();
      await harness.agentSystem.load();
      await harness.agentSystem.start();

      const agentId = await subagentCreate(harness.agentSystem, harness.eventBus);
      await vi.advanceTimersByTimeAsync(POISON_PILL_DELAY_MS);
      await vi.waitFor(async () => {
        const state = await agentStateRead(harness.config, agentId);
        expect(state?.state).toBe("dead");
      });
    } finally {
      delayedSignals?.stop();
      vi.useRealTimers();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("ignores poison-pill signals for non-subagent agents", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
    let delayedSignals: DelayedSignals | null = null;
    try {
      const harness = await harnessCreate(dir);
      delayedSignals = harness.delayedSignals;
      await delayedSignals.start();
      await harness.agentSystem.load();
      await harness.agentSystem.start();

      const agentId = createId();
      const descriptor: AgentDescriptor = { type: "cron", id: agentId, name: "cron-worker" };
      await harness.agentSystem.postAndAwait(
        { descriptor },
        { type: "reset", message: "init cron" }
      );
      await harness.signals.generate({
        type: `agent:${agentId}:poison-pill`,
        source: { type: "system" }
      });

      const state = await agentStateRead(harness.config, agentId);
      expect(state?.state).toBe("sleeping");
    } finally {
      delayedSignals?.stop();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("kills active subagents after poison-pill delivery and rejects queued completions", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
    let delayedSignals: DelayedSignals | null = null;
    try {
      let releaseFirstInference!: () => void;
      const firstInferenceGate = new Promise<void>((resolve) => {
        releaseFirstInference = () => resolve();
      });
      let inferenceCalls = 0;
      const complete = vi.fn(async () => {
        inferenceCalls += 1;
        if (inferenceCalls === 1) {
          await firstInferenceGate;
        }
        return inferenceResponse("done");
      });
      const inferenceRouter: InferenceRouter = {
        complete
      } as unknown as InferenceRouter;

      const harness = await harnessCreate(dir, { inferenceRouter });
      delayedSignals = harness.delayedSignals;
      await delayedSignals.start();
      await harness.agentSystem.load();
      await harness.agentSystem.start();

      const agentId = await subagentCreate(harness.agentSystem, harness.eventBus);
      await harness.agentSystem.post(
        { agentId },
        { type: "message", message: { text: "start long work" }, context: {} }
      );
      await vi.waitFor(() => {
        expect(complete.mock.calls.length).toBe(1);
      });

      await harness.signals.generate({
        type: `agent:${agentId}:poison-pill`,
        source: { type: "system" }
      });
      const queued = harness.agentSystem.postAndAwait(
        { agentId },
        { type: "reset", message: "queued after poison-pill" }
      );

      releaseFirstInference();

      await expect(queued).rejects.toThrow(`Agent is dead: ${agentId}`);
      await vi.waitFor(() => {
        const calls = complete.mock.calls.length;
        expect(calls).toBeGreaterThanOrEqual(2);
      });
      await expect(
        harness.agentSystem.postAndAwait(
          { agentId },
          { type: "reset", message: "dead check" }
        )
      ).rejects.toThrow(`Agent is dead: ${agentId}`);
      await vi.waitFor(async () => {
        const state = await agentStateRead(harness.config, agentId);
        expect(state?.state).toBe("dead");
      });
    } finally {
      delayedSignals?.stop();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("restores sleeping subagents with past poison-pill deadlines and marks them dead", async () => {
    vi.useFakeTimers();
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
    let delayedSignalsA: DelayedSignals | null = null;
    let delayedSignalsB: DelayedSignals | null = null;
    try {
      vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
      const first = await harnessCreate(dir);
      delayedSignalsA = first.delayedSignals;
      await delayedSignalsA.start();
      await first.agentSystem.load();
      await first.agentSystem.start();

      const agentId = await subagentCreate(first.agentSystem, first.eventBus);
      const beforeRestart = await agentStateRead(first.config, agentId);
      expect(beforeRestart?.state).toBe("sleeping");
      delayedSignalsA.stop();

      vi.setSystemTime(new Date((beforeRestart?.updatedAt ?? 0) + POISON_PILL_DELAY_MS + 1));
      const second = await harnessCreate(dir);
      delayedSignalsB = second.delayedSignals;
      await second.agentSystem.load();
      await second.agentSystem.start();
      await delayedSignalsB.start();

      await vi.waitFor(async () => {
        const state = await agentStateRead(second.config, agentId);
        expect(state?.state).toBe("dead");
      });
    } finally {
      delayedSignalsA?.stop();
      delayedSignalsB?.stop();
      vi.useRealTimers();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("restores sleeping subagents with future deadlines by scheduling remaining poison-pill time", async () => {
    vi.useFakeTimers();
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
    let delayedSignalsA: DelayedSignals | null = null;
    let delayedSignalsB: DelayedSignals | null = null;
    try {
      vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
      const first = await harnessCreate(dir);
      delayedSignalsA = first.delayedSignals;
      await delayedSignalsA.start();
      await first.agentSystem.load();
      await first.agentSystem.start();

      const agentId = await subagentCreate(first.agentSystem, first.eventBus);
      const beforeRestart = await agentStateRead(first.config, agentId);
      expect(beforeRestart?.state).toBe("sleeping");
      delayedSignalsA.stop();

      vi.setSystemTime(new Date((beforeRestart?.updatedAt ?? 0) + 30 * 60 * 1000));
      const second = await harnessCreate(dir);
      delayedSignalsB = second.delayedSignals;
      await second.agentSystem.load();
      const signalType = `agent:${agentId}:poison-pill`;
      const scheduled = delayedSignalsB.list().find((event) => event.type === signalType);
      expect(scheduled?.deliverAt).toBe((beforeRestart?.updatedAt ?? 0) + POISON_PILL_DELAY_MS);
    } finally {
      delayedSignalsA?.stop();
      delayedSignalsB?.stop();
      vi.useRealTimers();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("skips already-dead subagents on load and does not schedule poison-pill signals", async () => {
    vi.useFakeTimers();
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
    let delayedSignalsA: DelayedSignals | null = null;
    let delayedSignalsB: DelayedSignals | null = null;
    try {
      const first = await harnessCreate(dir);
      delayedSignalsA = first.delayedSignals;
      await delayedSignalsA.start();
      await first.agentSystem.load();
      await first.agentSystem.start();

      const agentId = await subagentCreate(first.agentSystem, first.eventBus);
      const current = await agentStateRead(first.config, agentId);
      if (!current) {
        throw new Error("Missing state for subagent");
      }
      const deadState = { ...current, state: "dead" as const, updatedAt: Date.now() };
      await agentStateWrite(first.config, agentId, deadState);
      delayedSignalsA.stop();

      const second = await harnessCreate(dir);
      delayedSignalsB = second.delayedSignals;
      await second.agentSystem.load();
      expect(
        delayedSignalsB.list().some((event) => event.type === `agent:${agentId}:poison-pill`)
      ).toBe(false);
      await expect(
        second.agentSystem.postAndAwait(
          { agentId },
          { type: "reset", message: "dead restore" }
        )
      ).rejects.toThrow(`Agent is dead: ${agentId}`);
    } finally {
      delayedSignalsA?.stop();
      delayedSignalsB?.stop();
      vi.useRealTimers();
      await rm(dir, { recursive: true, force: true });
    }
  });
});

async function harnessCreate(
  dir: string,
  options?: { inferenceRouter?: InferenceRouter }
): Promise<{
  config: ReturnType<typeof configResolve>;
  eventBus: EngineEventBus;
  signals: Signals;
  delayedSignals: DelayedSignals;
  agentSystem: AgentSystem;
}> {
  const config = configResolve(
    {
      engine: { dataDir: dir },
      assistant: { workspaceDir: dir },
      providers: [{ id: "openai", model: "gpt-4.1" }]
    },
    path.join(dir, "settings.json")
  );
  const configModule = new ConfigModule(config);
  const eventBus = new EngineEventBus();
  const signals = new Signals({ eventBus, configDir: config.configDir });
  const delayedSignals = new DelayedSignals({
    config: configModule,
    eventBus,
    signals
  });
  await delayedSignals.ensureDir();
  const pluginManager = {
    getSystemPrompts: async () => [],
    listRegisteredSkills: () => []
  } as unknown as PluginManager;
  const inferenceRouter = options?.inferenceRouter ??
    ({
      complete: vi.fn(async () => inferenceResponse("ok"))
    } as unknown as InferenceRouter);
  const agentSystem = new AgentSystem({
    config: configModule,
    eventBus,
    connectorRegistry: new ConnectorRegistry({
      onMessage: async () => undefined
    }),
    imageRegistry: new ImageGenerationRegistry(),
    toolResolver: new ToolResolver(),
    pluginManager,
    inferenceRouter,
    fileStore: new FileStore(config),
    authStore: new AuthStore(config),
    delayedSignals
  });
  agentSystem.setCrons({
    listTasks: async () => []
  } as unknown as Crons);
  agentSystem.setHeartbeats({} as unknown as Heartbeats);
  agentSystem.setSignals(signals);
  return { config, eventBus, signals, delayedSignals, agentSystem };
}

async function subagentCreate(agentSystem: AgentSystem, eventBus: EngineEventBus): Promise<string> {
  let createdAgentId: string | null = null;
  const unsubscribe = eventBus.onEvent((event) => {
    if (event.type !== "agent.created") {
      return;
    }
    const payload = event.payload as { agentId?: string };
    if (payload.agentId) {
      createdAgentId = payload.agentId;
    }
  });
  try {
    const descriptor: AgentDescriptor = {
      type: "subagent",
      id: createId(),
      parentAgentId: createId(),
      name: `subagent-${createId()}`
    };
    await agentSystem.postAndAwait(
      { descriptor },
      { type: "reset", message: "init subagent" }
    );
  } finally {
    unsubscribe();
  }
  if (!createdAgentId) {
    throw new Error("Subagent create did not emit agent.created");
  }
  return createdAgentId;
}

function inferenceResponse(text: string) {
  return {
    providerId: "openai",
    modelId: "gpt-4.1",
    message: {
      role: "assistant" as const,
      content: [{ type: "text" as const, text: `<response>${text}</response>` }],
      api: "openai-responses" as const,
      provider: "openai",
      model: "gpt-4.1",
      usage: {
        input: 10,
        output: 5,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 15,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
      },
      stopReason: "stop" as const,
      timestamp: Date.now()
    }
  };
}
