import { getLogger } from "../log.js";
import type { Durable } from "./durableTypes.js";

const logger = getLogger("durable.local");

/**
 * Local durable runtime used when no remote durable backend is configured.
 * Expects: start and stop have no side effects beyond logging.
 */
export class DurableLocal implements Durable {
    readonly kind = "local" as const;
    private started = false;

    async start(): Promise<void> {
        if (this.started) {
            return;
        }
        this.started = true;
        logger.info("skip: Durable runtime using local implementation");
    }

    async stop(): Promise<void> {
        this.started = false;
    }
}
