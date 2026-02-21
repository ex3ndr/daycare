import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pdfExtract, pdfSignatureIs } from "./pdfExtract.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const fixturePdfPath = path.join(currentDir, "__testdata__", "dummy.pdf");

describe("pdfExtract", () => {
    it("extracts text from real fixture pdf", async () => {
        const pdfBuffer = await fs.readFile(fixturePdfPath);
        const result = await pdfExtract(pdfBuffer, {
            includeImagesWhenTextMissing: false,
            minTextChars: 1
        });

        expect(result.totalPages).toBe(1);
        expect(result.pagesProcessed).toBe(1);
        expect(result.text).toContain("Dummy PDF file");
        expect(result.images.length).toBe(0);
    });

    it("checks pdf signature", () => {
        expect(pdfSignatureIs(Buffer.from("%PDF-1.7\n"))).toBe(true);
        expect(pdfSignatureIs(Buffer.from("not-a-pdf"))).toBe(false);
    });
});
