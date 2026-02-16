import { fileURLToPath } from "node:url";

import { z } from "zod";

import type { ExposeTunnelProvider, SessionPermissions } from "@/types";
import { definePlugin } from "../../engine/plugins/types.js";
import { shellQuote } from "../../util/shellQuote.js";

const LOCAL_EXPOSE_DEFAULT_LISTEN_PORT = 18221;

const settingsSchema = z
  .object({
    domain: z.string().trim().min(1),
    port: z.coerce.number().int().min(1).max(65535).default(LOCAL_EXPOSE_DEFAULT_LISTEN_PORT)
  })
  .strict();

type LocalExposeSettings = z.infer<typeof settingsSchema>;

const FORWARDER_ENTRY_PATH = fileURLToPath(
  new URL("./localTunnelForwarderEntry.js", import.meta.url)
);
const LOCAL_FORWARDER_ALLOWED_DOMAINS = ["127.0.0.1", "localhost"];

export const plugin = definePlugin({
  settingsSchema,
  onboarding: async (api) => {
    const domain = await api.prompt.input({
      message: "Local domain (host header) to expose over local HTTP"
    });
    if (!domain) {
      return null;
    }
    const listenPortInput = await api.prompt.input({
      message: `Local listen port (default: ${LOCAL_EXPOSE_DEFAULT_LISTEN_PORT})`
    });

    return {
      settings: {
        domain: domain.trim(),
        port: localExposeListenPortResolve(listenPortInput)
      }
    };
  },
  create: (api) => {
    const settings = api.settings as LocalExposeSettings;
    const instanceId = api.instance.instanceId;
    const processOwner = { type: "plugin" as const, id: instanceId };
    const configuredDomain = settings.domain.trim().toLowerCase();
    const configuredPort = settings.port ?? LOCAL_EXPOSE_DEFAULT_LISTEN_PORT;
    const activeDomains = new Set<string>();

    let provider: ExposeTunnelProvider | null = null;

    const processEnsure = async (proxyPort: number): Promise<void> => {
      const expectedName = processNameBuild(instanceId, proxyPort);
      const existing = await api.processes.listByOwner(processOwner);
      if (existing.length > 0) {
        await api.processes.removeByOwner(processOwner);
      }

      const processPermissions: SessionPermissions = {
        workingDir: api.dataDir,
        writeDirs: [api.dataDir],
        readDirs: [api.dataDir],
        network: true,
        events: false
      };
      await api.processes.create(
        {
          name: expectedName,
          command: processCommandBuild(proxyPort, configuredPort),
          cwd: api.dataDir,
          home: api.dataDir,
          keepAlive: true,
          allowLocalBinding: true,
          owner: processOwner,
          allowedDomains: LOCAL_FORWARDER_ALLOWED_DOMAINS
        },
        processPermissions
      );
    };

    const destroyTunnel = async (domain: string): Promise<void> => {
      await api.processes.removeByOwner(processOwner);
      activeDomains.delete(domain);
    };

    return {
      load: async () => {
        provider = {
          instanceId,
          domain: configuredDomain,
          capabilities: {
            public: true,
            localNetwork: true
          },
          createTunnel: async (proxyPort) => {
            if (activeDomains.size > 0) {
              throw new Error(
                "Local Expose provider supports only one active expose endpoint at a time."
              );
            }

            await processEnsure(proxyPort);
            activeDomains.add(configuredDomain);
            return { domain: configuredDomain };
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
              "error: Failed to destroy local-expose expose tunnel"
            );
          });
        }
        await api.exposes.unregisterProvider(instanceId);
      }
    };
  }
});

function processNameBuild(instanceId: string, proxyPort: number): string {
  return `local-expose-${instanceId}-${proxyPort}`;
}

function processCommandBuild(proxyPort: number, listenPort: number): string {
  return `${shellQuote(process.execPath)} ${shellQuote(FORWARDER_ENTRY_PATH)} ${shellQuote(
    String(proxyPort)
  )} ${shellQuote(String(listenPort))}`;
}

function localExposeListenPortResolve(input: string | null | undefined): number {
  const value = input?.trim();
  if (!value) {
    return LOCAL_EXPOSE_DEFAULT_LISTEN_PORT;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("Local listen port must be an integer between 1 and 65535.");
  }
  return parsed;
}
