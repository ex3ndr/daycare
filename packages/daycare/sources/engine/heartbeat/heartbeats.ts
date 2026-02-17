import path from "node:path";

import { createId } from "@paralleldrive/cuid2";
import { getLogger } from "../../log.js";
import type { EngineEventBus } from "../ipc/events.js";
import { heartbeatPromptBuildBatch } from "./ops/heartbeatPromptBuildBatch.js";
import { HeartbeatScheduler } from "./ops/heartbeatScheduler.js";
import { HeartbeatStore } from "./ops/heartbeatStore.js";
import type { HeartbeatCreateTaskArgs, HeartbeatDefinition } from "./heartbeatTypes.js";
import type { AgentSystem } from "../agents/agentSystem.js";
import type { ConfigModule } from "../config/configModule.js";
import type { ConnectorRegistry } from "../modules/connectorRegistry.js";
import type { PermissionRequestRegistry } from "../modules/tools/permissionRequestRegistry.js";
import { gatePermissionRequest } from "../scheduling/gatePermissionRequest.js";

const logger = getLogger("heartbeat.facade");

export type HeartbeatsOptions = {
  config: ConfigModule;
  eventBus: EngineEventBus;
  agentSystem: AgentSystem;
  connectorRegistry: ConnectorRegistry;
  permissionRequestRegistry: PermissionRequestRegistry;
  intervalMs?: number;
};

/**
 * Coordinates heartbeat storage + scheduling for engine runtime.
 * Posts heartbeat prompts directly to the agent system.
 */
export class Heartbeats {
  private readonly eventBus: EngineEventBus;
  private readonly agentSystem: AgentSystem;
  private readonly scheduler: HeartbeatScheduler;
  private readonly store: HeartbeatStore;

  constructor(options: HeartbeatsOptions) {
    this.eventBus = options.eventBus;
    this.agentSystem = options.agentSystem;
    const currentConfig = options.config.current;
    const basePath = path.join(currentConfig.configDir, "heartbeat");
    this.store = new HeartbeatStore(basePath);
    this.scheduler = new HeartbeatScheduler({
      config: options.config,
      store: this.store,
      intervalMs: options.intervalMs,
      defaultPermissions: currentConfig.defaultPermissions,
      resolvePermissions: async () =>
        this.agentSystem.permissionsForTarget({
          descriptor: { type: "system", tag: "heartbeat" }
        }),
      onRun: async (tasks) => {
        const batch = heartbeatPromptBuildBatch(tasks);
        const target = { descriptor: { type: "system" as const, tag: "heartbeat" } };
        const targetAgentId = await this.agentSystem.agentIdForTarget(target);
        const permissions = await this.agentSystem.permissionsForTarget(target);
        this.agentSystem.updateAgentPermissions(targetAgentId, permissions, Date.now());

        await this.agentSystem.postAndAwait(target, {
          type: "signal",
          subscriptionPattern: "internal.heartbeat.tick",
          signal: {
            id: createId(),
            type: "internal.heartbeat.tick",
            source: { type: "system" },
            createdAt: Date.now(),
            data: {
              prompt: batch.prompt,
              tasks: tasks.map((task) => ({ id: task.id, title: task.title, prompt: task.prompt }))
            }
          }
        });
      },
      onError: async (error, taskIds) => {
        logger.warn({ taskIds, error }, "error: Heartbeat task failed");
      },
      onGatePermissionRequest: async (task, missing) => {
        const label = task.title ? `heartbeat task "${task.title}" (${task.id})` : `heartbeat task ${task.id}`;
        const target = { descriptor: { type: "system" as const, tag: "heartbeat" } };
        const agentId = await this.agentSystem.agentIdForTarget(target);
        const result = await gatePermissionRequest({
          missing,
          taskLabel: label,
          agentSystem: this.agentSystem,
          connectorRegistry: options.connectorRegistry,
          permissionRequestRegistry: options.permissionRequestRegistry,
          agentId
        });
        return result.granted;
      },
      onTaskComplete: (task, runAt) => {
        this.eventBus.emit("heartbeat.task.ran", { taskId: task.id, runAt: runAt.toISOString() });
      }
    });
  }

  async ensureDir(): Promise<void> {
    await this.store.ensureDir();
  }

  async start(): Promise<void> {
    await this.scheduler.start();
    const tasks = await this.listTasks();
    this.eventBus.emit("heartbeat.started", { tasks });
    if (tasks.length === 0) {
      logger.info("event: No heartbeat tasks found on boot.");
      return;
    }
    const withLastRun = tasks.filter((task) => !!task.lastRunAt);
    const missingLastRun = tasks.filter((task) => !task.lastRunAt);
    if (withLastRun.length > 0) {
      const mostRecent = withLastRun
        .map((task) => task.lastRunAt as string)
        .sort()
        .at(-1);
      logger.info(
        {
          taskCount: tasks.length,
          mostRecentRunAt: mostRecent
        },
        "load: Heartbeat last run loaded on boot"
      );
    }
    if (missingLastRun.length > 0) {
      logger.info(
        {
          taskCount: missingLastRun.length,
          taskIds: missingLastRun.map((task) => task.id)
        },
        "event: Heartbeat missing last run info; running now"
      );
      await this.runNow({ ids: missingLastRun.map((task) => task.id) });
    }
    const nextRunAt =
      this.scheduler.getNextRunAt() ??
      new Date(Date.now() + this.scheduler.getIntervalMs());
    logger.info({ nextRunAt: nextRunAt.toISOString() }, "schedule: Next heartbeat run scheduled");
  }

  stop(): void {
    this.scheduler.stop();
  }

  async listTasks(): Promise<HeartbeatDefinition[]> {
    return this.store.listTasks();
  }

  async runNow(args?: { ids?: string[] }): Promise<{ ran: number; taskIds: string[] }> {
    return this.scheduler.runNow(args?.ids);
  }

  async addTask(args: HeartbeatCreateTaskArgs): Promise<HeartbeatDefinition> {
    return this.store.createTask(args);
  }

  async removeTask(taskId: string): Promise<boolean> {
    return this.store.deleteTask(taskId);
  }
}
