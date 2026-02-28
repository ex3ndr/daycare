import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Engine } from "../engine.js";
import { requestSocket } from "./client.js";
import { EngineEventBus } from "./events.js";
import { type EngineServer, startEngineServer } from "./server.js";

describe("startEngineServer", () => {
    const activeServers: EngineServer[] = [];
    const activeDirs: string[] = [];

    afterEach(async () => {
        while (activeServers.length > 0) {
            const server = activeServers.pop();
            if (!server) {
                continue;
            }
            await server.close();
        }

        while (activeDirs.length > 0) {
            const dir = activeDirs.pop();
            if (!dir) {
                continue;
            }
            await fs.rm(dir, { recursive: true, force: true });
        }
    });

    it("returns plain text welcome message on root route", async () => {
        const runtime = runtimeBuild();
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-engine-server-"));
        activeDirs.push(dir);

        const server = await startEngineServer({
            socketPath: path.join(dir, "engine.sock"),
            settingsPath: path.join(dir, "settings.json"),
            runtime,
            eventBus: new EngineEventBus()
        });
        activeServers.push(server);

        const response = await requestSocket({
            socketPath: server.socketPath,
            path: "/"
        });

        expect(response.statusCode).toBe(200);
        expect(response.body).toBe("Welcome to Daycare API!");
        expect(response.body).not.toContain("<html");
    });

    it("triggers webhook execution for POST /v1/webhooks/:id", async () => {
        const trigger = vi.fn(async () => undefined);
        const runtime = runtimeBuild({
            trigger
        });
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-engine-server-"));
        activeDirs.push(dir);

        const server = await startEngineServer({
            socketPath: path.join(dir, "engine.sock"),
            settingsPath: path.join(dir, "settings.json"),
            runtime,
            eventBus: new EngineEventBus()
        });
        activeServers.push(server);

        const response = await requestSocket({
            socketPath: server.socketPath,
            path: "/v1/webhooks/hook-1",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event: "deploy" })
        });

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ ok: true });
        expect(trigger).toHaveBeenCalledWith("hook-1", { event: "deploy" });
    });

    it("returns 404 when webhook trigger is missing", async () => {
        const runtime = runtimeBuild({
            trigger: async () => {
                throw new Error("Webhook trigger not found: missing-hook");
            }
        });
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-engine-server-"));
        activeDirs.push(dir);

        const server = await startEngineServer({
            socketPath: path.join(dir, "engine.sock"),
            settingsPath: path.join(dir, "settings.json"),
            runtime,
            eventBus: new EngineEventBus()
        });
        activeServers.push(server);

        const response = await requestSocket({
            socketPath: server.socketPath,
            path: "/v1/webhooks/missing-hook",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
        });

        expect(response.statusCode).toBe(404);
        expect(JSON.parse(response.body)).toEqual({
            ok: false,
            error: "Webhook trigger not found: missing-hook"
        });
    });

    it("returns 500 when webhook execution fails", async () => {
        const runtime = runtimeBuild({
            trigger: async () => {
                throw new Error("Webhook execution failed");
            }
        });
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-engine-server-"));
        activeDirs.push(dir);

        const server = await startEngineServer({
            socketPath: path.join(dir, "engine.sock"),
            settingsPath: path.join(dir, "settings.json"),
            runtime,
            eventBus: new EngineEventBus()
        });
        activeServers.push(server);

        const response = await requestSocket({
            socketPath: server.socketPath,
            path: "/v1/webhooks/hook-error",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
        });

        expect(response.statusCode).toBe(500);
        expect(JSON.parse(response.body)).toEqual({
            ok: false,
            error: "Webhook execution failed"
        });
    });

    it("lists webhook triggers via /v1/engine/webhook/tasks", async () => {
        const runtime = runtimeBuild({
            listTasks: async () => [
                {
                    id: "hook-1",
                    taskId: "task-1",
                    userId: "user-1",
                    agentId: null,
                    createdAt: 1,
                    updatedAt: 1
                }
            ]
        });
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-engine-server-"));
        activeDirs.push(dir);

        const server = await startEngineServer({
            socketPath: path.join(dir, "engine.sock"),
            settingsPath: path.join(dir, "settings.json"),
            runtime,
            eventBus: new EngineEventBus()
        });
        activeServers.push(server);

        const response = await requestSocket({
            socketPath: server.socketPath,
            path: "/v1/engine/webhook/tasks"
        });

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
            ok: true,
            tasks: [
                {
                    id: "hook-1",
                    taskId: "task-1",
                    userId: "user-1",
                    agentId: null,
                    createdAt: 1,
                    updatedAt: 1
                }
            ]
        });
    });
});

function runtimeBuild(options?: {
    trigger?: (id: string, body?: unknown) => Promise<void>;
    listTasks?: () => Promise<unknown[]>;
}): Engine {
    return {
        webhooks: {
            trigger: options?.trigger ?? (async () => undefined),
            listTasks: options?.listTasks ?? (async () => [])
        }
    } as unknown as Engine;
}
