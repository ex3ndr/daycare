import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

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
});
