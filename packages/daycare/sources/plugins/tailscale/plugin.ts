import { execFile } from "node:child_process";

import { z } from "zod";

import type { ExposeMode, ExposeTunnelProvider } from "@/types";
import { definePlugin } from "../../engine/plugins/types.js";
import { tailscaleBinaryResolve } from "./tailscaleBinaryResolve.js";
import { tailscaleStatusDomainResolve } from "./tailscaleStatusDomainResolve.js";
import { tailscaleTunnelCommandBuild } from "./tailscaleTunnelCommandBuild.js";

const settingsSchema = z.object({}).passthrough();

export const plugin = definePlugin({
  settingsSchema,
  create: (api) => {
    const instanceId = api.instance.instanceId;
    const activeDomains = new Map<string, ExposeMode>();
    let tailscaleBinary = "tailscale";
    const httpsPort = 443;

    const destroyTunnel = async (domain: string): Promise<void> => {
      const mode = activeDomains.get(domain) ?? "public";
      const command = tailscaleTunnelCommandBuild({
        action: "destroy",
        mode,
        httpsPort,
        binary: tailscaleBinary
      });
      await commandRun(command.command, command.args);
      activeDomains.delete(domain);
    };

    let provider: ExposeTunnelProvider | null = null;

    return {
      load: async () => {
        tailscaleBinary = await tailscaleBinaryResolve();
        const status = await commandRun(tailscaleBinary, ["status", "--json"]);
        const resolved = tailscaleStatusDomainResolve(status);

        provider = {
          instanceId,
          domain: resolved.domain,
          capabilities: {
            public: true,
            localNetwork: true
          },
          createTunnel: async (proxyPort, mode) => {
            if (activeDomains.size > 0) {
              throw new Error(
                "Tailscale provider supports only one active expose endpoint at a time."
              );
            }
            const command = tailscaleTunnelCommandBuild({
              action: "create",
              mode,
              proxyPort,
              httpsPort,
              binary: tailscaleBinary
            });
            await commandRun(command.command, command.args);

            const domain = resolved.dnsName;
            activeDomains.set(domain, mode);
            return { domain };
          },
          destroyTunnel
        };

        await api.exposes.registerProvider(provider);
      },
      unload: async () => {
        for (const domain of [...activeDomains.keys()]) {
          await destroyTunnel(domain).catch((error) => {
            api.logger.warn(
              { domain, error },
              "error: Failed to destroy tailscale expose tunnel"
            );
          });
        }

        await api.exposes.unregisterProvider(instanceId);
      }
    };
  }
});

function commandRun(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        const message = stderr?.trim() || stdout?.trim() || error.message;
        reject(new Error(message));
        return;
      }
      resolve(stdout);
    });
  });
}
