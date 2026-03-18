import os from "node:os";
import { Inngest } from "inngest";
import { connect, type WorkerConnection } from "inngest/connect";

import { getLogger } from "../log.js";
import type { DurableConfig } from "./durableConfigResolve.js";
import type { Durable } from "./durableTypes.js";

const logger = getLogger("durable.inngest");

export type DurableInngestOptions = {
    connectRun?: typeof connect;
};

/**
 * Durable runtime backed by the official Inngest SDK connect worker.
 * Expects: endpoint is already the websocket gateway URL used for connect().
 */
export class DurableInngest implements Durable {
    readonly kind = "inngest" as const;
    private readonly config: DurableConfig;
    private readonly connectRun: typeof connect;
    private connection: WorkerConnection | null = null;
    private started = false;

    constructor(config: DurableConfig, options: DurableInngestOptions = {}) {
        this.config = config;
        this.connectRun = options.connectRun ?? connect;
    }

    async start(): Promise<void> {
        if (this.started) {
            return;
        }
        this.started = true;

        logger.info({ endpoint: this.config.endpoint }, "start: Starting durable runtime via Inngest connect()");

        const client = new Inngest({
            baseUrl: this.config.apiBaseUrl,
            id: "daycare-durable",
            internalLogger: logger,
            logger
        });

        this.connection = await this.connectRun({
            apps: [{ client, functions: [] }],
            gatewayUrl: this.config.endpoint,
            handleShutdownSignals: [],
            instanceId: `${os.hostname()}-${process.pid}`
        });

        void this.connection.closed.then(() => {
            logger.warn({ endpoint: this.config.endpoint }, "event: Durable runtime connection closed");
        });

        logger.info(
            { connectionId: this.connection.connectionId, endpoint: this.config.endpoint },
            "ready: Durable runtime connected"
        );
    }

    async stop(): Promise<void> {
        if (!this.connection) {
            return;
        }

        const connection = this.connection;
        this.connection = null;
        await connection.close();
    }
}
