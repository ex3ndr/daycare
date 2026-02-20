import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { ToolExecutionContext } from "@/types";
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

            const workspace = result.toolMessage.details?.workspace as
                | { dir: string; files: Array<{ path: string }> }
                | undefined;
            expect(workspace?.dir).toBe(path.join(tempDir, "files"));
            expect(workspace?.files).toHaveLength(1);
            const generatedPath = workspace?.files[0]?.path;
            expect(generatedPath).toBeTruthy();
            if (!generatedPath) {
                throw new Error("Missing generated file path");
            }
            const generatedData = await fs.readFile(generatedPath, "utf8");
            expect(generatedData).toBe("png-bytes");
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
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        fileStore: null as unknown as ToolExecutionContext["fileStore"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        permissions: {
            workingDir,
            writeDirs: [],
            readDirs: [],
            network: false,
            events: false
        },
        agent: { id: "agent-test" } as unknown as ToolExecutionContext["agent"],
        agentContext: null as unknown as ToolExecutionContext["agentContext"],
        source: "test",
        messageContext: {} as unknown as ToolExecutionContext["messageContext"],
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}
