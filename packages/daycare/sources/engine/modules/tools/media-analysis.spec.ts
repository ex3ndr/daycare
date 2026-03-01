import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { Sandbox } from "../../../sandbox/sandbox.js";
import { mediaPromptDefault } from "../media-analysis/mediaPromptDefault.js";
import type { MediaAnalysisProvider } from "../media-analysis/types.js";
import { MediaAnalysisRegistry } from "../mediaAnalysisRegistry.js";
import { buildMediaAnalysisTool } from "./media-analysis.js";

describe("buildMediaAnalysisTool", () => {
    it("analyzes media with a routed provider", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-media-tool-"));
        try {
            const filePath = path.join(tempDir, "image.png");
            await fs.writeFile(filePath, Buffer.from("fake-image"));

            const imageAnalyze = vi.fn(async () => ({ text: "analysis text" }));
            const registry = new MediaAnalysisRegistry();
            registry.register(
                "plugin-video",
                providerBuild(
                    "video-provider",
                    ["video"],
                    vi.fn(async () => ({ text: "" }))
                )
            );
            registry.register("plugin-image", providerBuild("image-provider", ["image"], imageAnalyze));

            const result = await buildMediaAnalysisTool(registry).execute(
                { path: filePath, prompt: "Describe the image" },
                contextBuild(tempDir),
                { id: "call-1", name: "media_analyze" }
            );

            expect(result.typedResult).toEqual({
                text: "analysis text",
                provider: "image-provider",
                mediaType: "image"
            });
            expect(imageAnalyze).toHaveBeenCalledWith(
                expect.objectContaining({
                    filePath: expect.stringMatching(/image\.png$/),
                    mimeType: "image/png",
                    mediaType: "image",
                    prompt: "Describe the image"
                }),
                expect.any(Object)
            );
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it("uses default prompt when prompt is omitted", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-media-tool-"));
        try {
            const filePath = path.join(tempDir, "audio.mp3");
            await fs.writeFile(filePath, Buffer.from("fake-audio"));

            const analyze = vi.fn(async () => ({ text: "audio analysis" }));
            const registry = new MediaAnalysisRegistry();
            registry.register("plugin-audio", providerBuild("audio-provider", ["audio"], analyze));

            await buildMediaAnalysisTool(registry).execute({ path: filePath }, contextBuild(tempDir), {
                id: "call-2",
                name: "media_analyze"
            });

            expect(analyze).toHaveBeenCalledWith(
                expect.objectContaining({
                    prompt: mediaPromptDefault("audio")
                }),
                expect.any(Object)
            );
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it("throws when no providers are registered", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-media-tool-"));
        try {
            const filePath = path.join(tempDir, "image.png");
            await fs.writeFile(filePath, Buffer.from("fake-image"));
            const registry = new MediaAnalysisRegistry();

            await expect(
                buildMediaAnalysisTool(registry).execute({ path: filePath }, contextBuild(tempDir), {
                    id: "call-3",
                    name: "media_analyze"
                })
            ).rejects.toThrow("No media analysis providers available");
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it("throws when provider id is unknown", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-media-tool-"));
        try {
            const filePath = path.join(tempDir, "image.png");
            await fs.writeFile(filePath, Buffer.from("fake-image"));
            const registry = new MediaAnalysisRegistry();
            registry.register(
                "plugin-image",
                providerBuild(
                    "image-provider",
                    ["image"],
                    vi.fn(async () => ({ text: "ok" }))
                )
            );

            await expect(
                buildMediaAnalysisTool(registry).execute(
                    { path: filePath, provider: "missing-provider" },
                    contextBuild(tempDir),
                    { id: "call-4", name: "media_analyze" }
                )
            ).rejects.toThrow("Unknown media analysis provider: missing-provider");
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it("throws when media type is unsupported", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-media-tool-"));
        try {
            const filePath = path.join(tempDir, "notes.txt");
            await fs.writeFile(filePath, "hello", "utf8");
            const registry = new MediaAnalysisRegistry();
            registry.register(
                "plugin-image",
                providerBuild(
                    "image-provider",
                    ["image"],
                    vi.fn(async () => ({ text: "ok" }))
                )
            );

            await expect(
                buildMediaAnalysisTool(registry).execute({ path: filePath }, contextBuild(tempDir), {
                    id: "call-5",
                    name: "media_analyze"
                })
            ).rejects.toThrow(`Unsupported media type: ${filePath}`);
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });
});

function providerBuild(
    id: string,
    supportedTypes: MediaAnalysisProvider["supportedTypes"],
    analyze: MediaAnalysisProvider["analyze"]
): MediaAnalysisProvider {
    return {
        id,
        label: id,
        supportedTypes,
        analyze
    };
}

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
