import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { isWithinSecure, openSecure } from "../../engine/permissions/pathResolveSecure.js";
import { sandboxCanRead } from "../../sandbox/sandboxCanRead.js";

const DEFAULT_PDF_MAX_PAGES = 4;
const DEFAULT_PDF_MAX_PIXELS = 4_000_000;
const DEFAULT_PDF_MIN_TEXT_CHARS = 200;
const DEFAULT_PDF_MAX_CHARS = 20_000;
const PDF_HEADER = "%PDF-";
const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
const NARROW_NO_BREAK_SPACE = "\u202F";

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

type PdfTextItem = {
    str?: unknown;
};

type PdfTextContent = {
    items: PdfTextItem[];
};

type PdfViewport = {
    width: number;
    height: number;
};

type PdfRenderTask = {
    promise: Promise<void>;
};

type PdfPage = {
    getTextContent(): Promise<PdfTextContent>;
    getViewport(options: { scale: number }): PdfViewport;
    render(options: { viewport: PdfViewport; canvas?: unknown; canvasContext?: unknown }): PdfRenderTask;
};

type PdfDocument = {
    numPages: number;
    getPage(pageNumber: number): Promise<PdfPage>;
};

type PdfJsModule = {
    getDocument(options: { data: Uint8Array; disableWorker: boolean }): { promise: Promise<PdfDocument> };
};

type CanvasLike = {
    getContext?(kind: "2d"): unknown;
    toBuffer(type: "image/png"): Buffer;
};

type CanvasModule = {
    createCanvas(width: number, height: number): CanvasLike;
};

type ExtractedPdfContent = {
    text: string;
    images: Array<{ type: "image"; data: string; mimeType: string }>;
    pagesProcessed: number;
    totalPages: number;
};

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;
let canvasModulePromise: Promise<CanvasModule> | null = null;

/**
 * Builds a PDF processing tool that extracts text and, when needed, page images.
 * Expects: args.path points to an existing PDF file readable by current permissions.
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

            const resolvedInputPath = await readInputPathResolve(payload.path, workingDir);
            const resolvedPath = await sandboxCanRead(context.permissions, resolvedInputPath);
            const pdfBuffer = await readPdfBufferSecure(resolvedPath);
            if (!pdfHeaderIs(pdfBuffer)) {
                throw new Error("Path is not a PDF file.");
            }

            const extracted = await extractPdfContent({
                buffer: pdfBuffer,
                maxPages: payload.maxPages ?? DEFAULT_PDF_MAX_PAGES,
                maxPixels: payload.maxPixels ?? DEFAULT_PDF_MAX_PIXELS,
                minTextChars: payload.minTextChars ?? DEFAULT_PDF_MIN_TEXT_CHARS,
                includeImagesWhenTextMissing: payload.includeImagesWhenTextMissing ?? true,
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

async function extractPdfContent(input: {
    buffer: Buffer;
    maxPages: number;
    maxPixels: number;
    minTextChars: number;
    includeImagesWhenTextMissing: boolean;
    logger: { warn: (data: unknown, message?: string, ...args: unknown[]) => void };
}): Promise<ExtractedPdfContent> {
    const pdfJs = await pdfJsModuleLoad();
    const pdf = await pdfJs.getDocument({
        data: new Uint8Array(input.buffer),
        disableWorker: true
    }).promise;
    const pagesProcessed = Math.min(pdf.numPages, input.maxPages);
    const textParts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pagesProcessed; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item) => (typeof item.str === "string" ? item.str : ""))
            .filter((text) => text.length > 0)
            .join(" ");
        if (pageText.length > 0) {
            textParts.push(pageText);
        }
    }

    const text = textParts.join("\n\n");
    if (!input.includeImagesWhenTextMissing || text.trim().length >= input.minTextChars) {
        return {
            text,
            images: [],
            pagesProcessed,
            totalPages: pdf.numPages
        };
    }

    let canvasModule: CanvasModule;
    try {
        canvasModule = await canvasModuleLoad();
    } catch (error) {
        input.logger.warn({ error }, "warn: PDF page image rendering skipped");
        return {
            text,
            images: [],
            pagesProcessed,
            totalPages: pdf.numPages
        };
    }

    const images: Array<{ type: "image"; data: string; mimeType: string }> = [];
    for (let pageNumber = 1; pageNumber <= pagesProcessed; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const pixelBudget = Math.max(1, input.maxPixels);
        const pagePixels = Math.max(1, baseViewport.width * baseViewport.height);
        const scale = Math.min(1, Math.sqrt(pixelBudget / pagePixels));
        const scaledViewport = page.getViewport({ scale: Math.max(0.1, scale) });
        const canvas = canvasModule.createCanvas(
            Math.max(1, Math.ceil(scaledViewport.width)),
            Math.max(1, Math.ceil(scaledViewport.height))
        );
        const renderOptions: { viewport: PdfViewport; canvas?: unknown; canvasContext?: unknown } = {
            viewport: scaledViewport
        };
        const context2d = canvas.getContext?.("2d");
        if (context2d) {
            renderOptions.canvasContext = context2d;
        } else {
            renderOptions.canvas = canvas as unknown;
        }
        await page.render(renderOptions).promise;
        const png = canvas.toBuffer("image/png");
        images.push({
            type: "image",
            data: png.toString("base64"),
            mimeType: "image/png"
        });
    }

    return {
        text,
        images,
        pagesProcessed,
        totalPages: pdf.numPages
    };
}

async function readPdfBufferSecure(resolvedPath: string): Promise<Buffer> {
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

function pdfHeaderIs(data: Buffer): boolean {
    if (data.length < PDF_HEADER.length) {
        return false;
    }
    return data.subarray(0, PDF_HEADER.length).toString("ascii") === PDF_HEADER;
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

function normalizeReadPathUnicodeSpaces(value: string): string {
    return value.replace(UNICODE_SPACES, " ");
}

function normalizeReadPathAtPrefix(value: string): string {
    return value.startsWith("@") ? value.slice(1) : value;
}

function normalizeReadPathInput(rawPath: string): string {
    const normalized = normalizeReadPathUnicodeSpaces(normalizeReadPathAtPrefix(rawPath));
    if (normalized === "~") {
        return os.homedir();
    }
    if (normalized.startsWith("~/")) {
        return os.homedir() + normalized.slice(1);
    }
    return normalized;
}

async function pathExists(target: string): Promise<boolean> {
    try {
        await fs.access(target);
        return true;
    } catch {
        return false;
    }
}

function readPathTryMacOSScreenshotVariant(target: string): string {
    return target.replace(/ (AM|PM)\./g, `${NARROW_NO_BREAK_SPACE}$1.`);
}

function readPathTryNfdVariant(target: string): string {
    return target.normalize("NFD");
}

function readPathTryCurlyQuoteVariant(target: string): string {
    return target.replace(/'/g, "\u2019");
}

async function readInputPathResolve(rawPath: string, workingDir: string): Promise<string> {
    const normalized = normalizeReadPathInput(rawPath);
    const resolved = path.isAbsolute(normalized) ? normalized : path.resolve(workingDir, normalized);
    if (await pathExists(resolved)) {
        return resolved;
    }
    const amPmVariant = readPathTryMacOSScreenshotVariant(resolved);
    if (amPmVariant !== resolved && (await pathExists(amPmVariant))) {
        return amPmVariant;
    }
    const nfdVariant = readPathTryNfdVariant(resolved);
    if (nfdVariant !== resolved && (await pathExists(nfdVariant))) {
        return nfdVariant;
    }
    const curlyVariant = readPathTryCurlyQuoteVariant(resolved);
    if (curlyVariant !== resolved && (await pathExists(curlyVariant))) {
        return curlyVariant;
    }
    const nfdCurlyVariant = readPathTryCurlyQuoteVariant(nfdVariant);
    if (nfdCurlyVariant !== resolved && (await pathExists(nfdCurlyVariant))) {
        return nfdCurlyVariant;
    }
    return resolved;
}

function displayPathFormat(workingDir: string, target: string): string {
    if (isWithinSecure(workingDir, target)) {
        return path.relative(workingDir, target) || ".";
    }
    return target;
}

async function pdfJsModuleLoad(): Promise<PdfJsModule> {
    if (!pdfJsModulePromise) {
        pdfJsModulePromise = import("pdfjs-dist/legacy/build/pdf.mjs")
            .then((loaded) => loaded as unknown as PdfJsModule)
            .catch((error) => {
                pdfJsModulePromise = null;
                throw new Error(`pdfjs-dist is required for PDF processing: ${String(error)}`);
            });
    }
    return pdfJsModulePromise;
}

async function canvasModuleLoad(): Promise<CanvasModule> {
    if (!canvasModulePromise) {
        const moduleId = "@napi-rs/canvas";
        canvasModulePromise = import(moduleId)
            .then((loaded) => loaded as unknown as CanvasModule)
            .catch((error) => {
                canvasModulePromise = null;
                throw new Error(
                    `Optional dependency @napi-rs/canvas is required for PDF image rendering: ${String(error)}`
                );
            });
    }
    return canvasModulePromise;
}
