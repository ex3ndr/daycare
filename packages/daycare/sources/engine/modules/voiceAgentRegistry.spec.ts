import { describe, expect, it } from "vitest";
import { VoiceAgentRegistry } from "./voiceAgentRegistry.js";

describe("VoiceAgentRegistry", () => {
    it("registers and resolves providers", () => {
        const registry = new VoiceAgentRegistry();
        const provider = {
            id: "elevenlabs",
            label: "ElevenLabs",
            startSession: async () => ({
                agentId: "agent-1",
                overrides: {}
            })
        };

        registry.register("plugin-elevenlabs", provider);

        expect(registry.get("elevenlabs")).toEqual(expect.objectContaining(provider));
        expect(registry.list()).toEqual([expect.objectContaining(provider)]);
    });

    it("unregisters providers by id", () => {
        const registry = new VoiceAgentRegistry();
        registry.register("plugin-elevenlabs", {
            id: "elevenlabs",
            label: "ElevenLabs",
            startSession: async () => ({
                agentId: "agent-1",
                overrides: {}
            })
        });

        registry.unregister("elevenlabs");

        expect(registry.get("elevenlabs")).toBeNull();
        expect(registry.list()).toEqual([]);
    });

    it("unregisters all providers for a plugin", () => {
        const registry = new VoiceAgentRegistry();
        registry.register("plugin-elevenlabs", {
            id: "elevenlabs-a",
            label: "ElevenLabs A",
            startSession: async () => ({
                agentId: "agent-a",
                overrides: {}
            })
        });
        registry.register("plugin-elevenlabs", {
            id: "elevenlabs-b",
            label: "ElevenLabs B",
            startSession: async () => ({
                agentId: "agent-b",
                overrides: {}
            })
        });
        registry.register("plugin-other", {
            id: "other",
            label: "Other",
            startSession: async () => ({
                agentId: "agent-other",
                overrides: {}
            })
        });

        registry.unregisterByPlugin("plugin-elevenlabs");

        expect(registry.get("elevenlabs-a")).toBeNull();
        expect(registry.get("elevenlabs-b")).toBeNull();
        expect(registry.get("other")).toEqual(
            expect.objectContaining({
                id: "other",
                label: "Other"
            })
        );
    });
});
