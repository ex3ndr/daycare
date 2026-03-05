import path from "node:path";

import type { FileReference, ToolExecutionContext } from "@/types";
import { sanitizeFilename } from "../../../utils/filename.js";

export type FileResolveArgs = {
    path: string;
    name?: string;
    mimeType: string;
};

/**
 * Resolves a sandbox file path to a persisted FileReference in ~/downloads.
 * Expects: args.path points to a readable binary file and args.mimeType is set.
 */
export async function fileResolve(args: FileResolveArgs, context: ToolExecutionContext): Promise<FileReference> {
    if (!args.path || args.path.length === 0) {
        throw new Error("path is required");
    }
    if (!args.mimeType) {
        throw new Error("mimeType is required when sending a path");
    }

    const readResult = await context.sandbox.read({ path: args.path, binary: true });
    if (readResult.type !== "binary") {
        throw new Error("Path is not a file");
    }

    const name = sanitizeFilename(args.name ?? path.basename(readResult.displayPath));
    const stored = await context.sandbox.write({
        path: `~/downloads/${name}`,
        content: readResult.content
    });

    return {
        id: stored.sandboxPath,
        name,
        mimeType: args.mimeType,
        size: stored.bytes,
        path: stored.resolvedPath
    };
}
