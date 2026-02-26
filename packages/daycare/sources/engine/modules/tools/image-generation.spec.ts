import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { Sandbox } from "../../../sandbox/sandbox.js";
import { ImageGenerationRegistry } from "../imageGenerationRegistry.js";
import { buildImageGenerationTool } from "./image-generation.js";

describe("buildImageGenerationTool", () => {
    it("returns file path references without embedding image bytes", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-image-tool-"));
        try {
            const sourcePath = path.join(tempDir, "source.png");
            await fs.writeFile(sourcePath, Buffer.from("png-bytes"));

            const imageRegistry = new ImageGenerationRegistry();
            imageRegistry.register("test-plugin", {
                id: "test-provider",
                label: "Test Provider",
                generate: async () => ({
                    files: [
                        {
                            id: "file-1",
                            name: "source.png",
                            mimeType: "image/png",
                            size: 9,
                            path: sourcePath
                        }
                    ]
                })
            });

            const tool = buildImageGenerationTool(imageRegistry);
            const result = await tool.execute({ prompt: "draw" }, contextBuild(tempDir), {
                id: "call-1",
                name: "generate_image"
            });

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
            // Verify file was actually written to host filesystem
            const hostFilePath = path.join(tempDir, "downloads", generatedName);
            const generatedData = await fs.readFile(hostFilePath, "utf8");
            expect(generatedData).toBe("png-bytes");
            expect(result.typedResult.generated).toEqual([
                expect.objectContaining({
                    name: expect.stringMatching(/\.png$/),
                    path: generatedPath,
                    mimeType: "image/png",
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
