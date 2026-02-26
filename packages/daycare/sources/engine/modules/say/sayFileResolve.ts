import path from "node:path";

import type { Logger } from "pino";

import type { ConnectorFile, ConnectorFileDisposition, FileReference } from "@/types";
import type { Sandbox } from "../../../sandbox/sandbox.js";
import { sanitizeFilename } from "../../../util/filename.js";

export type SayFileResolveInput = {
    files: Array<{ path: string; mode: ConnectorFileDisposition }>;
    sandbox: Sandbox;
    logger: Logger;
};

/**
 * Resolves say-mode file descriptors into connector-ready files.
 * Expects: paths are absolute or workspace-relative to `sandbox.workingDir`.
 */
export async function sayFileResolve(input: SayFileResolveInput): Promise<ConnectorFile[]> {
    const resolved: ConnectorFile[] = [];

    for (const item of input.files) {
        try {
            const file = await sayFileReferenceResolve(item.path, input.sandbox);
            if (!file) {
                continue;
            }
            resolved.push({ ...file, sendAs: item.mode });
        } catch (error) {
            input.logger.warn({ path: item.path, error }, "warn: Failed to resolve <file> path; skipping");
        }
    }

    return resolved;
}

async function sayFileReferenceResolve(filePath: string, sandbox: Sandbox): Promise<FileReference | null> {
    const readResult = await sandbox.read({ path: filePath, binary: true });
    if (readResult.type !== "binary") {
        throw new Error("Path is not a file");
    }

    const name = sanitizeFilename(path.basename(readResult.displayPath));
    const saved = await sandbox.write({
        path: `~/downloads/${name}`,
        content: readResult.content
    });

    return {
        id: saved.sandboxPath,
        name,
        mimeType: mimeTypeResolve(readResult.displayPath),
        size: saved.bytes,
        path: saved.resolvedPath
    };
}

function mimeTypeResolve(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === ".png") return "image/png";
    if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
    if (extension === ".gif") return "image/gif";
    if (extension === ".webp") return "image/webp";
    if (extension === ".svg") return "image/svg+xml";
    if (extension === ".mp4") return "video/mp4";
    if (extension === ".mov") return "video/quicktime";
    if (extension === ".webm") return "video/webm";
    if (extension === ".pdf") return "application/pdf";
    if (extension === ".txt") return "text/plain";
    if (extension === ".md") return "text/markdown";
    if (extension === ".json") return "application/json";
    if (extension === ".csv") return "text/csv";
    return "application/octet-stream";
}
