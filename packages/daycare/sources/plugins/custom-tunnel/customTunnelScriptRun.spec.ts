import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { customTunnelScriptRun } from "./customTunnelScriptRun.js";

describe("customTunnelScriptRun", () => {
    it("runs script and returns stdout", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-custom-tunnel-"));
        try {
            const scriptPath = path.join(dir, "expose.sh");
            await writeFile(scriptPath, '#!/bin/sh\necho "https://$1.example.com"\n', "utf8");
            await chmod(scriptPath, 0o755);

            const output = await customTunnelScriptRun(scriptPath, ["3000"]);
            expect(output).toBe("https://3000.example.com");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
