import { z } from "zod";

import { definePlugin } from "../../engine/plugins/types.js";
import type { AgentDescriptor, MessageContext } from "@/types";
import { upgradePm2ProcessDetect } from "./upgradePm2ProcessDetect.js";
import { upgradeRun } from "./upgradeRun.js";

const UPGRADE_COMMAND = "upgrade";

const settingsSchema = z
  .object({
    strategy: z.literal("pm2"),
    processName: z.string().trim().min(1)
  })
  .passthrough();

type UpgradePluginSettings = {
  strategy: "pm2";
  processName: string;
};

export const plugin = definePlugin({
  settingsSchema,
  onboarding: async (api) => {
    const detection = await upgradePm2ProcessDetect("daycare");
    if (!detection.found) {
      api.note(
        `Upgrade plugin requires an online PM2 process named "daycare". ${detection.reason}`,
        "Upgrade"
      );
      return null;
    }
    api.note(
      `Detected online PM2 process "${detection.processName}". Upgrade plugin configured.`,
      "Upgrade"
    );
    return {
      settings: {
        strategy: "pm2",
        processName: detection.processName
      }
    };
  },
  create: (api) => {
    const settings = api.settings as UpgradePluginSettings;

    const handler = async (
      _command: string,
      context: MessageContext,
      descriptor: AgentDescriptor
    ): Promise<void> => {
      if (descriptor.type !== "user") {
        return;
      }

      const sendStatus = async (text: string): Promise<void> => {
        try {
          await api.registrar.sendMessage(
            descriptor,
            context,
            { text }
          );
        } catch (error) {
          api.logger.warn({ error }, "error: Failed to send upgrade status message");
        }
      };

      await sendStatus("Upgrading Daycare...");
      try {
        await upgradeRun({
          strategy: settings.strategy,
          processName: settings.processName,
          sendStatus
        });
      } catch (error) {
        api.logger.warn({ error }, "error: Upgrade command failed");
      }
    };

    return {
      load: async () => {
        api.registrar.registerCommand({
          command: UPGRADE_COMMAND,
          description: "Upgrade daycare to latest version",
          handler
        });
      },
      unload: async () => {
        api.registrar.unregisterCommand(UPGRADE_COMMAND);
      }
    };
  }
});
