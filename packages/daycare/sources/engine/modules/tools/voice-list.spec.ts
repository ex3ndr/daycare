import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { Sandbox } from "../../../sandbox/sandbox.js";
import { SpeechGenerationRegistry } from "../speechGenerationRegistry.js";
import { buildVoiceListTool } from "./voice-list.js";

describe("buildVoiceListTool", () => {
    it("lists voices from providers that support discovery", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-voice-list-tool-"));
        try {
            const listVoices = vi.fn(async () => [
                { id: "voice-1", description: "Voice One (English)" },
                { id: "voice-2", description: "Voice Two (Spanish)" }
            ]);
            const registry = new SpeechGenerationRegistry();
            registry.register("plugin-a", {
                id: "provider-a",
                label: "Provider A",
                generate: vi.fn(async () => ({ files: [] })),
                listVoices
            });

            const result = await buildVoiceListTool(registry).execute({}, contextBuild(tempDir), {
                id: "call-1",
                name: "list_voices"
            });

            expect(listVoices).toHaveBeenCalledTimes(1);
            expect(result.typedResult.voices).toEqual([
                { id: "voice-1", description: "Voice One (English)", provider: "provider-a" },
                { id: "voice-2", description: "Voice Two (Spanish)", provider: "provider-a" }
            ]);
            expect(result.typedResult.summary).toContain("Found 2 voice(s)");
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it("returns empty voice list and note for provider without listVoices", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-voice-list-tool-"));
        try {
            const registry = new SpeechGenerationRegistry();
            registry.register("plugin-a", {
                id: "provider-a",
                label: "Provider A",
                generate: vi.fn(async () => ({ files: [] }))
            });

            const result = await buildVoiceListTool(registry).execute({}, contextBuild(tempDir), {
                id: "call-2",
                name: "list_voices"
            });

            expect(result.typedResult.voices).toEqual([]);
            expect(result.typedResult.summary).toContain("does not support voice listing");
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it("aggregates voices across multiple providers", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-voice-list-tool-"));
        try {
            const registry = new SpeechGenerationRegistry();
            registry.register("plugin-a", {
                id: "provider-a",
                label: "Provider A",
                generate: vi.fn(async () => ({ files: [] })),
                listVoices: vi.fn(async () => [{ id: "voice-1", description: "Voice One (English)" }])
            });
            registry.register("plugin-b", {
                id: "provider-b",
                label: "Provider B",
                generate: vi.fn(async () => ({ files: [] })),
                listVoices: vi.fn(async () => [{ id: "voice-2", description: "Voice Two (French)" }])
            });

            const result = await buildVoiceListTool(registry).execute({}, contextBuild(tempDir), {
                id: "call-3",
                name: "list_voices"
            });

            expect(result.typedResult.voices).toEqual([
                { id: "voice-1", description: "Voice One (English)", provider: "provider-a" },
                { id: "voice-2", description: "Voice Two (French)", provider: "provider-b" }
            ]);
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });
});

function contextBuild(workingDir: string): ToolExecutionContext {
    const permissions = {
        workingDir,
        writeDirs: [workingDir]
    };
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: new Sandbox({
            homeDir: workingDir,
            permissions
        }),
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: { id: "agent-test" } as unknown as ToolExecutionContext["agent"],
        ctx: null as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {} as unknown as ToolExecutionContext["messageContext"],
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}
