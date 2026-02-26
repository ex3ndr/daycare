import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { ExposeTunnelProvider } from "@/types";
import { plugin } from "./plugin.js";

describe("custom-tunnel plugin", () => {
    it("registers provider and executes expose/unexpose scripts", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-custom-plugin-"));
        try {
            const exposeScript = path.join(dir, "expose.sh");
            const unexposeScript = path.join(dir, "unexpose.sh");
            const unexposeLog = path.join(dir, "unexpose.log");

            await writeFile(exposeScript, '#!/bin/sh\necho "https://custom-$1.example.com/hello"\n', "utf8");
            await writeFile(unexposeScript, `#!/bin/sh\necho "$1" > "${unexposeLog}"\n`, "utf8");
            await chmod(exposeScript, 0o755);
            await chmod(unexposeScript, 0o755);

            let registeredProvider: ExposeTunnelProvider | null = null;

            const api = {
                instance: { instanceId: "custom-tunnel-1", pluginId: "custom-tunnel", enabled: true },
                settings: {
                    domain: "example.com",
                    exposeScript,
                    unexposeScript
                },
                engineSettings: {},
                logger: { warn: vi.fn() },
                auth: {},
                dataDir: dir,
                registrar: {},
                exposes: {
                    registerProvider: vi.fn(async (provider: ExposeTunnelProvider) => {
                        registeredProvider = provider;
                    }),
                    unregisterProvider: vi.fn(async () => undefined),
                    listProviders: () => []
                },
                fileStore: {},
                inference: {
                    complete: async () => {
                        throw new Error("Inference not available in test.");
                    }
                },
                processes: {},
                mode: "runtime" as const
            };

            const instance = await plugin.create(api as never);
            await instance.load?.();

            if (!registeredProvider) {
                throw new Error("Expected provider to be registered");
            }

            const provider = registeredProvider as ExposeTunnelProvider;
            const created = await provider.createTunnel(4010, "public", "user-1");
            expect(created.domain).toBe("custom-4010.example.com");

            await provider.destroyTunnel(created.domain);
            expect((await readFile(unexposeLog, "utf8")).trim()).toBe("https://custom-4010.example.com/hello");

            await instance.unload?.();
            expect(api.exposes.unregisterProvider).toHaveBeenCalledWith("custom-tunnel-1");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
