import { promises as fs } from "node:fs";
import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { sandboxCanRead } from "../../../sandbox/sandboxCanRead.js";
import { isWithinSecure, openSecure } from "../../permissions/pathResolveSecure.js";
import { pdfExtract, pdfSignatureIs } from "../media/pdfExtract.js";

const DEFAULT_PDF_MAX_CHARS = 20_000;

const schema = Type.Object(
    {
        path: Type.String({ minLength: 1 }),
        maxPages: Type.Optional(Type.Integer({ minimum: 1, maximum: 32 })),
        maxPixels: Type.Optional(Type.Integer({ minimum: 1, maximum: 64_000_000 })),
        minTextChars: Type.Optional(Type.Integer({ minimum: 0, maximum: 200_000 })),
        maxChars: Type.Optional(Type.Integer({ minimum: 1, maximum: 200_000 })),
        includeImagesWhenTextMissing: Type.Optional(Type.Boolean())
    },
    { additionalProperties: false }
);

type PdfProcessArgs = Static<typeof schema>;

const pdfProcessResultSchema = Type.Object(
    {
        summary: Type.String(),
        path: Type.String(),
        pagesProcessed: Type.Number(),
        totalPages: Type.Number(),
        textChars: Type.Number(),
        imageCount: Type.Number(),
        text: Type.String()
    },
    { additionalProperties: false }
);

type PdfProcessResult = Static<typeof pdfProcessResultSchema>;

const pdfProcessReturns: ToolResultContract<PdfProcessResult> = {
    schema: pdfProcessResultSchema,
    toLLMText: (result) => {
        if (result.text.length > 0) {
            return [result.summary, "", "Extracted text:", result.text].join("\n");
        }
        return result.summary;
    }
};

/**
 * Builds the system PDF processing tool.
 * Expects: path points to a PDF inside readable filesystem scope.
 */
export function pdfProcessTool(): ToolDefinition<typeof schema, PdfProcessResult> {
    return {
        tool: {
            name: "pdf_process",
            description:
                "Extract text from a PDF file. If extracted text is too short, optionally render page images for scanned PDFs.",
            parameters: schema
        },
        returns: pdfProcessReturns,
        execute: async (args, context, toolCall) => {
            const payload = args as PdfProcessArgs;
            const workingDir = context.permissions.workingDir;
            if (!workingDir) {
                throw new Error("Workspace is not configured.");
            }

            const normalizedPath = path.isAbsolute(payload.path)
                ? path.resolve(payload.path)
                : path.resolve(workingDir, payload.path);
            const resolvedPath = await sandboxCanRead(context.permissions, normalizedPath);
            const pdfBuffer = await pdfBufferReadSecure(resolvedPath);
            if (!pdfSignatureIs(pdfBuffer)) {
                throw new Error("Path is not a PDF file.");
            }

            const extracted = await pdfExtract(pdfBuffer, {
                maxPages: payload.maxPages,
                maxPixels: payload.maxPixels,
                minTextChars: payload.minTextChars,
                includeImagesWhenTextMissing: payload.includeImagesWhenTextMissing,
                logger: context.logger
            });
            const clampedText = textClamp(extracted.text, payload.maxChars ?? DEFAULT_PDF_MAX_CHARS);
            const displayPath = displayPathFormat(workingDir, resolvedPath);
            const summary = [
                `Processed PDF: ${displayPath}`,
                `pages=${extracted.pagesProcessed}/${extracted.totalPages}`,
                `text_chars=${clampedText.length}`,
                `images=${extracted.images.length}`
            ].join(" ");

            const textPart = pdfTextPartBuild(summary, clampedText);
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [textPart, ...extracted.images],
                details: {
                    path: displayPath,
                    pagesProcessed: extracted.pagesProcessed,
                    totalPages: extracted.totalPages,
                    textChars: clampedText.length,
                    imageCount: extracted.images.length
                },
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    path: displayPath,
                    pagesProcessed: extracted.pagesProcessed,
                    totalPages: extracted.totalPages,
                    textChars: clampedText.length,
                    imageCount: extracted.images.length,
                    text: clampedText
                }
            };
        }
    };
}

async function pdfBufferReadSecure(resolvedPath: string): Promise<Buffer> {
    const stats = await fs.lstat(resolvedPath);
    if (stats.isSymbolicLink()) {
        throw new Error("Cannot process symbolic link.");
    }
    if (!stats.isFile()) {
        throw new Error("Path is not a file.");
    }

    const handle = await openSecure(resolvedPath, "r");
    try {
        const handleStats = await handle.stat();
        if (!handleStats.isFile()) {
            throw new Error("Path is not a file.");
        }
        const data = await handle.readFile();
        return Buffer.isBuffer(data) ? data : Buffer.from(data);
    } finally {
        await handle.close();
    }
}

function textClamp(text: string, maxChars: number): string {
    if (text.length <= maxChars) {
        return text;
    }
    return text.slice(0, maxChars);
}

function pdfTextPartBuild(summary: string, text: string): { type: "text"; text: string } {
    if (text.length === 0) {
        return {
            type: "text",
            text: `${summary}\n\nNo extractable text found in processed pages.`
        };
    }
    return {
        type: "text",
        text: `${summary}\n\nExtracted text:\n${text}`
    };
}

function displayPathFormat(workingDir: string, target: string): string {
    if (isWithinSecure(workingDir, target)) {
        return path.relative(workingDir, target) || ".";
    }
    return target;
}
