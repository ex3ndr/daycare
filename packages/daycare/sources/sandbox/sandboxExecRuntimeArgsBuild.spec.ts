import { describe, expect, it } from "vitest";

import { sandboxExecRuntimeArgsBuild } from "./sandboxExecRuntimeArgsBuild.js";

describe("sandboxExecRuntimeArgsBuild", () => {
    it("rewrites mounted env paths and cwd into sandbox paths", () => {
        const result = sandboxExecRuntimeArgsBuild({
            env: {
                HOME: "/host/home",
                XDG_CONFIG_HOME: "/host/home/.config",
                OTHER: "/outside"
            },
            cwd: "/host/home/project",
            mounts: [
                { hostPath: "/host/home", mappedPath: "/home" },
                { hostPath: "/host/skills", mappedPath: "/shared/skills" }
            ]
        });

        expect(result.cwd).toBe("/home/project");
        expect(result.env.HOME).toBe("/home");
        expect(result.env.XDG_CONFIG_HOME).toBe("/home/.config");
        expect(result.env.OTHER).toBe("/outside");
        expect(result.env.TMPDIR).toBe("/tmp");
        expect(result.env.TMP).toBe("/tmp");
        expect(result.env.TEMP).toBe("/tmp");
    });

    it("rejects cwd values outside declared mounts", () => {
        expect(() =>
            sandboxExecRuntimeArgsBuild({
                env: {},
                cwd: "/outside/project",
                mounts: [{ hostPath: "/host/home", mappedPath: "/home" }]
            })
        ).toThrow("Path is not mappable to sandbox mounts");
    });
});
