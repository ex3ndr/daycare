import { z } from "zod";

import type { ExposeTunnelProvider } from "@/types";
import { definePlugin } from "../../engine/plugins/types.js";
import { customTunnelDomainResolve } from "./customTunnelDomainResolve.js";
import { customTunnelScriptRun } from "./customTunnelScriptRun.js";

const settingsSchema = z
    .object({
        domain: z.string().trim().min(1),
        exposeScript: z.string().trim().min(1),
        unexposeScript: z.string().trim().min(1)
    })
    .strict();

type CustomTunnelSettings = z.infer<typeof settingsSchema>;

export const plugin = definePlugin({
    settingsSchema,
    onboarding: async (api) => {
        const domain = await api.prompt.input({
            message: "Custom tunnel base domain"
        });
        if (!domain) {
            return null;
        }
        const exposeScript = await api.prompt.input({
            message: "Expose script path"
        });
        if (!exposeScript) {
            return null;
        }
        const unexposeScript = await api.prompt.input({
            message: "Unexpose script path"
        });
        if (!unexposeScript) {
            return null;
        }

        return {
            settings: {
                domain: domain.trim(),
                exposeScript: exposeScript.trim(),
                unexposeScript: unexposeScript.trim()
            }
        };
    },
    create: (api) => {
        const settings = api.settings as CustomTunnelSettings;
        const instanceId = api.instance.instanceId;
        const activeDomains = new Map<string, string>();

        let provider: ExposeTunnelProvider | null = null;

        const destroyTunnel = async (domain: string): Promise<void> => {
            const publicUrl = activeDomains.get(domain) ?? domain;
            await customTunnelScriptRun(settings.unexposeScript, [publicUrl]);
            activeDomains.delete(domain);
        };

        return {
            load: async () => {
                provider = {
                    instanceId,
                    domain: settings.domain,
                    capabilities: {
                        public: true,
                        localNetwork: false
                    },
                    createTunnel: async (proxyPort) => {
                        const url = await customTunnelScriptRun(settings.exposeScript, [String(proxyPort)]);
                        const resolved = customTunnelDomainResolve(url);
                        activeDomains.set(resolved.domain, resolved.publicUrl);
                        return { domain: resolved.domain };
                    },
                    destroyTunnel
                };

                await api.exposes.registerProvider(provider);
            },
            unload: async () => {
                for (const domain of [...activeDomains.keys()]) {
                    await destroyTunnel(domain).catch((error) => {
                        api.logger.warn({ domain, error }, "error: Failed to destroy custom expose tunnel");
                    });
                }

                await api.exposes.unregisterProvider(instanceId);
            }
        };
    }
});
