import { describe, expect, it, vi } from "vitest";

import type { Connector } from "@/types";
import { ModuleRegistry } from "../modules/moduleRegistry.js";
import { PluginRegistry } from "./registry.js";

describe("PluginRegistrar command registration", () => {
    it("registers and unregisters plugin commands", () => {
        const modules = new ModuleRegistry({
            onMessage: async () => undefined
        });
        const registry = new PluginRegistry(modules);
        const registrar = registry.createRegistrar("upgrade-instance");
        const handler = vi.fn(async () => undefined);

        registrar.registerCommand({
            command: "upgrade",
            description: "Upgrade daycare to latest version",
            handler
        });

        expect(modules.commands.get("upgrade")).toEqual({
            command: "upgrade",
            description: "Upgrade daycare to latest version",
            handler
        });

        registrar.unregisterCommand("upgrade");

        expect(modules.commands.get("upgrade")).toBeNull();
    });

    it("cleans up registered commands on unregisterAll", async () => {
        const modules = new ModuleRegistry({
            onMessage: async () => undefined
        });
        const registry = new PluginRegistry(modules);
        const registrar = registry.createRegistrar("upgrade-instance");

        registrar.registerCommand({
            command: "upgrade",
            description: "Upgrade daycare to latest version",
            handler: async () => undefined
        });
        registrar.registerCommand({
            command: "hello",
            description: "Greeting command",
            handler: async () => undefined
        });

        await registrar.unregisterAll();

        expect(modules.commands.list()).toEqual([]);
    });

    it("sends messages through registered connectors", async () => {
        const modules = new ModuleRegistry({
            onMessage: async () => undefined
        });
        const registry = new PluginRegistry(modules);
        const registrar = registry.createRegistrar("upgrade-instance");
        const sendMessage = vi.fn(async () => undefined);
        const connector: Connector = {
            capabilities: { sendText: true },
            onMessage: () => () => undefined,
            sendMessage
        };
        modules.connectors.register("telegram", connector);

        await registrar.sendMessage(
            {
                type: "user",
                connector: "telegram",
                userId: "123",
                channelId: "123"
            },
            { messageId: "77" },
            { text: "Upgrading..." }
        );

        expect(sendMessage).toHaveBeenCalledWith("123", {
            text: "Upgrading...",
            replyToMessageId: "77"
        });
    });

    it("registers and unregisters media analysis providers", async () => {
        const modules = new ModuleRegistry({
            onMessage: async () => undefined
        });
        const registry = new PluginRegistry(modules);
        const registrar = registry.createRegistrar("media-instance");

        registrar.registerMediaAnalysisProvider({
            id: "media-provider",
            label: "Media Provider",
            supportedTypes: ["image", "audio"],
            analyze: async () => ({ text: "ok" })
        });
        expect(modules.mediaAnalysis.get("media-provider")).toEqual(
            expect.objectContaining({
                id: "media-provider",
                label: "Media Provider",
                supportedTypes: ["image", "audio"]
            })
        );

        await registrar.unregisterAll();
        expect(modules.mediaAnalysis.get("media-provider")).toBeNull();
    });
});
