import { describe, expect, it } from "vitest";
import { writeOutputFileNameResolve } from "./writeOutputFileNameResolve.js";

describe("writeOutputFileNameResolve", () => {
    it("returns base name when there is no collision", () => {
        const result = writeOutputFileNameResolve("notes", new Set<string>());
        expect(result).toBe("notes.md");
    });

    it("returns first suffix when base name exists", () => {
        const result = writeOutputFileNameResolve("notes", new Set<string>(["notes.md"]));
        expect(result).toBe("notes (1).md");
    });

    it("returns next free suffix after multiple collisions", () => {
        const result = writeOutputFileNameResolve(
            "notes",
            new Set<string>(["notes.md", "notes (1).md", "notes (2).md"])
        );
        expect(result).toBe("notes (3).md");
    });

    it("throws when no candidate is available in suffix range", () => {
        const collisions = new Set<string>();
        for (let index = 0; index <= 2; index += 1) {
            collisions.add(index === 0 ? "notes.md" : `notes (${index}).md`);
        }
        expect(() => writeOutputFileNameResolve("notes", collisions, "md", 2)).toThrow(
            "Could not resolve unique output"
        );
    });

    it("resolves json extension candidates", () => {
        const result = writeOutputFileNameResolve("notes", new Set<string>(), "json");
        expect(result).toBe("notes.json");
    });

    it("throws for unsupported extension", () => {
        expect(() => writeOutputFileNameResolve("notes", new Set<string>(), "txt")).toThrow(
            "Unsupported output extension"
        );
    });
});
