import { promises as fs } from "node:fs";
import path from "node:path";

import { createId } from "@paralleldrive/cuid2";
import type { StoredFile } from "../../files/types.js";
import { sanitizeFilename } from "../../utils/filename.js";

/**
 * Stores files into a single filesystem folder.
 * Expects: basePath points to a writable directory location.
 */
export class FileFolder {
    readonly path: string;

    constructor(basePath: string) {
        this.path = path.resolve(basePath);
    }

    async saveBuffer(options: { name: string; mimeType: string; data: Buffer }): Promise<StoredFile> {
        await this.ensureDir();
        const id = createId();
        const filename = `${id}__${sanitizeFilename(options.name)}`;
        const filePath = path.join(this.path, filename);
        await fs.writeFile(filePath, options.data);
        const stats = await fs.stat(filePath);
        return {
            id,
            name: options.name,
            path: filePath,
            mimeType: options.mimeType,
            size: stats.size
        };
    }

    async saveFromPath(options: { name: string; mimeType: string; path: string }): Promise<StoredFile> {
        await this.ensureDir();
        const id = createId();
        const filename = `${id}__${sanitizeFilename(options.name)}`;
        const filePath = path.join(this.path, filename);
        await fs.copyFile(options.path, filePath);
        const stats = await fs.stat(filePath);
        return {
            id,
            name: options.name,
            path: filePath,
            mimeType: options.mimeType,
            size: stats.size
        };
    }

    private async ensureDir(): Promise<void> {
        await fs.mkdir(this.path, { recursive: true });
    }
}
