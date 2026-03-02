import { describe, expect, it } from "vitest";

import { pathMountMapMappedToHost } from "./pathMountMapMappedToHost.js";

describe("pathMountMapMappedToHost", () => {
    const mountPoints = [
        { hostPath: "/host/home", mappedPath: "/home" },
        { hostPath: "/host/shared/skills", mappedPath: "/shared/skills" },
        { hostPath: "/host/shared/examples", mappedPath: "/shared/examples" }
    ];

    it("maps mapped root and nested paths into host paths", () => {
        expect(pathMountMapMappedToHost({ mountPoints, mappedPath: "/home" })).toBe("/host/home");
        expect(pathMountMapMappedToHost({ mountPoints, mappedPath: "/home/project/file.ts" })).toBe(
            "/host/home/project/file.ts"
        );
        expect(pathMountMapMappedToHost({ mountPoints, mappedPath: "/shared/examples/doc.md" })).toBe(
            "/host/shared/examples/doc.md"
        );
    });

    it("returns null for unmappable or relative mapped paths", () => {
        expect(pathMountMapMappedToHost({ mountPoints, mappedPath: "/tmp/file.txt" })).toBeNull();
        expect(pathMountMapMappedToHost({ mountPoints, mappedPath: "home/file.txt" })).toBeNull();
    });

    it("prefers the most specific overlapping mount point", () => {
        const overlapping = [
            { hostPath: "/host/base", mappedPath: "/shared" },
            { hostPath: "/host/skills", mappedPath: "/shared/skills" }
        ];
        expect(pathMountMapMappedToHost({ mountPoints: overlapping, mappedPath: "/shared/skills/a.md" })).toBe(
            "/host/skills/a.md"
        );
    });

    it("throws for invalid mount point configuration", () => {
        expect(() =>
            pathMountMapMappedToHost({
                mountPoints: [{ hostPath: "host/home", mappedPath: "/home" }],
                mappedPath: "/home/file.txt"
            })
        ).toThrow("Mount hostPath must be absolute:");

        expect(() =>
            pathMountMapMappedToHost({
                mountPoints: [{ hostPath: "/host/home", mappedPath: "home" }],
                mappedPath: "/home/file.txt"
            })
        ).toThrow("Mount mappedPath must be absolute POSIX path:");
    });
});
