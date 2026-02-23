import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
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
            const workingDir = context.sandbox.workingDir;
            if (!workingDir) {
                throw new Error("Workspace is not configured.");
            }

            const readResult = await context.sandbox.read({
                path: payload.path,
                binary: true
            });
            if (readResult.type !== "binary") {
                throw new Error("Path is not a regular file.");
            }
            const pdfBuffer = readResult.content;
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
            const displayPath = readResult.displayPath;
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
