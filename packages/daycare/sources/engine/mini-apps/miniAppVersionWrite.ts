import { promises as fs } from "node:fs";
import path from "node:path";
import { miniAppFilePathNormalize } from "./miniAppFilePathNormalize.js";
import type { MiniAppFileInput } from "./miniAppTypes.js";

type MiniAppVersionWriteInput = {
    directory: string;
    html: string;
    files?: MiniAppFileInput[];
    deletePaths?: string[];
};

/**
 * Applies one mini-app code revision's file set inside a prepared directory.
 * Expects: directory exists and belongs to exactly one app codeVersion.
 */
export async function miniAppVersionWrite(input: MiniAppVersionWriteInput): Promise<void> {
    for (const rawPath of input.deletePaths ?? []) {
        const normalized = miniAppFilePathNormalize(rawPath);
        await fs.rm(path.join(input.directory, normalized), { recursive: true, force: true });
    }

    await fs.mkdir(input.directory, { recursive: true });
    await fs.writeFile(path.join(input.directory, "index.html"), input.html, "utf8");

    for (const file of input.files ?? []) {
        const normalized = miniAppFilePathNormalize(file.path);
        const absolutePath = path.join(input.directory, normalized);
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        const content =
            file.encoding === "base64" ? Buffer.from(file.content, "base64") : Buffer.from(file.content, "utf8");
        await fs.writeFile(absolutePath, content);
    }
}
