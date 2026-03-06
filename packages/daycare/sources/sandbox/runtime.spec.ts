import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { runInSandbox } from "./runtime.js";

describe("runInSandbox", () => {
    it("executes commands directly without an inner sandbox", async () => {
        const result = await runInSandbox("printf 'ok'", {}, {});
        expect(result.stdout).toBe("ok");
        expect(result.stderr).toBe("");
    });

    it("allows outbound network access by default", async () => {
        const result = await runInSandbox(`curl -s -I --max-time 10 "https://microsoft.com"`, {}, {});
        expect(result.stdout).toContain("HTTP/");
    });

    it("maps HOME when home option is provided", async () => {
        const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-runtime-home-"));
        try {
            const home = path.join(workspace, ".sandbox-home");
            const result = await runInSandbox("printf '%s' \"$HOME\"", {}, { home });
            expect(result.stdout).toBe(home);
        } finally {
            await fs.rm(workspace, { recursive: true, force: true });
        }
    });
});
