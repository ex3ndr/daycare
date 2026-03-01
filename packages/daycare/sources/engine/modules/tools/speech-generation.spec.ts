import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { Sandbox } from "../../../sandbox/sandbox.js";
import { SpeechGenerationRegistry } from "../speechGenerationRegistry.js";
import { buildSpeechGenerationTool } from "./speech-generation.js";

describe("buildSpeechGenerationTool", () => {
    it("returns file path references without embedding audio bytes", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-speech-tool-"));
        try {
            const sourcePath = path.join(tempDir, "source.mp3");
            await fs.writeFile(sourcePath, Buffer.from("mp3-bytes"));
            const generate = vi.fn(async () => ({
                files: [
                    {
                        id: "file-1",
                        name: "source.mp3",
                        mimeType: "audio/mpeg",
                        size: 9,
                        path: sourcePath
                    }
                ]
            }));

            const speechRegistry = new SpeechGenerationRegistry();
            speechRegistry.register("test-plugin", {
                id: "test-provider",
                label: "Test Provider",
                generate
            });

            const tool = buildSpeechGenerationTool(speechRegistry);
            const result = await tool.execute(
                {
                    text: "Hello world",
                    voice: "alloy",
                    output_format: "mp3"
                },
                contextBuild(tempDir),
                {
                    id: "call-1",
                    name: "generate_speech"
                }
            );

            expect(generate).toHaveBeenCalledWith(
                expect.objectContaining({
                    text: "Hello world",
                    voice: "alloy",
                    outputFormat: "mp3"
                }),
                expect.any(Object)
            );
            const downloads = result.toolMessage.details?.downloads as
                | { dir: string; files: Array<{ path: string; name: string }> }
                | undefined;
            expect(downloads?.dir).toBe("~/downloads");
            expect(downloads?.files).toHaveLength(1);
            const generatedPath = downloads?.files[0]?.path;
            const generatedName = downloads?.files[0]?.name;
            expect(generatedPath).toBeTruthy();
            if (!generatedPath || !generatedName) {
                throw new Error("Missing generated file path");
            }
            const hostFilePath = path.join(tempDir, "downloads", generatedName);
            const generatedData = await fs.readFile(hostFilePath, "utf8");
            expect(generatedData).toBe("mp3-bytes");
            expect(result.typedResult.generated).toEqual([
                expect.objectContaining({
                    name: expect.stringMatching(/\.mp3$/),
                    path: generatedPath,
                    mimeType: "audio/mpeg",
                    size: 9
                })
            ]);
            expect(result.typedResult.summary).toContain(generatedPath);
            const content = result.toolMessage.content as Array<{ type: string; data?: string; text?: string }>;
            expect(content.every((block) => block.type === "text")).toBe(true);
            expect(content.some((block) => (block.text ?? "").includes(generatedPath))).toBe(true);
            expect(content.every((block) => !("data" in block))).toBe(true);
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it("throws when no providers are registered", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-speech-tool-"));
        try {
            const registry = new SpeechGenerationRegistry();

            await expect(
                buildSpeechGenerationTool(registry).execute({ text: "hello" }, contextBuild(tempDir), {
                    id: "call-2",
                    name: "generate_speech"
                })
            ).rejects.toThrow("No speech generation providers available");
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it("throws when provider id is unknown", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-speech-tool-"));
        try {
            const registry = new SpeechGenerationRegistry();
            registry.register("plugin-a", {
                id: "provider-a",
                label: "Provider A",
                generate: vi.fn(async () => ({ files: [] }))
            });

            await expect(
                buildSpeechGenerationTool(registry).execute(
                    { text: "hello", provider: "missing-provider" },
                    contextBuild(tempDir),
                    {
                        id: "call-3",
                        name: "generate_speech"
                    }
                )
            ).rejects.toThrow("Unknown speech provider: missing-provider");
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it("throws when multiple providers are available without explicit selection", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-speech-tool-"));
        try {
            const registry = new SpeechGenerationRegistry();
            registry.register("plugin-a", {
                id: "provider-a",
                label: "Provider A",
                generate: vi.fn(async () => ({ files: [] }))
            });
            registry.register("plugin-b", {
                id: "provider-b",
                label: "Provider B",
                generate: vi.fn(async () => ({ files: [] }))
            });

            await expect(
                buildSpeechGenerationTool(registry).execute({ text: "hello" }, contextBuild(tempDir), {
                    id: "call-4",
                    name: "generate_speech"
                })
            ).rejects.toThrow("Multiple speech providers available; specify provider");
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
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"]
    };
}
