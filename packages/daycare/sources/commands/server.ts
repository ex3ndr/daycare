import { getLogger } from "sources/log";
import { awaitShutdown } from "sources/utils/shutdown";
import { delay } from "sources/utils/time";

export type ServerOptions = {
    settings?: string;
};

const logger = getLogger("boot");

export async function serverCommand(options: ServerOptions): Promise<void> {

    //
    // TODO: Implement server boot
    //


    //
    // Await exit
    //

    logger.info("ready: Ready. Listening for messages.");
    const signal = await awaitShutdown();
    logger.info({ signal }, "event: Shutdown complete");
    process.exit(0);
}