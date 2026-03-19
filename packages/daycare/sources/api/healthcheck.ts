import http from "node:http";
import { getLogger } from "../log.js";

const logger = getLogger("api.healthcheck");

export const HEALTHCHECK_DEFAULT_PORT = 7333;

/**
 * Minimal HTTP server that responds 200 on all requests.
 * Runs independently of the app server so probes work regardless of role configuration.
 */
export class HealthcheckServer {
    private server: http.Server | null = null;
    private readonly port: number;

    constructor(port?: number) {
        this.port = port ?? HEALTHCHECK_DEFAULT_PORT;
    }

    async start(): Promise<void> {
        if (this.server) {
            return;
        }
        const server = http.createServer((_req, res) => {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end('{"status":"ok"}');
        });
        await new Promise<void>((resolve, reject) => {
            server.once("error", reject);
            server.listen(this.port, "0.0.0.0", () => {
                server.removeListener("error", reject);
                resolve();
            });
        });
        this.server = server;
        logger.info({ port: this.port }, "Healthcheck server started");
    }

    async stop(): Promise<void> {
        const server = this.server;
        if (!server) {
            return;
        }
        this.server = null;
        await new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
        logger.info("Healthcheck server stopped");
    }
}
