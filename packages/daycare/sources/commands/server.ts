import path from "node:path";
import { configLoad } from "sources/config/configLoad";
import { Engine } from "sources/engine/engine";
import { EngineEventBus } from "sources/engine/ipc/events";
import { getLogger } from "sources/log";
import { DEFAULT_SETTINGS_PATH } from "sources/settings";
import { rolesCurrentList } from "sources/utils/hasRole";
import { awaitShutdown, onShutdown } from "sources/utils/shutdown";

export type ServerOptions = {
    settings?: string;
};

const logger = getLogger("boot");

export async function serverCommand(_options: ServerOptions): Promise<void> {
    const settingsPath = path.resolve(_options.settings ?? DEFAULT_SETTINGS_PATH);
    const config = await configLoad(settingsPath);
    logger.info({ settingsPath: config.settingsPath, settings: config.settings }, "server: Loaded settings.json");
    logger.info({ roles: rolesCurrentList() }, "server: Loaded process roles");

    const runtime = new Engine({
        config,
        eventBus: new EngineEventBus(),
        server: true
    });
    const auth = await runtime.authStore.read();
    logger.info({ authPath: config.authPath, auth }, "server: Loaded credentials from auth.json");

    await runtime.start();
    onShutdown("server-runtime", () => {
        void runtime.shutdown();
    });

    logger.info("Ready. Listening for messages.");
    const signal = await awaitShutdown();
    logger.info({ signal }, "Shutdown complete");
    process.exit(0);
}
