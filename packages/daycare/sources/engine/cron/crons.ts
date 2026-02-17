import path from "node:path";

import { createId } from "@paralleldrive/cuid2";
import { getLogger } from "../../log.js";
import type { EngineEventBus } from "../ipc/events.js";
import type { SessionPermissions } from "@/types";
import { CronScheduler } from "./ops/cronScheduler.js";
import { CronStore } from "./ops/cronStore.js";
import type { CronTaskDefinition, CronTaskWithPaths } from "./cronTypes.js";
import type { AgentSystem } from "../agents/agentSystem.js";
import { permissionBuildCron } from "../permissions/permissionBuildCron.js";
import type { ConfigModule } from "../config/configModule.js";
import type { ConnectorRegistry } from "../modules/connectorRegistry.js";
import type { PermissionRequestRegistry } from "../modules/tools/permissionRequestRegistry.js";
import { gatePermissionRequest } from "../scheduling/gatePermissionRequest.js";

const logger = getLogger("cron.facade");

export type CronsOptions = {
  config: ConfigModule;
  eventBus: EngineEventBus;
  agentSystem: AgentSystem;
  connectorRegistry: ConnectorRegistry;
  permissionRequestRegistry: PermissionRequestRegistry;
};

/**
 * Coordinates cron storage + scheduling for engine runtime.
 * Posts cron task prompts directly to the agent system.
 */
export class Crons {
  private readonly eventBus: EngineEventBus;
  private readonly agentSystem: AgentSystem;
  private readonly scheduler: CronScheduler;
  private readonly store: CronStore;

  constructor(options: CronsOptions) {
    this.eventBus = options.eventBus;
    this.agentSystem = options.agentSystem;
    const currentConfig = options.config.current;
    const basePath = path.join(currentConfig.configDir, "cron");
    this.store = new CronStore(basePath);
    this.scheduler = new CronScheduler({
      config: options.config,
      store: this.store,
      defaultPermissions: currentConfig.defaultPermissions,
      resolvePermissions: async (task) => {
        if (task.agentId) {
          return this.agentSystem.permissionsForTarget({ agentId: task.agentId });
        }
        const base = permissionBuildCron(options.config.current.defaultPermissions, task.filesPath);
        const current = await this.agentSystem.permissionsForTarget({
          descriptor: { type: "cron", id: task.taskUid, name: task.name }
        });
        return mergeCronPermissions(base, current);
      },
      onTask: async (task, messageContext) => {
        const target = task.agentId
          ? { agentId: task.agentId }
          : { descriptor: { type: "system" as const, tag: "cron" } };
        logger.debug(
          `event: CronScheduler.onTask triggered taskUid=${task.taskUid} agentId=${task.agentId ?? "system:cron"}`
        );

        const permissions = task.agentId
          ? await this.agentSystem.permissionsForTarget({ agentId: task.agentId })
          : mergeCronPermissions(
              permissionBuildCron(options.config.current.defaultPermissions, task.filesPath),
              await this.agentSystem.permissionsForTarget({ descriptor: { type: "system", tag: "cron" } })
            );
        const targetAgentId = await this.agentSystem.agentIdForTarget(target);
        this.agentSystem.updateAgentPermissions(targetAgentId, permissions, Date.now());

        await this.agentSystem.postAndAwait(target, {
          type: "signal",
          subscriptionPattern: "internal.cron.task",
          signal: {
            id: createId(),
            type: "internal.cron.task",
            source: { type: "system" },
            createdAt: Date.now(),
            data: {
              prompt: task.prompt,
              taskId: task.taskId,
              taskUid: task.taskUid,
              taskName: task.taskName,
              filesPath: task.filesPath,
              memoryPath: task.memoryPath,
              messageContext
            }
          }
        });
      },
      onError: async (error, taskId) => {
        logger.warn({ taskId, error }, "error: Cron task failed");
      },
      onGatePermissionRequest: async (task, missing) => {
        const target = task.agentId
          ? { agentId: task.agentId }
          : { descriptor: { type: "cron" as const, id: task.taskUid, name: task.name } };
        const agentId = await this.agentSystem.agentIdForTarget(target);
        const label = task.name ? `cron task "${task.name}" (${task.id})` : `cron task ${task.id}`;
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
        this.eventBus.emit("cron.task.ran", { taskId: task.id, runAt: runAt.toISOString() });
      }
    });
  }

  async ensureDir(): Promise<void> {
    await this.store.ensureDir();
  }

  async start(): Promise<void> {
    await this.scheduler.start();
    this.eventBus.emit("cron.started", { tasks: this.scheduler.listTasks() });
  }

  stop(): void {
    this.scheduler.stop();
  }

  listScheduledTasks(): CronTaskWithPaths[] {
    return this.scheduler.listTasks();
  }

  async listTasks(): Promise<CronTaskWithPaths[]> {
    return this.store.listTasks();
  }

  async addTask(
    definition: Omit<CronTaskDefinition, "id"> & { id?: string }
  ): Promise<CronTaskWithPaths> {
    const task = await this.scheduler.addTask(definition);
    this.eventBus.emit("cron.task.added", { task });
    return task;
  }

  async deleteTask(taskId: string): Promise<boolean> {
    return this.scheduler.deleteTask(taskId);
  }

  async loadTask(taskId: string): Promise<CronTaskWithPaths | null> {
    return this.store.loadTask(taskId);
  }

  async readMemory(taskId: string): Promise<string> {
    return this.store.readMemory(taskId);
  }

  async writeMemory(taskId: string, content: string): Promise<void> {
    await this.store.writeMemory(taskId, content);
  }
}

function mergeCronPermissions(
  base: SessionPermissions,
  current: SessionPermissions
): SessionPermissions {
  const writeDirs = new Set([...base.writeDirs, ...current.writeDirs]);
  const readDirs = new Set([...base.readDirs, ...current.readDirs]);
  return {
    workingDir: base.workingDir,
    writeDirs: Array.from(writeDirs.values()),
    readDirs: Array.from(readDirs.values()),
    network: base.network || current.network,
    events: base.events || current.events
  };
}
