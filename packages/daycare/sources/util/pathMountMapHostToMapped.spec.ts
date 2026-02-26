import { describe, expect, it } from "vitest";

import { pathMountMapHostToMapped } from "./pathMountMapHostToMapped.js";

describe("pathMountMapHostToMapped", () => {
    const mountPoints = [
        { hostPath: "/host/home", mappedPath: "/home" },
        { hostPath: "/host/shared/skills", mappedPath: "/shared/skills" },
        { hostPath: "/host/shared/examples", mappedPath: "/shared/examples" }
    ];

    it("maps host root and nested paths into mapped paths", () => {
        expect(pathMountMapHostToMapped({ mountPoints, hostPath: "/host/home" })).toBe("/home");
        expect(pathMountMapHostToMapped({ mountPoints, hostPath: "/host/home/project/file.ts" })).toBe(
            "/home/project/file.ts"
        );
        expect(pathMountMapHostToMapped({ mountPoints, hostPath: "/host/shared/skills/core/SKILL.md" })).toBe(
            "/shared/skills/core/SKILL.md"
        );
    });

    it("returns null for unmappable or relative host paths", () => {
        expect(pathMountMapHostToMapped({ mountPoints, hostPath: "/host/other/file.txt" })).toBeNull();
        expect(pathMountMapHostToMapped({ mountPoints, hostPath: "host/home/file.txt" })).toBeNull();
    });

    it("does not match lookalike prefixes", () => {
        const mounts = [{ hostPath: "/data/users/u123/home", mappedPath: "/home" }];
        expect(
            pathMountMapHostToMapped({ mountPoints: mounts, hostPath: "/data/users/u123/homework/notes.txt" })
        ).toBeNull();
    });

    it("prefers the most specific overlapping mount point", () => {
        const overlapping = [
            { hostPath: "/host", mappedPath: "/base" },
            { hostPath: "/host/home", mappedPath: "/home" }
        ];
        expect(pathMountMapHostToMapped({ mountPoints: overlapping, hostPath: "/host/home/file.txt" })).toBe(
            "/home/file.txt"
        );
    });

    it("throws for invalid mount point configuration", () => {
        expect(() =>
            pathMountMapHostToMapped({
                mountPoints: [{ hostPath: "host/home", mappedPath: "/home" }],
                hostPath: "/host/home/file.txt"
            })
        ).toThrow("Mount hostPath must be absolute:");

        expect(() =>
            pathMountMapHostToMapped({
                mountPoints: [{ hostPath: "/host/home", mappedPath: "home" }],
                hostPath: "/host/home/file.txt"
            })
        ).toThrow("Mount mappedPath must be absolute POSIX path:");
    });
});
