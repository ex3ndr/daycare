import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { pdfProcessTool } from "./pdfProcessTool.js";

const mockState = vi.hoisted(() => ({
    numPages: 1,
    textByPage: ["Hello PDF"],
    renderCount: 0
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
    getDocument: () => ({
        promise: Promise.resolve({
            numPages: mockState.numPages,
            getPage: async (pageNumber: number) => ({
                getTextContent: async () => ({
                    items: [{ str: mockState.textByPage[pageNumber - 1] ?? "" }]
                }),
                getViewport: ({ scale }: { scale: number }) => ({
                    width: 1200 * scale,
                    height: 800 * scale
                }),
                render: () => {
                    mockState.renderCount += 1;
                    return { promise: Promise.resolve() };
                }
            })
        })
    })
}));

vi.mock("@napi-rs/canvas", () => ({
    createCanvas: () => ({
        getContext: () => ({}),
        toBuffer: () => Buffer.from("png-data")
    })
}));

const toolCall = { id: "tool-call-1", name: "pdf_process" };

describe("pdfProcessTool", () => {
    let workingDir: string;

    beforeEach(async () => {
        workingDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-pdf-tool-"));
        mockState.numPages = 1;
        mockState.textByPage = ["Hello PDF"];
        mockState.renderCount = 0;
    });

    afterEach(async () => {
        await fs.rm(workingDir, { recursive: true, force: true });
    });

    it("extracts text from pdf pages", async () => {
        const pdfPath = path.join(workingDir, "report.pdf");
        await fs.writeFile(pdfPath, Buffer.from("%PDF-1.7\nmock"));

        const result = await pdfProcessTool().execute(
            { path: pdfPath, minTextChars: 1 },
            contextCreate(workingDir),
            toolCall
        );

        expect(result.toolMessage.isError).toBe(false);
        expect(result.typedResult.text).toContain("Hello PDF");
        expect(result.typedResult.imageCount).toBe(0);
        expect(mockState.renderCount).toBe(0);
    });

    it("renders page images when text is below threshold", async () => {
        const pdfPath = path.join(workingDir, "scanned.pdf");
        await fs.writeFile(pdfPath, Buffer.from("%PDF-1.7\nmock"));
        mockState.textByPage = [""];

        const result = await pdfProcessTool().execute(
            { path: pdfPath, minTextChars: 200, includeImagesWhenTextMissing: true },
            contextCreate(workingDir),
            toolCall
        );

        expect(result.toolMessage.isError).toBe(false);
        expect(result.typedResult.imageCount).toBe(1);
        expect(result.toolMessage.content.some((part) => part.type === "image")).toBe(true);
        expect(mockState.renderCount).toBe(1);
    });

    it("rejects non-pdf files", async () => {
        const txtPath = path.join(workingDir, "note.txt");
        await fs.writeFile(txtPath, "hello", "utf8");

        await expect(pdfProcessTool().execute({ path: txtPath }, contextCreate(workingDir), toolCall)).rejects.toThrow(
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
            writeDirs: [],
            readDirs: [],
            network: false,
            events: false
        },
        agent: null as unknown as ToolExecutionContext["agent"],
        ctx: null as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}
