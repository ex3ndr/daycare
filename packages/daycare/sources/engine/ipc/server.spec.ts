import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

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
        const runtime = {} as unknown as import("../engine.js").Engine;
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dces-"));
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

    it("posts text to a target agent by agentId", async () => {
        const postAndAwait = vi.fn(async () => ({ type: "message" as const, responseText: "ok" }));
        const runtime = {
            agentSystem: {
                contextForAgentId: vi.fn(async (agentId: string) => ({ userId: "user-1", agentId })),
                postAndAwait,
                post: vi.fn(),
                agentIdForTarget: vi.fn()
            }
        } as unknown as import("../engine.js").Engine;
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dces-msg-"));
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
            path: "/v1/engine/agents/message",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId: "agent-1", text: "hello" })
        });

        expect(response.statusCode).toBe(200);
        expect(postAndAwait).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user-1", hasAgentId: false }),
            { agentId: "agent-1" },
            expect.objectContaining({
                type: "message",
                message: { text: "hello" }
            })
        );
        const payload = JSON.parse(response.body) as { ok: boolean; agentId: string; responseText: string | null };
        expect(payload.ok).toBe(true);
        expect(payload.agentId).toBe("agent-1");
        expect(payload.responseText).toBe("ok");
    });

    it("posts text to descriptor target by resolving agent id", async () => {
        const post = vi.fn(async () => {});
        const agentIdForTarget = vi.fn(async () => "resolved-agent");
        const runtime = {
            agentSystem: {
                contextForAgentId: vi.fn(),
                postAndAwait: vi.fn(),
                post,
                agentIdForTarget
            }
        } as unknown as import("../engine.js").Engine;
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dces-desc-"));
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
            path: "/v1/engine/agents/message",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: "user-1",
                descriptor: { type: "system", tag: "task" },
                text: "create cron",
                awaitResponse: false
            })
        });

        expect(response.statusCode).toBe(200);
        expect(agentIdForTarget).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user-1", hasAgentId: false }),
            { descriptor: { type: "system", tag: "task" } }
        );
        expect(post).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user-1", hasAgentId: false }),
            { agentId: "resolved-agent" },
            expect.objectContaining({
                type: "message",
                message: { text: "create cron" }
            })
        );
    });

    it("triggers cron task manually via IPC endpoint", async () => {
        const triggerTask = vi.fn(async () => {});
        const runtime = {
            crons: {
                triggerTask
            }
        } as unknown as import("../engine.js").Engine;
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dces-cron-"));
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
            path: "/v1/engine/cron/tasks/nightly/trigger",
            method: "POST"
        });

        expect(response.statusCode).toBe(200);
        expect(triggerTask).toHaveBeenCalledWith("nightly");
        const payload = JSON.parse(response.body) as { ok: boolean; triggerId: string };
        expect(payload.ok).toBe(true);
        expect(payload.triggerId).toBe("nightly");
    });
});
