import { describe, expect, it, vi } from "vitest";
import { configResolve } from "../../config/configResolve.js";
import { getProviderDefinition } from "../../providers/catalog.js";
import { providerModelSelectBySize } from "../../providers/providerModelSelectBySize.js";
import { ConfigModule } from "../config/configModule.js";
import { PluginInferenceService } from "./inference.js";

describe("PluginInferenceService", () => {
    it("resolves built-in flavor strategy for selected provider", async () => {
        const router = {
            complete: vi.fn().mockResolvedValue({
                message: {
                    role: "assistant",
                    content: [{ type: "text", text: "ok" }],
                    stopReason: "end_turn",
                    timestamp: Date.now()
                },
                providerId: "openai",
                modelId: "gpt-5-mini"
            })
        };
        const service = new PluginInferenceService({
            router: router as never,
            config: configModuleBuild({
                providers: [{ id: "openai", enabled: true, model: "gpt-5" }]
            })
        });

        const client = service.createClient("plugin-1");
        await client.complete({
            messages: [],
            strategy: "small"
        });

        const call = router.complete.mock.calls[0];
        const options = call?.[2];
        const expectedModel =
            providerModelSelectBySize(getProviderDefinition("openai")?.models ?? [], "small") ?? "gpt-5";
        expect(options?.providersOverride).toEqual([{ id: "openai", enabled: true, model: expectedModel }]);
    });

    it("resolves custom flavor strategy to configured provider/model", async () => {
        const router = {
            complete: vi.fn().mockResolvedValue({
                message: {
                    role: "assistant",
                    content: [{ type: "text", text: "ok" }],
                    stopReason: "end_turn",
                    timestamp: Date.now()
                },
                providerId: "anthropic",
                modelId: "claude-opus-4-5"
            })
        };
        const service = new PluginInferenceService({
            router: router as never,
            config: configModuleBuild({
                providers: [
                    { id: "openai", enabled: true, model: "gpt-5" },
                    { id: "anthropic", enabled: true, model: "claude-sonnet-4-5" }
                ],
                modelFlavors: {
                    coding: {
                        model: "anthropic/claude-opus-4-5",
                        description: "High-capability coding and planning"
                    }
                }
            })
        });

        const client = service.createClient("plugin-2");
        await client.complete({
            messages: [],
            strategy: "coding"
        });

        const call = router.complete.mock.calls[0];
        const options = call?.[2];
        expect(options?.providersOverride).toEqual([{ id: "anthropic", enabled: true, model: "claude-opus-4-5" }]);
    });

    it("throws for unknown non-default strategy", async () => {
        const router = {
            complete: vi.fn().mockResolvedValue({
                message: {
                    role: "assistant",
                    content: [{ type: "text", text: "ok" }],
                    stopReason: "end_turn",
                    timestamp: Date.now()
                },
                providerId: "openai",
                modelId: "gpt-5"
            })
        };
        const service = new PluginInferenceService({
            router: router as never,
            config: configModuleBuild({
                providers: [{ id: "openai", enabled: true, model: "gpt-5" }]
            })
        });

        const client = service.createClient("plugin-3");
        await expect(
            client.complete({
                messages: [],
                strategy: "unknown"
            })
        ).rejects.toThrow("Unknown inference strategy: unknown");
    });
});

function configModuleBuild(options: {
    providers: Array<{ id: string; enabled: boolean; model: string }>;
    modelFlavors?: Record<string, { model: string; description: string }>;
}): ConfigModule {
    return new ConfigModule(
        configResolve(
            {
                engine: { dataDir: "/tmp/daycare-tests" },
                providers: options.providers,
                modelFlavors: options.modelFlavors
            },
            "/tmp/daycare-tests/settings.json"
        )
    );
}
