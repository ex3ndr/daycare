import { describe, expect, it, vi } from "vitest";
import { CommandRegistry } from "./commandRegistry.js";
import type { CommandHandler } from "./connectors/types.js";

function handlerBuild(): CommandHandler {
    return vi.fn(async () => undefined);
}

describe("CommandRegistry", () => {
    it("registers commands and returns list entries", () => {
        const registry = new CommandRegistry();
        const handler = handlerBuild();

        registry.register("upgrade", {
            command: "upgrade",
            description: "Upgrade daycare to latest version",
            handler
        });

        expect(registry.get("upgrade")).toEqual({
            command: "upgrade",
            description: "Upgrade daycare to latest version",
            handler
        });
        expect(registry.list()).toEqual([
            {
                command: "upgrade",
                description: "Upgrade daycare to latest version"
            }
        ]);
    });

    it("unregisters individual commands", () => {
        const registry = new CommandRegistry();

        registry.register("upgrade", {
            command: "upgrade",
            description: "Upgrade daycare to latest version",
            handler: handlerBuild()
        });

        registry.unregister("upgrade");

        expect(registry.get("upgrade")).toBeNull();
        expect(registry.list()).toEqual([]);
    });

    it("unregisters commands by plugin id", () => {
        const registry = new CommandRegistry();

        registry.register("upgrade", {
            command: "upgrade",
            description: "Upgrade daycare to latest version",
            handler: handlerBuild()
        });
        registry.register("telegram", {
            command: "hello",
            description: "Say hello",
            handler: handlerBuild()
        });

        registry.unregisterByPlugin("upgrade");

        expect(registry.get("upgrade")).toBeNull();
        expect(registry.get("hello")).toEqual({
            command: "hello",
            description: "Say hello",
            handler: expect.any(Function)
        });
    });

    it("emits change events for register and unregister", () => {
        const registry = new CommandRegistry();
        const listener = vi.fn();
        const unsubscribe = registry.onChange(listener);

        registry.register("upgrade", {
            command: "upgrade",
            description: "Upgrade daycare to latest version",
            handler: handlerBuild()
        });
        registry.unregister("upgrade");

        expect(listener).toHaveBeenCalledTimes(2);
        expect(listener).toHaveBeenNthCalledWith(1, [
            {
                command: "upgrade",
                description: "Upgrade daycare to latest version"
            }
        ]);
        expect(listener).toHaveBeenNthCalledWith(2, []);

        unsubscribe();
        registry.register("upgrade", {
            command: "upgrade",
            description: "Upgrade daycare to latest version",
            handler: handlerBuild()
        });
        expect(listener).toHaveBeenCalledTimes(2);
    });
});
