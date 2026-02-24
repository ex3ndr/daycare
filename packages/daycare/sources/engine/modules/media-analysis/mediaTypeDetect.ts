import path from "node:path";
import type { MediaType } from "./types.js";

type MediaTypeDetection = {
    mediaType: MediaType;
    mimeType: string;
};

const mediaExtensions: Record<string, MediaTypeDetection> = {
    ".png": { mediaType: "image", mimeType: "image/png" },
    ".jpg": { mediaType: "image", mimeType: "image/jpeg" },
    ".jpeg": { mediaType: "image", mimeType: "image/jpeg" },
    ".gif": { mediaType: "image", mimeType: "image/gif" },
    ".webp": { mediaType: "image", mimeType: "image/webp" },
    ".bmp": { mediaType: "image", mimeType: "image/bmp" },
    ".svg": { mediaType: "image", mimeType: "image/svg+xml" },
    ".tiff": { mediaType: "image", mimeType: "image/tiff" },
    ".avif": { mediaType: "image", mimeType: "image/avif" },
    ".heic": { mediaType: "image", mimeType: "image/heic" },
    ".mp4": { mediaType: "video", mimeType: "video/mp4" },
    ".mov": { mediaType: "video", mimeType: "video/quicktime" },
    ".avi": { mediaType: "video", mimeType: "video/x-msvideo" },
    ".mkv": { mediaType: "video", mimeType: "video/x-matroska" },
    ".webm": { mediaType: "video", mimeType: "video/webm" },
    ".flv": { mediaType: "video", mimeType: "video/x-flv" },
    ".mp3": { mediaType: "audio", mimeType: "audio/mpeg" },
    ".wav": { mediaType: "audio", mimeType: "audio/wav" },
    ".ogg": { mediaType: "audio", mimeType: "audio/ogg" },
    ".flac": { mediaType: "audio", mimeType: "audio/flac" },
    ".m4a": { mediaType: "audio", mimeType: "audio/mp4" },
    ".aac": { mediaType: "audio", mimeType: "audio/aac" },
    ".wma": { mediaType: "audio", mimeType: "audio/x-ms-wma" },
    ".pdf": { mediaType: "pdf", mimeType: "application/pdf" }
};

/**
 * Detects media type + mime type from file extension.
 * Expects: any file path string, absolute or relative.
 */
export function mediaTypeDetect(filePath: string): MediaTypeDetection | null {
    const extension = path.extname(filePath).trim().toLowerCase();
    if (!extension) {
        return null;
    }
    return mediaExtensions[extension] ?? null;
}
