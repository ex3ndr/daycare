import { describe, expect, it } from "vitest";

import { sayFileExtract } from "./sayFileExtract.js";

describe("sayFileExtract", () => {
    it("extracts file paths with default auto mode", () => {
        expect(sayFileExtract("<file>/tmp/a.txt</file>")).toEqual([{ path: "/tmp/a.txt", mode: "auto" }]);
    });

    it("maps doc/photo/video modes", () => {
        const text = [
            '<file mode="doc">/tmp/a.pdf</file>',
            '<file mode="photo">/tmp/b.png</file>',
            '<file mode="video">/tmp/c.mp4</file>'
        ].join(" ");

        expect(sayFileExtract(text)).toEqual([
            { path: "/tmp/a.pdf", mode: "document" },
            { path: "/tmp/b.png", mode: "photo" },
            { path: "/tmp/c.mp4", mode: "video" }
        ]);
    });

    it("falls back to auto for unknown mode", () => {
        expect(sayFileExtract('<file mode="weird">/tmp/a.txt</file>')).toEqual([{ path: "/tmp/a.txt", mode: "auto" }]);
    });

    it("skips empty file paths", () => {
        expect(sayFileExtract("<file>   </file>")).toEqual([]);
    });

    it("returns empty array when there are no file tags", () => {
        expect(sayFileExtract("<say>hello</say>")).toEqual([]);
    });
});
