import { describe, expect, it } from "vitest";
import { mediaTypeDetect } from "./mediaTypeDetect.js";

describe("mediaTypeDetect", () => {
    it("maps supported file extensions", () => {
        const cases: Array<{ file: string; mediaType: string; mimeType: string }> = [
            { file: "image.png", mediaType: "image", mimeType: "image/png" },
            { file: "image.jpg", mediaType: "image", mimeType: "image/jpeg" },
            { file: "image.jpeg", mediaType: "image", mimeType: "image/jpeg" },
            { file: "image.gif", mediaType: "image", mimeType: "image/gif" },
            { file: "image.webp", mediaType: "image", mimeType: "image/webp" },
            { file: "image.bmp", mediaType: "image", mimeType: "image/bmp" },
            { file: "image.svg", mediaType: "image", mimeType: "image/svg+xml" },
            { file: "image.tiff", mediaType: "image", mimeType: "image/tiff" },
            { file: "image.avif", mediaType: "image", mimeType: "image/avif" },
            { file: "image.heic", mediaType: "image", mimeType: "image/heic" },
            { file: "video.mp4", mediaType: "video", mimeType: "video/mp4" },
            { file: "video.mov", mediaType: "video", mimeType: "video/quicktime" },
            { file: "video.avi", mediaType: "video", mimeType: "video/x-msvideo" },
            { file: "video.mkv", mediaType: "video", mimeType: "video/x-matroska" },
            { file: "video.webm", mediaType: "video", mimeType: "video/webm" },
            { file: "video.flv", mediaType: "video", mimeType: "video/x-flv" },
            { file: "audio.mp3", mediaType: "audio", mimeType: "audio/mpeg" },
            { file: "audio.wav", mediaType: "audio", mimeType: "audio/wav" },
            { file: "audio.ogg", mediaType: "audio", mimeType: "audio/ogg" },
            { file: "audio.flac", mediaType: "audio", mimeType: "audio/flac" },
            { file: "audio.m4a", mediaType: "audio", mimeType: "audio/mp4" },
            { file: "audio.aac", mediaType: "audio", mimeType: "audio/aac" },
            { file: "audio.wma", mediaType: "audio", mimeType: "audio/x-ms-wma" },
            { file: "doc.pdf", mediaType: "pdf", mimeType: "application/pdf" }
        ];

        for (const entry of cases) {
            expect(mediaTypeDetect(entry.file)).toEqual({
                mediaType: entry.mediaType,
                mimeType: entry.mimeType
            });
        }
    });

    it("supports uppercase extensions", () => {
        expect(mediaTypeDetect("PHOTO.JPG")).toEqual({
            mediaType: "image",
            mimeType: "image/jpeg"
        });
    });

    it("returns null for unknown extension", () => {
        expect(mediaTypeDetect("file.txt")).toBeNull();
        expect(mediaTypeDetect("file")).toBeNull();
    });
});
