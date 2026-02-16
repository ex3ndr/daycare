import { execFile } from "node:child_process";
import crypto from "node:crypto";

import { z } from "zod";

import type { ExposeTunnelProvider } from "@/types";
import { definePlugin } from "../../engine/plugins/types.js";
import { cloudflareDomainResolve } from "./cloudflareDomainResolve.js";
import { cloudflareTunnelCommandBuild } from "./cloudflareTunnelCommandBuild.js";

const settingsSchema = z.object({}).passthrough();

export const plugin = definePlugin({
  settingsSchema,
  onboarding: async (api) => {
    const existing = await api.auth.getToken(api.instanceId);
    if (existing) {
      return { settings: {} };
    }

    const token = await api.prompt.input({
      message: "Cloudflare tunnel token"
    });
    if (!token) {
      return null;
    }
    await api.auth.setToken(api.instanceId, token.trim());
    return { settings: {} };
  },
  create: (api) => {
    const instanceId = api.instance.instanceId;
    const activeDomains = new Set<string>();

    let provider: ExposeTunnelProvider | null = null;

    const runWithToken = async (command: string, args: string[]): Promise<string> => {
      const token = await api.auth.getToken(instanceId);
      if (!token) {
        throw new Error("Missing cloudflare tunnel token in auth store.");
      }
      return commandRun(command, args, {
        TUNNEL_TOKEN: token
      });
    };

    const destroyTunnel = async (domain: string): Promise<void> => {
      const command = cloudflareTunnelCommandBuild({ action: "destroy", domain });
      await runWithToken(command.command, command.args);
      activeDomains.delete(domain);
    };

    return {
      load: async () => {
        const info = await runWithToken("cloudflared", [
          "tunnel",
          "info",
          "--output",
          "json"
        ]);
        const resolved = cloudflareDomainResolve(info);

        provider = {
          instanceId,
          domain: resolved.domain,
          capabilities: {
            public: true,
            localNetwork: false
          },
          createTunnel: async (proxyPort) => {
            const label = crypto.randomBytes(6).toString("hex");
            const domain = `${label}.${resolved.domain}`;
            const command = cloudflareTunnelCommandBuild({
              action: "create",
              domain,
              proxyPort
            });
            await runWithToken(command.command, command.args);
            activeDomains.add(domain);
            return { domain };
          },
          destroyTunnel
        };

        await api.exposes.registerProvider(provider);
      },
      unload: async () => {
        for (const domain of [...activeDomains.values()]) {
          await destroyTunnel(domain).catch((error) => {
            api.logger.warn(
              { domain, error },
              "error: Failed to destroy cloudflare expose tunnel"
            );
          });
        }

        await api.exposes.unregisterProvider(instanceId);
      }
    };
  }
});

function commandRun(
  command: string,
  args: string[],
  env: Record<string, string>
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        windowsHide: true,
        env: {
          ...process.env,
          ...env
        }
      },
      (error, stdout, stderr) => {
        if (error) {
          const message = stderr?.trim() || stdout?.trim() || error.message;
          reject(new Error(message));
          return;
        }
        resolve(stdout);
      }
    );
  });
}
