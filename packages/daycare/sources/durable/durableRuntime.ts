import os from "node:os";
import { Inngest } from "inngest";
import { connect, type WorkerConnection } from "inngest/connect";

import { getLogger } from "../log.js";
import type { DurableConfig } from "./durableConfigResolve.js";

const logger = getLogger("durable.runtime");

export type DurableRuntimeOptions = {
    connectRun?: typeof connect;
};

/**
 * Starts the official Inngest durable worker connection for server mode.
 * Expects: config token is a valid Inngest signing token for the configured endpoint.
 */
export class DurableRuntime {
    private readonly config: DurableConfig | null;
    private readonly connectRun: typeof connect;
    private connection: WorkerConnection | null = null;
    private started = false;

    constructor(config: DurableConfig | null, options: DurableRuntimeOptions = {}) {
        this.config = config;
        this.connectRun = options.connectRun ?? connect;
    }

    async start(): Promise<void> {
        if (this.started) {
            return;
        }
        this.started = true;

        if (!this.config) {
            logger.info("skip: Durable runtime disabled because Inngest env is not configured");
            return;
        }

        logger.info(
            { endpoint: this.config.endpoint, gatewayUrl: this.config.gatewayUrl },
            "start: Starting durable runtime via Inngest connect()"
        );

        const client = new Inngest({
            id: "daycare-durable",
            baseUrl: this.config.apiUrl,
            internalLogger: logger,
            logger,
            signingKey: this.config.token
        });

        this.connection = await this.connectRun({
            apps: [{ client, functions: [] }],
            gatewayUrl: this.config.gatewayUrl,
            handleShutdownSignals: [],
            instanceId: `${os.hostname()}-${process.pid}`
        });

        void this.connection.closed.then(() => {
            logger.warn({ endpoint: this.config?.endpoint }, "event: Durable runtime connection closed");
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
