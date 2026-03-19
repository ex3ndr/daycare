import os from "node:os";
import { createId } from "@paralleldrive/cuid2";
import { Inngest, type InngestFunction, invoke, staticSchema } from "inngest";
import { connect, type WorkerConnection } from "inngest/connect";

import { getLogger } from "../log.js";
import { Context, type ContextJson, contexts, contextToJSON } from "../types.js";
import type { DaycareRole } from "../utils/hasRole.js";
import type { DurableConfig } from "./durableConfigResolve.js";
import { durableFunctionEnabled } from "./durableFunctionEnabled.js";
import { durableFunctionNamesForRoles } from "./durableFunctionNamesForRoles.js";
import type { DurableFunctionInput, DurableFunctionName, DurableFunctionOutput } from "./durableFunctions.js";
import { durableInstanceCurrentSet, durableInstanceRegister, durableInstanceUnregister } from "./durableRegistry.js";
import type { Durable, DurableExecute } from "./durableTypes.js";

const logger = getLogger("durable.inngest");

type DurableInngestStepContext = {
    invoke<TValue>(
        id: string,
        options: {
            data: unknown;
            function: InngestFunction.Any;
        }
    ): Promise<TValue>;
    run<TValue>(id: string, fn: () => Promise<TValue> | TValue): Promise<TValue>;
};

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
    readonly instanceId: string;
    private readonly config: DurableConfig;
    private readonly connectRun: typeof connect;
    private readonly env: NodeJS.ProcessEnv;
    private readonly execute: DurableExecute;
    private readonly client: Inngest;
    private readonly functionsByName: Partial<Record<DurableFunctionName, InngestFunction.Any>>;
    private readonly roles: readonly DaycareRole[];
    private readonly stepsByExecutionId = new Map<string, DurableInngestStepContext>();
    private connection: WorkerConnection | null = null;
    private started = false;

    constructor(config: DurableConfig, options: DurableInngestOptions) {
        this.instanceId = `inngest:${createId()}`;
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
        durableInstanceRegister(this.instanceId, {
            call: (ctx, id, name, input) => this.call(ctx, id, name, input),
            schedule: (ctx, name, input) => this.schedule(ctx, name, input),
            step: (ctx, id, execute) => this.step(ctx, id, execute)
        });
    }

    async start(): Promise<void> {
        if (this.started) {
            return;
        }
        this.started = true;
        durableInstanceCurrentSet(this.instanceId);

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
            durableInstanceUnregister(this.instanceId);
            return;
        }

        const connection = this.connection;
        this.connection = null;
        await connection.close();
        durableInstanceUnregister(this.instanceId);
    }

    private functionBuild<TName extends DurableFunctionName>(name: TName): InngestFunction.Any {
        const eventName = durableFunctionEvent(name);
        return this.client.createFunction(
            {
                id: durableFunctionId(name),
                triggers: [{ event: eventName }, invoke(staticSchema<DurableEnvelope<TName>>())]
            },
            async ({ event, step }) => {
                const payload = event.data as DurableEnvelope<TName>;
                const executionId = createId();
                const ctx = contexts.durable.set(Context.fromJSON(payload.ctx), {
                    active: true,
                    executionId,
                    instanceId: this.instanceId,
                    kind: this.kind
                });
                this.stepsByExecutionId.set(executionId, step);
                try {
                    return await this.executeRequireEnabled(ctx, name, payload.input);
                } finally {
                    this.stepsByExecutionId.delete(executionId);
                }
            }
        );
    }

    private executeRequireEnabled<TName extends DurableFunctionName>(
        ctx: Context,
        name: TName,
        input: DurableFunctionInput<TName>
    ): Promise<DurableFunctionOutput<TName>> {
        this.functionRequireEnabled(name);
        return this.execute(ctx, name, input);
    }

    private async call<TName extends DurableFunctionName>(
        ctx: Context,
        id: string,
        name: TName,
        input: DurableFunctionInput<TName>
    ): Promise<DurableFunctionOutput<TName> | undefined> {
        this.functionRequireEnabled(name);
        if (ctx.durable?.active === true) {
            const step = this.stepContextGet(ctx);
            if (!step) {
                throw new Error("Durable Inngest call requires an active step context.");
            }
            const target = this.functionsByName[name];
            if (!target) {
                throw new Error(`Durable function "${name}" is not registered in this runtime.`);
            }
            return step.invoke<DurableFunctionOutput<TName>>(id, {
                data: {
                    ctx: contextToJSON(ctx),
                    input
                },
                function: target
            });
        }
        await this.client.send({
            name: durableFunctionEvent(name),
            data: {
                ctx: contextToJSON(ctx),
                input
            }
        });
    }

    private async schedule<TName extends DurableFunctionName>(
        ctx: Context,
        name: TName,
        input: DurableFunctionInput<TName>
    ): Promise<void> {
        this.functionRequireEnabled(name);
        await this.client.send({
            name: durableFunctionEvent(name),
            data: {
                ctx: contextToJSON(ctx),
                input
            }
        });
    }

    private step<TValue>(_ctx: Context, id: string, execute: () => Promise<TValue> | TValue): Promise<TValue> {
        const step = this.stepContextGet(_ctx);
        if (!step) {
            throw new Error("Durable Inngest step requires an active step context.");
        }
        return step.run(id, execute);
    }

    private stepContextGet(ctx: Context): DurableInngestStepContext | null {
        const executionId = ctx.durable?.executionId;
        if (!executionId) {
            return null;
        }
        return this.stepsByExecutionId.get(executionId) ?? null;
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

function durableFunctionEvent(name: DurableFunctionName): string {
    return `daycare/durable.${name}`;
}

function durableFunctionId(name: DurableFunctionName): string {
    return `durable-${name}`;
}
