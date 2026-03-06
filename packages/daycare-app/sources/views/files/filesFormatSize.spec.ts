import { describe, expect, it } from "vitest";
import { filesFormatSize } from "./filesFormatSize";

describe("filesFormatSize", () => {
    it("formats bytes", () => {
        expect(filesFormatSize(0)).toBe("0 B");
        expect(filesFormatSize(512)).toBe("512 B");
    });

    it("formats kilobytes", () => {
        expect(filesFormatSize(1024)).toBe("1.0 KB");
        expect(filesFormatSize(1536)).toBe("1.5 KB");
    });

    it("formats megabytes", () => {
        expect(filesFormatSize(1024 * 1024)).toBe("1.0 MB");
        expect(filesFormatSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
    });

    it("formats gigabytes", () => {
        expect(filesFormatSize(1024 * 1024 * 1024)).toBe("1.0 GB");
    });
});
