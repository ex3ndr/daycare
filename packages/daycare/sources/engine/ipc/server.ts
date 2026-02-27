import { promises as fs } from "node:fs";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { z } from "zod";

import { getLogger } from "../../log.js";
import {
    listEnabledPlugins,
    listPlugins,
    nextPluginInstanceId,
    readSettingsFile,
    updateSettingsFile,
    upsertPlugin
} from "../../settings.js";
import { requestShutdown } from "../../util/shutdown.js";
import { contextForUser } from "../agents/context.js";
import { agentBackgroundList } from "../agents/ops/agentBackgroundList.js";
import { agentHistoryLoadAll } from "../agents/ops/agentHistoryLoadAll.js";
import { agentList } from "../agents/ops/agentList.js";
import type { Engine } from "../engine.js";
import { buildPluginCatalog } from "../plugins/catalog.js";
import { resolveExclusivePlugins } from "../plugins/exclusive.js";
import { PluginModuleLoader } from "../plugins/loader.js";
import type { EngineEventBus } from "./events.js";
import { serverMemoryRoutesRegister } from "./serverMemoryRoutesRegister.js";
import { resolveEngineSocketPath } from "./socket.js";

export type EngineServerOptions = {
    socketPath?: string;
    settingsPath: string;
    runtime: Engine;
    eventBus: EngineEventBus;
};

export type EngineServer = {
    socketPath: string;
    close: () => Promise<void>;
};

const pluginLoadSchema = z.object({
    pluginId: z.string().min(1).optional(),
    instanceId: z.string().min(1).optional(),
    id: z.string().min(1).optional(),
    settings: z.record(z.unknown()).optional()
});
const pluginUnloadSchema = z.object({
    instanceId: z.string().min(1).optional(),
    id: z.string().min(1).optional()
});
const authSchema = z.object({
    id: z.string().min(1),
    key: z.string().min(1),
    value: z.string().min(1)
});
const signalEventsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(1000).optional()
});
const agentHistoryQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(10000).optional(),
    sessionId: z.string().min(1).optional()
});
const tokenStatsQuerySchema = z.object({
    from: z.coerce.number().int().nonnegative().optional(),
    to: z.coerce.number().int().nonnegative().optional(),
    userId: z.string().min(1).optional(),
    agentId: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50000).optional()
});
const signalGenerateSchema = z.object({
    type: z.string().min(1),
    source: z.discriminatedUnion("type", [
        z.object({ type: z.literal("system"), userId: z.string().min(1) }),
        z.object({ type: z.literal("agent"), id: z.string().min(1), userId: z.string().min(1) }),
        z.object({ type: z.literal("webhook"), id: z.string().optional(), userId: z.string().min(1) }),
        z.object({ type: z.literal("process"), id: z.string().optional(), userId: z.string().min(1) })
    ]),
    data: z.unknown().optional()
});
const engineEventSchema = z.object({
    type: z.string().min(1),
    payload: z.unknown().optional()
});
const channelCreateSchema = z.object({
    userId: z.string().min(1),
    name: z.string().min(1),
    leaderAgentId: z.string().min(1)
});
const channelSendSchema = z.object({
    userId: z.string().min(1),
    senderUsername: z.string().min(1),
    text: z.string().min(1),
    mentions: z.array(z.string().min(1)).optional()
});
const channelListQuerySchema = z.object({
    userId: z.string().min(1)
});
const channelMemberAddSchema = z.object({
    agentId: z.string().min(1),
    username: z.string().min(1)
});
const channelMemberRemoveSchema = z.object({
    agentId: z.string().min(1)
});
const systemPromptCreateSchema = z.object({
    scope: z.enum(["global", "user"]),
    userId: z.string().min(1).nullable().optional(),
    kind: z.enum(["system", "first_message"]),
    condition: z.enum(["new_user", "returning_user"]).nullable().optional(),
    prompt: z.string().min(1),
    enabled: z.boolean().optional()
});
const systemPromptUpdateSchema = z.object({
    scope: z.enum(["global", "user"]).optional(),
    userId: z.string().min(1).nullable().optional(),
    kind: z.enum(["system", "first_message"]).optional(),
    condition: z.enum(["new_user", "returning_user"]).nullable().optional(),
    prompt: z.string().min(1).optional(),
    enabled: z.boolean().optional()
});

export async function startEngineServer(options: EngineServerOptions): Promise<EngineServer> {
    const logger = getLogger("engine.server");
    logger.debug(`event: startEngineServer() called settingsPath=${options.settingsPath}`);
    const socketPath = resolveEngineSocketPath(options.socketPath);
    logger.debug(`event: Socket path resolved socketPath=${socketPath}`);
    await fs.mkdir(path.dirname(socketPath), { recursive: true });
    await fs.rm(socketPath, { force: true });
    logger.debug("event: Socket directory prepared");

    const app = fastify({ logger: false });
    logger.debug("create: Fastify app created");
    const pluginCatalog = buildPluginCatalog();
    serverMemoryRoutesRegister(app, options.runtime);

    app.get("/", async (_request, reply) => {
        logger.debug("event: GET /");
        return reply.type("text/plain; charset=utf-8").send("Welcome to Daycare API!");
    });

    app.get("/v1/engine/status", async (_request, reply) => {
        logger.debug("event: GET /v1/engine/status");
        const status = options.runtime.getStatus();
        logger.debug(
            `event: Status retrieved pluginCount=${status.plugins.length} connectorCount=${status.connectors.length}`
        );
        return reply.send({
            ok: true,
            status
        });
    });

    app.get("/v1/engine/cron/tasks", async (_request, reply) => {
        logger.debug("event: GET /v1/engine/cron/tasks");
        const tasks = options.runtime.crons.listScheduledTasks();
        logger.debug(`event: Cron tasks retrieved taskCount=${tasks.length}`);
        return reply.send({ ok: true, tasks });
    });

    app.get("/v1/engine/heartbeat/tasks", async (_request, reply) => {
        logger.debug("event: GET /v1/engine/heartbeat/tasks");
        const tasks = await options.runtime.heartbeats.listTasks();
        logger.debug(`event: Heartbeat tasks retrieved taskCount=${tasks.length}`);
        return reply.send({ ok: true, tasks });
    });

    app.get("/v1/engine/processes", async (_request, reply) => {
        logger.debug("event: GET /v1/engine/processes");
        const processes = await options.runtime.processes.list();
        logger.debug(`event: Processes retrieved count=${processes.length}`);
        return reply.send({ ok: true, processes });
    });

    app.get("/v1/engine/processes/:processId", async (request, reply) => {
        const processId = (request.params as { processId: string }).processId;
        logger.debug(`event: GET /v1/engine/processes/:processId processId=${processId}`);
        try {
            const processInfo = await options.runtime.processes.get(processId);
            return reply.send({ ok: true, process: processInfo });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Process lookup failed";
            if (message.startsWith("Unknown process id:")) {
                return reply.status(404).send({ ok: false, error: message });
            }
            return reply.status(500).send({ ok: false, error: message });
        }
    });

    app.get("/v1/engine/signals/events", async (request, reply) => {
        logger.debug("event: GET /v1/engine/signals/events");
        const parsed = signalEventsQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.status(400).send({ ok: false, error: "Invalid query" });
        }
        const limit = parsed.data.limit ?? 200;
        const events = await options.runtime.signals.listRecent(limit);
        logger.debug(`event: Signal events retrieved eventCount=${events.length} limit=${limit}`);
        return reply.send({ ok: true, events });
    });

    app.post("/v1/engine/signals/generate", async (request, reply) => {
        logger.debug("event: POST /v1/engine/signals/generate");
        const payload = parseBody(signalGenerateSchema, request.body, reply);
        if (!payload) {
            return;
        }
        try {
            const signal = await options.runtime.signals.generate({
                type: payload.type,
                source: payload.source,
                data: payload.data
            });
            logger.info({ signalId: signal.id, type: signal.type }, "event: Signal generated via API");
            return reply.send({ ok: true, signal });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Signal generation failed";
            return reply.status(400).send({ ok: false, error: message });
        }
    });

    app.get("/v1/engine/signals/subscriptions", async (_request, reply) => {
        logger.debug("event: GET /v1/engine/signals/subscriptions");
        const subscriptions = await options.runtime.signals.listSubscriptions();
        logger.debug(`event: Signal subscriptions retrieved count=${subscriptions.length}`);
        return reply.send({ ok: true, subscriptions });
    });

    app.get("/v1/engine/channels", async (request, reply) => {
        logger.debug("event: GET /v1/engine/channels");
        const parsed = channelListQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.status(400).send({ ok: false, error: "Invalid query" });
        }
        const channels = options.runtime.channels.listForUserIds([parsed.data.userId]);
        return reply.send({ ok: true, channels });
    });

    app.post("/v1/engine/channels", async (request, reply) => {
        logger.debug("event: POST /v1/engine/channels");
        const payload = parseBody(channelCreateSchema, request.body, reply);
        if (!payload) {
            return;
        }
        try {
            const channel = await options.runtime.channels.create(
                contextForUser({ userId: payload.userId }),
                payload.name,
                payload.leaderAgentId
            );
            return reply.send({ ok: true, channel });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Channel create failed";
            return reply.status(400).send({ ok: false, error: message });
        }
    });

    app.post("/v1/engine/channels/:channelName/send", async (request, reply) => {
        const channelName = (request.params as { channelName: string }).channelName;
        logger.debug(`event: POST /v1/engine/channels/:channelName/send channelName=${channelName}`);
        const payload = parseBody(channelSendSchema, request.body, reply);
        if (!payload) {
            return;
        }
        try {
            const result = await options.runtime.channels.send(
                contextForUser({ userId: payload.userId }),
                channelName,
                payload.senderUsername,
                payload.text,
                payload.mentions ?? []
            );
            return reply.send({ ok: true, ...result });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Channel send failed";
            return reply.status(400).send({ ok: false, error: message });
        }
    });

    app.post("/v1/engine/channels/:channelName/members", async (request, reply) => {
        const channelName = (request.params as { channelName: string }).channelName;
        logger.debug(`event: POST /v1/engine/channels/:channelName/members channelName=${channelName}`);
        const payload = parseBody(channelMemberAddSchema, request.body, reply);
        if (!payload) {
            return;
        }
        try {
            const ctx = await options.runtime.agentSystem.contextForAgentId(payload.agentId);
            if (!ctx) {
                return reply.status(404).send({ ok: false, error: `Agent not found: ${payload.agentId}` });
            }
            const channel = await options.runtime.channels.addMember(channelName, ctx, payload.username);
            return reply.send({ ok: true, channel });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Channel add member failed";
            return reply.status(400).send({ ok: false, error: message });
        }
    });

    app.post("/v1/engine/channels/:channelName/members/remove", async (request, reply) => {
        const channelName = (request.params as { channelName: string }).channelName;
        logger.debug(`event: POST /v1/engine/channels/:channelName/members/remove channelName=${channelName}`);
        const payload = parseBody(channelMemberRemoveSchema, request.body, reply);
        if (!payload) {
            return;
        }
        try {
            const ctx = await options.runtime.agentSystem.contextForAgentId(payload.agentId);
            if (!ctx) {
                return reply.status(404).send({ ok: false, error: `Agent not found: ${payload.agentId}` });
            }
            const removed = await options.runtime.channels.removeMember(channelName, ctx);
            return reply.send({ ok: true, removed });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Channel remove member failed";
            return reply.status(400).send({ ok: false, error: message });
        }
    });

    app.get("/v1/engine/users", async (_request, reply) => {
        logger.debug("event: GET /v1/engine/users");
        const users = await options.runtime.storage.users.findMany();
        const mapped = users.map((user) => ({
            id: user.id,
            isOwner: user.isOwner,
            nametag: user.nametag,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        }));
        logger.debug(`event: Users retrieved userCount=${mapped.length}`);
        return reply.send({ ok: true, users: mapped });
    });

    app.get("/v1/engine/token-stats", async (request, reply) => {
        const parsed = tokenStatsQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.status(400).send({ ok: false, error: "Invalid query" });
        }
        const { from, to, userId, agentId, model, limit } = parsed.data;
        logger.debug(
            `event: GET /v1/engine/token-stats from=${from ?? "none"} to=${to ?? "none"} userId=${userId ?? "all"} agentId=${agentId ?? "all"} model=${model ?? "all"}`
        );
        const rows = await options.runtime.storage.tokenStats.findAll({
            from,
            to,
            userId,
            agentId,
            model,
            limit
        });
        return reply.send({
            ok: true,
            rows: rows.map((row) => ({
                hourStart: row.hourStart,
                userId: row.userId,
                agentId: row.agentId,
                model: row.model,
                input: row.input,
                output: row.output,
                cacheRead: row.cacheRead,
                cacheWrite: row.cacheWrite,
                cost: row.cost
            }))
        });
    });

    app.get("/v1/engine/agents/background", async (_request, reply) => {
        logger.debug("event: GET /v1/engine/agents/background");
        const agents = await agentBackgroundList(options.runtime.storage);
        logger.debug(`event: Background agents retrieved agentCount=${agents.length}`);
        return reply.send({ ok: true, agents });
    });

    app.get("/v1/engine/agents", async (_request, reply) => {
        logger.debug("event: GET /v1/engine/agents");
        const agents = await agentList(options.runtime.storage);
        logger.debug(`event: Agents retrieved agentCount=${agents.length}`);
        return reply.send({ ok: true, agents });
    });

    app.get("/v1/engine/agents/:agentId/sessions", async (request, reply) => {
        const agentId = (request.params as { agentId: string }).agentId;
        logger.debug(`event: GET /v1/engine/agents/:agentId/sessions agentId=${agentId}`);
        const sessions = await options.runtime.storage.sessions.findByAgentId(agentId);
        logger.debug(`event: Agent sessions retrieved agentId=${agentId} sessionCount=${sessions.length}`);
        return reply.send({ ok: true, sessions });
    });

    app.get("/v1/engine/agents/:agentId/history", async (request, reply) => {
        const agentId = (request.params as { agentId: string }).agentId;
        const parsed = agentHistoryQuerySchema.safeParse(request.query);
        const limit = parsed.success ? parsed.data.limit : undefined;
        const sessionId = parsed.success ? parsed.data.sessionId : undefined;
        logger.debug(
            `event: GET /v1/engine/agents/:agentId/history agentId=${agentId} limit=${limit ?? "none"} sessionId=${sessionId ?? "all"}`
        );
        const records = sessionId
            ? await options.runtime.storage.history.findBySessionId(sessionId)
            : await (async () => {
                  const ctx = await options.runtime.agentSystem.contextForAgentId(agentId);
                  if (!ctx) {
                      return [];
                  }
                  return agentHistoryLoadAll(options.runtime.storage, ctx, limit);
              })();
        logger.debug(`event: Agent history retrieved agentId=${agentId} recordCount=${records.length}`);
        return reply.send({ ok: true, records });
    });

    app.post("/v1/engine/agents/:agentId/reset", async (request, reply) => {
        const agentId = (request.params as { agentId: string }).agentId;
        logger.debug(`event: POST /v1/engine/agents/:agentId/reset agentId=${agentId}`);
        const targetCtx = await options.runtime.agentSystem.contextForAgentId(agentId);
        if (!targetCtx) {
            logger.debug(`error: Agent reset failed agentId=${agentId}`);
            return reply.status(404).send({ ok: false, error: "Agent not found" });
        }
        await options.runtime.agentSystem.post(
            contextForUser({ userId: targetCtx.userId }),
            { agentId },
            { type: "reset", message: "Manual reset requested by the user." }
        );
        logger.info({ agentId }, "event: Agent reset");
        return reply.send({ ok: true });
    });

    app.get("/v1/engine/plugins", async (_request, reply) => {
        logger.debug("event: GET /v1/engine/plugins");
        const settings = await readSettingsFile(options.settingsPath);
        const loaded = options.runtime.pluginManager.listLoaded();
        const configured = listPlugins(settings);
        logger.debug(`event: Plugin list retrieved loadedCount=${loaded.length} configuredCount=${configured.length}`);
        return reply.send({
            ok: true,
            loaded,
            configured
        });
    });

    app.post("/v1/engine/plugins/load", async (request, reply) => {
        logger.debug("load: POST /v1/engine/plugins/load");
        const payload = parseBody(pluginLoadSchema, request.body, reply);
        if (!payload) {
            logger.debug("load: Invalid payload for plugin load");
            return;
        }

        const pluginId = payload.pluginId ?? payload.id ?? payload.instanceId;
        const requestedInstanceId = payload.instanceId ?? payload.id;

        const currentSettings = await readSettingsFile(options.settingsPath);
        const existing = requestedInstanceId
            ? listPlugins(currentSettings).find((plugin) => plugin.instanceId === requestedInstanceId)
            : undefined;
        const resolvedPluginId = pluginId ?? existing?.pluginId;
        if (!resolvedPluginId) {
            logger.debug("event: Missing pluginId");
            reply.status(400).send({ error: "pluginId required" });
            return;
        }

        const definition = pluginCatalog.get(resolvedPluginId);
        const instanceId =
            requestedInstanceId ??
            nextPluginInstanceId(resolvedPluginId, currentSettings.plugins, {
                exclusive: definition?.descriptor.exclusive
            });
        if (!definition) {
            logger.debug(`event: Unknown pluginId=${resolvedPluginId}`);
            reply.status(400).send({ error: `Unknown pluginId: ${resolvedPluginId}` });
            return;
        }
        const nextConfig = {
            ...(existing ?? { instanceId, pluginId: resolvedPluginId }),
            enabled: true,
            settings: payload.settings ?? existing?.settings
        };
        try {
            const loader = new PluginModuleLoader(`plugin.validate:${instanceId}`);
            const { module } = await loader.load(definition.entryPath);
            module.settingsSchema.parse(nextConfig.settings ?? {});
        } catch (error) {
            const message = error instanceof Error ? error.message : "Plugin settings validation failed.";
            reply.status(400).send({ error: message });
            return;
        }
        logger.info({ plugin: resolvedPluginId, instance: instanceId }, "load: Plugin load requested");
        logger.debug(
            `load: Processing plugin load pluginId=${resolvedPluginId} instanceId=${instanceId} hasSettings=${!!payload.settings}`
        );

        try {
            await updateSettingsFile(options.settingsPath, (current) => {
                const existingEntry = listPlugins(current).find((plugin) => plugin.instanceId === instanceId);
                const config = existingEntry ?? {
                    instanceId,
                    pluginId: resolvedPluginId,
                    enabled: true
                };
                logger.debug(`event: Updating settings file existing=${!!existingEntry}`);
                const nextPlugins = upsertPlugin(current.plugins, {
                    ...config,
                    enabled: true,
                    settings: payload.settings ?? config.settings
                });
                const nextSettings = {
                    ...current,
                    plugins: nextPlugins
                };
                const resolution = resolveExclusivePlugins(listEnabledPlugins(nextSettings), pluginCatalog);
                if (resolution.skipped.length > 0) {
                    const exclusiveId = resolution.exclusive?.pluginId;
                    const exclusiveName =
                        (exclusiveId && pluginCatalog.get(exclusiveId)?.descriptor.name) ??
                        exclusiveId ??
                        "Exclusive plugin";
                    throw new Error(
                        `${exclusiveName} is marked exclusive, so only one plugin can be enabled at a time.`
                    );
                }
                return nextSettings;
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Plugin enable failed.";
            reply.status(400).send({ error: message });
            return;
        }

        try {
            await reloadRuntime(options.runtime);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Runtime reload failed.";
            reply.status(400).send({ error: message });
            return;
        }

        options.eventBus.emit("plugin.loaded", { id: instanceId });
        logger.debug(`load: Plugin load completed instanceId=${instanceId}`);
        return reply.send({ ok: true });
    });

    app.post("/v1/engine/plugins/unload", async (request, reply) => {
        logger.debug("unload: POST /v1/engine/plugins/unload");
        const payload = parseBody(pluginUnloadSchema, request.body, reply);
        if (!payload) {
            logger.debug("unload: Invalid payload for plugin unload");
            return;
        }

        const instanceId = payload.instanceId ?? payload.id;
        if (!instanceId) {
            logger.debug("event: Missing instanceId");
            reply.status(400).send({ error: "instanceId required" });
            return;
        }

        logger.info({ instance: instanceId }, "unload: Plugin unload requested");

        logger.debug(`unload: Updating settings file for unload instanceId=${instanceId}`);
        await updateSettingsFile(options.settingsPath, (current) => ({
            ...current,
            plugins: upsertPlugin(current.plugins, {
                ...(listPlugins(current).find((plugin) => plugin.instanceId === instanceId) ?? {
                    instanceId,
                    pluginId: instanceId
                }),
                enabled: false
            })
        }));

        try {
            await reloadRuntime(options.runtime);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Runtime reload failed.";
            reply.status(400).send({ error: message });
            return;
        }
        options.eventBus.emit("plugin.unloaded", { id: instanceId });
        logger.debug(`unload: Plugin unload completed instanceId=${instanceId}`);
        return reply.send({ ok: true });
    });

    app.post("/v1/engine/auth", async (request, reply) => {
        logger.debug("event: POST /v1/engine/auth");
        const payload = parseBody(authSchema, request.body, reply);
        if (!payload) {
            logger.debug("event: Invalid payload for auth");
            return;
        }
        logger.debug(`event: Setting auth field id=${payload.id} key=${payload.key}`);
        await options.runtime.authStore.setField(payload.id, payload.key, payload.value);
        logger.debug("event: Auth field set");
        return reply.send({ ok: true });
    });

    app.post("/v1/engine/shutdown", async (_request, reply) => {
        logger.info("event: Shutdown requested via API");
        reply.send({ ok: true });
        setImmediate(() => {
            requestShutdown("SIGTERM");
        });
    });

    app.post("/v1/engine/reload", async (_request, reply) => {
        logger.info("reload: Reload requested via API");
        try {
            await reloadRuntime(options.runtime);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Runtime reload failed.";
            reply.status(400).send({ ok: false, error: message });
            return;
        }
        reply.send({ ok: true });
    });

    app.post("/v1/engine/events", async (request, reply) => {
        logger.debug("event: POST /v1/engine/events");
        const payload = parseBody(engineEventSchema, request.body, reply);
        if (!payload) {
            return;
        }
        options.eventBus.emit(payload.type, payload.payload ?? null);
        logger.info({ eventType: payload.type }, "event: Engine event emitted via API");
        return reply.send({ ok: true });
    });

    app.get("/v1/engine/events", async (request, reply) => {
        logger.debug("event: GET /v1/engine/events (SSE connection)");
        reply.raw.setHeader("Content-Type", "text/event-stream");
        reply.raw.setHeader("Cache-Control", "no-cache");
        reply.raw.setHeader("Connection", "keep-alive");
        reply.raw.flushHeaders();

        const sendEvent = (event: unknown) => {
            reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        };

        logger.debug("send: Sending init event");
        sendEvent({
            type: "init",
            payload: {
                status: options.runtime.getStatus(),
                cron: options.runtime.crons.listScheduledTasks(),
                heartbeat: await options.runtime.heartbeats.listTasks(),
                backgroundAgents: await agentBackgroundList(options.runtime.storage)
            },
            timestamp: new Date().toISOString()
        });

        const unsubscribe = options.eventBus.onEvent((event) => {
            logger.debug(`event: Forwarding event to SSE client eventType=${(event as { type?: string }).type}`);
            sendEvent(event);
        });

        request.raw.on("close", () => {
            logger.debug("event: SSE connection closed");
            unsubscribe();
        });
    });

    // System prompts CRUD
    app.get("/v1/engine/system-prompts", async (_request, reply) => {
        logger.debug("event: GET /v1/engine/system-prompts");
        const prompts = await options.runtime.storage.systemPrompts.findMany();
        logger.debug(`event: System prompts retrieved count=${prompts.length}`);
        return reply.send({ ok: true, prompts });
    });

    app.get("/v1/engine/system-prompts/:id", async (request, reply) => {
        const id = (request.params as { id: string }).id;
        logger.debug(`event: GET /v1/engine/system-prompts/${id}`);
        const prompt = await options.runtime.storage.systemPrompts.findById(id);
        if (!prompt) {
            return reply.status(404).send({ ok: false, error: `System prompt not found: ${id}` });
        }
        return reply.send({ ok: true, prompt });
    });

    app.post("/v1/engine/system-prompts", async (request, reply) => {
        logger.debug("event: POST /v1/engine/system-prompts");
        const payload = parseBody(systemPromptCreateSchema, request.body, reply);
        if (!payload) return;
        const now = Date.now();
        const record = {
            id: createId(),
            scope: payload.scope,
            userId: payload.userId ?? null,
            kind: payload.kind,
            condition: payload.condition ?? null,
            prompt: payload.prompt,
            enabled: payload.enabled !== false,
            createdAt: now,
            updatedAt: now
        };
        await options.runtime.storage.systemPrompts.create(record);
        logger.info({ promptId: record.id, scope: record.scope, kind: record.kind }, "event: System prompt created");
        return reply.send({ ok: true, prompt: record });
    });

    app.put("/v1/engine/system-prompts/:id", async (request, reply) => {
        const id = (request.params as { id: string }).id;
        logger.debug(`event: PUT /v1/engine/system-prompts/${id}`);
        const payload = parseBody(systemPromptUpdateSchema, request.body, reply);
        if (!payload) return;
        const existing = await options.runtime.storage.systemPrompts.findById(id);
        if (!existing) {
            return reply.status(404).send({ ok: false, error: `System prompt not found: ${id}` });
        }
        const updates: Record<string, unknown> = { updatedAt: Date.now() };
        if (payload.scope !== undefined) updates.scope = payload.scope;
        if (payload.userId !== undefined) updates.userId = payload.userId;
        if (payload.kind !== undefined) updates.kind = payload.kind;
        if (payload.condition !== undefined) updates.condition = payload.condition;
        if (payload.prompt !== undefined) updates.prompt = payload.prompt;
        if (payload.enabled !== undefined) updates.enabled = payload.enabled;
        await options.runtime.storage.systemPrompts.updateById(id, updates);
        const updated = await options.runtime.storage.systemPrompts.findById(id);
        logger.info({ promptId: id }, "event: System prompt updated");
        return reply.send({ ok: true, prompt: updated });
    });

    app.delete("/v1/engine/system-prompts/:id", async (request, reply) => {
        const id = (request.params as { id: string }).id;
        logger.debug(`event: DELETE /v1/engine/system-prompts/${id}`);
        const deleted = await options.runtime.storage.systemPrompts.deleteById(id);
        if (!deleted) {
            return reply.status(404).send({ ok: false, error: `System prompt not found: ${id}` });
        }
        logger.info({ promptId: id }, "event: System prompt deleted");
        return reply.send({ ok: true });
    });

    logger.debug("start: Starting server listen");
    await app.listen({ path: socketPath });
    logger.info({ socket: socketPath }, "ready: Engine server ready");
    logger.debug("event: Server listening on socket");

    return {
        socketPath,
        close: async () => {
            logger.debug("event: Closing engine server");
            await closeServer(app);
            await fs.rm(socketPath, { force: true });
            logger.debug("event: Engine server closed");
        }
    };
}

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown, reply: FastifyReply): T | null {
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

async function reloadRuntime(runtime: Engine): Promise<void> {
    await runtime.reload();
}
