import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { pdfProcessTool } from "./pdf-process.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const fixturePdfPath = path.resolve(currentDir, "..", "media", "__testdata__", "dummy.pdf");
const toolCall = { id: "tool-call-1", name: "pdf_process" };

describe("pdfProcessTool", () => {
    const tempDirs: string[] = [];

    afterEach(async () => {
        for (const dir of tempDirs) {
            await fs.rm(dir, { recursive: true, force: true });
        }
        tempDirs.length = 0;
    });

    it("processes a real fixture pdf", async () => {
        const result = await pdfProcessTool().execute(
            {
                path: fixturePdfPath,
                minTextChars: 1,
                includeImagesWhenTextMissing: false
            },
            contextCreate(path.dirname(fixturePdfPath)),
            toolCall
        );

        expect(result.toolMessage.isError).toBe(false);
        expect(result.typedResult.totalPages).toBe(1);
        expect(result.typedResult.text).toContain("Dummy PDF file");
        expect(result.typedResult.imageCount).toBe(0);
    });

    it("rejects non-pdf files", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-pdf-tool-"));
        tempDirs.push(tempDir);
        const txtPath = path.join(tempDir, "note.txt");
        await fs.writeFile(txtPath, "hello", "utf8");

        await expect(pdfProcessTool().execute({ path: txtPath }, contextCreate(tempDir), toolCall)).rejects.toThrow(
            "Path is not a PDF file."
        );
    });
});

function contextCreate(workingDir: string): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        fileStore: null as unknown as ToolExecutionContext["fileStore"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: { warn: vi.fn() } as unknown as ToolExecutionContext["logger"],
        assistant: null,
        permissions: {
            workingDir,
            writeDirs: []
        },
        agent: null as unknown as ToolExecutionContext["agent"],
        ctx: null as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}
