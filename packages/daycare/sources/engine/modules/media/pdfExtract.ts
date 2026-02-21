import type { Logger } from "pino";

const MODULE_ID = "@napi-rs/canvas";

export const PDF_DEFAULT_MAX_PAGES = 4;
export const PDF_DEFAULT_MAX_PIXELS = 4_000_000;
export const PDF_DEFAULT_MIN_TEXT_CHARS = 200;

export type PdfExtractImage = {
    type: "image";
    data: string;
    mimeType: "image/png";
};

export type PdfExtractOptions = {
    maxPages?: number;
    maxPixels?: number;
    minTextChars?: number;
    includeImagesWhenTextMissing?: boolean;
    logger?: Logger;
};

export type PdfExtractResult = {
    text: string;
    images: PdfExtractImage[];
    pagesProcessed: number;
    totalPages: number;
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

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;
let canvasModulePromise: Promise<CanvasModule> | null = null;

/**
 * Extracts PDF text and falls back to page image rendering when text is sparse.
 * Expects: input buffer is a valid PDF payload.
 */
export async function pdfExtract(buffer: Buffer, options: PdfExtractOptions = {}): Promise<PdfExtractResult> {
    const maxPages = options.maxPages ?? PDF_DEFAULT_MAX_PAGES;
    const maxPixels = options.maxPixels ?? PDF_DEFAULT_MAX_PIXELS;
    const minTextChars = options.minTextChars ?? PDF_DEFAULT_MIN_TEXT_CHARS;
    const includeImages = options.includeImagesWhenTextMissing ?? true;
    const pdfJs = await pdfJsModuleLoad();
    const pdf = await pdfJs.getDocument({
        data: new Uint8Array(buffer),
        disableWorker: true
    }).promise;
    const pagesProcessed = Math.min(pdf.numPages, maxPages);
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
    if (!includeImages || text.trim().length >= minTextChars) {
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
        options.logger?.warn({ error }, "warn: PDF page image rendering skipped");
        return {
            text,
            images: [],
            pagesProcessed,
            totalPages: pdf.numPages
        };
    }

    const images: PdfExtractImage[] = [];
    for (let pageNumber = 1; pageNumber <= pagesProcessed; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const pixelBudget = Math.max(1, maxPixels);
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

/**
 * Checks whether a buffer starts with a PDF file signature.
 * Expects: any binary payload.
 */
export function pdfSignatureIs(data: Buffer): boolean {
    const signature = "%PDF-";
    if (data.length < signature.length) {
        return false;
    }
    return data.subarray(0, signature.length).toString("ascii") === signature;
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
        canvasModulePromise = import(MODULE_ID)
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
