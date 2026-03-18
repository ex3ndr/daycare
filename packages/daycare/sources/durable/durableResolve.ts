import path from "node:path";
import { durableConfigResolve } from "./durableConfigResolve.js";
import { DurableInngest, type DurableInngestOptions } from "./durableInngest.js";
import { DurableLocal } from "./durableLocal.js";
import type { Durable, DurableExecute } from "./durableTypes.js";

export type DurableResolveOptions = {
    dataDir: string;
    execute: DurableExecute;
    inngest?: Omit<DurableInngestOptions, "env" | "execute">;
    server?: boolean;
};

/**
 * Resolves the durable runtime implementation for the current process.
 * Expects: server mode uses Inngest when configured; otherwise local runtime is used.
 */
export function durableResolve(env: NodeJS.ProcessEnv, options: DurableResolveOptions): Durable {
    if (options.server !== true) {
        return new DurableLocal({
            execute: options.execute,
            rootDir: path.join(options.dataDir, "durable")
        });
    }

    const config = durableConfigResolve(env);
    if (!config) {
        return new DurableLocal({
            execute: options.execute,
            rootDir: path.join(options.dataDir, "durable")
        });
    }

    return new DurableInngest(config, {
        ...options.inngest,
        env,
        execute: options.execute
    });
}
