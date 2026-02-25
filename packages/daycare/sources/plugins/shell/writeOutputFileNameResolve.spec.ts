import { describe, expect, it } from "vitest";
import { writeOutputFileNameResolve } from "./writeOutputFileNameResolve.js";

// Fixed timestamp for deterministic tests: 2025-06-15 10:30:45
const NOW = new Date(2025, 5, 15, 10, 30, 45).getTime();
const PREFIX = "20250615103045";

describe("writeOutputFileNameResolve", () => {
    it("returns date-prefixed name when there is no collision", () => {
        const result = writeOutputFileNameResolve("notes", new Set<string>(), "md", 99, NOW);
        expect(result).toBe(`${PREFIX}-notes.md`);
    });

    it("returns first suffix when base name exists", () => {
        const result = writeOutputFileNameResolve("notes", new Set<string>([`${PREFIX}-notes.md`]), "md", 99, NOW);
        expect(result).toBe(`${PREFIX}-notes-1.md`);
    });

    it("returns next free suffix after multiple collisions", () => {
        const result = writeOutputFileNameResolve(
            "notes",
            new Set<string>([`${PREFIX}-notes.md`, `${PREFIX}-notes-1.md`, `${PREFIX}-notes-2.md`]),
            "md",
            99,
            NOW
        );
        expect(result).toBe(`${PREFIX}-notes-3.md`);
    });

    it("throws when no candidate is available in suffix range", () => {
        const collisions = new Set<string>();
        for (let index = 0; index <= 2; index += 1) {
            collisions.add(index === 0 ? `${PREFIX}-notes.md` : `${PREFIX}-notes-${index}.md`);
        }
        expect(() => writeOutputFileNameResolve("notes", collisions, "md", 2, NOW)).toThrow(
            "Could not resolve unique output"
        );
    });

    it("resolves json extension candidates", () => {
        const result = writeOutputFileNameResolve("notes", new Set<string>(), "json", 99, NOW);
        expect(result).toBe(`${PREFIX}-notes.json`);
    });

    it("throws for unsupported extension", () => {
        expect(() => writeOutputFileNameResolve("notes", new Set<string>(), "txt", 99, NOW)).toThrow(
            "Unsupported output extension"
        );
    });

    it("uses current time when now is not provided", () => {
        const result = writeOutputFileNameResolve("notes", new Set<string>());
        // Should start with a 14-digit date prefix followed by dash
        expect(result).toMatch(/^\d{14}-notes\.md$/);
    });
});
