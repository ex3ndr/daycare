import { z } from "zod";

import { definePlugin } from "../../engine/plugins/types.js";
import type { AgentDescriptor, MessageContext } from "@/types";
import { upgradeRestartPendingClear } from "./upgradeRestartPendingClear.js";
import { upgradeRestartPendingSet } from "./upgradeRestartPendingSet.js";
import { upgradeRestartPendingTake } from "./upgradeRestartPendingTake.js";
import { upgradePm2ProcessDetect } from "./upgradePm2ProcessDetect.js";
import { upgradeRestartRun } from "./upgradeRestartRun.js";
import { upgradeRun } from "./upgradeRun.js";
import { upgradeVersionRead } from "./upgradeVersionRead.js";

const UPGRADE_COMMAND = "upgrade";
const RESTART_COMMAND = "restart";
const RESTART_CONFIRM_MAX_AGE_MS = 5 * 60 * 1000;

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

    const upgradeHandler = async (
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
      const previousVersion = await upgradeVersionRead();
      if (previousVersion) {
        try {
          await upgradeRestartPendingSet({
            dataDir: api.dataDir,
            descriptor,
            context,
            requestedAtMs: Date.now(),
            requesterPid: process.pid,
            previousVersion
          });
        } catch (error) {
          api.logger.warn({ error }, "error: Failed to persist upgrade pending marker");
        }
      }
      try {
        await upgradeRun({
          strategy: settings.strategy,
          processName: settings.processName,
          sendStatus
        });
      } catch (error) {
        await upgradeRestartPendingClear(api.dataDir);
        api.logger.warn({ error }, "error: Upgrade command failed");
      }
    };

    const restartHandler = async (
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
          api.logger.warn({ error }, "error: Failed to send restart status message");
        }
      };

      await sendStatus("Restarting Daycare...");
      try {
        await upgradeRestartPendingSet({
          dataDir: api.dataDir,
          descriptor,
          context,
          requestedAtMs: Date.now(),
          requesterPid: process.pid
        });
      } catch (error) {
        api.logger.warn({ error }, "error: Failed to persist restart pending marker");
        await sendStatus("Restart failed before scheduling confirmation.");
        return;
      }
      try {
        await upgradeRestartRun({
          strategy: settings.strategy,
          processName: settings.processName,
          sendStatus
        });
      } catch (error) {
        await upgradeRestartPendingClear(api.dataDir);
        api.logger.warn({ error }, "error: Restart command failed");
      }
    };

    return {
      load: async () => {
        api.registrar.registerCommand({
          command: UPGRADE_COMMAND,
          description: "Upgrade daycare to latest version",
          handler: upgradeHandler
        });
        api.registrar.registerCommand({
          command: RESTART_COMMAND,
          description: "Restart the daycare server process",
          handler: restartHandler
        });
      },
      unload: async () => {
        api.registrar.unregisterCommand(UPGRADE_COMMAND);
        api.registrar.unregisterCommand(RESTART_COMMAND);
      },
      postStart: async () => {
        const pending = await upgradeRestartPendingTake(api.dataDir);
        if (!pending) {
          return;
        }
        if (pending.requesterPid === process.pid) {
          return;
        }
        if (Date.now() - pending.requestedAtMs > RESTART_CONFIRM_MAX_AGE_MS) {
          return;
        }
        if (pending.previousVersion) {
          const currentVersion = await upgradeVersionRead();
          if (!currentVersion || currentVersion === pending.previousVersion) {
            return;
          }
          try {
            await api.registrar.sendMessage(
              pending.descriptor,
              pending.context,
              {
                text: `Upgrade complete: Daycare ${pending.previousVersion} -> ${currentVersion}.`
              }
            );
          } catch (error) {
            api.logger.warn({ error }, "error: Failed to send upgrade completion status message");
          }
          return;
        }
        try {
          await api.registrar.sendMessage(
            pending.descriptor,
            pending.context,
            { text: "Restart complete. Daycare is back online." }
          );
        } catch (error) {
          api.logger.warn({ error }, "error: Failed to send restart completion status message");
        }
      }
    };
  }
});
