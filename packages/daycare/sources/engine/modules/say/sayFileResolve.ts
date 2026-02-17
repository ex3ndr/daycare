import { promises as fs } from "node:fs";
import path from "node:path";

import type { Logger } from "pino";

import type {
  ConnectorFile,
  ConnectorFileDisposition,
  FileReference,
  SessionPermissions
} from "@/types";
import type { FileStore } from "../../../files/store.js";
import { openSecure, pathResolveSecure } from "../../permissions/pathResolveSecure.js";

export type SayFileResolveInput = {
  files: Array<{ path: string; mode: ConnectorFileDisposition }>;
  fileStore: FileStore;
  permissions: SessionPermissions;
  logger: Logger;
};

/**
 * Resolves say-mode file descriptors into connector-ready files.
 * Expects: paths are absolute or workspace-relative to `permissions.workingDir`.
 */
export async function sayFileResolve(input: SayFileResolveInput): Promise<ConnectorFile[]> {
  const resolved: ConnectorFile[] = [];

  for (const item of input.files) {
    try {
      const file = await sayFileReferenceResolve(item.path, input.fileStore, input.permissions);
      if (!file) {
        continue;
      }
      resolved.push({ ...file, sendAs: item.mode });
    } catch (error) {
      input.logger.warn(
        { path: item.path, error },
        "warn: Failed to resolve <file> path; skipping"
      );
    }
  }

  return resolved;
}

async function sayFileReferenceResolve(
  filePath: string,
  fileStore: FileStore,
  permissions: SessionPermissions
): Promise<FileReference | null> {
  const normalizedInputPath = pathNormalize(filePath, permissions.workingDir);
  const stored = await fileStorePathLookup(normalizedInputPath, fileStore);
  if (stored) {
    return stored;
  }

  const allowedDirs = [permissions.workingDir, ...permissions.readDirs];
  const { realPath } = await pathResolveSecure(allowedDirs, normalizedInputPath);

  const stats = await fs.lstat(realPath);
  if (stats.isSymbolicLink()) {
    throw new Error("Cannot send symbolic link");
  }
  if (!stats.isFile()) {
    throw new Error("Path is not a file");
  }

  const handle = await openSecure(realPath, "r");
  const handleStats = await handle.stat();
  await handle.close();
  if (!handleStats.isFile()) {
    throw new Error("Path is not a file");
  }

  const saved = await fileStore.saveFromPath({
    name: path.basename(realPath),
    mimeType: mimeTypeResolve(realPath),
    source: "say_file",
    path: realPath
  });

  return {
    id: saved.id,
    name: saved.name,
    mimeType: saved.mimeType,
    size: saved.size,
    path: saved.path
  };
}

function pathNormalize(filePath: string, workingDir: string): string {
  if (path.isAbsolute(filePath)) {
    return path.resolve(filePath);
  }
  return path.resolve(workingDir, filePath);
}

async function fileStorePathLookup(filePath: string, fileStore: FileStore): Promise<FileReference | null> {
  const baseName = path.basename(filePath);
  const separator = baseName.indexOf("__");
  if (separator <= 0) {
    return null;
  }

  const possibleId = baseName.slice(0, separator);
  const stored = await fileStore.get(possibleId);
  if (!stored) {
    return null;
  }
  if (path.resolve(stored.path) !== path.resolve(filePath)) {
    return null;
  }

  return {
    id: stored.id,
    name: stored.name,
    mimeType: stored.mimeType,
    size: stored.size,
    path: stored.path
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
