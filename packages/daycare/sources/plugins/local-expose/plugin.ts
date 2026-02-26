import { promises as fs } from "node:fs";
import path from "node:path";

import { z } from "zod";

import type { ExposeTunnelProvider, SessionPermissions } from "@/types";
import { definePlugin } from "../../engine/plugins/types.js";
import { shellQuote } from "../../util/shellQuote.js";

const LOCAL_EXPOSE_DEFAULT_LISTEN_PORT = 18221;
const LOCAL_FORWARDER_SCRIPT_NAME = "localTunnelForwarderEntry.js";

const settingsSchema = z
    .object({
        domain: z.string().trim().min(1),
        port: z.coerce.number().int().min(1).max(65535).default(LOCAL_EXPOSE_DEFAULT_LISTEN_PORT)
    })
    .strict();

type LocalExposeSettings = z.infer<typeof settingsSchema>;

const LOCAL_FORWARDER_ALLOWED_DOMAINS = ["127.0.0.1", "localhost"];
const LOCAL_FORWARDER_SCRIPT = `
import http from "node:http";
import { pipeline } from "node:stream/promises";

const proxyPort = parsePort(process.argv[2], "proxy port");
const listenPort = parsePort(process.argv[3], "listen port");

const server = http.createServer((request, response) => {
  const headers = { ...request.headers };
  delete headers.connection;

  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: proxyPort,
      method: request.method,
      path: request.url,
      headers
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      void pipeline(upstreamResponse, response).catch(() => {
        response.destroy();
      });
    }
  );

  upstream.on("error", () => {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.statusCode = 502;
    response.setHeader("content-type", "text/plain; charset=utf-8");
    response.end("Expose upstream unavailable.");
  });

  void pipeline(request, upstream).catch(() => {
    upstream.destroy();
  });
});

server.listen({ host: "0.0.0.0", port: listenPort }, () => {
  process.stdout.write(
    \`local-expose forwarder listening on :\${listenPort} -> 127.0.0.1:\${proxyPort}\\n\`
  );
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});

function parsePort(value, label) {
  if (!value) {
    throw new Error(\`Missing \${label}.\`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(\`Invalid \${label}: \${value}\`);
  }
  return parsed;
}
`.trim();

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

        const processEnsure = async (proxyPort: number, userId: string): Promise<void> => {
            const expectedName = processNameBuild(instanceId, proxyPort);
            const existing = await api.processes.listByOwner(processOwner);
            if (existing.length > 0) {
                await api.processes.removeByOwner(processOwner);
            }
            const forwarderScriptPath = await localForwarderScriptEnsure(api.dataDir);

            const processPermissions: SessionPermissions = {
                workingDir: api.dataDir,
                writeDirs: [api.dataDir]
            };
            await api.processes.create(
                {
                    name: expectedName,
                    command: processCommandBuild(proxyPort, configuredPort, forwarderScriptPath),
                    cwd: api.dataDir,
                    home: api.dataDir,
                    keepAlive: true,
                    allowLocalBinding: true,
                    owner: processOwner,
                    allowedDomains: LOCAL_FORWARDER_ALLOWED_DOMAINS,
                    userId
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
                    createTunnel: async (proxyPort, _mode, userId) => {
                        if (activeDomains.size > 0) {
                            throw new Error(
                                "Local Expose provider supports only one active expose endpoint at a time."
                            );
                        }

                        await processEnsure(proxyPort, userId);
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
                        api.logger.warn({ domain, error }, "error: Failed to destroy local-expose expose tunnel");
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

function processCommandBuild(proxyPort: number, listenPort: number, forwarderScriptPath: string): string {
    return `${shellQuote(process.execPath)} ${shellQuote(forwarderScriptPath)} ${shellQuote(
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

async function localForwarderScriptEnsure(dataDir: string): Promise<string> {
    await fs.mkdir(dataDir, { recursive: true });
    const scriptPath = path.join(dataDir, LOCAL_FORWARDER_SCRIPT_NAME);
    let needsWrite = true;
    try {
        const current = await fs.readFile(scriptPath, "utf8");
        needsWrite = current !== LOCAL_FORWARDER_SCRIPT;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
        }
    }
    if (needsWrite) {
        await fs.writeFile(scriptPath, `${LOCAL_FORWARDER_SCRIPT}\n`, { mode: 0o700 });
    }
    return scriptPath;
}
