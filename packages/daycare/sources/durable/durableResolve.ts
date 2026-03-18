import { durableConfigResolve } from "./durableConfigResolve.js";
import { DurableInngest, type DurableInngestOptions } from "./durableInngest.js";
import { DurableLocal } from "./durableLocal.js";
import type { Durable } from "./durableTypes.js";

export type DurableResolveOptions = {
    inngest?: DurableInngestOptions;
    server?: boolean;
};

/**
 * Resolves the durable runtime implementation for the current process.
 * Expects: server mode uses Inngest when configured; otherwise local runtime is used.
 */
export function durableResolve(env: NodeJS.ProcessEnv, options: DurableResolveOptions = {}): Durable {
    if (options.server !== true) {
        return new DurableLocal();
    }

    const config = durableConfigResolve(env);
    if (!config) {
        return new DurableLocal();
    }

    return new DurableInngest(config, options.inngest);
}
