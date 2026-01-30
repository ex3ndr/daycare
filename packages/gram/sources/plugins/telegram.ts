import path from "node:path";
import { TelegramConnector, type TelegramConnectorOptions } from "../connectors/telegram.js";
import type { Plugin } from "./types.js";

type TelegramPluginConfig = Omit<TelegramConnectorOptions, "token" | "fileStore" | "dataDir">;

export function createTelegramPlugin(): Plugin {
  return {
    id: "telegram",
    kind: "connector",
    load: async (context) => {
      const token = await context.secrets.get("telegram", "token");
      if (!token) {
        throw new Error("Missing telegram token in secrets store");
      }
      const config = (context.config.config ?? {}) as TelegramPluginConfig;
      const statePath =
        config.statePath === undefined
          ? path.join(context.dataDir, "telegram-offset.json")
          : config.statePath;
      const connector = new TelegramConnector({
        ...config,
        statePath,
        token,
        fileStore: context.fileStore,
        dataDir: context.dataDir,
        enableGracefulShutdown: false,
        onFatal: (reason, error) => {
          context.logger.warn({ reason, error }, "Telegram connector fatal");
        }
      });
      context.registrar.registerConnector("telegram", connector);
    },
    unload: async (context) => {
      await context.registrar.unregisterConnector("telegram");
    }
  };
}
