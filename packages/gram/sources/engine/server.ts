import { promises as fs } from "node:fs";
import path from "node:path";

import fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { z } from "zod";

import { getLogger } from "../log.js";
import { resolveEngineSocketPath } from "./socket.js";
import type { EngineRuntime } from "./runtime.js";
import { readSettingsFile, updateSettingsFile, upsertPlugin } from "../settings.js";
import type { EngineEventBus } from "./events.js";

export type EngineServerOptions = {
  socketPath?: string;
  settingsPath: string;
  runtime: EngineRuntime;
  eventBus: EngineEventBus;
};

export type EngineServer = {
  socketPath: string;
  close: () => Promise<void>;
};

const pluginSchema = z.object({
  id: z.string().min(1)
});
const secretSchema = z.object({
  pluginId: z.string().min(1),
  key: z.string().min(1),
  value: z.string().min(1)
});

export async function startEngineServer(
  options: EngineServerOptions
): Promise<EngineServer> {
  const logger = getLogger("engine.server");
  const socketPath = resolveEngineSocketPath(options.socketPath);
  await fs.mkdir(path.dirname(socketPath), { recursive: true });
  await fs.rm(socketPath, { force: true });

  const app = fastify({ logger: false });

  app.get("/v1/engine/status", async (_request, reply) => {
    return reply.send({
      ok: true,
      status: options.runtime.getStatus()
    });
  });

  app.get("/v1/engine/cron/tasks", async (_request, reply) => {
    return reply.send({ ok: true, tasks: options.runtime.getCronTasks() });
  });

  app.get("/v1/engine/sessions", async (_request, reply) => {
    const sessions = await options.runtime.getSessionStore().listSessions();
    return reply.send({ ok: true, sessions });
  });

  app.get("/v1/engine/sessions/:storageId", async (request, reply) => {
    const storageId = (request.params as { storageId: string }).storageId;
    const entries = await options.runtime.getSessionStore().readSessionEntries(storageId);
    return reply.send({ ok: true, entries });
  });

  app.get("/v1/engine/memory/search", async (request, reply) => {
    const query = (request.query as { query?: string }).query ?? "";
    const memory = options.runtime.getMemoryEngine();
    if (!memory) {
      return reply.status(400).send({ error: "Memory engine unavailable" });
    }
    const results = await memory.query(query);
    return reply.send({ ok: true, results });
  });

  app.get("/v1/engine/plugins", async (_request, reply) => {
    const settings = await readSettingsFile(options.settingsPath);
    return reply.send({
      ok: true,
      loaded: options.runtime.getPluginManager().listLoaded(),
      configured: settings.plugins ?? []
    });
  });

  app.post("/v1/engine/plugins/load", async (request, reply) => {
    const payload = parseBody(pluginSchema, request.body, reply);
    if (!payload) {
      return;
    }

    const settings = await updateSettingsFile(options.settingsPath, (current) => {
      const existing = current.plugins?.find((plugin) => plugin.id === payload.id);
      const config = existing ?? { id: payload.id, enabled: true };
      return {
        ...current,
        plugins: upsertPlugin(current.plugins, {
          ...config,
          enabled: true
        })
      };
    });

    options.runtime.updateSettings(settings);
    await options.runtime.getPluginManager().load({
      id: payload.id,
      enabled: true,
      config: settings.plugins?.find((plugin) => plugin.id === payload.id)?.config
    });

    options.eventBus.emit("plugin.loaded", { id: payload.id });
    return reply.send({ ok: true });
  });

  app.post("/v1/engine/plugins/unload", async (request, reply) => {
    const payload = parseBody(pluginSchema, request.body, reply);
    if (!payload) {
      return;
    }

    const settings = await updateSettingsFile(options.settingsPath, (current) => ({
      ...current,
      plugins: upsertPlugin(current.plugins, { id: payload.id, enabled: false })
    }));

    options.runtime.updateSettings(settings);
    await options.runtime.getPluginManager().unload(payload.id);
    options.eventBus.emit("plugin.unloaded", { id: payload.id });
    return reply.send({ ok: true });
  });

  app.post("/v1/engine/secrets", async (request, reply) => {
    const payload = parseBody(secretSchema, request.body, reply);
    if (!payload) {
      return;
    }
    await options.runtime.getSecretsStore().set(
      payload.pluginId,
      payload.key,
      payload.value
    );
    return reply.send({ ok: true });
  });

  app.get("/v1/engine/events", async (request, reply) => {
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.flushHeaders();

    const sendEvent = (event: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    sendEvent({
      type: "init",
      payload: {
        status: options.runtime.getStatus(),
        cron: options.runtime.getCronTasks()
      },
      timestamp: new Date().toISOString()
    });

    const unsubscribe = options.eventBus.onEvent((event) => {
      sendEvent(event);
    });

    request.raw.on("close", () => {
      unsubscribe();
    });
  });

  await app.listen({ path: socketPath });
  logger.info({ socket: socketPath }, "Engine server ready");

  return {
    socketPath,
    close: async () => {
      await closeServer(app);
      await fs.rm(socketPath, { force: true });
    }
  };
}

function parseBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
  reply: FastifyReply
): T | null {
  const result = schema.safeParse(body);
  if (result.success) {
    return result.data;
  }
  reply.status(400).send({
    error: "Invalid payload",
    details: result.error.flatten()
  });
  return null;
}

async function closeServer(app: FastifyInstance): Promise<void> {
  await app.close();
}
