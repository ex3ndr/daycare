import os from "node:os";
import { Inngest, type InngestFunction, invoke, staticSchema } from "inngest";
import { connect, type WorkerConnection } from "inngest/connect";

import { getLogger } from "../log.js";
import { Context, type ContextJson, contextToJSON } from "../types.js";
import type { DaycareRole } from "../utils/hasRole.js";
import type { DurableConfig } from "./durableConfigResolve.js";
import { durableContextBind, durableContextCallGet } from "./durableContext.js";
import {
    type DurableFunctionInput,
    type DurableFunctionName,
    type DurableFunctionOutput,
    durableFunctionDefinitions,
    durableFunctionEnabled,
    durableFunctionKey,
    durableFunctionNamesForRoles
} from "./durableFunctions.js";
import type { Durable, DurableExecute } from "./durableTypes.js";

const logger = getLogger("durable.inngest");

export type DurableInngestOptions = {
    connectRun?: typeof connect;
    env?: NodeJS.ProcessEnv;
    execute: DurableExecute;
    roles?: readonly DaycareRole[];
};

/**
 * Durable runtime backed by the official Inngest SDK connect worker.
 * Expects: endpoint is already the websocket gateway URL used for connect().
 */
export class DurableInngest implements Durable {
    readonly kind = "inngest" as const;
    private readonly config: DurableConfig;
    private readonly connectRun: typeof connect;
    private readonly env: NodeJS.ProcessEnv;
    private readonly execute: DurableExecute;
    private readonly client: Inngest;
    private readonly functionsByName: Partial<Record<DurableFunctionName, InngestFunction.Any>>;
    private readonly roles: readonly DaycareRole[];
    private connection: WorkerConnection | null = null;
    private started = false;

    constructor(config: DurableConfig, options: DurableInngestOptions) {
        this.config = config;
        this.connectRun = options.connectRun ?? connect;
        this.env = options.env ?? process.env;
        this.execute = options.execute;
        this.roles = options.roles ?? [];
        this.client = new Inngest({
            baseUrl: this.config.apiBaseUrl,
            id: "daycare-durable",
            internalLogger: logger,
            logger,
            ...(this.env.INNGEST_DEV !== undefined || this.env.INNGEST_EVENT_KEY === undefined ? { isDev: true } : {})
        });
        this.functionsByName = {};
        for (const name of durableFunctionNamesForRoles(this.roles)) {
            this.functionsByName[name] = this.functionBuild(name);
        }
    }

    async call<TName extends DurableFunctionName>(
        ctx: Context,
        name: TName,
        input: DurableFunctionInput<TName>
    ): Promise<DurableFunctionOutput<TName>> {
        this.functionRequireEnabled(name);
        const call = durableContextCallGet(ctx, this.kind);
        if (!call) {
            throw new Error("Durable call requires a durable execution context.");
        }
        return call(ctx, name, input);
    }

    async schedule<TName extends DurableFunctionName>(
        ctx: Context,
        name: TName,
        input: DurableFunctionInput<TName>
    ): Promise<void> {
        await this.client.send({
            name: durableFunctionDefinitions[name].event,
            data: {
                ctx: contextToJSON(ctx),
                input
            }
        });
    }

    async start(): Promise<void> {
        if (this.started) {
            return;
        }
        this.started = true;

        const functions = Object.values(this.functionsByName);
        if (functions.length === 0) {
            logger.info({ roles: this.roles }, "skip: No durable functions enabled for current roles");
            return;
        }

        logger.info({ endpoint: this.config.endpoint }, "start: Starting durable runtime via Inngest connect()");

        this.connection = await this.connectRun({
            apps: [{ client: this.client, functions }],
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

    private functionBuild<TName extends DurableFunctionName>(name: TName): InngestFunction.Any {
        const definition = durableFunctionDefinitions[name];
        return this.client.createFunction(
            {
                id: definition.functionId,
                triggers: [{ event: definition.event }, invoke(staticSchema<DurableEnvelope<TName>>())]
            },
            async ({ event, step }) => {
                const payload = event.data as DurableEnvelope<TName>;
                const ctx = Context.fromJSON(payload.ctx);
                const durableCtx = durableContextBind(ctx, this.kind, async (callCtx, callName, callInput) => {
                    this.functionRequireEnabled(callName);
                    const target = this.functionsByName[callName];
                    if (!target) {
                        throw new Error(`Durable function "${callName}" is not registered in this runtime.`);
                    }
                    return step.invoke(this.stepIdBuild(callCtx, callName, callInput), {
                        data: {
                            ctx: contextToJSON(callCtx),
                            input: callInput
                        },
                        function: target
                    }) as Promise<DurableFunctionOutput<typeof callName>>;
                });
                return this.executeRequireEnabled(durableCtx, name, payload.input);
            }
        );
    }

    private stepIdBuild<TName extends DurableFunctionName>(
        ctx: Context,
        name: TName,
        input: DurableFunctionInput<TName>
    ): string {
        const key = durableFunctionKey(ctx, name, input);
        return key ? `durable:${name}:${key}` : `durable:${name}`;
    }

    private executeRequireEnabled<TName extends DurableFunctionName>(
        ctx: Context,
        name: TName,
        input: DurableFunctionInput<TName>
    ): Promise<DurableFunctionOutput<TName>> {
        this.functionRequireEnabled(name);
        return this.execute(ctx, name, input);
    }

    private functionRequireEnabled(name: DurableFunctionName): void {
        if (durableFunctionEnabled(name, this.roles)) {
            return;
        }
        const roleLabel = this.roles.length === 0 ? "none" : this.roles.join(", ");
        throw new Error(`Durable function "${name}" is disabled for roles: ${roleLabel}.`);
    }
}

type DurableEnvelope<TName extends DurableFunctionName> = {
    ctx: ContextJson;
    input: DurableFunctionInput<TName>;
};
